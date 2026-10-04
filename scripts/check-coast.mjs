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
assert.ok(terrain.heights.every(height => height <= 0.7), 'Beach terrain has become a high mound');
assert.ok(terrain.sand.every(value => value === 255), 'Beach-only terrain lost sand cover');
for (const mask of [terrain.rock, terrain.path, terrain.gully, terrain.scarp, terrain.seagrass, terrain.rubble]) {
  assert.ok(mask.every(value => value === 0), 'Beach-only terrain retains rock or vegetation cover');
}
// Only the house-sized island may remain above sea level anywhere in the map.
// Union of the two actual floor slabs: their 0.25 m overlap counts only once.
const houseFootprintM2 = 10.8 * 8.5 + 11 * 3 - 10.8 * 0.25;
let rasterDryAreaM2 = 0, maxTerrainHeight = -Infinity;
for (let i = 0; i < terrain.heights.length; i++) {
  if (terrain.heights[i] <= 0) continue;
  rasterDryAreaM2 += terrain.texel ** 2;
  maxTerrainHeight = Math.max(maxTerrainHeight, terrain.heights[i]);
  const x = terrain.origin + (i % terrain.res + 0.5) * terrain.texel;
  const z = terrain.origin + (Math.floor(i / terrain.res) + 0.5) * terrain.texel;
  assert.ok(Math.hypot(x - 28, z + 75) < 20, 'Land remains away from the house');
  assert.ok(x > 13 && x < 43 && z > -89 && z < -57, 'Dry land is outside the continuous-area sampling bounds');
}
// The rendered sea-level boundary follows bilinear heightAt, rather than the
// count of positive one-metre texels. Integrate that actual boundary at 0.125 m.
let beachAreaM2 = 0;
const areaStep = 0.125;
for (let z = -90 + areaStep / 2; z < -56; z += areaStep) {
  for (let x = 12 + areaStep / 2; x < 44; x += areaStep) {
    if (terrain.heightAt(x, z) > 0) beachAreaM2 += areaStep ** 2;
  }
}
const visibleSandM2 = beachAreaM2 - houseFootprintM2;
const visibleSandRatio = visibleSandM2 / houseFootprintM2;
assert.ok(Math.abs(visibleSandRatio - 2) <= 0.05, 'Exposed dry sand must be about twice the house and porch footprint');
const bounds = terrain.boundsFor(3, -100, 53, -50);
const normal = new Vector3();
let dry = 0, submerged = 0, terrainSamples = 0;
for (let z = -100; z <= -50; z += 2.5) for (let x = 3; x <= 53; x += 2.5) {
  const height = terrain.heightAt(x, z);
  assert.ok(Number.isFinite(height) && height >= bounds[0] && height <= bounds[1], 'Culling bounds exclude terrain');
  terrain.normalAt(x, z, normal);
  assert.ok(Number.isFinite(normal.length()) && Math.abs(normal.length() - 1) < 1e-6, 'Invalid terrain normal');
  if (height > 0) dry++;
  if (height < 0) submerged++;
  terrainSamples++;
}
assert.ok(dry > 0 && submerged > 0, 'The beach must meet the sea');
// Measure the actual bilinear CPU surface, including its shallow-water join.
// A low peak alone is insufficient if the shoreline still forms a steep wall.
let maxShoreSlope = 0;
for (let z = -90; z <= -58; z += 0.5) for (let x = 13; x <= 43; x += 0.5) {
  if (terrain.heightAt(x, z) < -0.25) continue;
  const dx = terrain.heightAt(x + 0.5, z) - terrain.heightAt(x - 0.5, z);
  const dz = terrain.heightAt(x, z + 0.5) - terrain.heightAt(x, z - 0.5);
  maxShoreSlope = Math.max(maxShoreSlope, Math.hypot(dx, dz));
}
assert.ok(maxShoreSlope <= 0.3, 'The low beach still has an excessively steep shoreline');

