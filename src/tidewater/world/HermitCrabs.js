import {
	Group, Mesh, SphereGeometry, CylinderGeometry, TorusGeometry, TubeGeometry,
	CatmullRomCurve3, Vector3, Quaternion, mergeGeometries,
} from '../engine/index.js';
import { standard } from '../materials/Materials.js';

export function createHermitCrabs( terrainData ) {

	const group = new Group();
	group.name = 'Ten hermit crabs by the stairs';
	const shellMaterial = standard( { name: 'crab-shell', color: 0xd7b887, roughness: 0.78 } );
	const grooveMaterial = standard( { name: 'crab-shell-spiral', color: 0x98653e, roughness: 0.84 } );
	const bodyMaterial = standard( { name: 'crab-red-orange', color: 0xd86d35, roughness: 0.73 } );
	const eyeMaterial = standard( { name: 'crab-eyes', color: 0x171d19, roughness: 0.32 } );
	function ellipsoid( x, y, z, sx, sy, sz ) {
		return new SphereGeometry( 1, 12, 8 ).scale( sx, sy, sz ).translate( x, y, z );
	}
	function rod( a, b, radius ) {
		const start = new Vector3( ...a ), end = new Vector3( ...b );
		const delta = end.clone().sub( start );
		const center = start.add( end ).multiplyScalar( 0.5 );
		return new CylinderGeometry( radius * 0.8, radius, delta.length(), 6 )
			.applyQuaternion( new Quaternion().setFromUnitVectors( new Vector3( 0, 1, 0 ), delta.normalize() ) )
			.translate( center.x, center.y, center.z );
	}
	function merged( parts ) {
		const geometry = mergeGeometries( parts );
		geometry.computeBoundingBox();
		geometry.computeBoundingSphere();
		return geometry;
	}
	function mesh( geometry, material, name ) {
		const object = new Mesh( geometry, material );
		object.name = name;
		object.castShadow = true;
		object.receiveShadow = true;
		return object;
	}

	// One shared shell has a raised 2.7-turn spiral following its curved surface.
	const spiral = [], seam = [];
	for ( let i = 0; i <= 90; i ++ ) {
		const t = i / 90, angle = 0.45 + t * Math.PI * 5.4;
		const radius = 0.005 + t * 0.066;
		const z = 0.094 * Math.sqrt( 1 - ( radius / 0.087 ) ** 2 );
		spiral.push( new Vector3( Math.cos( angle ) * radius, Math.sin( angle ) * radius * 0.85, z + 0.001 ) );
		seam.push( new Vector3( Math.cos( angle + 0.095 ) * radius, Math.sin( angle + 0.095 ) * radius * 0.85, z + 0.004 ) );
	}
	const shellGeometry = merged( [
		ellipsoid( 0, 0, 0, 0.085, 0.074, 0.094 ),
		new TubeGeometry( new CatmullRomCurve3( spiral ), 90, 0.0033, 6 ),
		new TorusGeometry( 0.031, 0.0033, 6, 20 ).scale( 1.2, 0.77, 1 ).translate( 0, -0.037, 0.082 ),
	] );
	const grooveGeometry = merged( [
		new TubeGeometry( new CatmullRomCurve3( seam ), 90, 0.0014, 5 ),
		ellipsoid( 0, -0.037, 0.084, 0.034, 0.023, 0.004 ),
	] );
	const bodyParts = [ ellipsoid( 0, 0.034, 0.043, 0.038, 0.022, 0.034 ) ];
	const eyeParts = [];
	for ( const side of [ -1, 1 ] ) {
		bodyParts.push( rod( [ side * 0.017, 0.040, 0.058 ], [ side * 0.023, 0.071, 0.075 ], 0.0028 ) );
		eyeParts.push( ellipsoid( side * 0.023, 0.074, 0.076, 0.006, 0.0065, 0.006 ) );
		// The larger left pincer and smaller right one both have separated tips.
		const size = side < 0 ? 1 : 0.77;
		bodyParts.push(
			rod( [ side * 0.023, 0.033, 0.060 ], [ side * 0.051, 0.028, 0.093 ], 0.0046 ),
			ellipsoid( side * 0.054, 0.029, 0.101, 0.018 * size, 0.012 * size, 0.020 * size ),
			rod( [ side * 0.064, 0.029, 0.110 ], [ side * 0.063, 0.029, 0.130 ], 0.0035 * size ),
			rod( [ side * 0.043, 0.029, 0.110 ], [ side * 0.050, 0.029, 0.132 ], 0.0031 * size ),
		);
	}
	const bodyGeometry = merged( bodyParts ), eyeGeometry = merged( eyeParts );
	function legGeometry( side ) {
		const parts = [];
		for ( let i = 0; i < 3; i ++ ) {
			const z = 0.044 - i * 0.029;
			const knee = [ side * 0.065, 0.027, z + 0.013 - i * 0.008 ];
			const toe = [ side * ( 0.099 + ( i === 1 ? 0.010 : 0 ) ), 0.005, z + 0.027 - i * 0.020 ];
			parts.push(
				rod( [ side * 0.025, 0.034, z ], knee, 0.0035 ),
				rod( knee, toe, 0.0026 ),
				ellipsoid( ...knee, 0.0042, 0.0042, 0.0042 ),
			);
		}
		return merged( parts );
	}
	const leftGeometry = legGeometry( -1 ), rightGeometry = legGeometry( 1 );
	// The nearest center is still in front of the solid bottom stair. Side paths
	// remain outside its three-meter width; every route stays on the dry shore.
	const sites = [
		[ 26.0, -66.10, 0.22, 0.08, 0.0, 1.00 ],
		[ 27.5, -65.90, 0.30, 0.09, 1.1, 0.94 ],
		[ 28.9, -66.10, 0.25, 0.12, 2.4, 1.12 ],
		[ 24.8, -66.40, 0.34, 0.09, 0.6, 1.05 ],
		[ 30.3, -66.35, 0.29, 0.13, 1.7, 1.00 ],
		[ 23.1, -67.35, 0.33, 0.10, 3.1, 0.95 ],
		[ 32.2, -67.25, 0.31, 0.09, 4.5, 1.10 ],
		[ 24.0, -65.60, 0.28, 0.11, 5.8, 0.92 ],
		[ 29.0, -65.20, 0.24, 0.07, 0.5, 0.90 ],
		[ 31.4, -65.55, 0.30, 0.10, 2.9, 1.08 ],
	];
	const animals = sites.map( ( [ x, z, rx, rz, phase, scale ], i ) => {
		const root = new Group();
		root.name = `Hermit crab ${ i + 1 }`;
		root.scale.setScalar( scale );
		const shell = new Group();
		shell.position.set( 0, 0.093, -0.040 );
		shell.add( mesh( shellGeometry, shellMaterial, 'Spiral shell' ), mesh( grooveGeometry, grooveMaterial, 'Spiral groove and opening' ) );
		const leftLegs = new Group(), rightLegs = new Group();
		leftLegs.add( mesh( leftGeometry, bodyMaterial, 'Three left legs' ) );
		rightLegs.add( mesh( rightGeometry, bodyMaterial, 'Three right legs' ) );
		root.add( shell, mesh( bodyGeometry, bodyMaterial, 'Body, pincers and eye stalks' ), mesh( eyeGeometry, eyeMaterial, 'Two black eyes' ), leftLegs, rightLegs );
		group.add( root );
		return { type: 'hermit-crab', root, shell, leftLegs, rightLegs, path: { x, z, rx, rz, phase }, scale, radius: 0.17 * scale };
	} );
	const up = new Vector3( 0, 1, 0 ), normal = new Vector3(), yawRotation = new Quaternion();
	group.update = ( time ) => {
		for ( const animal of animals ) {
			const { root, shell, leftLegs, rightLegs, path } = animal;
			const q = time * 0.10 + path.phase;
			const x = path.x + path.rx * Math.sin( q );
			const z = path.z + path.rz * Math.sin( q * 2 + path.phase * 0.4 );
			const dx = path.rx * Math.cos( q ), dz = path.rz * 2 * Math.cos( q * 2 + path.phase * 0.4 );
			root.position.set( x, terrainData.heightAt( x, z ) + 0.006, z );
			terrainData.normalAt( x, z, normal );
			root.quaternion.setFromUnitVectors( up, normal ).multiply( yawRotation.setFromAxisAngle( up, Math.atan2( dx, dz ) ) );
			const stride = time * 4.0 + path.phase * 3;
			const step = Math.sin( stride );
			leftLegs.position.set( 0, Math.max( 0, step ) * 0.011, step * 0.012 );
			rightLegs.position.set( 0, Math.max( 0, -step ) * 0.011, -step * 0.012 );
			leftLegs.rotation.y = step * 0.09;
			rightLegs.rotation.y = -step * 0.09;
			shell.position.y = 0.093 + Math.sin( stride * 0.5 ) * 0.001;
			shell.rotation.z = Math.sin( stride ) * 0.025;
		}
		group.updateMatrixWorld( true );
	};
	group.userData.crabs = { animals };
	group.update( 0 );
	return group;

}
