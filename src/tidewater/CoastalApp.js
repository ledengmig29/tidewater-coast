// Coastal viewer adapted from Tidewater (MIT), commit
// 4811ba48d795197de5621985f404e765c0b7c0ef. See LICENSE and THIRD_PARTY_NOTICES.md.
import { Vector3, Color, MathUtils, Mesh } from './engine/index.js';
import { GPU } from './engine/gpu/GPU.js';
import { SunShadows } from './engine/render/Shadows.js';
import { FrameUniforms } from './engine/render/Frame.js';
import { Engine } from './core/Engine.js';
import { Input } from './core/Input.js';
import { CDLOD } from './core/CDLOD.js';
import { G } from './core/Globals.js';
import { SceneRenderer, LAYERS } from './core/SceneRenderer.js';
import { Atmosphere, SUN_ILLUMINANCE } from './sky/Atmosphere.js';
import { Sky, sunDirectionFromTime } from './sky/Sky.js';
import { SkyProClouds } from './sky/SkyProClouds.js';
import { Environment } from './sky/Environment.js';
import { TerrainData } from './world/TerrainData.js';
import { TerrainGPU } from './world/TerrainGPU.js';
import { Terrain } from './world/Terrain.js';
import { createBeachHouse } from './world/BeachHouse.js';
import { createBeachGarden } from './world/BeachGarden.js';
import { createSeaLife } from './world/SeaLife.js';
import { createHermitCrabs } from './world/HermitCrabs.js';
import { computeShoreField } from './world/ShoreField.js';
import { WORLD } from './world/WorldLayout.js';
import { OceanFFT } from './ocean/OceanFFT.js';
import { WaterSurface } from './ocean/WaterSurface.js';
import { WaterMaterial } from './ocean/WaterMaterial.js';
import { createFoamTexture } from './ocean/FoamTexture.js';
import { ShoreWaves } from './ocean/ShoreWaves.js';
import { ShoreSim } from './ocean/ShoreSim.js';
import { Caustics } from './ocean/Caustics.js';
import { installUnderwaterLighting } from './ocean/UnderwaterLighting.js';
import { RefractionPass } from './ocean/RefractionPass.js';
import { installGroundBounce } from './materials/GroundBounce.js';
import { WaterQuery } from './ocean/WaterQuery.js';
import { Breakers } from './ocean/Breakers.js';
import { SurfFoam } from './ocean/SurfFoam.js';
import { Spray } from './fx/Spray.js';
import { SeaDetail } from './ocean/SeaDetail.js';
import { MarineSnow } from './fx/MarineSnow.js';
import { Underwater, LENS_REACH } from './post/Underwater.js';
import { PostFX } from './post/PostFX.js';
import { AirHaze } from './post/AirHaze.js';
import { FlyCamera } from './player/FlyCamera.js';
import { updateCameraVelocity, useStaticVelocity } from './post/CameraVelocity.js';

const up = new Vector3( 0, 1, 0 );
const views = {
	shore: { p: [ 48, 4.4, -47 ], yaw: 0.94, pitch: 0.035, portrait: { p: [ 54, 5.2, -39 ], yaw: 0.63, pitch: 0.04 } },
	home: { p: [ 41, 4.7, -59 ], yaw: 0.68, pitch: 0.1, portrait: { p: [ 44, 4.7, -46 ], yaw: 0.53, pitch: 0.065 } },
	shallows: { p: [ 28, 3.6, -38 ], yaw: 0, pitch: -0.23, portrait: { p: [ 63, 6, -41 ], yaw: 1.11, pitch: -0.18 } },
	overview: { p: [ 49, 21, -43 ], yaw: 0.61, pitch: -0.46 },
	waterline: { p: [ 27, 0.26, -56 ], yaw: -0.04, pitch: 0.055, portrait: { p: [ 28, 0.26, -35 ], yaw: 0, pitch: 0.055 } },
};

export class CoastalApp {
	constructor( container ) {
		this.container = container;
		this.settings = { timeOfDay: 16.2, sunAzimuth: 45, timeSpeed: 0, exposure: 0.55, renderScale: 0.8, waveStrength: 1 };
		this.paused = false;
		this.running = false;
		this.fps = 0;
		this.view = 'shore';
	}