// Build the same native geometry used by the viewer: malformed merged meshes
// or a foundation off the dry sand should fail without starting a GPU/server.
const { createBeachHouse } = await import('../src/tidewater/world/BeachHouse.js');
const { Box3 } = await import('../src/tidewater/engine/math/Box3.js');
const house = createBeachHouse(terrain);
house.updateMatrixWorld(true);
function checkGeometry(group, label, maxMeshes) {
  let meshes = 0, vertices = 0;
  group.traverse(object => {
    if (!object.isMesh) return;
    meshes++;
    const position = object.geometry.getAttribute('position');
    const normals = object.geometry.getAttribute('normal');
    assert.ok(position?.count > 0 && position.array.every(Number.isFinite), `${label} contains invalid positions`);
    assert.ok(normals?.count === position.count && normals.array.every(Number.isFinite), `${label} contains invalid normals`);
    const index = object.geometry.getIndex();
    assert.ok(!index || index.array.every(value => value >= 0 && value < position.count), `${label} index exceeds its vertex buffer`);
    vertices += position.count;
  });
  assert.ok(meshes > 0 && meshes <= maxMeshes, `${label} exceeds its batched mesh budget`);
  return { meshes, vertices };
}
const { meshes: houseMeshes, vertices: houseVertices } = checkGeometry(house, 'House', 25);
const houseBounds = new Box3().setFromObject(house, true);
const houseSize = houseBounds.getSize(new Vector3());
assert.ok(houseSize.y > 7 && houseSize.y < 25 && houseSize.x > 8 && houseSize.x < 35 && houseSize.z > 8 && houseSize.z < 35, 'House dimensions do not describe a complete two-story beach home');
const houseData = house.userData.house;
const timber = house.children.find(object => object.name === 'house-weathered-timber');
const timberPosition = timber?.geometry.getAttribute('position');
const housePoint = new Vector3();
assert.ok(houseData?.footings.length >= 6 && timberPosition, 'House foundation is missing');
for (const footing of houseData.footings) {
  const ground = terrain.heightAt(footing.x, footing.z);
  assert.ok(ground > 0.25 && houseData.floorY - ground >= 0.5, 'House floor or foundation enters the surf zone');
  let touchesSand = false;
  for (let i = 0; i < timberPosition.count; i++) {
    housePoint.fromBufferAttribute(timberPosition, i).applyMatrix4(timber.matrixWorld);
    if (Math.abs(housePoint.x - footing.x) < 0.16 && Math.abs(housePoint.z - footing.z) < 0.16
      && housePoint.y <= ground && housePoint.y >= ground - 0.4) {
      touchesSand = true;
      break;
    }
  }
  assert.ok(touchesSand, 'House piling does not reach its actual terrain height');
}
for (let z = -4.25; z <= 7; z += 0.75) for (let x = -5.5; x <= 5.5; x += 0.75) {
  const ground = terrain.heightAt(houseData.site.x + x, houseData.site.z + z);
  assert.ok(ground > 0 && ground < houseData.floorY, 'House or porch footprint is outside dry sand');
}
for (const stair of houseData.stairs) {
  assert.ok(terrain.heightAt(stair.x, stair.z) > 0 && stair.topY > stair.groundY, 'House stairs do not meet dry sand');
}

const { createBeachGarden } = await import('../src/tidewater/world/BeachGarden.js');
const garden = createBeachGarden(terrain);
garden.updateMatrixWorld(true);
const { meshes: gardenMeshes, vertices: gardenVertices } = checkGeometry(garden, 'Garden', 10);
const plants = garden.userData.garden.plants;
const trunkNormals = garden.children.find(mesh => mesh.name === 'garden-palm-bark')?.geometry.getAttribute('normal');
assert.ok(trunkNormals?.getX(0) > 0, 'Palm trunk faces point inward');
for (const [type, expected] of [['palm', 6], ['cycad', 8], ['flowers-and-grass', 12]]) {
  assert.equal(plants.filter(plant => plant.type === type).length, expected, `Garden silently omitted ${type}`);
}
for (const plant of plants) {
  const ground = terrain.heightAt(plant.x, plant.z);
  assert.ok(ground > 0.05 && Math.hypot(plant.x - houseData.site.x, plant.z - houseData.site.z) < 12, 'Plant is outside dry sand near the house');
  assert.ok(!(Math.abs(plant.x - 27.4) < 1.8 + plant.radius && plant.z > -68), 'Garden blocks the front stairs');
  let rootAttached = false;
  for (const mesh of garden.children) {
    const position = mesh.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      housePoint.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      if (Math.hypot(housePoint.x - plant.x, housePoint.z - plant.z) < 0.7
        && housePoint.y >= ground - 0.2 && housePoint.y <= ground + 0.08) {
        rootAttached = true;
        break;
      }
    }
    if (rootAttached) break;
  }
  assert.ok(rootAttached, 'Garden geometry does not reach its planting ground');
}

