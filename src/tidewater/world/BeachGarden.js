import {
	Group, Mesh, BufferGeometry, Float32BufferAttribute,
	CylinderGeometry, SphereGeometry, Vector3, Quaternion, mergeGeometries,
} from '../engine/index.js';
import { standard } from '../materials/Materials.js';

// Static, individually shaped pinnate foliage; merge by material so the garden
// adds seven draws rather than one draw for every leaflet and stem.
export function createBeachGarden( terrainData ) {

	const garden = new Group();
	garden.name = 'Hawaiian beach garden';
	const plants = [], batches = new Map();
	const bark = standard( {
		name: 'garden-palm-bark', color: 0x8b7654, roughness: 0.97,
		surface: 's.albedo *= 0.89 + 0.08 * sin( in.P.y * 31.0 ) + 0.035 * sin( in.P.x * 28.0 + in.P.z * 17.0 );',
	} );
	const leaves = [ 0x3b6e3e, 0x508848, 0x72934e ].map( ( color, i ) => standard( {
		name: `garden-leaf-${ i }`, color, roughness: 0.84, side: 'double',
		surface: 's.albedo *= 0.94 + 0.06 * cos( in.uv.y * 6.283185 ); s.translucency = vec3f( 0.12 );',
	} ) );
	const flowers = [ 0xd97767, 0xf1dfb6 ].map( ( color, i ) => standard( { name: `garden-flower-${ i }`, color, roughness: 0.88, side: 'double' } ) );
	const pollen = standard( { name: 'garden-pollen', color: 0xcda554, roughness: 0.86 } );
	function add( geometry, material ) {
		if ( ! batches.has( material ) ) batches.set( material, [] );
		batches.get( material ).push( geometry );
	}
	function geometry( positions, uv, indices ) {
		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( positions, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
		g.setIndex( indices );
		g.computeVertexNormals();
		return g;
	}
	function rod( a, b, radius, material = leaves[ 0 ], topRadius = radius ) {
		const delta = b.clone().sub( a ), center = a.clone().add( b ).multiplyScalar( 0.5 );
		const g = new CylinderGeometry( topRadius, radius, delta.length(), 6 );
		g.applyQuaternion( new Quaternion().setFromUnitVectors( new Vector3( 0, 1, 0 ), delta.normalize() ) );
		add( g.translate( center.x, center.y, center.z ), material );
	}
	function sphere( center, scale, material, angle = 0 ) {
		add( new SphereGeometry( 1, 12, 8 ).scale( ...scale ).rotateY( angle ).translate( center.x, center.y, center.z ), material );
	}
	function ribbon( point, width, material ) {
		const p = [], uv = [], index = [];
		for ( let i = 0; i <= 5; i ++ ) {
			const t = i / 5, center = point( t );
			const tangent = point( Math.min( 1, t + 0.01 ) ).sub( point( Math.max( 0, t - 0.01 ) ) );
			const side = new Vector3( tangent.z, 0, -tangent.x ).normalize();
			const w = width * ( 0.02 + 0.98 * Math.sin( Math.PI * t ) ** 0.75 );
			for ( let j = -1; j <= 1; j ++ ) {
				p.push( center.x + side.x * w * j, center.y + ( j === 0 ? w * 0.18 : 0 ), center.z + side.z * w * j );
				uv.push( t, ( j + 1 ) / 2 );
			}
			if ( i < 5 ) for ( let j = 0; j < 2; j ++ ) {
				const a = i * 3 + j;
				index.push( a, a + 3, a + 1, a + 1, a + 3, a + 4 );
			}
		}
		add( geometry( p, uv, index ), material );
	}
	function frond( start, angle, length, arch, drop, pairs, leafletLength, material ) {
		const forward = new Vector3( Math.cos( angle ), 0, Math.sin( angle ) );
		const across = new Vector3( -forward.z, 0, forward.x );
		const point = ( t ) => start.clone().addScaledVector( forward, length * t ).add( new Vector3( 0, arch * Math.sin( Math.PI * t ) - drop * t * t, 0 ) );
		for ( let i = 0; i < 8; i ++ ) rod( point( i / 8 ), point( ( i + 1 ) / 8 ), 0.020 * ( 1 - i / 10 ), leaves[ 0 ] );
		for ( let i = 0; i < pairs; i ++ ) {
			const t = 0.10 + i / pairs * 0.87;
			const base = point( t );
			const leafLength = leafletLength * ( 0.26 + 0.74 * Math.sin( Math.PI * t ) );
			for ( const side of [ -1, 1 ] ) {
				const direction = across.clone().multiplyScalar( side ).addScaledVector( forward, 0.28 ).normalize();
				ribbon( ( s ) => base.clone().addScaledVector( direction, leafLength * s ).add( new Vector3( 0, 0.08 * Math.sin( Math.PI * s ) - 0.15 * s * s, 0 ) ), leafLength * 0.065, material );
			}
		}
		// The last leaf is a tapering spear; it closes the central rachis naturally.
		ribbon( ( t ) => point( 0.88 + t * 0.12 ), 0.025, material );
	}
	function palm( x, z, height, lean, angle ) {
		const groundY = terrainData.heightAt( x, z );
		if ( groundY < 1.2 ) return;
		const baseY = groundY - 0.06;
		const path = ( t ) => new Vector3( x + Math.cos( angle ) * lean * t * t, baseY + height * t, z + Math.sin( angle ) * lean * t * t );
		const p = [], uv = [], index = [];
		for ( let i = 0; i <= 30; i ++ ) {
			const t = i / 30, center = path( t );
			const radius = 0.20 - 0.105 * t + 0.010 * Math.cos( i * Math.PI );
			for ( let j = 0; j <= 10; j ++ ) {
				const a = j / 10 * Math.PI * 2;
				p.push( center.x + Math.cos( a ) * radius, center.y, center.z + Math.sin( a ) * radius );
				uv.push( j / 10, t );
				if ( i < 30 && j < 10 ) {
					const n = i * 11 + j;
					index.push( n, n + 11, n + 1, n + 1, n + 11, n + 12 );
				}
			}
		}
		add( geometry( p, uv, index ), bark );
		const crown = path( 1 );
		sphere( crown.clone().add( new Vector3( 0, -0.08, 0 ) ), [ 0.24, 0.30, 0.24 ], leaves[ 0 ] );
		for ( let i = 0; i < 11; i ++ ) {
			const a = angle + i * Math.PI * 2 / 11;
			const young = i % 4 === 0;
			frond( crown, a, young ? 1.75 : 2.25 + i % 3 * 0.18, young ? 0.55 : 0.38, young ? -0.42 : 0.8 + i % 3 * 0.17, 20, 0.56, leaves[ i % 3 ] );
		}
		for ( let i = 0; i < 3; i ++ ) {
			const a = angle + i * 2.1;
			sphere( crown.clone().add( new Vector3( Math.cos( a ) * 0.16, -0.30, Math.sin( a ) * 0.16 ) ), [ 0.11, 0.145, 0.11 ], bark );
		}
		plants.push( { type: 'palm', x, z, groundY, baseY, radius: 2.75, height: height + 0.80 } );
	}
	function cycad( x, z, rotation, size ) {
		const groundY = terrainData.heightAt( x, z );
		if ( groundY < 1.2 ) return;
		const baseY = groundY - 0.06;
		sphere( new Vector3( x, baseY + 0.28 * size, z ), [ 0.23 * size, 0.33 * size, 0.23 * size ], bark );
		const crown = new Vector3( x, baseY + 0.56 * size, z );
		for ( let i = 0; i < 12; i ++ ) frond( crown, rotation + i * Math.PI * 2 / 12, ( 1.18 + i % 3 * 0.12 ) * size, 0.40 * size, 0.22 * size, 15, 0.31 * size, leaves[ i % 2 ] );
		for ( let i = 0; i < 4; i ++ ) frond( crown.clone().add( new Vector3( 0, 0.11, 0 ) ), rotation + i * Math.PI / 2, 0.74 * size, 0.43 * size, -0.24 * size, 12, 0.24 * size, leaves[ 1 ] );
		plants.push( { type: 'cycad', x, z, groundY, baseY, radius: 1.65 * size, height: 1.3 * size } );
	}
	function flowerPatch( x, z, rotation ) {
		const groundY = terrainData.heightAt( x, z );
		if ( groundY < 1.2 ) return;
		const baseY = groundY - 0.035;
		for ( let i = 0; i < 22; i ++ ) {
			const a = i * 2.4 + rotation, r = 0.14 + 0.035 * ( i % 8 );
			const base = new Vector3( x + Math.cos( a ) * r, baseY, z + Math.sin( a ) * r );
			const direction = new Vector3( Math.cos( a ), 0, Math.sin( a ) );
			const h = 0.31 + i % 5 * 0.065;
			ribbon( ( t ) => base.clone().addScaledVector( direction, 0.20 * t * t ).add( new Vector3( 0, h * t, 0 ) ), 0.016, leaves[ i % 3 ] );
		}
		for ( let i = 0; i < 7; i ++ ) {
			const a = rotation + i * 2.4;
			const start = new Vector3( x + 0.17 * Math.cos( a ), baseY, z + 0.17 * Math.sin( a ) );
			const top = start.clone().add( new Vector3( Math.cos( a ) * 0.14, 0.45 + i % 3 * 0.09, Math.sin( a ) * 0.14 ) );
			rod( start, top, 0.009 );
			for ( const side of [ -1, 1 ] ) {
				const leafStart = start.clone().lerp( top, 0.46 );
				ribbon( ( t ) => leafStart.clone().add( new Vector3( Math.cos( a + side ) * 0.21 * t, 0.07 * Math.sin( Math.PI * t ), Math.sin( a + side ) * 0.21 * t ) ), 0.045, leaves[ 1 ] );
			}
			for ( let k = 0; k < 5; k ++ ) {
				const phi = k * Math.PI * 2 / 5;
				sphere( top.clone().add( new Vector3( Math.cos( phi ) * 0.064, 0, Math.sin( phi ) * 0.064 ) ), [ 0.066, 0.026, 0.052 ], flowers[ i % 2 ], phi );
			}
			sphere( top.clone().add( new Vector3( 0, 0.022, 0 ) ), [ 0.025, 0.020, 0.025 ], pollen );
		}
		plants.push( { type: 'flowers-and-grass', x, z, groundY, baseY, radius: 0.62, height: 0.73 } );
	}

	// Keep all roots beside or behind the house, leaving the front stairs open.
	palm( 21.4, -79.8, 6.4, 0.65, 3.7 );
	palm( 34.5, -79.9, 5.4, 0.50, -0.5 );
	palm( 21.2, -73.0, 4.5, 0.80, 3.1 );
	cycad( 21.30, -76.0, 0.2, 0.85 );
	cycad( 34.65, -76.0, 1.4, 0.90 );
	cycad( 21.3, -70.6, 0.8, 0.78 );
	cycad( 34.70, -70.7, 2.3, 0.84 );
	flowerPatch( 22.10, -69.1, 0.4 );
	flowerPatch( 34.40, -68.5, 1.7 );
	flowerPatch( 32.70, -80.3, 2.1 );
	for ( const [ material, parts ] of batches ) {
		const merged = mergeGeometries( parts );
		merged.computeBoundingBox();
		merged.computeBoundingSphere();
		const mesh = new Mesh( merged, material );
		mesh.name = material.name;
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		garden.add( mesh );
	}
	garden.userData.garden = { plants, drawCount: garden.children.length };
	return garden;

}
