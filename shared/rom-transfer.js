export const MAX_ROM_BYTES = 8 * 1024 * 1024;
export const ROM_CHUNK_BYTES = 64 * 1024;
const HEADER_BYTES = 20;
export function encodeROMChunk(id,sequence,bytes){
  if(!/^[a-f0-9]{32}$/.test(id)||bytes.length>ROM_CHUNK_BYTES)throw Error('无效的卡带传输');
  const packet=new Uint8Array(HEADER_BYTES+bytes.length);
  for(let i=0;i<16;i++)packet[i]=parseInt(id.slice(i*2,i*2+2),16);
  new DataView(packet.buffer).setUint32(16,sequence);packet.set(bytes,HEADER_BYTES);return packet;
}
export function decodeROMChunk(packet){
  if(packet.byteLength<=HEADER_BYTES||packet.byteLength>HEADER_BYTES+ROM_CHUNK_BYTES)throw Error('无效的卡带数据包');
  const id=Array.from(packet.subarray(0,16),v=>v.toString(16).padStart(2,'0')).join('');
  const sequence=new DataView(packet.buffer,packet.byteOffset,packet.byteLength).getUint32(16);
  return {id,sequence,bytes:packet.subarray(HEADER_BYTES)};
}