// Exercise the actual moving geometry, rather than just its orbit centres:
// a fin, jellyfish tentacle or crab leg must not intersect the sand or stairs.
const { createSeaLife } = await import('../src/tidewater/world/SeaLife.js');
const { createHermitCrabs } = await import('../src/tidewater/world/HermitCrabs.js');
const seaLife = createSeaLife(terrain), crabs = createHermitCrabs(terrain);
const seaAnimals = seaLife.userData.seaLife.animals, crabAnimals = crabs.userData.crabs.animals;
for (const [type, count] of [['manta-ray', 3], ['sea-turtle', 5], ['pink-jellyfish', 15]]) {
  assert.equal(seaAnimals.filter(animal => animal.type === type).length, count, `Missing ${type}`);
}
assert.equal(seaAnimals.length, 23, 'Unexpected sea-life count');
assert.equal(crabAnimals.length, 10, 'There must be ten hermit crabs');
assert.ok(crabAnimals.every(animal => animal.type === 'hermit-crab'));
const seaGeometry = checkGeometry(seaLife, 'Sea life', 100);
const crabGeometry = checkGeometry(crabs, 'Hermit crabs', 80);
assert.ok(seaGeometry.vertices < 150000 && crabGeometry.vertices < 50000, 'Animal geometry exceeds its budget');
const seaMeshes = [], crabMeshes = [];
for (const [group, meshes] of [[seaLife, seaMeshes], [crabs, crabMeshes]]) {
  group.traverse(object => {
    if (!object.isMesh) return;
    meshes.push(object);
    assert.notEqual(object.staticVelocity, true, 'Moving animal suppresses its motion vectors');
    const normals = object.geometry.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) {
      assert.ok(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) > 0.5, 'Animal has a degenerate lighting normal');
    }
  });
  const snapshot = () => {
    const pose = [];
    group.traverse(object => pose.push(...object.matrixWorld.elements));
    return pose;
  };
  group.update(0);
  const initial = snapshot();
  group.update(1);
  const moving = snapshot();
  assert.notDeepEqual(moving, initial, 'Animals do not animate');
  group.update(1);
  assert.deepEqual(snapshot(), moving, 'Paused simulation time changes animal poses');
  group.update(88);
  group.update(1);
  assert.deepEqual(snapshot(), moving, 'Animal animation depends on update history');
  group.update(0);
  assert.deepEqual(snapshot(), initial, 'Animal animation cannot return to its initial pose');
}
const jellyMeshes = seaMeshes.filter(mesh => mesh.material.transparent);
assert.equal(jellyMeshes.length, 45, 'Jellyfish lost their bell, arms or tentacles');
for (const mesh of jellyMeshes) {
  assert.equal(mesh.layers.mask, 1 << 2, 'Jellyfish is absent from the transparent pass');
  assert.ok(mesh.material.opacity > 0 && mesh.material.opacity < 1, 'Jellyfish must be translucent');
  assert.equal(mesh.material.depthWrite, false, 'Transparent jellyfish blocks later underwater geometry');
  assert.equal(mesh.material.userData.refractUnderwater, true, 'Jellyfish is absent from the water refraction source');
  assert.notEqual(mesh.material.underwaterLighting, 'none', 'Jellyfish bypasses underwater lighting');
}
let animalVertexSamples = 0, highestSeaAnimalY = -Infinity, minSeaBedClearance = Infinity, minCrabGroundClearance = Infinity;
for (const time of [0, 1, 5, 10, 30, 60, 120, 180, 240, 300]) {
  seaLife.update(time);
  crabs.update(time);
  for (const mesh of seaMeshes) {
    const position = mesh.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      housePoint.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      const clearance = housePoint.y - terrain.heightAt(housePoint.x, housePoint.z);
      highestSeaAnimalY = Math.max(highestSeaAnimalY, housePoint.y);
      minSeaBedClearance = Math.min(minSeaBedClearance, clearance);
      assert.ok(housePoint.y < -0.1 && clearance > 0.08, 'Sea animal crosses mean water level or the seabed');
      animalVertexSamples++;
    }
  }
  for (const animal of crabAnimals) {
    assert.ok(terrain.heightAt(animal.root.position.x, animal.root.position.z) > 0.15, 'Crab walks into the sea');
    assert.ok(Math.hypot(animal.root.position.x - 27.4, animal.root.position.z + 67) < 6, 'Crab strays away from the stairs');
  }
  for (const mesh of crabMeshes) {
    const position = mesh.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      housePoint.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      const clearance = housePoint.y - terrain.heightAt(housePoint.x, housePoint.z);
      minCrabGroundClearance = Math.min(minCrabGroundClearance, clearance);
      assert.ok(clearance > -0.005, 'Crab sinks into the sand');
      assert.ok(!houseData.stairs.some(stair => Math.abs(housePoint.x - stair.x) < 1.53
        && Math.abs(housePoint.z - stair.z) < 0.16 && housePoint.y > stair.bottomY && housePoint.y < stair.topY + 0.035), 'Crab intersects a solid wooden stair');
      animalVertexSamples++;
    }
  }
}