	async init( onProgress = () => {} ) {
		const progress = async ( p, text ) => {
			onProgress( p, text );
			await new Promise( resolve => setTimeout( resolve, 0 ) );
		};
		await progress( 0.02, '初始化 WebGPU' );
		const engine = this.engine = new Engine( this.container );
		await engine.init();
		const renderer = this.renderer = engine;
		const { scene, camera } = engine;
		this.scene = scene;
		this.camera = camera;
		camera.near = 0.1;
		camera.updateProjectionMatrix();
		engine.domElement.setAttribute( 'aria-label', '海岸、夏威夷木屋与浅海动物三维场景：拖动查看，WASD 移动，Q E 升降' );
		this.input = new Input( engine.domElement );
		this.fly = new FlyCamera( camera, engine.domElement, this.input );
		this.fly.speed = 5;

		await progress( 0.06, '构建大气与体积云' );
		this.atmosphere = new Atmosphere( renderer );
		this.sky = new Sky( this.atmosphere );
		this.clouds = new SkyProClouds( renderer, this.atmosphere );
		await this.clouds.ready;
		this.sky.clouds = this.clouds;
		this.shadows = new SunShadows( { size: 2048, splits: [ 10, 60, 400 ], lightMargin: 200, normalBias: [ 0.015, 0.06, 0.3 ], bias: 0.00002 } );
		this.shadows.layerMask = ( 1 << LAYERS.OPAQUE ) | ( 1 << LAYERS.TRANSPARENT );
		this.environment = new Environment( renderer, scene, this.sky );

		await progress( 0.12, '生成木屋周围的小沙岛' );
		this.terrainData = new TerrainData();
		this.setView( 'shore' );
		this.shoreField = computeShoreField( this.terrainData, { res: 1024, swellDir: [ WORLD.swellDir.x, WORLD.swellDir.y ] } );
		this.terrainGPU = new TerrainGPU( this.terrainData, this.shoreField );
		this.terrain = new Terrain( { scene, terrainData: this.terrainData, terrainGPU: this.terrainGPU, renderer } );
		this.terrain.mesh.material.appliesHillShadow = true;
		await progress( 0.24, '搭建木屋、露台与热带花园' );
		this.beachHouse = createBeachHouse( this.terrainData );
		scene.add( this.beachHouse );
		useStaticVelocity( this.beachHouse );
		this.beachGarden = createBeachGarden( this.terrainData );
		scene.add( this.beachGarden );
		useStaticVelocity( this.beachGarden );
		await progress( 0.26, '布置浅海动物与楼梯下的寄居蟹' );
		this.seaLife = createSeaLife( this.terrainData );
		this.hermitCrabs = createHermitCrabs( this.terrainData );
		scene.add( this.seaLife, this.hermitCrabs );

		await progress( 0.27, '模拟海浪、碎浪与泡沫' );
		this.fft = new OceanFFT( renderer );
		this.foamTexture = createFoamTexture( renderer );
		this.oceanLOD = new CDLOD( { gridSize: 32, leafSize: 8, levels: 12, minY: -25, maxY: 25 } );
		this.surface = new WaterSurface( { fft: this.fft, cdlod: this.oceanLOD, foamTexture: this.foamTexture } );
		this.surface.terrain = this.terrainGPU;
		this.seaDetail = new SeaDetail();
		this.surface.detail = this.seaDetail;
		this.shore = new ShoreWaves( this.terrainGPU );
		this.surface.shore = this.shore;
		this.caustics = new Caustics( renderer, this.fft );
		this.caustics.detail = this.seaDetail;
		this.shoreSim = new ShoreSim( renderer, { terrainGPU: this.terrainGPU, shore: this.shore } );
		this.surface.shoreSim = this.shoreSim;
		this.terrain.wetness = {
			modules: [ this.shoreSim.module ],
			code: /* wgsl */`
fn terrainWetness( xz: vec2f, h: f32 ) -> vec2f {
	let s = shoreSimSample( xz );
	let inside = shoreSimInside( shoreSimUvOf( xz ) );
	let band = smoothstep( 0.45, 0.0, h );
	return vec2f( max( s.y, band * ( 1.0 - inside ) ), shoreSimSandFoam( xz, s, h ) );
}`,
		};
		this.terrain.finalizeMaterial();
		this.surfFoam = new SurfFoam( { shoreSim: this.shoreSim } );
		this.surface.foamShading = args => this.surfFoam.shading( args );
		this.underwaterLighting = installUnderwaterLighting( {
			fft: this.fft, caustics: this.caustics, clouds: this.clouds, terrain: this.terrainGPU,
			shore: this.shore, surface: this.surface, shoreSim: this.shoreSim,
		} );
		installGroundBounce( { terrain: this.terrainGPU, clouds: this.clouds } );
		this.sceneRenderer = new SceneRenderer( engine.meshRenderer, scene, camera );
		this.refraction = new RefractionPass( { meshRenderer: engine.meshRenderer, scene, camera, sceneRenderer: this.sceneRenderer, scale: 0.5 } );
		this.sceneRenderer.onBeforeWater = () => this.refraction.render( G.seaLevel.value );
		this.sceneRenderer.background = this.sky.background;
		this.waterMaterial = new WaterMaterial( {
			surface: this.surface, sky: this.sky, sceneCopy: this.sceneRenderer.opaqueCopy,
			sceneDepthHalf: this.sceneRenderer.opaqueDepthHalf.texture, refraction: this.refraction,
		} );
		this.waterMaterial.clouds = this.clouds;
		this.ocean = new Mesh( this.oceanLOD.geometry, this.waterMaterial );
		this.ocean.frustumCulled = false;
		this.ocean.receiveShadow = true;
		this.ocean.layers.set( LAYERS.WATER );
		scene.add( this.ocean );
		useStaticVelocity( this.terrain.mesh );
		this.query = new WaterQuery( renderer, this.surface );
		this.marineSnow = new MarineSnow( { fft: this.fft, query: this.query } );
		scene.add( this.marineSnow.mesh );
		this.spray = new Spray( renderer, { query: this.query, terrain: this.terrainGPU, sceneCopy: this.sceneRenderer.opaqueCopy, clouds: this.clouds } );
		scene.add( this.spray.mesh );
		this.breakers = new Breakers( renderer, {
			surface: this.surface, shore: this.shore, terrainData: this.terrainData,
			sky: this.sky, spray: this.spray, clouds: this.clouds,
		} );
		scene.add( this.breakers.mesh );

		await progress( 0.34, '准备折射、焦散与光照' );
		this.underwater = new Underwater( {
			depthTexture: this.sceneRenderer.sceneRT.depthTexture, maskTexture: this.sceneRenderer.waterMaskTexture,
			query: this.query, caustics: this.caustics, fft: this.fft,
		} );
		this.waterMaterial.cameraWaterHeightNode = this.query.cameraState().x;
		this.haze = new AirHaze( {
			depthTexture: this.sceneRenderer.sceneRT.depthTexture, underwater: this.underwater,
			atmosphere: this.atmosphere, sky: this.sky, clouds: this.clouds, terrain: this.terrainGPU, csm: this.shadows,
		} );
		this.post = new PostFX( renderer, { sceneRenderer: this.sceneRenderer, camera, underwater: this.underwater, clouds: this.clouds, sunDir: this.atmosphere.sunDir, haze: this.haze } );
		this.setRenderScale( this.settings.renderScale );
		this.updateSun();
		this.gpu = GPU;
		await progress( 0.4, '首次编译海岸着色器，可能需要一些时间' );
		await this.precompile();
		await progress( 0.94, '预热海面与光照' );
		for ( let i = 0; i < 3; i++ ) {
			this.frame( 1 / 60 );
			await GPU.queue.onSubmittedWorkDone();
		}
		onProgress( 1, '海岸已就绪' );
		return this;
	}

