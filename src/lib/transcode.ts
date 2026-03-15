import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

export const loadFFmpeg = async () => {
  if (ffmpeg) return ffmpeg;
  ffmpeg = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  return ffmpeg;
};

export const transcodeVideoToAV1 = async (file: File, resolution: '720p' | '1080p' | 'original'): Promise<Blob> => {
  if (resolution === 'original') {
    return file;
  }

  const ffmpeg = await loadFFmpeg();
  const inputName = 'input_' + file.name;
  const outputName = 'output.mp4';
  
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  
  const scale = resolution === '720p' ? 'scale=-2:720' : 'scale=-2:1080';
  
  await ffmpeg.exec([
    '-i', inputName,
    '-map_metadata', '-1',
    '-vf', scale,
    '-c:v', 'libaom-av1',
    '-crf', '30',
    '-b:v', '0',
    '-strict', 'experimental',
    outputName
  ]);
  
  try {
    const data = await ffmpeg.readFile(outputName);
    return new Blob([data], { type: 'video/mp4' });
  } catch (e) {
    throw new Error('Failed to transcode video to AV1. Fallback to original.');
  }
};