// The water previously captured only opaque geometry. Verify the new flagged
// transparent draw loads its colour/depth, so jellyfish survive refraction.
const { RefractionPass } = await import('../src/tidewater/ocean/RefractionPass.js');
const { PerspectiveCamera } = await import('../src/tidewater/engine/scene/Camera.js');
const { setFrameCamera } = await import('../src/tidewater/engine/render/Frame.js');
const refractionDraws = [];
const refractionCamera = new PerspectiveCamera(62, 16 / 9, 0.06, 60000);
setFrameCamera(refractionCamera, 1280, 720);
const refraction = new RefractionPass({ scene: seaLife, camera: refractionCamera,
  sceneRenderer: { width: 1280, height: 720 }, meshRenderer: { render(scene, pass) { refractionDraws.push(pass); } } });
// Keep GPU allocation out of this CPU test; the real pass and filters run unchanged.
refraction.target = { width: 0, height: 0, formats: ['rgba16float'],
  setSize(width, height) { this.width = width; this.height = height; },
  texture: { view() { return 'colour'; } }, depthTexture: { view() { return 'depth'; } } };
refraction.render(0);
assert.equal(refractionDraws.length, 2, 'Submerged transparency was not rendered');
assert.equal(refractionDraws[0].layerMask, 1 << 0);
assert.equal(refractionDraws[1].layerMask, 1 << 2);
assert.equal(refractionDraws[1].clearColors, undefined, 'Transparent pass erases the seabed colour');
assert.equal(refractionDraws[1].clearDepth, undefined, 'Transparent pass erases submerged depth');
assert.ok(jellyMeshes.every(mesh => refractionDraws[1].filter(mesh)), 'Refraction filter rejects underwater jellyfish');
assert.ok(seaMeshes.filter(mesh => !mesh.material.transparent).every(mesh => !refractionDraws[1].filter(mesh)), 'Opaque animals enter the transparent pass');
const surfaceEffect = { ...jellyMeshes[0], material: { ...jellyMeshes[0].material, userData: {} } };
assert.equal(refractionDraws[1].filter(surfaceEffect), false, 'Unflagged spray/effects enter underwater refraction');
refraction.enabled = false;
refraction.render(0);
assert.ok(refractionDraws.slice(2).every(pass => pass.layerMask === 0), 'Disabled refraction still draws animals');

// One-metre cells resolve the compact shore; a 64-cell global field misses it.
const shore = computeShoreField({ size: 160, origin: -100, heightAt: (x, z) => terrain.heightAt(x, z) }, { res: 160 });
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
const uploadedTerrain = { origin: shore.origin, size: shore.size,
  shoreTexture: { width: shore.res, upload() {} }, uniforms: { fields: { shoreRes: { value: 0 } } } };
TerrainGPU.prototype.setShoreField.call(uploadedTerrain, shore);
assert.equal(uploadedTerrain.shoreField, shore, 'Texture upload lost the CPU shoreline field');
const shoreWaves = { terrain: uploadedTerrain, dirMin: { value: new Vector2() }, dirSize: { value: 0 },
  uniforms: { fields: { dirOn: { value: 0 } } } };
const directions = ShoreWaves.prototype.buildDirTexture.call(shoreWaves, { min: new Vector2(8, -95), size: 40, res: 8 });
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
  terrainSamples, rasterDryAreaM2, beachAreaM2, houseFootprintM2, visibleSandM2, visibleSandRatio, maxTerrainHeight, maxShoreSlope,
  houseMeshes, houseVertices, gardenMeshes, gardenVertices, plants: plants.length,
  seaLife: { counts: { mantaRays: 3, seaTurtles: 5, pinkJellyfish: 15 }, ...seaGeometry, highestSeaAnimalY, minSeaBedClearance },
  hermitCrabs: { count: crabAnimals.length, ...crabGeometry, minGroundClearance: minCrabGroundClearance },
  animalVertexSamples, submergedTransparency: 'passed',
  houseSizeMeters: { x: houseSize.x, y: houseSize.y, z: houseSize.z },
  shorelineCells: shore.res ** 2, shoreDirectionCells: 64,
  limitation: 'CPU and asset checks only; WebGPU rendering requires a compatible browser.' }, null, 2));
