// Tidewater input adapted for a touch-friendly viewer. No automatic pointer lock.
export class Input {
	constructor( dom ) {
		this.dom = dom;
		this.keys = new Set();
		this.pressed = new Set();
		this.look = { x: 0, y: 0 };
		this.wheel = 0;
		this.mouseDown = false;
		this.rightDown = false;
		this.locked = false;
		this.enabled = true;
		this.pointer = null;
		dom.style.touchAction = 'none';
		const clear = () => {
			this.keys.clear();
			this.pressed.clear();
			this.look.x = this.look.y = this.wheel = 0;
			this.mouseDown = this.rightDown = false;
			this.pointer = null;
		};
		window.addEventListener( 'keydown', e => {
			if ( ! this.enabled || e.ctrlKey || e.metaKey || e.altKey ) return;
			if ( e.target?.closest?.( 'input, select, textarea, button, a, [contenteditable="true"]' ) ) return;
			if ( ! this.keys.has( e.code ) ) this.pressed.add( e.code );
			this.keys.add( e.code );
			if ( e.code === 'Space' && e.target === dom ) e.preventDefault();
		} );
		window.addEventListener( 'keyup', e => this.keys.delete( e.code ) );
		window.addEventListener( 'blur', clear );
		dom.addEventListener( 'blur', clear );
		dom.addEventListener( 'pointerdown', e => {
			if ( ! this.enabled || this.pointer !== null || ! [ 0, 2 ].includes( e.button ) ) return;
			this.pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
			this.mouseDown = e.button === 0;
			this.rightDown = e.button === 2;
			dom.focus( { preventScroll: true } );
			dom.setPointerCapture( e.pointerId );
		} );
		dom.addEventListener( 'pointermove', e => {
			if ( ! this.enabled || ! this.pointer || e.pointerId !== this.pointer.id || this.locked ) return;
			this.look.x += e.clientX - this.pointer.x;
			this.look.y += e.clientY - this.pointer.y;
			this.pointer.x = e.clientX;
			this.pointer.y = e.clientY;
		} );
		const release = e => {
			if ( this.pointer?.id !== e.pointerId ) return;
			this.pointer = null;
			this.mouseDown = this.rightDown = false;
		};
		dom.addEventListener( 'pointerup', release );
		dom.addEventListener( 'pointercancel', release );
		dom.addEventListener( 'lostpointercapture', release );
		dom.addEventListener( 'contextmenu', e => e.preventDefault() );
		dom.addEventListener( 'wheel', e => {
			if ( ! this.enabled ) return;
			this.wheel += Math.sign( e.deltaY );
			e.preventDefault();
		}, { passive: false } );
		document.addEventListener( 'pointerlockchange', () => {
			this.locked = document.pointerLockElement === dom;
		} );
		window.addEventListener( 'mousemove', e => {
			if ( this.enabled && this.locked ) {
				this.look.x += e.movementX;
				this.look.y += e.movementY;
			}
		} );
	}

	requestLock() {
		if ( ! this.locked ) this.dom.requestPointerLock?.()?.catch?.( () => {} );
	}
	down( code ) { return this.enabled && this.keys.has( code ); }
	hit( code ) { return this.enabled && this.pressed.has( code ); }
	consumeLook() {
		const look = { ...this.look };
		this.look.x = this.look.y = 0;
		return this.enabled ? look : { x: 0, y: 0 };
	}
	consumeWheel() {
		const wheel = this.wheel;
		this.wheel = 0;
		return this.enabled ? wheel : 0;
	}
	endFrame() { this.pressed.clear(); }
}
