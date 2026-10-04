import './coast.css';
import { CoastalApp } from './tidewater/CoastalApp.js';
import { SUNRISE_HOUR, SUNSET_HOUR } from './tidewater/DayCycle.js';
import { exportDayVideo } from './tidewater/exportDayVideo.js';

const $ = (id) => document.getElementById(id);
const controls = document.querySelectorAll('.toolbar button, [data-view], #replay-day');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const app = new CoastalApp($('scene'));
let ready = false;
let activeView = 'shore';
let exporting = false, exportAbort, videoUrl;

function announce(text) { $('status').textContent = text; }

function syncPause() {
  $('pause').setAttribute('aria-pressed', String(app.paused));
  $('pause').setAttribute('aria-label', app.paused ? '继续海浪、日光与动物' : '暂停海浪、日光与动物');
  $('pause').querySelector('span').textContent = app.paused ? '继续' : '暂停';
}

function setSettings(open) {
  $('settings').hidden = !open;
  $('settings-toggle').setAttribute('aria-expanded', String(open));
  if (open) $('settings-close').focus({ preventScroll: true });
  else $('settings-toggle').focus({ preventScroll: true });
}

function syncTime() {
  const hour = app.settings.timeOfDay;
  $('daylight').value = String(hour);
  const minutes = Math.round(hour * 60);
  $('daylight-value').value = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function updateTime() {
  app.dayPlaying = false;
  app.settings.timeOfDay = Number($('daylight').value);
  app.updateSun();
  syncTime();
}
app.onFrame = syncTime;

function selectView(name) {
  activeView = name;
  app.setView(name);
  for (const button of document.querySelectorAll('[data-view]')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === name));
  }
  announce(`已切换到${{ shore: '岸边', home: '木屋', shallows: '浅滩', overview: '俯瞰', waterline: '水线' }[name]}视角`);
}

function fail(error) {
  exportAbort?.abort(error);
  app.stop();
  ready = false;
  document.documentElement.dataset.coastState = 'error';
  $('loading').hidden = true;
  $('error').hidden = false;
  const message = String(error?.message || error);
  $('error-message').textContent = /WebGPU|adapter|GPUDevice|requestDevice/i.test(message)
    ? '浏览器未能启用 WebGPU。请使用支持 WebGPU 的 Chrome 或 Edge，开启浏览器硬件加速后重新加载。'
    : `海岸加载遇到了问题，请重新加载。${message}`;
  controls.forEach((button) => { button.disabled = true; });
  console.error('[Coast]', error);
}

