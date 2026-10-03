import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'rollup/parseAst';

const root = fileURLToPath(new URL('../', import.meta.url));
const pending = ['src/coast-main.js', 'src/tidewater/CoastalApp.js'].map(file => resolve(root, file));
const modules = new Set(), assets = new Set();
let localImports = 0;

function* nodes(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type) yield node;
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const child of value) yield* nodes(child);
    else if (value && typeof value === 'object') yield* nodes(value);
  }
}

async function requireFile(file, context) {
  const info = await stat(file).catch(() => null);
  assert.ok(info?.isFile() && info.size > 0, `${context}: missing or empty ${relative(root, file)}`);
}

// Parse real syntax, so commented imports and shader text cannot hide missing modules.
while (pending.length) {
  const file = pending.pop();
  if (modules.has(file)) continue;
  await requireFile(file, 'Module');
  modules.add(file);
  if (!['.js', '.mjs'].includes(extname(file))) continue;
  const ast = [...nodes(parseAst(await readFile(file, 'utf8')))];
  for (const node of ast) {
    if (!['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type) || !node.source) continue;
    const source = node.source;
    const specifier = source.type === 'Literal' ? source.value
      : source.type === 'TemplateLiteral' && !source.expressions.length ? source.quasis[0].value.cooked : null;
    assert.equal(typeof specifier, 'string', `${relative(root, file)}: computed import needs explicit validation`);
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) continue;
    const path = specifier.split(/[?#]/)[0];
    pending.push(path.startsWith('/') ? resolve(root, path.slice(1)) : resolve(dirname(file), path));
    localImports++;
  }

  const strings = ast.flatMap(node => node.type === 'Literal' && typeof node.value === 'string' ? [node.value]
    : node.type === 'TemplateLiteral' && !node.expressions.length ? [node.quasis[0].value.cooked] : []);
  const directories = strings.filter(value => /^\/?[\w-]+\/[\w/-]*$/.test(value) && value.endsWith('/'));
  for (const value of strings) {
    if (!/^[\w./-]+\.(?:png|jpe?g|webp|avif|svg|bin|glb|gltf|mp3|ogg|wav|woff2?|json)$/i.test(value)) continue;
    // The two upstream loaders join a literal directory with literal filenames.
    // Keep this limited to assets in this module; it is not a JS interpreter.
    const candidates = value.includes('/') && !value.startsWith('.') ? [value]
      : !value.includes('/') ? directories.map(directory => directory + value) : [];
    if (!candidates.length) continue;
    const found = [];
    for (const candidate of candidates) {
      const path = resolve(root, 'public', candidate.replace(/^\//, ''));
      const info = await stat(path).catch(() => null);
      if (info?.isFile() && info.size > 0) found.push(path);
    }
    assert.ok(found.length, `${relative(root, file)}: missing asset ${candidates.join(' or ')}`);
    for (const path of found) assets.add(relative(root, path).replaceAll('\\', '/'));
  }
}

const { TerrainData } = await import('../src/tidewater/world/TerrainData.js');
const { computeShoreField } = await import('../src/tidewater/world/ShoreField.js');
const { Vector3 } = await import('../src/tidewater/engine/math/Vector3.js');
const terrain = new TerrainData();
assert.ok(terrain.heights.every(Number.isFinite), 'Terrain contains non-finite heights');
assert.ok(terrain.heights.every(height => height <= 3.184001), 'Rear mountains remain in the beach terrain');
assert.ok(terrain.sand.every(value => value === 255), 'Beach-only terrain lost sand cover');
for (const mask of [terrain.rock, terrain.path, terrain.gully, terrain.scarp, terrain.seagrass, terrain.rubble]) {
  assert.ok(mask.every(value => value === 0), 'Beach-only terrain retains rock or vegetation cover');
}
// Sea-level land area was 819,790 m² before resizing; the real footprint must halve.
const beachAreaM2 = terrain.heights.reduce((area, height) => area + (height > 0 ? terrain.texel ** 2 : 0), 0);
const beachAreaRatio = beachAreaM2 / 819790;
assert.ok(Math.abs(beachAreaRatio - 0.5) < 0.01, 'Beach footprint is not half its original area');
// The original coast heights survive at their scaled positions (two bilinear resamplings).
for (const [x, z, height] of [
  [-100, -55, 0.4188689589500427], [-20, -45, 0.2514282613992691],
  [0, -40, -0.023624965164344758], [70, -57, 0.8281079083681107],
  [120, -55, 0.23795964568853378], [-20, -20, -1.194947510957718],
  [0, 0, -1.962782472372055], [70, -25, -1.1507116854190826],
]) assert.ok(Math.abs(terrain.heightAt(10 + (x - 10) * Math.SQRT1_2, -42 + (z + 42) * Math.SQRT1_2) - height) < 0.02, 'Beach resizing lost the surf profile');
const bounds = terrain.boundsFor(-160, -140, 160, 120);
const normal = new Vector3();
let dry = 0, submerged = 0, terrainSamples = 0;
for (let z = -140; z <= 120; z += 10) for (let x = -160; x <= 160; x += 10) {
  const height = terrain.heightAt(x, z);
  assert.ok(Number.isFinite(height) && height >= bounds[0] && height <= bounds[1], 'Culling bounds exclude terrain');
  terrain.normalAt(x, z, normal);
  assert.ok(Number.isFinite(normal.length()) && Math.abs(normal.length() - 1) < 1e-6, 'Invalid terrain normal');
  if (height > 0) dry++;
  if (height < 0) submerged++;
  terrainSamples++;
}
assert.ok(dry > 0 && submerged > 0, 'The beach must meet the sea');

const shore = computeShoreField(terrain, { res: 64 });
assert.equal(shore.data.length, shore.res * shore.res * 4);
assert.ok(shore.data.every(Number.isFinite) && shore.depth.every(Number.isFinite), 'Invalid shoreline propagation field');
assert.ok(shore.depth.some(depth => depth > 0) && shore.depth.some(depth => depth < 0), 'Shore field lost its land/water boundary');
for (let i = 0; i < shore.data.length; i += 4) {
  assert.ok(Math.hypot(shore.data[i + 1], shore.data[i + 2]) <= 1 + 1e-6, 'Wave exposure exceeds unity');
}

// Uploading a texture may release its CPU buffer; the shore direction bake still needs it.
const { TerrainGPU } = await import('../src/tidewater/world/TerrainGPU.js');
const { ShoreWaves } = await import('../src/tidewater/ocean/ShoreWaves.js');
const { Vector2 } = await import('../src/tidewater/engine/math/Vector2.js');
const uploadedTerrain = { origin: terrain.origin, size: terrain.size,
  shoreTexture: { width: shore.res, upload() {} }, uniforms: { fields: { shoreRes: { value: 0 } } } };
TerrainGPU.prototype.setShoreField.call(uploadedTerrain, shore);
assert.equal(uploadedTerrain.shoreField, shore, 'Texture upload lost the CPU shoreline field');
const shoreWaves = { terrain: uploadedTerrain, dirMin: { value: new Vector2() }, dirSize: { value: 0 },
  uniforms: { fields: { dirOn: { value: 0 } } } };
const directions = ShoreWaves.prototype.buildDirTexture.call(shoreWaves, { min: new Vector2(-190, -215), size: 380, res: 8 });
assert.equal(directions?.pendingData?.length, 8 * 8 * 4, 'Shoreline direction bake failed after upload');
assert.ok(directions.pendingData.every(Number.isFinite), 'Invalid shoreline direction texture');
assert.equal(shoreWaves.uniforms.fields.dirOn.value, 1, 'Shoreline direction texture is disabled');

// A constant-depth ocean must carry a plane wave forward at sqrt(g * depth).
const depth = 25, size = 64, res = 32;
const plane = computeShoreField({ size, origin: -size / 2, heightAt: () => -depth }, { res, maxDepth: depth });
for (let j = 4; j < res - 4; j++) {
  const z = -size / 2 + (j + 0.5) * plane.cellSize;
  const i = (j * res + res / 2) * 4;
  assert.ok(Math.abs(plane.data[i] - (size - z / Math.sqrt(9.81 * depth))) < 1e-3, 'Plane-wave travel time is incorrect');
  assert.ok(Math.abs(plane.data[i + 1]) < 1e-3 && plane.data[i + 2] < -0.99, 'Plane wave travels in the wrong direction');
}

console.log(JSON.stringify({ status: 'passed', modules: modules.size, localImports, assets: [...assets].sort(),
  terrainSamples, beachAreaM2, beachAreaRatio, shorelineCells: shore.res ** 2, shoreDirectionCells: 64,
  limitation: 'CPU and asset checks only; WebGPU rendering requires a compatible browser.' }, null, 2));
