import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readManifest,writeManifest,resolveGames,validateROM} from '../server/library-store.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=path.resolve(process.env.LIBRARY_DIR||path.join(root,'.data','library'));
const [command,...args]=process.argv.slice(2);
try{
 if(command==='import'){
  const source=args[0];if(!source)throw Error('用法：npm run library -- import /path/game.nes [--name 游戏名称] [--default]');
  const bytes=await readFile(source);validateROM(bytes);const id=createHash('sha256').update(bytes).digest('hex');
  const index=args.indexOf('--name');if(index!==-1&&!args[index+1])throw Error('--name 后需要游戏名称');
  const name=index===-1?path.basename(source).replace(/\.nes$/i,''):args[index+1];
  await mkdir(directory,{recursive:true});await writeFile(path.join(directory,id+'.nes'),bytes);
  const data=await readManifest(directory);const existing=data.games.find(g=>g.id===id||g.file===id+'.nes');if(existing)existing.name=name;else data.games.push({id,name,size:bytes.length,addedAt:new Date().toISOString()});
  if(args.includes('--default')){data.defaultId=id;delete data.defaultGame;}await writeManifest(directory,data);console.log(`已导入：${name}\nID: ${id}\n配置：${path.join(directory,'library.json')}`);
 }else if(command==='default'){
  const selected=args[0];if(!selected)throw Error('用法：npm run library -- default <游戏ID或文件名|none>');
  const data=await readManifest(directory),resolved=await resolveGames(directory,data);
  const game=resolved.games.find(g=>g.id===selected||g.file===selected);if(selected!=='none'&&!game)throw Error('游戏不存在，请使用 list 查看');
  data.defaultId=game?.id||null;delete data.defaultGame;await writeManifest(directory,data);console.log(game?`默认游戏：${game.name}`:'已取消默认游戏');
 }else if(command==='list'){
  const data=await resolveGames(directory,await readManifest(directory));for(const g of data.games)console.log(`${g.id===data.defaultId?'*':' '} ${g.name}\n  ${g.id}`);if(!data.games.length)console.log('游戏库为空');
 }else throw Error('用法：npm run library -- <import 文件 [--name 名称] [--default]|default ID或文件名或none|list>');
}catch(error){console.error(error.message);process.exitCode=1;}
