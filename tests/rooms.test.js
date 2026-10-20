import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {WebSocketServer,WebSocket} from 'ws';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CompatibleNES as NES} from '../src/nes-core.js';
import {attachRooms,PROTOCOL} from '../server/rooms.js';
const server=createServer();const wss=new WebSocketServer({server});const activeRooms=attachRooms(wss);
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`ws://127.0.0.1:${server.address().port}`;
after(async()=>{for(const ws of wss.clients)ws.terminate();await new Promise(r=>wss.close(r));await new Promise(r=>server.close(r));});
async function client(){const ws=new WebSocket(url);const messages=[];ws.on('message',(raw,binary)=>messages.push(binary?{type:'binary',packet:Buffer.from(raw)}:JSON.parse(raw)));await new Promise(r=>ws.once('open',r));return {ws,send:data=>ws.send(JSON.stringify(data)),wait:async type=>{const until=Date.now()+2500;while(Date.now()<until){const i=messages.findIndex(m=>m.type===type);if(i!==-1)return messages.splice(i,1)[0];await new Promise(r=>setTimeout(r,5));}throw Error(`Timeout waiting ${type}`);}};}
const hash='a'.repeat(64), ready={type:'ready',hash,name:'demo',protocol:PROTOCOL};
test('room handshake advertises the running backend protocol before joining',async()=>{
 const c=await client();c.send({type:'hello',protocol:PROTOCOL});assert.equal((await c.wait('hello')).protocol,PROTOCOL);c.ws.close();
});
async function pair(){const a=await client(),b=await client();a.send({type:'create'});const room=await a.wait('joined');b.send({type:'join',code:room.code});await b.wait('joined');return {a,b,code:room.code};}
test('room access, ROM validation, authority and disconnect cleanup',async()=>{
 const {a,b,code}=await pair();const c=await client();c.send({type:'join',code});assert.match((await c.wait('error')).message,/两位/);
 a.send(ready);await new Promise(r=>setTimeout(r,20));b.send({...ready,hash:'b'.repeat(64)});assert.match((await b.wait('error')).message,/不一致/);
 b.send({type:'start'});assert.match((await b.wait('error')).message,/房主/);
 a.send({type:'start'});assert.match((await a.wait('error')).message,/等待/);
 b.send(ready);await new Promise(r=>setTimeout(r,20));a.send({type:'start'});const start=await a.wait('start');await b.wait('start');
 a.send({type:'input',epoch:start.epoch,frame:999,buttons:0});assert.match((await a.wait('error')).message,/无效/);
 b.ws.close();assert.match((await a.wait('left')).reason,/同伴/);c.send({type:'join',code});assert.match((await c.wait('error')).message,/不存在/);a.ws.close();c.ws.close();
});
test('120 lockstep frames deliver identical machine states and both controllers',async()=>{
 const {a,b}=await pair();a.send(ready);b.send(ready);await new Promise(r=>setTimeout(r,30));a.send({type:'start'});const start=await a.wait('start');assert.equal((await b.wait('start')).epoch,start.epoch);
 const rom=readFileSync(new URL('../public/demo.nes',import.meta.url));const replicas=[new NES(),new NES()];replicas.forEach(n=>n.loadROM(rom));
 for(let frame=0;frame<120;frame++){
   const masks=[frame>=50&&frame<80?128:0,frame>=80&&frame<110?64:0];
   a.send({type:'input',epoch:start.epoch,frame,buttons:masks[0]});b.send({type:'input',epoch:start.epoch,frame,buttons:masks[1]});
   const [fa,fb]=await Promise.all([a.wait('frame'),b.wait('frame')]);assert.deepEqual(fa,fb);assert.equal(fa.frame,frame);
   replicas.forEach(n=>{for(let p=1;p<=2;p++)for(let bit=0;bit<8;bit++)n[(masks[p-1]&(1<<bit))?'buttonDown':'buttonUp'](p,bit);n.frame();});
 }
 const digest=n=>createHash('sha256').update(JSON.stringify(n.toJSON())).digest('hex');assert.equal(digest(replicas[0]),digest(replicas[1]));
 assert.ok(replicas[0].cpu.mem[0x203]>75,'1P moved right');assert.ok(replicas[0].cpu.mem[0x207]<170,'2P moved left');
 a.send({type:'stop'});await a.wait('stop');await b.wait('stop');
 b.send({...ready,hash:'b'.repeat(64)});await b.wait('error');a.send({type:'start'});assert.match((await a.wait('error')).message,/等待/,'mismatched replacement clears old readiness');
 b.send(ready);await new Promise(r=>setTimeout(r,20));a.send({type:'start'});const restart=await a.wait('start');assert.notEqual(restart.epoch,start.epoch);
 a.ws.close();b.ws.close();
});
test('resume start relays a validated host save to both clients',async()=>{
 const {a,b}=await pair();a.send(ready);b.send(ready);await new Promise(r=>setTimeout(r,30));
 const {snapshot}=await import('../src/save-store.js');const n=new NES();n.loadROM(readFileSync(new URL('../public/demo.nes',import.meta.url)));for(let f=0;f<100;f++){n.buttonDown(1,7);n.frame();}
 const save=snapshot(n,{hash,name:'demo'});a.send({type:'start',snapshot:{...save,hash:'b'.repeat(64)}});assert.match((await a.wait('error')).message,/不一致/);
 a.send({type:'start',snapshot:save});const [aa,bb]=await Promise.all([a.wait('start'),b.wait('start')]);assert.deepEqual(aa.snapshot,save);assert.deepEqual(bb.snapshot,save);assert.ok(bb.snapshot.state.cpu.mem[0x203]>75);
 a.ws.close();b.ws.close();
});

