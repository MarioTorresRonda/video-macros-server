import ffmpeg from 'fluent-ffmpeg';
import fs from 'node:fs';
import path from 'node:path';

const camStates = {
    untouched: "-1",
    remove: "0",
    add: "1",
}

export default function configurateVideo(sourcePath, videoName, audioChannel, cam, callback, onProgress) {
    const inputFile = path.join(sourcePath, videoName);

    if (!fs.existsSync(inputFile)) {
        return callback(new Error(`Input file not found: ${inputFile}`));
    }

    if (!fs.existsSync(sourcePath)) {
        fs.mkdirSync(sourcePath, { recursive: true });
    }
    
    let suffix = "▼"
    let videoFilters = null; 
    
    switch (cam) {
        case camStates.untouched:
            suffix += "COM" 
            break;
        case camStates.remove:
            videoFilters = "crop=1920:1080:1:1"
            suffix += "NOCAM" 
            break;
        case camStates.add:
            suffix += "CAM" 
            break;
        default:
            return callback(new Error('Cam state not correct'));
    }

    if ( audioChannel != -1  ) {
        suffix += "_A"+audioChannel; 
    }

    const outputName = path.parse(videoName).name + suffix  + '.mp4';
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


        let command = ffmpeg(inputFile)
        .videoCodec('hevc_nvenc');

        if ( videoFilters ) {
            command = command.videoFilters(videoFilters)
        } 
        command = command.outputOptions([
            '-map 0:v:0',
            audioChannel == -1 ? '-map a:*' : `-map 0:a:${audioChannel}`,
            '-b:v 13M',          // Target bitrate (13,000 kbps)
            '-maxrate:v 15M',    // Allow small spikes for complex scenes
            '-bufsize:v 26M',    // Buffer size (typically 2x maxrate)
            '-preset p6'         // High quality encoding preset
        ]);

        command
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