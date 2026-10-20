import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CompatibleNES} from '../src/nes-core.js';
function machine(){
 const bytes=Buffer.alloc(16+8*16384+32*8192);bytes.set([0x4e,0x45,0x53,0x1a,8,32,0x70,0x10]);
 for(let b=0;b<16;b++)bytes.fill(b,16+b*8192,16+(b+1)*8192);
 for(let b=0;b<256;b++)bytes.fill(b,16+131072+b*1024,16+131072+(b+1)*1024);
 const n=new CompatibleNES();n.loadROM(bytes);return n;
}
test('VRC2b switches two 8K PRG windows and preserves the fixed last 16K',()=>{
 const n=machine();n.mmap.write(0x8fff,5);n.mmap.write(0xafff,7);
 assert.deepEqual([0x8000,0xa000,0xc000,0xe000].map(a=>n.cpu.mem[a]),[5,7,14,15]);
});
test('VRC2b independently switches eight 1K CHR windows including expanded banks',()=>{
 const n=machine();for(let i=0;i<8;i++){const a=0xb000+(i>>1)*0x1000+(i%2)*2;const b=128+i*13;n.mmap.write(a,b&15);n.mmap.write(a+1,b>>4);}
 assert.deepEqual(Array.from({length:8},(_,i)=>n.ppu.vramMem[i*1024]),Array.from({length:8},(_,i)=>128+i*13));
 n.mmap.write(0xb001,0x1f);assert.equal(n.mmap.chr[0],240,'VRC2 ignores high bit 4');
});
test('VRC2b latch aliases and nametable mirroring behave as hardware',()=>{
 const n=machine();n.cpu.dataBus=0x60;n.mmap.write(0x6100,1);assert.equal(n.mmap.load(0x6000),0x61);assert.equal(n.mmap.load(0x6fff),0x61);
 n.mmap.write(0x6000,2);assert.equal(n.mmap.load(0x6100),0x60);n.mmap.write(0x9003,255);assert.equal(n.ppu.currentMirroring,n.rom.HORIZONTAL_MIRRORING);
 n.mmap.write(0x9000,2);assert.equal(n.ppu.currentMirroring,n.rom.VERTICAL_MIRRORING);
});
test('VRC2b register state survives JSON restoration and later bank writes',()=>{
 const n=machine();n.mmap.write(0xb001,8);n.mmap.write(0x6000,1);const state=JSON.parse(JSON.stringify(n.toJSON()));n.fromJSON(state);
 n.mmap.write(0xb000,7);assert.equal(n.ppu.vramMem[0],135);assert.equal(n.mmap.load(0x6000)&1,1);
});
const paths=JSON.parse(process.env.NES_MAPPER23_ROMS||'[]');
for(const path of paths)test(`private VRC2b ROM: gameplay, peer determinism and save continuation (${path.split('/').pop()})`,()=>{
 const bytes=readFileSync(path);const a=new CompatibleNES(),b=new CompatibleNES();a.loadROM(bytes);b.loadROM(bytes);
 for(let f=0;f<1400;f++)for(const n of [a,b]){n[(f>=350&&f<360)||(f>=650&&f<660)?'buttonDown':'buttonUp'](1,3);n.frame();}
 assert.ok(new Set(a.ppu.buffer).size>8);assert.deepEqual(a.toJSON(),b.toJSON());
 const restored=new CompatibleNES();restored.loadROM(bytes);restored.fromJSON(JSON.parse(JSON.stringify(a.toJSON())));
 for(let f=0;f<180;f++)for(const n of [a,restored]){n.buttonDown(1,7);n.buttonDown(1,1);n.frame();}
 assert.deepEqual(a.toJSON(),restored.toJSON());
});
