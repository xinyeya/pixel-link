import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import createModule from '../public/cores/fceumm.js';
import {FCEUmmCore} from '../src/fceumm-core.js';
import {snapshot} from '../src/save-store.js';
import {validateSave,CORE_VERSION} from '../shared/session.js';
const wasmBinary=readFileSync(new URL('../public/cores/fceumm.wasm',import.meta.url));
const factory=opts=>createModule({...opts,wasmBinary});
const demo=readFileSync(new URL('../public/demo.nes',import.meta.url));
const make=bytes=>FCEUmmCore.create(bytes,{factory});
const game=bytes=>({name:'test',hash:createHash('sha256').update(bytes).digest('hex')});
test('FCEUmm two isolated instances, both controllers, serialized continuation and audio',async()=>{
 let samples=0;const a=await FCEUmmCore.create(demo,{factory,onAudioSample:()=>samples++}),b=await make(demo);
 for(let i=0;i<300;i++)for(const n of [a,b]){n.buttonDown(1,7);n.buttonDown(2,6);n.frame();}
 assert.deepEqual(a.toJSON(),b.toJSON());assert.ok(samples>200000);assert.ok(new Set(a.video()).size>2);
 const save=snapshot(a,game(demo));assert.equal(save.core,CORE_VERSION);validateSave(save,game(demo).hash);
 const restored=await make(demo);restored.fromJSON(JSON.parse(JSON.stringify(save)).state);
 for(let i=0;i<180;i++)for(const n of [a,restored]){n.buttonUp(1,7);n.buttonDown(1,0);n.frame();}
 assert.deepEqual(a.toJSON(),restored.toJSON());
 const fresh=await make(demo);assert.notEqual(fresh.toJSON().digest,a.toJSON().digest);
});
for(const path of JSON.parse(process.env.NES_FCEUMM_ROMS||'[]'))test('private FCEUmm cartridge: '+path.split('/').pop(),async()=>{
 const bytes=readFileSync(path),a=await make(bytes),b=await make(bytes);
 const mapper=(bytes[6]>>4)|(bytes[7]&240);const starts=mapper===1?[600,660,850]:[350,650];
 for(let f=0;f<2100;f++)for(const n of [a,b]){n[starts.some(t=>f>=t&&f<t+10)?'buttonDown':'buttonUp'](1,3);if(f>1400){n.buttonDown(1,1);n[f%60<15?'buttonDown':'buttonUp'](1,0);}n.frame();}
 assert.ok(new Set(a.video()).size>8);assert.deepEqual(a.toJSON(),b.toJSON());const s=a.toJSON();b.fromJSON(s);
 // MMC1_Restore deliberately clears its obsolete timestamp-based LRST.
 // Compare observable continuation, and compare two freshly restored peers
 // byte-for-byte, rather than treating that historical counter as gameplay.
 const peer=await make(bytes);peer.fromJSON(s);
 for(let f=0;f<120;f++){a.frame();b.frame();peer.frame();assert.deepEqual(a.video(),b.video());assert.equal(a.toJSON().ram,b.toJSON().ram);}
 assert.deepEqual(b.toJSON(),peer.toJSON());
});
