import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash,timingSafeEqual} from 'node:crypto';
import path from 'node:path';
import {readManifest,writeManifest,resolveGames,validateROM,MAX_ROM} from './library-store.js';
export function createLibrary({directory,webManagement=process.env.LIBRARY_WEB_MANAGEMENT==='1',adminToken=process.env.LIBRARY_ADMIN_TOKEN||''}) {
  let serial=Promise.resolve();const cache=new Map();
  function isAdmin(req){
    if(!webManagement||!adminToken)return false;
    const supplied=Buffer.from(req.headers['x-library-token']||'');const expected=Buffer.from(adminToken);
    return supplied.length===expected.length&&timingSafeEqual(supplied,expected);
  }
  function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
  async function body(req,limit){let length=0;const parts=[];for await(const part of req){length+=part.length;if(length>limit)throw Object.assign(Error('文件太大'),{status:413});parts.push(part);}return Buffer.concat(parts);}
  const mutate=fn=>{const task=serial.then(fn);serial=task.catch(()=>{});return task;};
  return async(req,res)=>{
    const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/api/library'))return false;
    try {
      if(req.method==='GET'&&url.pathname==='/api/library'){
        const data=await resolveGames(directory,await readManifest(directory),cache);
        json(res,200,{games:data.games.map(({file,target,...game})=>game),defaultId:data.defaultId});return true;
      }
      const match=/^\/api\/library\/([a-f0-9]{64})\/rom$/.exec(url.pathname);
      if(req.method==='GET'&&match){
        const data=await resolveGames(directory,await readManifest(directory),cache);const game=data.games.find(g=>g.id===match[1]);if(!game)throw Object.assign(Error('游戏不存在'),{status:404});
        const bytes=await readFile(game.target);res.writeHead(200,{'Content-Type':'application/octet-stream','Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'});res.end(bytes);return true;
      }
      // Disabled even for localhost and even when a token is supplied. Opting
      // in requires BOTH the explicit server flag and a configured secret.
      if(!webManagement||!adminToken){json(res,404,{error:'网页游戏库管理已关闭，请在服务器管理卡带和配置'});return true;}
      if(!['POST','PUT'].includes(req.method)){json(res,404,{error:'接口不存在'});return true;}
      const origin=req.headers.origin;
      if(!origin||new URL(origin).host!==req.headers.host||req.headers['sec-fetch-site']==='cross-site')throw Object.assign(Error('只允许同源请求'),{status:403});
      if(!isAdmin(req))throw Object.assign(Error('无管理权限'),{status:403});
      if(req.method==='POST'&&url.pathname==='/api/library/upload'){
        const bytes=await body(req,MAX_ROM);validateROM(bytes);
        const name=String(url.searchParams.get('name')||'未命名游戏').replace(/\.nes$/i,'').slice(0,120);
        const id=createHash('sha256').update(bytes).digest('hex');
        const game=await mutate(async()=>{const data=await readManifest(directory);await mkdir(directory,{recursive:true});await writeFile(path.join(directory,id+'.nes'),bytes);let game=data.games.find(g=>g.id===id);if(!game){game={id,name,size:bytes.length,addedAt:new Date().toISOString()};data.games.push(game);}await writeManifest(directory,data);return game;});
        json(res,200,{game});return true;
      }
      if(req.method==='PUT'&&url.pathname==='/api/library/default'){
        const {id}=JSON.parse((await body(req,1024)).toString());
        await mutate(async()=>{const data=await readManifest(directory);const resolved=await resolveGames(directory,data,cache);if(id!==null&&!resolved.games.some(g=>g.id===id))throw Error('请选择游戏库中的游戏');data.defaultId=id;delete data.defaultGame;await writeManifest(directory,data);});
        json(res,200,{ok:true});return true;
      }
      json(res,404,{error:'接口不存在'});
    }catch(error){json(res,error.status||400,{error:error.code==='ENOENT'?'游戏文件不存在，请检查服务器游戏库配置':error.message});}
    return true;
  };
}