async function offered(client){for(;;){const status=await client.wait('room');if(status.offer)return status.offer;}}
test('local ROM is relayed in acknowledged binary chunks and discarded after delivery',async()=>{
 const {encodeROMChunk,decodeROMChunk,ROM_CHUNK_BYTES}=await import('../shared/rom-transfer.js');
 const {a,b,code}=await pair();const rom=Buffer.concat([readFileSync(new URL('../public/demo.nes',import.meta.url)),Buffer.alloc(90000,7)]);const digest=createHash('sha256').update(rom).digest('hex');
 a.send({...ready,hash:digest,size:rom.length,source:'relay'});const offer=await offered(b);b.send({type:'request-rom',offerId:offer.id});const transfer=await a.wait('rom-request');await b.wait('rom-begin');
 const chunks=[];
 for(let offset=0,sequence=0;offset<rom.length;offset+=ROM_CHUNK_BYTES,sequence++){
  const piece=rom.subarray(offset,offset+ROM_CHUNK_BYTES);a.ws.send(encodeROMChunk(transfer.id,sequence,piece));const received=decodeROMChunk((await b.wait('binary')).packet);assert.deepEqual(Buffer.from(received.bytes),piece);chunks.push(received.bytes);
  assert.equal(activeRooms.get(code).transfer.received,offset+piece.length);assert.equal(activeRooms.get(code).transfer.rom,undefined);
  b.send({type:'rom-ack',id:transfer.id,sequence});assert.equal((await a.wait('rom-ack')).sequence,sequence);
 }
 await b.wait('rom-end');assert.deepEqual(Buffer.concat(chunks),rom);assert.equal(activeRooms.get(code).transfer,null);
 b.send({...ready,hash:digest});await new Promise(r=>setTimeout(r,20));a.send({type:'start'});await a.wait('start');await b.wait('start');a.ws.close();b.ws.close();
});
test('bad ROM digest cancels transfer; retry works and closing the room clears transfer state',async()=>{
 const {encodeROMChunk}=await import('../shared/rom-transfer.js');const {a,b,code}=await pair();const rom=readFileSync(new URL('../public/demo.nes',import.meta.url));const digest=createHash('sha256').update(rom).digest('hex');
 a.send({...ready,hash:digest,size:rom.length,source:'relay'});const offer=await offered(b);
 a.send({type:'request-rom',offerId:offer.id});assert.match((await a.wait('error')).message,/成员/);
 b.send({type:'request-rom',offerId:offer.id});const t=await a.wait('rom-request');await b.wait('rom-begin');const damaged=Buffer.from(rom);damaged[20]^=1;a.ws.send(encodeROMChunk(t.id,0,damaged));assert.match((await b.wait('rom-cancelled')).message,/校验/);assert.equal(activeRooms.get(code).transfer,null);
 b.send({type:'request-rom',offerId:offer.id});await b.wait('rom-begin');await a.wait('rom-request');assert.ok(activeRooms.get(code).transfer);a.ws.close();await b.wait('left');assert.equal(activeRooms.has(code),false);b.ws.close();
});
