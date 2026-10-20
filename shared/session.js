export const PROTOCOL = 'pixel-link-7-fceumm';
export const CORE_VERSION = 'fceumm-ac0d00a-pl1';
export const LEGACY_CORE_VERSION = 'jsnes-2.1.0-pixel-link-4';
export const MAX_SAVE_BYTES = 6 * 1024 * 1024;
export function validateSave(save, hash) {
  if (!save || save.format !== 'pixel-link-save' || save.version !== 1 || ![CORE_VERSION, LEGACY_CORE_VERSION].includes(save.core)) throw Error('存档版本不兼容，请使用当前版本导出的存档');
  if (!/^[a-f0-9]{64}$/.test(save.hash) || (hash && save.hash !== hash)) throw Error('存档与当前卡带不一致，请先加载对应的游戏文件');
  const s = save.state;
  if(save.core===CORE_VERSION){
    if(s?.kind!=='fceumm'||typeof s.data!=='string'||s.data.length<64||s.data.length>2*1024*1024||s.data.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(s.data)||! /^[a-f0-9]{64}$/.test(s.digest)||typeof s.video!=='string'||s.video.length!==327680||!/^[A-Za-z0-9+/]+={0,2}$/.test(s.video)||typeof s.ram!=='string'||s.ram.length!==2732||!Array.isArray(s.pads)||s.pads.length!==2||!s.pads.every(n=>Number.isInteger(n)&&n>=0&&n<=255))throw Error('存档内容不完整或已损坏');
    return save;
  }
  if (!s?.cpu || !s.ppu || !s.mmap || !s.papu || !s.controllers || !Array.isArray(s.cpu.mem) || s.cpu.mem.length !== 65536 || !Array.isArray(s.ppu.buffer) || s.ppu.buffer.length !== 61440 || !Array.isArray(s.ppu.ptTile) || s.ppu.ptTile.length !== 512) throw Error('存档内容不完整或已损坏');
  return save;
}
