import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { attachRooms } from './rooms.js';
import { createLibrary } from './library.js';
import { MAX_SAVE_BYTES, PROTOCOL, CORE_VERSION } from '../shared/session.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dev=process.argv.includes('--dev');
const port=Number(process.env.PORT)||4178;
const vite=dev?await (await import('vite')).createServer({root,server:{middlewareMode:true,hmr:{port:port+10000}},appType:'spa'}):null;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.nes':'application/octet-stream','.svg':'image/svg+xml','.json':'application/json','.wasm':'application/wasm'};
const libraryDirectory=path.resolve(process.env.LIBRARY_DIR||path.join(root,'.data','library'));
await mkdir(libraryDirectory,{recursive:true});
const library=createLibrary({directory:libraryDirectory});
const server=http.createServer(async(req,res)=>{
  if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:true,protocol:PROTOCOL,romRelay:true,core:CORE_VERSION}));return;}
  if(await library(req,res))return;
  // Emscripten modules are shipped verbatim. Bypass Vite's public-file
  // import rewriting for this local JS/WASM pair in development as well.
  if(new URL(req.url,'http://localhost').pathname.startsWith('/cores/')){
    const relative=new URL(req.url,'http://localhost').pathname.slice('/cores/'.length);
    if(!/^[A-Za-z0-9._-]+$/.test(relative)){res.writeHead(404);res.end();return;}
    try{const body=await readFile(path.join(root,dev?'public':'dist','cores',relative));res.writeHead(200,{'Content-Type':types[path.extname(relative)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(body);}catch{res.writeHead(404);res.end();}return;
  }
  if(vite){vite.middlewares(req,res);return;}
  try{
    const url=new URL(req.url,'http://localhost');
    const relative=decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const base=path.join(root,'dist'); const target=path.resolve(base,relative);
    if(!target.startsWith(base+path.sep)){res.writeHead(403);res.end();return;}
    const body=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(body);
  }catch{res.writeHead(404);res.end('Not found');}
});
const wss=new WebSocketServer({noServer:true,maxPayload:MAX_SAVE_BYTES+8192});attachRooms(wss);
server.on('upgrade',(req,socket,head)=>{
  if(new URL(req.url,'http://localhost').pathname!=='/netplay')return;
  // Only accept same-origin browser connections, including LAN hostnames.
  if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host){socket.destroy();return;}}catch{socket.destroy();return;}}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
});
server.listen(port,'0.0.0.0',()=>console.log(`Pixel Link ready: http://localhost:${port}`));