	async precompile() {
		this.post._build();
		this.post._outW = 0;
		await GPU.pipelinesReady();
		this.engine.meshRenderer.precompiling = true;
		try {
			this.frame( 1 / 60 );
		} finally {
			this.engine.meshRenderer.precompiling = false;
		}
		await GPU.pipelinesReady();
		await GPU.queue.onSubmittedWorkDone();
	}

	setView( name ) {
		const preset = views[ name ];
		if ( ! preset ) return false;
		const view = this.camera.aspect < 1 && preset.portrait ? preset.portrait : preset;
		this.view = name;
		const position = new Vector3( ...view.p );
		if ( name === 'shore' && this.terrainData ) position.y = Math.max( position.y, this.terrainData.heightAt( position.x, position.z ) + 1.7 );
		this.fly.setPose( position, view.yaw, view.pitch );
		this.fly.velocity.set( 0, 0, 0 );
		if ( this.post?.taau ) this.post.taau._needsRestart = true;
		return true;
	}

	setWaveStrength( value ) {
		const strength = MathUtils.clamp( Number( value ) || 1, 0.4, 1.5 );
		this.settings.waveStrength = strength;
		this.shore.amplitude.value = 0.34 * strength;
		this.fft.local.scale = strength;
		this.fft.swell.scale = 0.48 * strength;
		this.fft.updateSpectrumUniforms();
	}

	setRenderScale( value ) {
		const scale = MathUtils.clamp( Number( value ) || 0.8, 0.5, 1 );
		this.settings.renderScale = scale;
		this.post.setScale( scale );
		this.clouds.resolutionScale = scale;
	}

	updateSun() {
		const dir = sunDirectionFromTime( this.settings.timeOfDay ).applyAxisAngle( up, MathUtils.degToRad( this.settings.sunAzimuth ) );
		this.atmosphere.sunDir.value.copy( dir );
		G.night.value = MathUtils.smoothstep( -dir.y, 0.02, 0.18 );
		this.sky.starIntensity.value = G.night.value;
		const moon = new Vector3( -dir.x, Math.abs( dir.y ) * 0.8 + 0.25, -dir.z ).normalize();
		this.sky.moonDir.value.copy( moon );
		G.sunDir.value.copy( dir.y > -0.07 ? dir : moon );
	}

