import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CompatibleNES} from '../src/nes-core.js';
function machine(){const bytes=Buffer.from(readFileSync(new URL('../public/demo.nes',import.meta.url)));bytes[6]=0x10;const nes=new CompatibleNES();nes.loadROM(bytes);return nes;}
function writeAt(n,cycle,address,value){n.cpu._cpuCycleBase=cycle;n.cpu.instrBusCycles=0;n.mmap.write(address,value);}
test('MMC1 accepts the first RMW write, ignores the next cycle, accepts spaced serial writes',()=>{
 const n=machine();writeAt(n,100,0xe000,1);writeAt(n,101,0xe000,0);
 assert.equal(n.mmap.regBufferCounter,1);assert.equal(n.mmap.regBuffer,1);
 for(const cycle of [106,112,118])writeAt(n,cycle,0xe000,0);
 assert.equal(n.mmap.regBufferCounter,4);writeAt(n,124,0xe000,0);assert.equal(n.mmap.regBufferCounter,0);
});
test('MMC1 consecutive reset writes are ignored, low memory remains writable',()=>{
 const n=machine();writeAt(n,20,0xe000,1);writeAt(n,21,0xe000,128);assert.equal(n.mmap.regBufferCounter,1);
 writeAt(n,30,0xe000,128);assert.equal(n.mmap.regBufferCounter,0);
 writeAt(n,31,0x6000,23);assert.equal(n.cpu.mem[0x6000],23);
});
test('MMC1 protection survives emulator reset and save-state restoration',()=>{
 const n=machine();n.reset();writeAt(n,100,0xe000,1);const state=n.toJSON();n.fromJSON(state);
 writeAt(n,101,0xe000,0);assert.equal(n.mmap.regBufferCounter,1);
 writeAt(n,108,0xe000,0);assert.equal(n.mmap.regBufferCounter,2);
});
test('optional private ROM: title, gameplay and deterministic two-player input', {skip:!process.env.NES_TEST_ROM},()=>{
 const bytes=readFileSync(process.env.NES_TEST_ROM);const machines=[new CompatibleNES(),new CompatibleNES()];machines.forEach(n=>n.loadROM(bytes));
 let colors=0;machines[0].ui.writeFrame=buffer=>{colors=new Set(buffer).size;};
 for(let frame=0;frame<2400;frame++){
  for(const n of machines){
   // Wait through the publisher screen, then press Start and exercise both pads.
   for(let p=1;p<=2;p++)for(let b=0;b<8;b++){const pressed=(b===3&&((frame>=600&&frame<610)||(frame>=660&&frame<670)||(frame>=850&&frame<860)))||(b===7&&frame>=1000&&frame<1030)||(b===0&&frame>=1100&&frame<1110);n[pressed?'buttonDown':'buttonUp'](p,b);}
   n.frame();
  }
  if(frame===300)assert.ok(colors>4,'title must not remain black');
 }
 assert.equal(machines[0].ppu.f_spriteSize,1,'exercise the 8x16 in-game sprites');
 assert.ok(colors>4,'gameplay must remain visible');assert.deepEqual(machines[0].toJSON(),machines[1].toJSON());
});
