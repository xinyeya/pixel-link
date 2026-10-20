import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CompatibleNES} from '../src/nes-core.js';
import {snapshot} from '../src/save-store.js';
import {validateSave} from '../shared/session.js';
import {Emulator} from '../src/emulator.js';
import createModule from '../public/cores/fceumm.js';
import {FCEUmmCore} from '../src/fceumm-core.js';
const originalCreate=FCEUmmCore.create;
FCEUmmCore.create=(bytes,options)=>originalCreate.call(FCEUmmCore,bytes,{...options,factory:opts=>createModule({...opts,wasmBinary:readFileSync(new URL('../public/cores/fceumm.wasm',import.meta.url))})});
import {createHash} from 'node:crypto';
const rom=readFileSync(new URL('../public/demo.nes',import.meta.url));
const game={name:'original demo',hash:createHash('sha256').update(rom).digest('hex')};
function canvas(){return {getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:()=>{}})};}
test('save roundtrip resumes both machines at the same instruction and frame state',()=>{
 const a=new CompatibleNES();a.loadROM(rom);for(let i=0;i<130;i++){a.buttonDown(1,7);a.frame();}
 const save=snapshot(a,game);validateSave(save,game.hash);const b=new CompatibleNES();b.loadROM(rom);b.fromJSON(JSON.parse(JSON.stringify(save)).state);
 for(let i=0;i<90;i++){for(const n of [a,b]){n.buttonUp(1,7);n.buttonDown(2,6);n.frame();}}
 assert.deepEqual(a.toJSON(),b.toJSON());assert.ok(b.cpu.mem[0x203]>75,'restored 1P position retained');
});
test('wrong ROM and version saves are rejected; damaged restore preserves current progress',async()=>{
 const e=new Emulator(canvas());await e.load(rom);for(let i=0;i<30;i++)e.frame([128,0]);const before=snapshot(e.nes,game);
 assert.throws(()=>validateSave({...before,hash:'b'.repeat(64)},game.hash),/不一致/);assert.throws(()=>validateSave({...before,core:'old'}),/版本/);
 const damaged=structuredClone(before);damaged.state.digest='0'.repeat(64);await assert.rejects(()=>e.restore(damaged,game.hash),/损坏/);assert.deepEqual(snapshot(e.nes,game).state,before.state);
 await e.restore(before,game.hash);assert.equal(e.nes.toJSON().digest,before.state.digest);
});
test('optional private MMC1 save resumes gameplay without changing either machine',{skip:!process.env.NES_TEST_ROM},()=>{
 const bytes=readFileSync(process.env.NES_TEST_ROM),a=new CompatibleNES();a.loadROM(bytes);
 for(let f=0;f<2400;f++){const press=(f>=600&&f<610)||(f>=660&&f<670)||(f>=850&&f<860);a[press?'buttonDown':'buttonUp'](1,3);a.frame();}
 const game={name:'private test',hash:createHash('sha256').update(bytes).digest('hex')};const b=new CompatibleNES();b.loadROM(bytes);b.fromJSON(snapshot(a,game).state);
 for(let f=0;f<120;f++)for(const n of [a,b]){n.buttonDown(1,0);n.buttonDown(2,6);n.frame();}
 assert.deepEqual(a.toJSON(),b.toJSON());
});
test('legacy JSNES save loads via the old core and can continue without conversion',async()=>{
 const old=new CompatibleNES();old.loadROM(rom);for(let f=0;f<120;f++){old.buttonDown(1,7);old.frame();}
 const save=snapshot(old,game),e=new Emulator(canvas());await e.load(rom);await e.restore(save,game.hash);
 assert.equal(e.nes.coreVersion,undefined);assert.deepEqual(e.nes.toJSON(),old.toJSON());
 for(let f=0;f<60;f++){e.frame([128,0]);old.frame();}assert.deepEqual(e.nes.toJSON(),old.toJSON());
});
