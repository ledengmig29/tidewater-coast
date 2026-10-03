# Third-party notices

## Tidewater coastal rendering

The modules under `src/tidewater/` are extracted or adapted from
[dgreenheck/tidewater](https://github.com/dgreenheck/tidewater), commit
`4811ba48d795197de5621985f404e765c0b7c0ef`.

Copyright (c) 2026 DRG Software Solutions LLC. Licensed under the MIT License,
reproduced below and in `src/tidewater/LICENSE`.

The original ocean FFT, shore waves, breaking waves, spray, swash simulation,
sand shading, terrain, atmosphere and postprocessing are
retained. The terrain is adapted to a low sandy coast with half the former land
area (each horizontal axis scaled by sqrt(0.5)); mountains, scattered rocks
and procedural vegetation are removed from the active viewer. `CoastalApp.js`
assembles these into an environment viewer. The input
module was adapted for pointer/touch dragging and keyboard accessibility. Cloud
and SMAA asset paths were relocated to `public/tidewater/`. `TerrainGPU` retains
the shore field on the CPU so the existing wave-direction cache can be built.
The fishing game,
vendors, characters, boat, village, sound system and scanned models are omitted.

The cloud noise files under `public/tidewater/clouds/` come from the same source.
The upstream credits state that its cloud implementation, adapted from its own
Sky Pro WebGPU, is published under MIT by the copyright holder. The original
asset licensing notice is also retained in that folder.

The SMAA area/search lookup images under `public/tidewater/textures/smaa/` are
from three.js / the SMAA reference implementation, under MIT. References:
[three.js license](https://github.com/mrdoob/three.js/blob/dev/LICENSE),
[SMAA license](https://github.com/iryoku/smaa/blob/master/LICENSE.txt).

## MIT License — Tidewater

Copyright (c) 2026 DRG Software Solutions LLC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
