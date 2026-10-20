import { LEGACY_CORE_VERSION, validateSave } from '../shared/session.js';
export function snapshot(nes,game){
  return JSON.parse(JSON.stringify({format:'pixel-link-save',version:1,core:nes.coreVersion||LEGACY_CORE_VERSION,
    hash:game.hash,name:game.name,savedAt:new Date().toISOString(),state:nes.toJSON()}));
}
let opening;
function database(){
  if(!opening)opening=new Promise((resolve,reject)=>{
    const request=indexedDB.open('pixel-link-saves',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('saves',{keyPath:'key'});
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('无法打开本地存档，请检查浏览器存储权限'));
  });
  return opening;
}
export async function storeSave(save,slot){
  validateSave(save);const db=await database();
  return new Promise((resolve,reject)=>{const tx=db.transaction('saves','readwrite');tx.objectStore('saves').put({key:`${save.hash}:${slot}`,slot,save});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(Error('存档失败，浏览器存储空间可能不足'));});
}
export async function getSaves(hash){
  const db=await database();return new Promise((resolve,reject)=>{const req=db.transaction('saves').objectStore('saves').getAll();req.onsuccess=()=>resolve(req.result.filter(row=>row.save.hash===hash));req.onerror=()=>reject(Error('读取本地存档失败'));});
}
