import {
	Group, Mesh, SphereGeometry, CylinderGeometry, TorusGeometry,
	Float32BufferAttribute, Vector3, Quaternion, Color, mergeGeometries,
} from '../engine/index.js';
import { standard } from '../materials/Materials.js';
import { LAYERS } from '../engine/render/SceneRenderer.js';

export function createSeaLife( terrainData ) {

	const seaLife = new Group();
	seaLife.name = 'Shallow-water marine life';
	const animals = [];
	const jelly = standard( {
		name: 'pink-jellyfish', color: 0xffffff, vertexColors: true,
		roughness: 0.35, transparent: true, opacity: 0.50,
		side: 'double', depthWrite: false, userData: { refractUnderwater: true },
	} );
	function color( g, hex, alpha = 1 ) {
		const c = new Color( hex ), values = new Float32Array( g.attributes.position.count * 4 );
		for ( let i = 0; i < values.length; i += 4 ) {
			values[ i ] = c.r; values[ i + 1 ] = c.g; values[ i + 2 ] = c.b; values[ i + 3 ] = alpha;
		}
		g.setAttribute( 'color', new Float32BufferAttribute( values, 4 ) );
		return g;
	}
	function finish( g ) {
		g.computeBoundingBox();
		g.computeBoundingSphere();
		return g;
	}
	const merge = ( parts ) => finish( mergeGeometries( parts ) );
	function sphere( hex, size, position, alpha = 1 ) {
		return color( new SphereGeometry( 1, 12, 8 ).scale( ...size ).translate( ...position ), hex, alpha );
	}
	function rod( a, b, radius, hex, endRadius = radius ) {
		const from = new Vector3( ...a ), to = new Vector3( ...b );
		const delta = to.clone().sub( from ), center = from.clone().add( to ).multiplyScalar( 0.5 );
		const g = new CylinderGeometry( endRadius, radius, delta.length(), 6 );
		g.applyQuaternion( new Quaternion().setFromUnitVectors( new Vector3( 0, 1, 0 ), delta.normalize() ) );
		return color( g.translate( center.x, center.y, center.z ), hex );
	}
	function mesh( g, mat, name ) {
		const m = new Mesh( g, mat );
		m.name = name;
		m.staticVelocity = false;
		m.receiveShadow = true;
		m.castShadow = ! mat.transparent;
		if ( mat.transparent ) m.layers.set( LAYERS.TRANSPARENT );
		return m;
	}
	// Open umbrella, scalloped lip, four oral arms and eight curved fine tentacles.
	const bell = new SphereGeometry( 1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2 ).scale( 0.235, 0.185, 0.235 );
	const bp = bell.attributes.position;
	for ( let i = 0; i < bp.count; i ++ ) {
		const x = bp.getX( i ), y = bp.getY( i ), z = bp.getZ( i );
		const scallop = 1 + 0.035 * Math.cos( Math.atan2( z, x ) * 12 ) * ( 1 - y / 0.185 );
		bp.setXYZ( i, x * scallop, y, z * scallop );
	}
	const bellParts = [ color( bell, 0xea96bd ), color( new TorusGeometry( 0.235, 0.009, 6, 32 ).rotateX( Math.PI / 2 ), 0xd772a6 ) ];
	for ( let i = 0; i < 4; i ++ ) {
		const a = i * Math.PI / 2;
		bellParts.push( sphere( 0xf8bfd5, [ 0.043, 0.033, 0.068 ], [ Math.cos( a ) * 0.055, 0.050, Math.sin( a ) * 0.055 ] ) );
	}
	const jellyBell = merge( bellParts ), armParts = [], tendrilParts = [];
	for ( let i = 0; i < 4; i ++ ) {
		const a = i * Math.PI / 2;
		for ( let j = 0; j < 7; j ++ ) {
			const t = j / 6;
			armParts.push( sphere( j % 2 ? 0xf0b5cd : 0xe88cb8, [ 0.024 + t * 0.006, 0.043, 0.024 + t * 0.006 ], [ Math.cos( a + t * 0.7 ) * ( 0.035 + t * 0.026 ), -0.045 - t * 0.28, Math.sin( a + t * 0.7 ) * ( 0.035 + t * 0.026 ) ] ) );
		}
	}
	for ( let i = 0; i < 8; i ++ ) {
		const angle = i * Math.PI / 4;
		const point = ( t ) => [ Math.cos( angle ) * 0.155 + Math.sin( t * 7 + i ) * 0.037 * t, -0.014 - t * ( 0.48 + i % 3 * 0.035 ), Math.sin( angle ) * 0.155 + Math.cos( t * 6 + i ) * 0.035 * t ];
		for ( let j = 0; j < 12; j ++ ) tendrilParts.push( rod( point( j / 12 ), point( ( j + 1 ) / 12 ), 0.0053 - j * 0.00025, 0xe5a0c6 ) );
	}
	const jellyArms = merge( armParts ), jellyTentacles = merge( tendrilParts );
	function jellyfish( path, phase, speed, size ) {
		const root = new Group(); root.name = 'Pink jellyfish'; root.scale.setScalar( size );
		const umbrella = mesh( jellyBell, jelly, 'jellyfish-bell-lip-gonads' );
		const arms = mesh( jellyArms, jelly, 'jellyfish-oral-arms' );
		const tentacles = mesh( jellyTentacles, jelly, 'jellyfish-eight-tentacles' );
		root.add( umbrella, arms, tentacles );
		animals.push( { type: 'pink-jellyfish', root, path, phase, speed, depth: -0.43, size, joints: { umbrella, arms, tentacles } } );
		seaLife.add( root );
	}

	for ( let i = 0; i < 15; i ++ ) {
		const row = Math.floor( i / 5 ), column = i % 5;
		jellyfish( { x: 17 + column * 5.35 + row * 0.35, z: -54 + row * 0.85, rx: 0.28 + i % 3 * 0.045, rz: 0.28 }, i * 2.4, 0.085 + i % 4 * 0.009, 0.86 + i % 3 * 0.06 );
	}
	seaLife.update = ( time ) => {
		for ( const animal of animals ) {
			const { root, path, phase, speed, joints } = animal;
			const p = time * speed + phase;
			const bob = 0.030 * Math.sin( time * 1.35 + phase );
			root.position.set( path.x + path.rx * Math.cos( p ), animal.depth + bob, path.z + path.rz * Math.sin( p ) );
			root.rotation.y = Math.atan2( -path.rx * Math.sin( p ), path.rz * Math.cos( p ) );
			const pulse = Math.sin( time * 2.0 + phase ), radial = 0.95 - pulse * 0.07;
			joints.umbrella.scale.set( radial, 1 + pulse * 0.07, radial );
			joints.arms.rotation.y = 0.16 * Math.sin( time * 1.1 + phase );
			joints.arms.scale.y = 1 - pulse * 0.045;
			joints.tentacles.scale.set( radial, 1 + 0.05 * Math.sin( time * 1.8 + phase - 0.8 ), radial );
			joints.tentacles.rotation.x = 0.065 * Math.sin( time * 1.3 + phase );
			joints.tentacles.rotation.z = 0.045 * Math.cos( time * 1.15 + phase );
		}
		seaLife.updateMatrixWorld( true );
	};
	seaLife.userData.seaLife = { animals };
	seaLife.update( 0 );
	return seaLife;

}
