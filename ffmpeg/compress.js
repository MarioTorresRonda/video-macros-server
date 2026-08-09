import ffmpeg from 'fluent-ffmpeg';
import fs from 'node:fs';
import path from 'node:path';

export default function compressVideo(sourcePath, videoName, destPath, callback, onProgress) {
    const inputFile = path.join(sourcePath, videoName);

    if (!fs.existsSync(inputFile)) {
        return callback(new Error(`Input file not found: ${inputFile}`));
    }

    if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
    }

    const outputName = path.parse(videoName).name + '.mp4';
    const outputFile = path.join(destPath, outputName);

    // Inspect the source first so we know how many audio streams to map/convert.
    ffmpeg.ffprobe(inputFile, (probeErr, metadata) => {
        if (probeErr) {
            return callback(new Error(`ffprobe failed: ${probeErr.message}`));
        }

        const audioStreams = metadata.streams.filter((s) => s.codec_type === 'audio');
        const videoStreams = metadata.streams.filter((s) => s.codec_type === 'video');

        if (videoStreams.length === 0) {
            return callback(new Error('No video stream found in source file'));
        }

        const command = ffmpeg(inputFile)
            .inputOptions([
                '-hwaccel cuda',
                '-hwaccel_output_format cuda',
            ])
            .videoCodec('h264_nvenc')
            .outputOptions([
                '-map 0:v:0',
            ]);

        // Map + transcode every audio stream individually to Opus.
        audioStreams.forEach((_stream, i) => {
            command.outputOptions([`-map 0:a:${i}`]);
        });

        command.outputOptions([
            // --- Video: NVENC, ~3000kbps target with a sane ceiling for quality/bitrate balance ---
            '-preset p5',       // NVENC preset: p1 (fastest/lowest quality) .. p7 (slowest/best quality)
            '-rc vbr',           // variable bitrate so quality doesn't tank on complex scenes
            '-b:v 3000k',
            '-maxrate 3500k',
            '-bufsize 6000k',
            '-cq 23',            // lower = better quality (typical usable range ~19-28)

            // --- Container / faststart for streaming-friendly mp4 ---
            '-movflags +faststart',
        ]);

        // Per-stream audio codec/bitrate options (has to be indexed per output audio stream).
        audioStreams.forEach((_stream, i) => {
            command.outputOptions([
                `-c:a:${i} libopus`,
                `-b:a:${i} 128k`,
                `-vbr:a:${i} on`,
            ]);
        });

        command
            .format('mp4')
            .on('start', (cmdLine) => {
                console.log(`[compressVideo] started: ${videoName}`);
                console.log(`[compressVideo] ffmpeg command: ${cmdLine}`);
            })
            .on('progress', (progress) => {
                if (typeof onProgress === 'function') {
                    onProgress(progress);
                } else {
                    const pct = progress.percent ? progress.percent.toFixed(1) : '?';
                    console.log(`[compressVideo] ${videoName}: ${pct}%`);
                }
            })
            .on('stderr', (line) => {
                // Useful for debugging NVENC/CUDA init failures; comment out if too noisy.
                // console.log(`[ffmpeg] ${line}`);
            })
            .on('error', (err, _stdout, stderr) => {
                console.error(`[compressVideo] failed on ${videoName}: ${err.message}`);
                callback(new Error(`${err.message}\n${stderr || ''}`));
            })
            .on('end', () => {
                console.log(`[compressVideo] finished: ${outputFile}`);
                callback(null, outputFile);
            })
            .save(outputFile);
    });
}