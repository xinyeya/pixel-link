# FCEUmm WebAssembly build

Pinned upstream: https://github.com/libretro/libretro-fceumm
Revision: ac0d00a7fc01166f84c7bac01d1084ebfd2b865e
Compiler: Emscripten 4.0.20. Host bridge: GPL-2.0-or-later.

Prebuilt files: `public/cores/fceumm.js`, `public/cores/fceumm.wasm`.
No compiler is required on the production server. No ROMs are included.
The unmodified upstream corresponding source is in `upstream-source.tar.gz`.
The Makefile and bridge.c are the complete additional build sources.

To rebuild from a project checkout (Emscripten 4.0.20 installed and activated):

```sh
mkdir -p /tmp/pixel-link-fceumm-source
tar -xzf native/fceumm/upstream-source.tar.gz -C /tmp/pixel-link-fceumm-source
make -C native/fceumm CORE_SOURCE=/tmp/pixel-link-fceumm-source -j8
npm run build
```

This build includes all upstream mapper implementations, full 256x240 video,
48kHz stereo output, two standard joypads, one explicit retro_run per frame,
and libretro serialize/unserialize. Optional HD texture packs and NTSC filters
are omitted. ROMs and core filesystems live exclusively in browser memory;
user save states are stored by the host app in local IndexedDB.

Power-on RAM is fixed to FF for deterministic peers. Core option defaults are
negotiated from upstream; user-specific core options are not enabled. Fresh
starts instantiate new WASM modules, rather than reusing process-global state.
PAL/NTSC automatic frame timing is exposed to the host scheduler.