$('settings-toggle').addEventListener('click', () => setSettings($('settings').hidden));
$('settings-close').addEventListener('click', () => setSettings(false));
$('pause').addEventListener('click', () => {
  app.paused = !app.paused;
  syncPause();
  announce(app.paused ? '海浪、日光与动物已暂停，仍可改变视角和光照' : '海浪、日光与动物继续');
});
$('daylight').addEventListener('input', updateTime);
$('replay-day').addEventListener('click', () => {
  app.restartDayCycle();
  app.paused = false;
  syncPause();
  syncTime();
  announce('开始播放 30 秒日出到日落');
});
$('export-video').addEventListener('click', async () => {
  if (!ready || exporting) return;
  if ($('settings').hidden) setSettings(true);
  exporting = true;
  exportAbort = new AbortController();
  const disabled = [...document.querySelectorAll('.toolbar button, [data-view], .settings button, .settings input, .settings select')]
    .map(control => [control, control.disabled]);
  disabled.forEach(([control]) => { control.disabled = true; });
  $('export-progress').hidden = false;
  $('export-status').textContent = '准备制作 30 秒视频…';
  document.documentElement.dataset.exporting = 'true';
  const interrupt = () => {
    if (document.hidden) exportAbort.abort(new Error('导出已中止：请保持页面可见后重新导出。'));
  };
  const resize = () => exportAbort.abort(new Error('导出已中止：窗口尺寸改变，请重新导出。'));
  document.addEventListener('visibilitychange', interrupt);
  window.addEventListener('resize', resize);
  try {
    const blob = await exportDayVideo(app, (progress, text) => {
      $('export-progress').value = progress;
      $('export-status').textContent = text;
      $('export-video').querySelector('span').textContent = `${Math.round(progress * 100)}%`;
    }, exportAbort.signal);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    videoUrl = URL.createObjectURL(blob);
    const download = $('export-download');
    download.href = videoUrl;
    download.download = 'coast-sunrise-to-sunset-30s.mp4';
    download.hidden = false;
    download.click();
    $('export-status').textContent = '视频已生成：30 秒 · 1080p · 30 fps';
    announce('日出到日落视频已生成并开始下载。设置中也可再次下载。');
  } catch (error) {
    $('export-status').textContent = `未生成视频：${error.message}`;
    announce($('export-status').textContent);
  } finally {
    document.removeEventListener('visibilitychange', interrupt);
    window.removeEventListener('resize', resize);
    exporting = false;
    exportAbort = null;
    delete document.documentElement.dataset.exporting;
    $('export-progress').hidden = true;
    $('export-video').querySelector('span').textContent = '导出 30s';
    if (ready) disabled.forEach(([control, wasDisabled]) => { control.disabled = wasDisabled; });
    syncPause();
    syncTime();
    if (ready && !document.hidden) app.start();
  }
});
$('waves').addEventListener('input', () => {
  const strength = Number($('waves').value);
  app.setWaveStrength(strength);
  $('waves-value').value = `${strength.toFixed(1)}×`;
});
$('exposure').addEventListener('input', () => {
  app.settings.exposure = Number($('exposure').value);
  $('exposure-value').value = `${(app.settings.exposure / 0.55).toFixed(1)}×`;
});
$('quality').addEventListener('change', () => app.setRenderScale(Number($('quality').value)));
document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => selectView(button.dataset.view));
});
$('reset').addEventListener('click', () => {
  selectView('shore');
  $('exposure').value = '0.55';
  $('exposure-value').value = '1.0×';
  app.settings.exposure = 0.55;
  $('waves').value = '1';
  $('waves-value').value = '1.0×';
  app.setWaveStrength(1);
  app.restartDayCycle();
  syncTime();
  announce('已恢复岸边视角与日出光照，30 秒推进到日落');
});
$('retry').addEventListener('click', () => location.reload());
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !$('settings').hidden) setSettings(false);
});
document.addEventListener('visibilitychange', () => {
  if (!ready || exporting) return;
  if (document.hidden) app.stop();
  else app.start();
});
window.addEventListener('pagehide', () => {
  exportAbort?.abort(new Error('页面已离开，导出中止。'));
  app.stop();
  if (videoUrl) URL.revokeObjectURL(videoUrl);
});

window.__coast = { app, get ready() { return ready; }, get view() { return activeView; } };

document.documentElement.dataset.coastState = 'loading';
try {
  await app.init((progress, text) => {
    const p = Math.max(0, Math.min(1, progress));
    $('load-progress').value = p;
    $('load-percent').value = `${Math.round(p * 100)}%`;
    $('load-stage').textContent = text;
  });
  app.gpu.device.lost.then((info) => fail(new Error(`WebGPU device lost: ${info.message}`)));
  app.paused = reducedMotion.matches;
  app.restartDayCycle();
  app.setView('shore');
  $('daylight').min = String(SUNRISE_HOUR);
  $('daylight').max = String(SUNSET_HOUR);
  syncTime();
  syncPause();
  $('quality').value = String(app.settings.renderScale);
  app.start();
  ready = true;
  document.documentElement.dataset.coastState = 'ready';
  controls.forEach((button) => { button.disabled = false; });
  $('loading').classList.add('is-ready');
  setTimeout(() => { $('loading').hidden = true; }, reducedMotion.matches ? 0 : 450);
  announce(reducedMotion.matches ? '海岸已就绪。已根据减少动态偏好暂停海浪与动物。' : '海岸已就绪。拖动环顾，或选择观看位置。');
} catch (error) {
  fail(error);
}
