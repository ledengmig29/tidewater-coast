import { Texture } from './engine/gpu/Texture.js';
import { readTexture } from './engine/gpu/Readback.js';
import { DAY_DURATION, SUNRISE_HOUR, daylightAt } from './DayCycle.js';

export const VIDEO_FPS = 30;
export const VIDEO_FRAMES = DAY_DURATION * VIDEO_FPS;
export const VIDEO_SIZE = { width: 1920, height: 1080 };

export async function exportDayVideo(app, onProgress, signal) {
  if (typeof VideoEncoder === 'undefined') throw new Error('当前浏览器无法编码 MP4，请使用支持 WebCodecs 的 Chrome 或 Edge。');
  const { Output, Mp4OutputFormat, BufferTarget, VideoSampleSource, VideoSample, Quality, canEncodeVideo } = await import('mediabunny');
  const config = { codec: 'avc', quality: new Quality({ bitrate: 8_000_000 }), latencyMode: 'quality' };
  if (!await canEncodeVideo('avc', { ...VIDEO_SIZE, ...config })) throw new Error('当前设备不支持 1080p H.264 编码。');

  const saved = { paused: app.paused, dayPlaying: app.dayPlaying, dayElapsed: app.dayElapsed, hour: app.settings.timeOfDay,
    view: app.view, scale: app.settings.renderScale,
    position: app.camera.position.clone(), yaw: app.fly.yaw, pitch: app.fly.pitch,
    flyEnabled: app.fly.enabled, inputEnabled: app.input.enabled,
    texture: app.post.outputTexture, size: app.post.outputSize };
  const texture = new Texture({ ...VIDEO_SIZE, format: app.post.outputFormat, usage: ['render', 'copySrc'], label: 'day-video' });
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  let packets = 0;
  const source = new VideoSampleSource({ ...config, onEncodedPacket: () => packets++ });
  output.addVideoTrack(source, { frameRate: VIDEO_FPS });
  const checkAbort = () => {
    signal?.throwIfAborted();
    if (document.hidden) throw new Error('导出已中止：请保持页面可见后重新导出。');
  };

  app.stop();
  try {
    checkAbort();
    app.paused = false;
    app.dayPlaying = false;
    app.input.enabled = app.fly.enabled = false;
    app.fly.velocity.set(0, 0, 0);
    app.camera.aspect = VIDEO_SIZE.width / VIDEO_SIZE.height;
    app.camera.updateProjectionMatrix();
    app.setView('shore');
    app.setRenderScale(1);
    app.post.outputTexture = texture;
    app.post.outputSize = VIDEO_SIZE;
    app.settings.timeOfDay = SUNRISE_HOUR;
    onProgress(0, '准备日出光照…');
    // Give the native atmospheric readback and temporal lighting time to settle.
    for (let i = 0; i < 18; i++) {
      checkAbort();
      app.frame(1 / VIDEO_FPS);
      await app.gpu.queue.onSubmittedWorkDone();
    }
    await output.start();
    for (let frame = 0; frame < VIDEO_FRAMES; frame++) {
      checkAbort();
      app.settings.timeOfDay = daylightAt(frame / (VIDEO_FRAMES - 1) * DAY_DURATION);
      app.frame(frame === 0 ? 0 : 1 / VIDEO_FPS);
      // Read the persistent postprocess target; canvas swap textures can clear
      // across asynchronous encoding. This is the actual rendered scene.
      const { data } = await readTexture(texture);
      const sample = new VideoSample(new Uint8Array(data), {
        format: texture.format.startsWith('bgra') ? 'BGRA' : 'RGBA',
        codedWidth: VIDEO_SIZE.width, codedHeight: VIDEO_SIZE.height,
        timestamp: frame / VIDEO_FPS, duration: 1 / VIDEO_FPS,
      });
      try { await source.add(sample); } finally { sample.close(); }
      if ((frame + 1) % 15 === 0 || frame === VIDEO_FRAMES - 1) {
        onProgress((frame + 1) / VIDEO_FRAMES, `制作视频 ${frame + 1} / ${VIDEO_FRAMES} 帧`);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    checkAbort();
    onProgress(1, '正在封装 MP4…');
    await output.finalize();
    checkAbort();
    if (packets !== VIDEO_FRAMES || !target.buffer?.byteLength) throw new Error(`视频帧数异常（${packets}），未提供不完整文件。`);
    return new Blob([target.buffer], { type: 'video/mp4' });
  } finally {
    try { if (output.state !== 'finalized') await output.cancel(); } finally {
      app.post.outputTexture = saved.texture;
      app.post.outputSize = saved.size;
      texture.destroy();
      app.setRenderScale(saved.scale);
      app.engine.resize();
      app.fly.setPose(saved.position, saved.yaw, saved.pitch);
      app.view = saved.view;
      app.input.enabled = saved.inputEnabled;
      app.input.endFrame();
      app.fly.enabled = saved.flyEnabled;
      app.paused = saved.paused;
      app.dayPlaying = saved.dayPlaying;
      app.dayElapsed = saved.dayElapsed;
      app.settings.timeOfDay = saved.hour;
      app.updateSun();
      app.post.taau._needsRestart = true;
    }
  }
}
