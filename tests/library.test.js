import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createLibrary} from '../server/library.js';
test('server library authenticates upload/default, validates files, and persists across restarts',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'pixel-library-'));const handler=createLibrary({directory,webManagement:true,adminToken:'test-only-admin'});
 const server=createServer(async(req,res)=>{if(!await handler(req,res)){res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const rom=await readFile(new URL('../public/demo.nes',import.meta.url));const headers={Origin:base,'x-library-token':'test-only-admin'};
 try{
  assert.equal((await fetch(base+'/api/library/upload?name=demo.nes',{method:'POST',headers:{Origin:base},body:rom})).status,403);
  assert.equal((await fetch(base+'/api/library/upload',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:rom})).status,403);
  assert.equal((await fetch(base+'/api/library/upload',{method:'POST',headers,body:Buffer.from('not nes')})).status,400);
  const upload=await fetch(base+'/api/library/upload?name='+encodeURIComponent('演示卡带.nes'),{method:'POST',headers,body:rom});assert.equal(upload.status,200);const {game}=await upload.json();assert.equal(game.name,'演示卡带');
  const duplicate=await fetch(base+'/api/library/upload?name=duplicate',{method:'POST',headers,body:rom});assert.equal(duplicate.status,200);
  let listing=await(await fetch(base+'/api/library')).json();assert.equal(listing.games.length,1);assert.equal(listing.canManage,undefined);
  const choose=await fetch(base+'/api/library/default',{method:'PUT',headers,body:JSON.stringify({id:game.id})});assert.equal(choose.status,200);
  const persisted=JSON.parse(await readFile(path.join(directory,'library.json')));assert.equal(persisted.defaultId,game.id);
  const download=await fetch(base+`/api/library/${game.id}/rom`);assert.deepEqual(Buffer.from(await download.arrayBuffer()),rom);
  const bad=await fetch(base+'/api/library/default',{method:'PUT',headers,body:JSON.stringify({id:'missing'})});assert.equal(bad.status,400);
  await new Promise(r=>server.close(r));const restarted=createServer(async(req,res)=>{await createLibrary({directory,webManagement:true,adminToken:'test-only-admin'})(req,res);});await new Promise(r=>restarted.listen(0,'127.0.0.1',r));listing=await(await fetch(`http://127.0.0.1:${restarted.address().port}/api/library`)).json();assert.equal(listing.defaultId,game.id);await new Promise(r=>restarted.close(r));
 }finally{if(server.listening)await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}
});
test('default mode blocks management even on localhost with a valid token; manual filenames work',async()=>{
 const {writeFile,mkdir}=await import('node:fs/promises');
 const directory=await mkdtemp(path.join(tmpdir(),'pixel-readonly-'));
 await mkdir(path.join(directory,'roms'));const rom=await readFile(new URL('../public/demo.nes',import.meta.url));await writeFile(path.join(directory,'roms','演示.nes'),rom);
 await writeFile(path.join(directory,'library.json'),JSON.stringify({defaultGame:'roms/演示.nes',games:[{file:'roms/演示.nes',name:'我的演示'}]}));
 const handler=createLibrary({directory,webManagement:false,adminToken:'known-test-secret'});const server=createServer(async(req,res)=>{await handler(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  for(const [route,method] of [['upload','POST'],['default','PUT']])assert.equal((await fetch(base+'/api/library/'+route,{method,headers:{Origin:base,'x-library-token':'known-test-secret'},body:'{}'})).status,404);
  const listing=await(await fetch(base+'/api/library')).json();assert.equal(listing.games[0].name,'我的演示');assert.equal(listing.defaultId,listing.games[0].id);assert.equal(listing.games[0].file,undefined);
  const download=await fetch(base+`/api/library/${listing.defaultId}/rom`);assert.deepEqual(Buffer.from(await download.arrayBuffer()),rom);
  await writeFile(path.join(directory,'library.json'),JSON.stringify({games:[{file:'../private.nes',name:'blocked'}]}));assert.equal((await fetch(base+'/api/library')).status,400);
 }finally{await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}
});
test('directory scan discovers additions, nested NES files, renames and removals without configuration or restart',async()=>{
 const {writeFile,mkdir,rename,symlink}=await import('node:fs/promises');const directory=await mkdtemp(path.join(tmpdir(),'pixel-scan-'));
 const handler=createLibrary({directory,webManagement:false});const server=createServer(async(req,res)=>{await handler(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const list=async()=>{const response=await fetch(base+'/api/library');assert.equal(response.status,200);return response.json();};
 try{
  assert.equal((await list()).games.length,0);
  const rom=await readFile(new URL('../public/demo.nes',import.meta.url));await mkdir(path.join(directory,'双人'));await writeFile(path.join(directory,'双人','雪人兄弟.NES'),rom);
  await writeFile(path.join(directory,'坏卡带.nes'),'incomplete');await writeFile(path.join(directory,'说明.txt'),'ignore');await symlink('/etc/passwd',path.join(directory,'outside.nes'));
  let result=await list();assert.equal(result.games.length,1);assert.equal(result.games[0].name,'雪人兄弟');assert.equal(result.games[0].folder,'双人');
  assert.deepEqual(Buffer.from(await(await fetch(base+`/api/library/${result.games[0].id}/rom`)).arrayBuffer()),rom);
  await rename(path.join(directory,'双人','雪人兄弟.NES'),path.join(directory,'双人','更名.nes'));assert.equal((await list()).games[0].name,'更名');
  await writeFile(path.join(directory,'library.json'),JSON.stringify({defaultGame:'双人/更名.nes'}));result=await list();assert.equal(result.defaultId,result.games[0].id);
  await rm(path.join(directory,'双人','更名.nes'));assert.equal((await list()).games.length,0);
 }finally{await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}
});
