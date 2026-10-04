import './coast.css';
import { CoastalApp } from './tidewater/CoastalApp.js';

const $ = (id) => document.getElementById(id);
const controls = document.querySelectorAll('.toolbar button, [data-view]');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const app = new CoastalApp($('scene'));
let ready = false;
let activeView = 'shore';

function announce(text) { $('status').textContent = text; }

function syncPause() {
  $('pause').setAttribute('aria-pressed', String(app.paused));
  $('pause').setAttribute('aria-label', app.paused ? '继续海浪与动物' : '暂停海浪与动物');
  $('pause').querySelector('span').textContent = app.paused ? '继续' : '暂停';
}

function setSettings(open) {
  $('settings').hidden = !open;
  $('settings-toggle').setAttribute('aria-expanded', String(open));
  if (open) $('settings-close').focus({ preventScroll: true });
  else $('settings-toggle').focus({ preventScroll: true });
}

function updateTime() {
  const hour = Number($('daylight').value);
  app.settings.timeOfDay = hour;
  const minutes = Math.round(hour * 60);
  $('daylight-value').value = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  app.updateSun();
}

function selectView(name) {
  activeView = name;
  app.setView(name);
  for (const button of document.querySelectorAll('[data-view]')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === name));
  }
  announce(`已切换到${{ shore: '岸边', home: '木屋', shallows: '浅滩', overview: '俯瞰', waterline: '水线' }[name]}视角`);
}

function fail(error) {
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
  announce(app.paused ? '海浪与动物已暂停，仍可改变视角和光照' : '海浪与动物继续');
});
$('daylight').addEventListener('input', updateTime);
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
  $('daylight').value = '16.2';
  $('exposure').value = '0.55';
  $('exposure-value').value = '1.0×';
  app.settings.exposure = 0.55;
  $('waves').value = '1';
  $('waves-value').value = '1.0×';
  app.setWaveStrength(1);
  updateTime();
  announce('已恢复岸边视角与午后光照');
});
$('retry').addEventListener('click', () => location.reload());
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !$('settings').hidden) setSettings(false);
});
document.addEventListener('visibilitychange', () => {
  if (!ready) return;
  if (document.hidden) app.stop();
  else app.start();
});
window.addEventListener('pagehide', () => app.stop());

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
  app.setView('shore');
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
