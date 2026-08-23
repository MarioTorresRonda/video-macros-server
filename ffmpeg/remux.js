import ffmpeg from 'fluent-ffmpeg';
import fs from 'node:fs';
import path from 'node:path';

export default function remuxVideo(sourcePath, videoName, callback, onProgress) {
    const inputFile = path.join(sourcePath, videoName);

    if (!fs.existsSync(inputFile)) {
        return callback(new Error(`Input file not found: ${inputFile}`));
    }
    const outputName = path.parse(videoName).name + '.mp4';
    const outputFile = path.join(sourcePath, outputName);

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

        const audioStreamsMetadata =  []
        audioStreams.forEach( (stream, index) => {
            audioStreamsMetadata.push(`-metadata:s:a:${index} title="${stream.tags.title}"`)
            audioStreamsMetadata.push(`-metadata:s:a:${index} handler_name="${stream.tags.title}"`)
            audioStreamsMetadata.push(`-metadata:s:a:${index} language="${stream.tags.title}"`)
        });
        console.log( audioStreamsMetadata );

        const command = ffmpeg(inputFile)
            .videoCodec('hevc_nvenc')
            .outputOptions([
                '-map 0',
                '-c copy',
                '-movflags use_metadata_tags',
                ...audioStreamsMetadata
            ]);

        command
            .format('mp4')
            .on('start', (cmdLine) => {
                console.log(`[remuxVideo] started: ${videoName}`);
                console.log(`[remuxVideo] ffmpeg command: ${cmdLine}`);
            })
            .on('progress', (progress) => {
                if (typeof onProgress === 'function') {
                    onProgress(progress);
                } else {
                    const pct = progress.percent ? progress.percent.toFixed(1) : '?';
                    console.log(`[remuxVideo] ${videoName}: ${pct}%`);
                }
            })
            .on('stderr', (line) => {
                // Useful for debugging NVENC/CUDA init failures; comment out if too noisy.
                // console.log(`[ffmpeg] ${line}`);
            })
            .on('error', (err, _stdout, stderr) => {
                console.error(`[remuxVideo] failed on ${videoName}: ${err.message}`);
                callback(new Error(`${err.message}\n${stderr || ''}`));
            })
            .on('end', () => {
                console.log(`[remuxVideo] finished: ${outputFile}`);
                callback(null, outputFile);
            })
            .save(outputFile);
    });
}