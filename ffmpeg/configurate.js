import ffmpeg from 'fluent-ffmpeg';
import fs from 'node:fs';
import path from 'node:path';

export default function configurateVideo(sourcePath, videoName, audioChannel, callback, onProgress) {
    const inputFile = path.join(sourcePath, videoName);

    if (!fs.existsSync(inputFile)) {
        return callback(new Error(`Input file not found: ${inputFile}`));
    }

    if (!fs.existsSync(sourcePath)) {
        fs.mkdirSync(sourcePath, { recursive: true });
    }

    const outputName = path.parse(videoName).name + '_COM.mkv';
    const outputFile = path.join(sourcePath, outputName);

    // Inspect the source first so we know how many audio streams to map/convert.
    ffmpeg.ffprobe(inputFile, (probeErr, metadata) => {
        if (probeErr) {
            return callback(new Error(`ffprobe failed: ${probeErr.message}`));
        }

        const audioStreams = metadata.streams.filter((s) => s.codec_type === 'audio');
        if ( audioChannel > audioStreams.length ) {
            return callback(new Error(`No audio stream {${audioChannel}} found in source file`));
        }
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
                '-c copy',
                '-map 0:v:0',
            ]);

        // Map + transcode every audio stream individually to Opus.
        command.audioFilters('c0=c'+audioChannel)

        command
            .format('mp4')
            .on('start', (cmdLine) => {
                console.log(`[configurateVideo] started: ${videoName}`);
                console.log(`[configurateVideo] ffmpeg command: ${cmdLine}`);
            })
            .on('progress', (progress) => {
                if (typeof onProgress === 'function') {
                    onProgress(progress);
                } else {
                    const pct = progress.percent ? progress.percent.toFixed(1) : '?';
                    console.log(`[configurateVideo] ${videoName}: ${pct}%`);
                }
            })
            .on('stderr', (line) => {
                // Useful for debugging NVENC/CUDA init failures; comment out if too noisy.
                // console.log(`[ffmpeg] ${line}`);
            })
            .on('error', (err, _stdout, stderr) => {
                console.error(`[configurateVideo] failed on ${videoName}: ${err.message}`);
                callback(new Error(`${err.message}\n${stderr || ''}`));
            })
            .on('end', () => {
                console.log(`[configurateVideo] finished: ${outputFile}`);
                callback(null, outputFile);
            })
            .save(outputFile);
    });
}