	applyAtmosphereReadback() {
		const a = this.atmosphere;
		if ( ! a.sunTransmittance ) return;
		const t = a.sunTransmittance;
		const c = a.sunDir.value.y > -0.07
			? new Color( t[ 0 ], t[ 1 ], t[ 2 ] ).multiplyScalar( SUN_ILLUMINANCE * MathUtils.smoothstep( a.sunDir.value.y, -0.03, 0.02 ) )
			: new Color( 0.6, 0.7, 1 ).multiplyScalar( 0.12 * G.night.value );
		G.sunColor.value.copy( c );
		const night = 0.012 * G.night.value;
		G.skyIrradiance.value.setRGB( a.skyIrradiance[ 0 ] + night * 0.6, a.skyIrradiance[ 1 ] + night * 0.7, a.skyIrradiance[ 2 ] + night );
		G.horizonColor.value.setRGB( ...a.horizon );
	}

	start() {
		if ( this.running ) return;
		this.running = true;
		this.engine.clock.reset();
		this.engine.start( dt => this.frame( dt ) );
	}

	stop() {
		this.running = false;
		this.engine?.stop();
	}

	frame( elapsed ) {
		const dt = this.paused ? 0 : Math.min( elapsed, 0.1 );
		GPU.beginFrame();
		FrameUniforms.fields.frameIndex.value = GPU.frame;
		G.dt.value = dt;
		G.time.value += dt;
		this.seaLife.update( G.time.value );
		this.hermitCrabs.update( G.time.value );
		this.settings.timeOfDay = ( this.settings.timeOfDay + dt * this.settings.timeSpeed + 24 ) % 24;
		this.fly.update( elapsed );
		const wheel = this.input.consumeWheel();
		if ( wheel ) this.camera.position.addScaledVector( this.camera.getWorldDirection( new Vector3() ), wheel * -1.4 );
		this.updateSun();
		this.atmosphere.update( dt, this.camera.position.y );
		this.applyAtmosphereReadback();
		if ( ! this.paused ) {
			this.fft.update( dt );
			this.seaDetail.update( dt );
		}
		this.query.setCamera( this.camera.position.x, this.camera.position.z );
		this.query.update();
		if ( this.query.cpuValid ) {
			const h = Number.isFinite( this.query.cpu[ 0 ] ) ? this.query.cpu[ 0 ] : ( this.cameraWaterHeight ?? 0 );
			G.cameraUnderwater.value = this.camera.position.y < h - LENS_REACH ? 1 : 0;
			G.cameraWaterHeight.value = h;
			this.cameraWaterHeight = h;
		}
		this.caustics.update();
		this.marineSnow.update( this.camera, this.camera.position.y < ( this.cameraWaterHeight ?? 0 ) + LENS_REACH );
		if ( ! this.paused ) this.shoreSim.update();
		this.underwaterLighting.update( this.camera );
		this.breakers.update( this.camera );
		if ( ! this.paused ) this.spray.update();
		this.clouds.update( dt, this.camera );
		this.environment.update( dt );
		this.oceanLOD.update( this.camera );
		this.terrain.update( this.camera );
		G.exposure.value = this.settings.exposure;
		updateCameraVelocity( this.camera );
		this.post.lens.update( dt, this.camera.position.y < ( this.cameraWaterHeight ?? 0 ) );
		if ( this.post.flare ) {
			this.post.flare.setDepthHeight( this.sceneRenderer.sceneRT.height );
			this.post.flare.update( this.camera, dt, { aboveWater: this.camera.position.y > ( this.cameraWaterHeight ?? 0 ) - 0.02 } );
		}
		this.post.beginFrame();
		this.underwater.updateCamera( this.camera );
		this.shadows.render( this.scene, this.engine.meshRenderer, this.shadows.update( this.camera, G.sunDir.value ) );
		this.sceneRenderer.render();
		if ( this.post.flare ) this.post.flare.kernel.dispatch( 1 );
		this.post.render();
		this.post.endFrame();
		GPU.submit();
		this.input.endFrame();
		this._fpsTime = ( this._fpsTime || 0 ) + elapsed;
		this._fpsFrames = ( this._fpsFrames || 0 ) + 1;
		if ( this._fpsTime >= 0.5 ) {
			this.fps = this._fpsFrames / this._fpsTime;
			this._fpsTime = this._fpsFrames = 0;
		}
	}
}
