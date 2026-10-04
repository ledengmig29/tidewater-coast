import {
	Group, Mesh, SphereGeometry, CylinderGeometry, TorusGeometry,
	BufferGeometry, Float32BufferAttribute, Vector3, Quaternion, Color, mergeGeometries,
} from '../engine/index.js';
import { standard } from '../materials/Materials.js';
import { LAYERS } from '../engine/render/SceneRenderer.js';

export function createSeaLife( terrainData ) {

	const seaLife = new Group();
	seaLife.name = 'Shallow-water marine life';
	const animals = [];
	const skin = standard( { name: 'sea-life-skin', color: 0xffffff, roughness: 0.70, vertexColors: true } );
	const shell = standard( { name: 'sea-turtle-shell', color: 0xffffff, roughness: 0.64, vertexColors: true } );
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
	function surface( positions, index, hex ) {
		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( positions, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( new Float32Array( positions.length / 3 * 2 ), 2 ) );
		g.setIndex( index );
		g.computeVertexNormals();
		return color( g, hex );
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
	function mirror( g ) {
		const left = g.clone().scale( -1, 1, 1 );
		const index = left.index.array;
		for ( let i = 0; i < index.length; i += 3 ) [ index[ i + 1 ], index[ i + 2 ] ] = [ index[ i + 2 ], index[ i + 1 ] ];
		return finish( left );
	}

	// Broad cambered manta wings have pale undersides and thin tapered tips.
	const wingPoints = [ [ 0, 0.46, -0.48, 0.07 ], [ 0.27, 0.42, -0.44, 0.065 ], [ 0.55, 0.28, -0.37, 0.045 ], [ 0.80, 0.10, -0.24, 0.025 ], [ 1.04, -0.085, -0.105, 0.008 ] ];
	const wingPositions = [], wingIndex = [];
	for ( const underside of [ false, true ] ) {
		for ( const [ x, leading, trailing, thickness ] of wingPoints ) {
			for ( let j = 0; j < 3; j ++ ) wingPositions.push( x, ( underside ? -1 : 1 ) * thickness * ( j === 1 ? 1 : 0.60 ), leading + ( trailing - leading ) * j / 2 );
		}
	}
	for ( let side = 0; side < 2; side ++ ) {
		for ( let i = 0; i < 4; i ++ ) for ( let j = 0; j < 2; j ++ ) {
			const a = side * 15 + i * 3 + j;
			wingIndex.push( ...( side === 0 ? [ a, a + 3, a + 1, a + 1, a + 3, a + 4 ] : [ a, a + 1, a + 3, a + 1, a + 4, a + 3 ] ) );
		}
	}
	const quad = ( a, b, c, d ) => wingIndex.push( a, b, c, a, c, d );
	for ( let i = 0; i < 4; i ++ ) {
		const a = i * 3, b = ( i + 1 ) * 3;
		quad( a, a + 15, b + 15, b );
		quad( a + 2, b + 2, b + 17, a + 17 );
	}
	quad( 0, 2, 17, 15 );
	quad( 12, 27, 29, 14 );
	const rightWing = surface( wingPositions, wingIndex, 0x526572 );
	const pale = new Color( 0xd3d6c6 ), dark = new Color( 0x435561 );
	const wingColors = rightWing.attributes.color.array;
	for ( let i = 0; i < 30; i ++ ) {
		const c = i >= 15 ? pale : dark;
		wingColors.set( [ c.r, c.g, c.b, 1 ], i * 4 );
	}
	finish( rightWing );
	const leftWing = mirror( rightWing );
	const mantaParts = [
		sphere( 0x435561, [ 0.27, 0.10, 0.47 ], [ 0, 0.015, 0 ] ),
		sphere( 0xd3d6c6, [ 0.26, 0.023, 0.44 ], [ 0, -0.067, 0 ] ),
	];
	for ( const s of [ -1, 1 ] ) {
		mantaParts.push( sphere( 0x182b2c, [ 0.026, 0.020, 0.035 ], [ s * 0.227, 0.068, 0.30 ] ) );
		const points = [ [ s * 0.14, 0.03, 0.39 ], [ s * 0.16, 0.02, 0.53 ], [ s * 0.14, 0.07, 0.61 ], [ s * 0.12, 0.10, 0.57 ] ];
		for ( let i = 1; i < points.length; i ++ ) mantaParts.push( rod( points[ i - 1 ], points[ i ], 0.031 - i * 0.004, 0x526572 ) );
	}
	const mantaBody = merge( mantaParts ), tailParts = [];
	for ( let i = 0; i < 7; i ++ ) tailParts.push( rod( [ Math.sin( i * 0.6 ) * 0.024, -0.01, -i * 0.13 ], [ Math.sin( ( i + 1 ) * 0.6 ) * 0.024, -0.01, -( i + 1 ) * 0.13 ], 0.013 - i * 0.0014, 0x435561, 0.0116 - i * 0.0014 ) );
	const mantaTail = merge( tailParts );
	function manta( path, phase, speed ) {
		const root = new Group(); root.name = 'Manta ray';
		root.add( mesh( mantaBody, skin, 'manta-body-head-fins' ) );
		const left = mesh( leftWing, skin, 'manta-left-wing' ), right = mesh( rightWing, skin, 'manta-right-wing' );
		left.position.x = -0.14; right.position.x = 0.14;
		const tail = mesh( mantaTail, skin, 'manta-tail' ); tail.position.z = -0.43;
		root.add( left, right, tail );
		animals.push( { type: 'manta-ray', root, path, phase, speed, depth: -0.56, joints: { left, right, tail } } );
		seaLife.add( root );
	}

	// Raised individual shell scutes sit over a dark domed carapace.
	const shellParts = [ color( new SphereGeometry( 1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2 ).scale( 0.32, 0.18, 0.42 ), 0x3d573e ) ];
	function scute( u, v, ru, rv, hex ) {
		const positions = [];
		const point = ( a, b ) => [ a * 0.32, 0.18 * Math.sqrt( Math.max( 0.001, 1 - a * a - b * b ) ) + 0.006, b * 0.42 ];
		positions.push( ...point( u, v ) );
		for ( let i = 0; i < 6; i ++ ) {
			const a = i * Math.PI / 3;
			positions.push( ...point( u + ru * Math.cos( a ), v + rv * Math.sin( a ) ) );
		}
		const index = [];
		for ( let i = 0; i < 6; i ++ ) index.push( 0, ( i + 1 ) % 6 + 1, i + 1 );
		shellParts.push( surface( positions, index, hex ) );
	}
	for ( let i = 0; i < 5; i ++ ) scute( 0, ( i - 2 ) * 0.32, 0.27, 0.17, i % 2 ? 0x77865a : 0x63784e );
	for ( const s of [ -1, 1 ] ) for ( let i = 0; i < 3; i ++ ) scute( s * 0.50, ( i - 1 ) * 0.46, 0.23, 0.23, i % 2 ? 0x7c8e5c : 0x536e45 );
	const turtleShell = merge( shellParts );
	const turtleParts = [
		sphere( 0xd2c996, [ 0.31, 0.049, 0.41 ], [ 0, -0.035, 0 ] ),
		sphere( 0x77956b, [ 0.086, 0.048, 0.13 ], [ 0, -0.024, 0.39 ] ),
		sphere( 0x87a57d, [ 0.107, 0.070, 0.135 ], [ 0, -0.018, 0.53 ] ),
		sphere( 0xc2bc8e, [ 0.059, 0.030, 0.035 ], [ 0, -0.027, 0.651 ] ),
		rod( [ 0, -0.02, -0.38 ], [ 0, -0.04, -0.56 ], 0.027, 0x77956b, 0.005 ),
	];
	for ( const s of [ -1, 1 ] ) {
		turtleParts.push( sphere( 0x142e29, [ 0.019, 0.016, 0.021 ], [ s * 0.088, 0.014, 0.575 ] ) );
		for ( let i = 0; i < 3; i ++ ) turtleParts.push( sphere( 0xc4c69b, [ 0.010, 0.006, 0.013 ], [ s * ( 0.03 + i * 0.018 ), 0.043 - i * 0.008, 0.52 + i * 0.029 ] ) );
	}
	const turtleBody = merge( turtleParts );
	const frontFlipper = finish( color( new SphereGeometry( 1, 14, 8 ).scale( 0.11, 0.025, 0.32 ).rotateY( 0.65 ).translate( 0.17, -0.005, 0.12 ), 0x77956b ) );
	const backFlipper = finish( color( new SphereGeometry( 1, 12, 7 ).scale( 0.09, 0.021, 0.19 ).rotateY( -0.66 ).translate( 0.10, -0.005, -0.08 ), 0x77956b ) );
	const frontLeft = mirror( frontFlipper ), backLeft = mirror( backFlipper );
	function turtle( path, phase, speed ) {
		const root = new Group(); root.name = 'Sea turtle';
		root.add( mesh( turtleBody, skin, 'turtle-head-eyes-plastron' ), mesh( turtleShell, shell, 'turtle-carapace-scutes' ) );
		const fins = [];
		for ( const s of [ -1, 1 ] ) for ( const front of [ true, false ] ) {
			const fin = mesh( front ? s < 0 ? frontLeft : frontFlipper : s < 0 ? backLeft : backFlipper, skin, `turtle-${ s < 0 ? 'left' : 'right' }-${ front ? 'front' : 'rear' }-flipper` );
			fin.position.set( s * ( front ? 0.24 : 0.21 ), -0.045, front ? 0.16 : -0.25 );
			root.add( fin ); fins.push( { fin, side: s, front } );
		}
		animals.push( { type: 'sea-turtle', root, path, phase, speed, depth: -0.37, joints: { fins } } );
		seaLife.add( root );
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

	manta( { x: 22, z: -53.4, rx: 1.75, rz: 1.0 }, 0.4, 0.13 );
	manta( { x: 29, z: -52.7, rx: 2.0, rz: 0.9 }, 2.7, 0.11 );
	manta( { x: 36, z: -53.7, rx: 1.55, rz: 1.0 }, 4.6, 0.14 );
	for ( let i = 0; i < 5; i ++ ) turtle( { x: 16 + i * 6, z: -56.6 + i % 2 * 0.7, rx: 1.1 + i % 2 * 0.2, rz: 0.75 }, i * 1.3, 0.12 + i * 0.008 );
	for ( let i = 0; i < 15; i ++ ) {
		const row = Math.floor( i / 5 ), column = i % 5;
		jellyfish( { x: 17 + column * 5.35 + row * 0.35, z: -54 + row * 0.85, rx: 0.28 + i % 3 * 0.045, rz: 0.28 }, i * 2.4, 0.085 + i % 4 * 0.009, 0.86 + i % 3 * 0.06 );
	}
	seaLife.update = ( time ) => {
		for ( const animal of animals ) {
			const { root, path, phase, speed, joints } = animal;
			const p = time * speed + phase;
			const bob = animal.type === 'pink-jellyfish' ? 0.030 * Math.sin( time * 1.35 + phase ) : 0.022 * Math.sin( time * 0.68 + phase );
			root.position.set( path.x + path.rx * Math.cos( p ), animal.depth + bob, path.z + path.rz * Math.sin( p ) );
			root.rotation.y = Math.atan2( -path.rx * Math.sin( p ), path.rz * Math.cos( p ) );
			if ( animal.type === 'manta-ray' ) {
				const beat = 0.20 * Math.sin( time * 1.7 + phase );
				joints.left.rotation.z = -beat; joints.right.rotation.z = beat;
				joints.tail.rotation.y = 0.08 * Math.sin( time * 1.4 + phase + 0.7 );
			} else if ( animal.type === 'sea-turtle' ) {
				for ( const { fin, side, front } of joints.fins ) {
					const beat = time * 2.2 + phase + ( front ? 0 : 1.0 );
					fin.rotation.z = side * ( front ? 0.30 : 0.18 ) * Math.sin( beat );
					fin.rotation.x = ( front ? 0.10 : 0.07 ) * Math.cos( beat );
				}
			} else {
				const pulse = Math.sin( time * 2.0 + phase ), radial = 0.95 - pulse * 0.07;
				joints.umbrella.scale.set( radial, 1 + pulse * 0.07, radial );
				joints.arms.rotation.y = 0.16 * Math.sin( time * 1.1 + phase );
				joints.arms.scale.y = 1 - pulse * 0.045;
				joints.tentacles.scale.set( radial, 1 + 0.05 * Math.sin( time * 1.8 + phase - 0.8 ), radial );
				joints.tentacles.rotation.x = 0.065 * Math.sin( time * 1.3 + phase );
				joints.tentacles.rotation.z = 0.045 * Math.cos( time * 1.15 + phase );
			}
		}
		seaLife.updateMatrixWorld( true );
	};
	seaLife.userData.seaLife = { animals };
	seaLife.update( 0 );
	return seaLife;

}
