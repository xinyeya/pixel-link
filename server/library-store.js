import {readFile,writeFile,mkdir,rename,realpath,stat,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
export const MAX_ROM=8*1024*1024;
export async function readManifest(directory){
  try{const data=JSON.parse(await readFile(path.join(directory,'library.json'),'utf8'));if(data.games!==undefined&&!Array.isArray(data.games))throw Error('library.json 的 games 必须是数组');return {...data,games:data.games||[]};}
  catch(error){if(error.code==='ENOENT')return {games:[],defaultId:null};throw error;}
}
export async function writeManifest(directory,data){
  await mkdir(directory,{recursive:true});const target=path.join(directory,'library.json');await writeFile(target+'.tmp',JSON.stringify(data,null,2)+'\n');await rename(target+'.tmp',target);
}
export function validateROM(bytes){if(bytes.length<16||bytes.length>MAX_ROM||bytes[0]!==78||bytes[1]!==69||bytes[2]!==83||bytes[3]!==26)throw Error('请选择有效的 NES 卡带（最大 8 MB）');}
async function scanFiles(directory,relative=''){
  let entries;
  try{entries=await readdir(path.join(directory,relative),{withFileTypes:true});}
  catch(error){if(['ENOENT','EACCES','ENOTDIR'].includes(error.code))return [];throw error;}
  const files=[];
  for(const entry of entries){
    if(entry.name.startsWith('.')||entry.isSymbolicLink())continue;
    const file=path.join(relative,entry.name);
    if(entry.isDirectory())files.push(...await scanFiles(directory,file));
    else if(entry.isFile()&&/\.nes$/i.test(entry.name))files.push(file);
  }
  return files;
}
export async function resolveGames(directory,data,cache=new Map()){
  // Rescan names on every listing. The cache only avoids rehashing unchanged
  // ROM bytes; additions, renames and removals are visible without a restart.
  const discovered=await scanFiles(directory);
  if(!discovered.length&&!data.games.length)return {games:[],defaultId:null};
  let base;try{base=await realpath(directory);}catch(error){if(error.code==='ENOENT')return {games:[],defaultId:null};throw error;}
  const entries=new Map();
  for(const entry of data.games){
    const file=entry.file||(/^[a-f0-9]{64}$/.test(entry.id||'')?entry.id+'.nes':null);
    if(!file||path.isAbsolute(file)||file.split(/[\\/]/).includes('..'))throw Error('游戏配置需要目录内的相对 file 路径');
    entries.set(path.normalize(file),entry);
  }
  for(const file of discovered)if(!entries.has(file))entries.set(file,{file});
  const games=[];
  for(const [file,entry] of [...entries].sort(([a],[b])=>a.localeCompare(b,'zh-CN'))){
    try{
      const target=await realpath(path.resolve(base,file));
      if(!target.startsWith(base+path.sep))throw Error('游戏文件必须位于游戏库目录内');
      const info=await stat(target);if(!info.isFile()||info.size>MAX_ROM)continue;
      let cached=cache.get(target);
      if(!cached||cached.mtime!==info.mtimeMs||cached.ctime!==info.ctimeMs||cached.size!==info.size){
        const bytes=await readFile(target);validateROM(bytes);
        cached={mtime:info.mtimeMs,ctime:info.ctimeMs,size:info.size,id:createHash('sha256').update(bytes).digest('hex')};cache.set(target,cached);
      }
      const folder=path.dirname(file)==='.'?'':path.dirname(file).split(path.sep).join('/');
      games.push({id:cached.id,name:String(entry.name||path.basename(file).replace(/\.nes$/i,'')).slice(0,120),size:info.size,addedAt:entry.addedAt||info.mtime.toISOString(),folder,file,target});
    }catch(error){
      if(['ENOENT','EACCES','ENOTDIR'].includes(error.code))continue;
      // An incomplete upload or unrelated/broken NES file must not hide the
      // other games. Explicit configuration errors still surface to the owner.
      if(!data.games.includes(entry))continue;
      throw error;
    }
  }
  const selected=data.defaultGame?games.find(g=>g.file===data.defaultGame||g.id===data.defaultGame):games.find(g=>g.id===data.defaultId);
  const unique=[...new Map(games.map(g=>[g.id,g])).values()];
  const active=new Set(games.map(g=>g.target));for(const target of cache.keys())if(!active.has(target))cache.delete(target);
  return {games:unique,defaultId:selected?.id||null};
}
