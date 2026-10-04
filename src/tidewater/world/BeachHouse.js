import {
	Group, Mesh, BoxGeometry, SphereGeometry, CylinderGeometry, LatheGeometry,
	BufferGeometry, Float32BufferAttribute, Vector2, Vector3, Quaternion,
	mergeGeometries,
} from '../engine/index.js';
import { standard } from '../materials/Materials.js';

// Geometry is baked into one mesh per material: the many boards, roof seams and
// wicker strands stay static without adding hundreds of scene draw calls.
export function createBeachHouse( terrainData ) {

	const site = { x: 28, z: -75 };
	let groundMax = -Infinity;
	for ( let x = -5.5; x <= 5.5; x += 1 ) {
		for ( let z = -4; z <= 7; z += 1 ) groundMax = Math.max( groundMax, terrainData.heightAt( site.x + x, site.z + z ) );
	}
	const floorY = groundMax + 0.8;
	const group = new Group();
	group.name = 'Hawaiian family beach house';
	group.position.set( site.x, floorY, site.z );
	const batches = new Map();
	const material = ( name, color, roughness = 0.82, extra = {} ) => standard( { name: `house-${ name }`, color, roughness, ...extra } );
	const grain = `
		let grain = sin( in.P.x * 36.0 + sin( in.P.y * 31.0 + in.P.z * 3.0 ) * 1.7 );
		let weather = 0.95 + 0.035 * grain + 0.025 * sin( in.P.x * 2.3 + in.P.y * 3.1 );
		s.albedo *= weather;
	`;
	const paint = [
		material( 'clapboard', 0x6baba4, 0.84, { surface: grain } ),
		material( 'clapboard-faded', 0x83b8ad, 0.87, { surface: grain } ),
		material( 'clapboard-shaded', 0x5c9994, 0.86, { surface: grain } ),
	];
	const wood = material( 'weathered-timber', 0x9d7951, 0.88, { surface: grain } );
	const cream = material( 'cream-trim', 0xeee4c6 );
	const roof = material( 'coral-metal-roof', 0xb9513f, 0.62, { metalness: 0.22 } );
	const roofSeam = material( 'coral-roof-seams', 0xce6954, 0.59, { metalness: 0.25 } );
	const glass = material( 'window-glass', 0x234b50, 0.18, { metalness: 0.18, emissive: 0x1d3438, emissiveIntensity: 0.18 } );
	const door = material( 'door', 0x8a9980, 0.77 );
	const brass = material( 'brass', 0xb89554, 0.35, { metalness: 0.7 } );
	const wicker = material( 'woven-rattan', 0xb59767, 0.91 );
	const fabric = material( 'linen', 0xf0dfb9, 0.96, { side: 'double' } );
	const rope = material( 'cotton-rope', 0xe6d4ab, 0.93 );
	const teal = material( 'turquoise-surfboard', 0x249ea5, 0.43 );
	const orange = material( 'orange-surfboard', 0xe6a35c, 0.48 );
	const terra = material( 'terracotta', 0xb66b4e, 0.96 );
	const soil = material( 'pot-soil', 0x4b4030, 1 );
	const leaf = material( 'hibiscus-leaves', 0x42784b, 0.89 );
	const petal = material( 'hibiscus-flowers', 0xdc7063, 0.87, { side: 'double' } );
	function add( g, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 ) {
		if ( rx ) g.rotateX( rx );
		if ( ry ) g.rotateY( ry );
		if ( rz ) g.rotateZ( rz );
		g.translate( x, y, z );
		if ( ! batches.has( mat ) ) batches.set( mat, [] );
		batches.get( mat ).push( g );
	}
	const box = ( mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0 ) => add( new BoxGeometry( w, h, d ), mat, x, y, z, rx, ry, rz );
	const ellipsoid = ( mat, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0 ) => add( new SphereGeometry( 1, 16, 10 ).scale( sx, sy, sz ), mat, x, y, z, rx, ry, rz );
	function rod( mat, a, b, radius = 0.025, sides = 6 ) {
		const from = new Vector3( ...a ), to = new Vector3( ...b );
		const delta = to.clone().sub( from );
		const g = new CylinderGeometry( radius, radius, delta.length(), sides );
		g.applyQuaternion( new Quaternion().setFromUnitVectors( new Vector3( 0, 1, 0 ), delta.normalize() ) );
		const center = from.add( to ).multiplyScalar( 0.5 );
		add( g, mat, center.x, center.y, center.z );
	}
	function strip( mat, points, radius ) {
		for ( let i = 1; i < points.length; i ++ ) rod( mat, points[ i - 1 ], points[ i ], radius );
	}
	function surface( positions, indices, uv = null ) {
		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( positions, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( uv || new Array( positions.length / 3 * 2 ).fill( 0 ), 2 ) );
		g.setIndex( indices );
		g.computeVertexNormals();
		return g;
	}

	// The floor sits above the highest footprint sample; every piling is sunk
	// into its own terrain height instead of making the house hover over sand.
	const footings = [];
	for ( const x of [ -4.8, 0, 4.8 ] ) {
		for ( const z of [ -3.7, 0, 4.2, 6.7 ] ) {
			const groundY = terrainData.heightAt( site.x + x, site.z + z );
			const bottomY = groundY - 0.25, topY = floorY - 0.13;
			box( wood, 0.3, topY - bottomY, 0.3, x, ( topY + bottomY ) / 2 - floorY, z );
			footings.push( { x: site.x + x, z: site.z + z, groundY, bottomY, topY } );
		}
	}
	box( wood, 10.8, 0.22, 8.5, 0, -0.13, 0 );
	box( wood, 11, 0.22, 3, 0, -0.13, 5.5 );
	for ( let x = -5.4; x < 5.5; x += 0.24 ) box( wood, 0.22, 0.045, 3, x, 0.005, 5.5 );
	box( paint[ 2 ], 10, 5.8, 8, 0, 3.01, 0 );
	// Overlapping horizontal boards cast their own small shadows along the facade.
	for ( let i = 0; i < 32; i ++ ) {
		const y = 0.19 + i * 0.181;
		const mat = paint[ i % 7 === 0 ? 1 : i % 5 === 0 ? 2 : 0 ];
		box( mat, 10.06, 0.175, 0.065, 0, y, 4.025 );
		box( mat, 10.06, 0.175, 0.065, 0, y, -4.025 );
		box( mat, 0.065, 0.175, 8, -5.025, y, 0 );
		box( mat, 0.065, 0.175, 8, 5.025, y, 0 );
	}
	for ( const x of [ -5.08, 5.08 ] ) for ( const z of [ -4.075, 4.075 ] ) box( cream, 0.15, 5.85, 0.15, x, 3.02, z );
	box( cream, 10.25, 0.14, 0.13, 0, 3.05, 4.10 );
	box( cream, 0.13, 0.14, 8.2, 5.10, 3.05, 0 );

	function window( x, y, z, side = false, w = 1.42, h = 1.75 ) {
		const turn = side ? Math.PI / 2 : 0;
		const piece = ( mat, bw, bh, bd, dx, dy, dz ) => box( mat, bw, bh, bd, x + ( side ? dz : dx ), y + dy, z + ( side ? -dx : dz ), 0, turn );
		piece( glass, w, h, 0.035, 0, 0, 0.055 );
		for ( const dx of [ -w / 2, w / 2 ] ) piece( cream, 0.10, h + 0.2, 0.10, dx, 0, 0.08 );
		for ( const dy of [ -h / 2, h / 2 ] ) piece( cream, w + 0.12, 0.10, 0.10, 0, dy, 0.08 );
		piece( cream, 0.055, h, 0.06, 0, 0, 0.13 );
		piece( cream, w, 0.06, 0.06, 0, 0, 0.13 );
		piece( cream, w + 0.30, 0.13, 0.24, 0, -h / 2 - 0.04, 0.095 );
		// A high small reflection on the pane gives the dark recess a glazed read.
		piece( paint[ 1 ], w * 0.35, 0.025, 0.008, -w * 0.21, h * 0.29, 0.08 );
	}
	for ( const x of [ -3.15, 3.15 ] ) window( x, 1.58, 4.08 );
	for ( const x of [ -3.15, 3.15 ] ) window( x, 4.48, 4.08 );
	// A shallow upper bay and its own front gable break up the long facade.
	box( paint[ 2 ], 3.9, 2.82, 0.96, 0, 4.52, 4.49 );
	for ( let i = 0; i < 16; i ++ ) {
		const y = 3.16 + i * 0.177;
		box( paint[ i % 5 === 0 ? 1 : 0 ], 3.95, 0.17, 0.07, 0, y, 4.997 );
		for ( const x of [ -1.985, 1.985 ] ) box( paint[ 0 ], 0.06, 0.17, 0.98, x, y, 4.49 );
	}
	for ( const x of [ -2.0, 2.0 ] ) box( cream, 0.13, 2.91, 0.14, x, 4.52, 5.04 );
	window( 0, 4.70, 5.055, false, 2.78, 1.68 );
	for ( const z of [ -2.25, 2.25 ] ) for ( const y of [ 1.58, 4.48 ] ) window( 5.08, y, z, true );
	box( door, 1.24, 2.48, 0.12, -0.60, 1.28, 4.13 );
	for ( const x of [ -1.28, 0.08 ] ) box( cream, 0.12, 2.62, 0.17, x, 1.31, 4.19 );
	box( cream, 1.48, 0.12, 0.17, -0.60, 2.56, 4.19 );
	box( glass, 0.87, 0.65, 0.03, -0.60, 1.87, 4.20 );
	box( cream, 0.04, 0.65, 0.03, -0.60, 1.87, 4.23 );
	for ( const y of [ 0.43, 0.93 ] ) box( paint[ 2 ], 0.93, 0.035, 0.022, -0.60, y, 4.20 );
	ellipsoid( brass, 0.044, 0.044, 0.065, -0.17, 1.13, 4.24 );

	// Solid gables beneath two real sloped roof sheets, not a flat cap.
	for ( const z of [ -4.025, 4.025 ] ) {
		const g = surface( [ -5, 5.91, 0, 5, 5.91, 0, 0, 7.99, 0 ], z > 0 ? [ 0, 1, 2 ] : [ 2, 1, 0 ], [ 0, 0, 1, 0, 0.5, 1 ] );
		add( g, paint[ 0 ], 0, 0, z );
		for ( let y = 6.08; y < 7.95; y += 0.18 ) {
			const width = 10 * ( 7.99 - y ) / ( 7.99 - 5.91 );
			box( paint[ 1 ], width, 0.025, 0.04, 0, y, z + Math.sign( z ) * 0.025 );
		}
	}
	const roofAngle = Math.atan2( 2.24, 5.65 ), roofLength = Math.hypot( 5.65, 2.24 );
	for ( const side of [ -1, 1 ] ) {
		box( roof, roofLength, 0.12, 9.0, side * 2.825, 6.92, 0, 0, 0, -side * roofAngle );
		for ( let z = -4.45; z <= 4.45; z += 0.42 ) box( roofSeam, roofLength, 0.044, 0.028, side * 2.825, 7.004, z, 0, 0, -side * roofAngle );
		for ( const z of [ -4.52, 4.52 ] ) box( cream, roofLength + 0.05, 0.16, 0.12, side * 2.825, 6.85, z, 0, 0, -side * roofAngle );
	}
	add( new CylinderGeometry( 0.105, 0.105, 9.1, 10 ), roofSeam, 0, 8.04, 0, Math.PI / 2 );
	for ( const x of [ -5.65, 5.65 ] ) box( cream, 0.13, 0.2, 9.1, x, 5.77, 0 );
	add( surface( [ -1.95, 5.93, 0, 1.95, 5.93, 0, 0, 7.19, 0 ], [ 0, 1, 2 ], [ 0, 0, 1, 0, 0.5, 1 ] ), paint[ 1 ], 0, 0, 5.005 );
	const bayAngle = Math.atan2( 1.29, 2.16 ), bayLength = Math.hypot( 1.29, 2.16 );
	for ( const side of [ -1, 1 ] ) {
		box( roof, bayLength, 0.09, 1.95, side * 1.08, 6.49, 4.72, 0, 0, -side * bayAngle );
		for ( let z = 3.78; z <= 5.68; z += 0.38 ) box( roofSeam, bayLength, 0.037, 0.024, side * 1.08, 6.555, z, 0, 0, -side * bayAngle );
		box( cream, bayLength + 0.06, 0.14, 0.11, side * 1.08, 6.43, 5.72, 0, 0, -side * bayAngle );
	}
	add( new CylinderGeometry( 0.075, 0.075, 2.01, 8 ), roofSeam, 0, 7.145, 4.72, Math.PI / 2 );
	// Shaded lanai: a lower coral roof slopes gently toward the front edge.
	const porchAngle = 0.16;
	box( roof, 11.45, 0.11, 3.9, 0, 3.55, 5.57, porchAngle );
	for ( let x = -5.6; x <= 5.6; x += 0.42 ) box( roofSeam, 0.027, 0.04, 3.9, x, 3.63, 5.57, porchAngle );
	box( cream, 11.5, 0.2, 0.15, 0, 3.16, 7.49 );
	box( wood, 11.1, 0.16, 0.19, 0, 3.03, 6.93 );
	for ( const x of [ -5.05, -2.2, 1.0, 5.05 ] ) {
		box( cream, 0.17, 3.08, 0.17, x, 1.54, 6.9 );
		box( cream, 0.24, 0.10, 0.24, x, 0.06, 6.9 );
		for ( const s of [ -1, 1 ] ) rod( cream, [ x, 2.52, 6.9 ], [ x + s * 0.43, 2.98, 6.9 ], 0.047 );
	}
	for ( const x of [ -5.05, 5.05 ] ) box( cream, 0.17, 3.52, 0.17, x, 1.76, 4.12 );
	function netRail( a, b ) {
		rod( wood, [ a[ 0 ], 1.02, a[ 1 ] ], [ b[ 0 ], 1.02, b[ 1 ] ], 0.044 );
		rod( wood, [ a[ 0 ], 0.20, a[ 1 ] ], [ b[ 0 ], 0.20, b[ 1 ] ], 0.032 );
		const length = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
		const n = Math.ceil( length / 0.28 );
		for ( let i = 0; i < n; i ++ ) {
			const t = i / n, next = ( i + 1 ) / n;
			const p = [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t ];
			const q = [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * next, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * next ];
			rod( rope, [ p[ 0 ], 0.24, p[ 1 ] ], [ q[ 0 ], 0.98, q[ 1 ] ], 0.008, 5 );
			rod( rope, [ p[ 0 ], 0.98, p[ 1 ] ], [ q[ 0 ], 0.24, q[ 1 ] ], 0.008, 5 );
		}
	}
	netRail( [ -5.05, 6.90 ], [ -2.2, 6.90 ] );
	netRail( [ 1.0, 6.90 ], [ 5.05, 6.90 ] );
	for ( const x of [ -5.05, 5.05 ] ) netRail( [ x, 4.2 ], [ x, 6.90 ] );

	const stairX = -0.6, stairs = [];
	const stairGround = terrainData.heightAt( site.x + stairX, site.z + 9.32 );
	const rise = ( floorY - stairGround ) / 5;
	for ( let i = 0; i < 4; i ++ ) {
		const z = 7.3 + i * 0.58;
		const groundY = terrainData.heightAt( site.x + stairX, site.z + z );
		const topY = floorY - rise * ( i + 1 );
		const bottomY = groundY - 0.06;
		box( wood, 3, topY - bottomY, 0.61, stairX, ( topY + bottomY ) / 2 - floorY, z );
		box( wood, 3.06, 0.045, 0.63, stairX, topY - floorY + 0.012, z );
		stairs.push( { x: site.x + stairX, z: site.z + z, groundY, bottomY, topY } );
	}

	// Two rounded rattan armchairs, cream cushions and a small woven table.
	function chair( x, z ) {
		for ( const dx of [ -0.3, 0.3 ] ) for ( const dz of [ -0.3, 0.3 ] ) rod( wicker, [ x + dx, 0.04, z + dz ], [ x + dx, 0.49, z + dz ], 0.037 );
		box( wicker, 0.78, 0.08, 0.72, x, 0.45, z );
		ellipsoid( fabric, 0.37, 0.075, 0.34, x, 0.52, z );
		ellipsoid( fabric, 0.32, 0.32, 0.075, x, 0.91, z - 0.28, -0.14 );
		const arch = [];
		for ( let i = 0; i <= 16; i ++ ) {
			const angle = Math.PI * i / 16;
			arch.push( [ x + 0.45 * Math.cos( angle ), 0.57 + 0.84 * Math.sin( angle ), z - 0.34 ] );
		}
		strip( wicker, arch, 0.028 );
		for ( let i = -4; i <= 4; i ++ ) {
			const dx = i * 0.09;
			rod( wicker, [ x + dx, 0.50, z - 0.34 ], [ x + dx, 0.57 + 0.84 * Math.sqrt( 1 - ( dx / 0.45 ) ** 2 ), z - 0.34 ], 0.012 );
		}
		for ( const y of [ 0.7, 0.88, 1.04, 1.18 ] ) {
			const w = 0.45 * Math.sqrt( Math.max( 0, 1 - ( ( y - 0.57 ) / 0.84 ) ** 2 ) );
			rod( wicker, [ x - w, y, z - 0.34 ], [ x + w, y, z - 0.34 ], 0.010 );
		}
		for ( const dx of [ -0.4, 0.4 ] ) {
			rod( wicker, [ x + dx, 0.48, z + 0.28 ], [ x + dx, 0.82, z + 0.28 ], 0.029 );
			rod( wicker, [ x + dx, 0.82, z + 0.28 ], [ x + dx, 0.93, z - 0.29 ], 0.033 );
		}
	}
	chair( -3.9, 5.27 );
	chair( -2.45, 5.27 );
	add( new CylinderGeometry( 0.37, 0.30, 0.08, 20 ), wicker, -3.15, 0.55, 5.95 );
	add( new CylinderGeometry( 0.11, 0.18, 0.50, 12 ), wicker, -3.15, 0.28, 5.95 );
	for ( let a = 0; a < Math.PI * 2; a += Math.PI / 6 ) rod( wicker, [ -3.15 + 0.27 * Math.cos( a ), 0.04, 5.95 + 0.27 * Math.sin( a ) ], [ -3.15 + 0.34 * Math.cos( a ), 0.52, 5.95 + 0.34 * Math.sin( a ) ], 0.012 );

	// A hanging cloth sling with visibly sagging center and gathered rope ends.
	const hammockPositions = [], hammockUV = [], hammockIndices = [];
	for ( let i = 0; i <= 20; i ++ ) {
		const t = i / 20, x = 1.9 + t * 3.08;
		const width = 0.48 * Math.sin( Math.PI * t ) ** 0.45;
		for ( let j = 0; j <= 6; j ++ ) {
			const v = j / 6 - 0.5;
			hammockPositions.push( x, 1.45 - 0.63 * Math.sin( Math.PI * t ) + 0.20 * Math.abs( v ) * 2, 5.72 + v * width * 2 );
			hammockUV.push( t, j / 6 );
			if ( i < 20 && j < 6 ) {
				const n = i * 7 + j;
				hammockIndices.push( n, n + 7, n + 1, n + 1, n + 7, n + 8 );
			}
		}
	}
	add( surface( hammockPositions, hammockIndices, hammockUV ), fabric );
	for ( const edge of [ -1, 1 ] ) {
		const points = [];
		for ( let i = 0; i <= 20; i ++ ) {
			const t = i / 20;
			points.push( [ 1.9 + t * 3.08, 1.65 - 0.63 * Math.sin( Math.PI * t ), 5.72 + edge * 0.48 * Math.sin( Math.PI * t ) ** 0.45 ] );
		}
		strip( rope, points, 0.018 );
	}
	rod( rope, [ 1.9, 1.45, 5.72 ], [ 1.0, 1.78, 6.9 ], 0.022 );
	rod( rope, [ 4.98, 1.45, 5.72 ], [ 5.05, 1.78, 6.9 ], 0.022 );

	// Slim boards lean toward the side wall, their lowest tips resting on sand.
	for ( const [ x, z, mat, angle ] of [ [ 5.65, 1.9, teal, 0.17 ], [ 6.38, 1.55, orange, 0.25 ] ] ) {
		const ground = terrainData.heightAt( site.x + x, site.z + z ) - floorY;
		const y = ground + 1.43;
		ellipsoid( mat, 0.34, 1.45, 0.065, x, y, z, 0.08, 0, angle );
		ellipsoid( cream, 0.023, 1.24, 0.006, x + 0.008, y, z + 0.066, 0.08, 0, angle );
		box( wood, 0.035, 0.21, 0.16, x - 0.05, ground + 0.49, z - 0.10, 0.08, 0, angle );
	}

	function pot( x, z, size = 1 ) {
		const p = new LatheGeometry( [ new Vector2( 0, 0 ), new Vector2( 0.23, 0 ), new Vector2( 0.34, 0.45 ), new Vector2( 0.36, 0.47 ), new Vector2( 0.36, 0.53 ), new Vector2( 0.31, 0.53 ), new Vector2( 0.30, 0.45 ) ], 20 ).scale( size, size, size );
		add( p, terra, x, 0.027, z );
		add( new CylinderGeometry( 0.30 * size, 0.30 * size, 0.025, 16 ), soil, x, 0.50 * size, z );
		for ( let branch = 0; branch < 5; branch ++ ) {
			const a = branch * 2.4, bx = x + Math.cos( a ) * 0.19 * size, bz = z + Math.sin( a ) * 0.19 * size;
			const h = ( 0.92 + 0.10 * ( branch % 3 ) ) * size;
			rod( leaf, [ x, 0.47 * size, z ], [ bx, h, bz ], 0.018 * size );
			for ( const s of [ -1, 1 ] ) ellipsoid( leaf, 0.18 * size, 0.032 * size, 0.075 * size, bx + s * 0.09 * size, h - 0.16 * size, bz, 0, a, s * 0.5 );
			for ( let k = 0; k < 5; k ++ ) {
				const angle = k * Math.PI * 2 / 5;
				ellipsoid( petal, 0.075 * size, 0.075 * size, 0.027 * size, bx + Math.cos( angle ) * 0.07 * size, h + Math.sin( angle ) * 0.07 * size, bz + 0.04, 0, 0, angle );
			}
			rod( brass, [ bx, h, bz + 0.04 ], [ bx + 0.01, h + 0.06 * size, bz + 0.14 * size ], 0.007 * size, 5 );
		}
	}
	pot( -4.9, 4.75, 1.10 );
	pot( 4.80, 4.63, 1 );
	pot( 1.35, 6.48, 0.75 );

	for ( const [ mat, geometries ] of batches ) {
		const geometry = mergeGeometries( geometries );
		geometry.computeBoundingBox();
		geometry.computeBoundingSphere();
		const mesh = new Mesh( geometry, mat );
		mesh.name = mat.name;
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		group.add( mesh );
	}
	group.userData.house = { site, floorY, groundMax, footings, stairs, width: 10, depth: 8, porchDepth: 3, roofPeakY: floorY + 8.145, drawCount: group.children.length };
	group.updateMatrixWorld( true );
	return group;

}
