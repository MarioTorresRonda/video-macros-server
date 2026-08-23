
import fs from 'node:fs'
import path from 'node:path';
import os from 'node:os'
import crypto from 'crypto'
import ffmpeg from 'fluent-ffmpeg';

export function mergeVideos(dirPath, videoList, outputFile, callback, onProgress) {
  if (!Array.isArray(videoList) || videoList.length < 2) {
    return callback(new Error('videoList must be an array with at least 2 file names'));
  }

  const inputFiles = videoList.map((name) => path.join(dirPath, name));

  for (const file of inputFiles) {
    if (!fs.existsSync(file)) {
      return callback(new Error(`Input file not found: ${file}`));
    }
  }

  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Sanity-check that codecs match across all files before we even try —
  // gives a much clearer error than ffmpeg's raw concat failure message.
  probeAll(inputFiles)
    .then((probes) => {
      const mismatch = findCodecMismatch(probes, inputFiles);
      if (mismatch) {
        return callback(new Error(
          `Cannot merge without re-encoding: ${mismatch}. ` +
          `All files must share identical video/audio codecs and stream layout for stream-copy concat.`
        ));
      }

      const totalDuration = probes.reduce(
        (sum, p) => sum + (parseFloat(p.format.duration) || 0),
        0
      );

      runConcat(inputFiles, outputFile, totalDuration, callback, onProgress);
    })
    .catch((err) => callback(new Error(`ffprobe failed: ${err.message}`)));
}

function probeAll(files) {
  return Promise.all(
    files.map(
      (file) =>
        new Promise((resolve, reject) => {
          ffmpeg.ffprobe(file, (err, metadata) => {
            if (err) return reject(err);
            resolve(metadata);
          });
        })
    )
  );
}

function findCodecMismatch(probes, files) {
  const ref = summarizeStreams(probes[0]);

  for (let i = 1; i < probes.length; i++) {
    const cur = summarizeStreams(probes[i]);

    if (cur.videoCodec !== ref.videoCodec || cur.width !== ref.width || cur.height !== ref.height) {
      return `"${path.basename(files[i])}" video stream (${cur.videoCodec} ${cur.width}x${cur.height}) ` +
        `doesn't match "${path.basename(files[0])}" (${ref.videoCodec} ${ref.width}x${ref.height})`;
    }

    if (cur.audioCount !== ref.audioCount) {
      return `"${path.basename(files[i])}" has ${cur.audioCount} audio stream(s), ` +
        `"${path.basename(files[0])}" has ${ref.audioCount}`;
    }

    for (let a = 0; a < cur.audioCodecs.length; a++) {
      if (cur.audioCodecs[a] !== ref.audioCodecs[a]) {
        return `"${path.basename(files[i])}" audio stream ${a} codec (${cur.audioCodecs[a]}) ` +
          `doesn't match "${path.basename(files[0])}" (${ref.audioCodecs[a]})`;
      }
    }
  }

  return null;
}

function summarizeStreams(metadata) {
  const video = metadata.streams.find((s) => s.codec_type === 'video') || {};
  const audioStreams = metadata.streams.filter((s) => s.codec_type === 'audio');

  return {
    videoCodec: video.codec_name,
    width: video.width,
    height: video.height,
    audioCount: audioStreams.length,
    audioCodecs: audioStreams.map((s) => s.codec_name),
  };
}

// Converts ffmpeg's "HH:MM:SS.ms" timemark into total seconds.
function timemarkToSeconds(timemark) {
  if (!timemark) return 0;
  const parts = timemark.split(':');
  const seconds = parseFloat(parts.pop()) || 0;
  const minutes = parseInt(parts.pop() || '0', 10);
  const hours = parseInt(parts.pop() || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

function runConcat(inputFiles, outputFile, totalDuration, callback, onProgress) {
  // Build a temp concat list file, e.g.:
  //   file '/abs/path/part1.mp4'
  //   file '/abs/path/part2.mp4'
  const listPath = path.join(
    os.tmpdir(),
    `concat-${crypto.randomBytes(6).toString('hex')}.txt`
  );

  const listContent = inputFiles
    .map((file) => `file '${file.replace(/'/g, "'\\''")}'`)
    .join('\n');

  fs.writeFileSync(listPath, listContent);

  const cleanup = () => {
    fs.unlink(listPath, () => {});
  };

  ffmpeg()
    .input(listPath)
    .inputOptions(['-f concat', '-safe 0'])
    .outputOptions(['-map 0:v', '-map 0:a:0', "-c copy"])
    .on('start', (cmdLine) => {
      console.log(`[mergeVideos] started -> ${outputFile}`);
      console.log(`[mergeVideos] ffmpeg command: ${cmdLine}`);
    })
    .on('progress', (progress) => {
      // fluent-ffmpeg can't derive percent on its own here (input is a concat
      // list, not a probeable media file), so we calculate it ourselves from
      // the elapsed timemark vs. the total duration we summed up beforehand.
      const elapsedSeconds = timemarkToSeconds(progress.timemark);
      const percent = totalDuration > 0
        ? Math.min(100, (elapsedSeconds / totalDuration) * 100)
        : null;

      const enrichedProgress = { ...progress, percent };

      if (typeof onProgress === 'function') {
        onProgress(enrichedProgress);
      } else {
        const pct = percent !== null ? percent.toFixed(1) : '?';
        console.log(`[mergeVideos] ${path.basename(outputFile)}: ${pct}%`);
      }
    })
    .on('error', (err, _stdout, stderr) => {
      cleanup();
      console.error(`[mergeVideos] failed: ${err.message}`);
      callback(new Error(`${err.message}\n${stderr || ''}`));
    })
    .on('end', () => {
      cleanup();
      console.log(`[mergeVideos] finished: ${outputFile}`);
      callback(null, outputFile);
    })
    .save(outputFile);
}