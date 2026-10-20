import {createHash,randomBytes} from 'node:crypto';
import {MAX_ROM_BYTES,decodeROMChunk} from '../shared/rom-transfer.js';

// One acknowledged chunk at a time. ROM data is neither cached in the room
// nor written to disk; only the small incremental hash and counters survive.
export function createROMRelay(send){
  function cancel(room,reason='卡带传输已取消'){
    if(!room?.transfer)return;
    const transfer=room.transfer;room.transfer=null;
    for(const peer of room.players)send(peer,{type:'rom-cancelled',id:transfer.id,message:reason});
  }
  function offer(room,ws,msg){
    if(room.players[0]!==ws)return;
    const old=room.offer;
    if(!Number.isInteger(msg.size)||msg.size<16||msg.size>MAX_ROM_BYTES){room.offer=null;return;}
    const source=['library','demo'].includes(msg.source)?msg.source:'relay';
    if(source==='library'&&msg.libraryId!==msg.hash)throw Error('游戏库卡带标识无效');
    if(old&&old.hash===msg.hash&&old.source===source&&old.name===String(msg.name).slice(0,100))return;
    cancel(room,'房主已更换卡带');
    room.offer={id:randomBytes(16).toString('hex'),hash:msg.hash,name:String(msg.name).slice(0,100),size:msg.size,source,libraryId:source==='library'?msg.hash:null};
    if(room.players[1])room.players[1].game=null;
  }
  function request(ws,msg){
    const room=ws.room;
    if(!room||room.players[1]!==ws||room.running)throw Error('只有等待联机的房间成员可以接收卡带');
    if(!room.offer||msg.offerId!==room.offer.id)throw Error('房主卡带已变化，请重试');
    if(room.transfer){if(room.transfer.offerId===msg.offerId)return;cancel(room);}
    ws.game=null;
    const id=randomBytes(16).toString('hex');
    room.transfer={id,offerId:room.offer.id,size:room.offer.size,received:0,sequence:0,waiting:false,hash:createHash('sha256'),lastActivity:Date.now()};
    send(ws,{type:'rom-begin',id,offer:room.offer});
    send(room.players[0],{type:'rom-request',id,offer:room.offer});
  }
  function binary(ws,packet){
    const room=ws.room,t=room?.transfer;
    if(!room||!t||room.players[0]!==ws||room.running)throw Error('当前没有可发送的卡带');
    const chunk=decodeROMChunk(packet);
    if(chunk.id!==t.id)return; // Late packets from a cancelled transfer.
    if(t.waiting||chunk.sequence!==t.sequence||t.received+chunk.bytes.length>t.size)throw Error('卡带数据包顺序或大小无效');
    if(t.received===0&&(chunk.bytes.length<4||chunk.bytes[0]!==78||chunk.bytes[1]!==69||chunk.bytes[2]!==83||chunk.bytes[3]!==26))throw Error('无效的 NES 卡带');
    const guest=room.players[1];if(!guest||guest.readyState!==1)throw Error('同伴已经断开连接');
    if(guest.bufferedAmount>128*1024)throw Error('同伴接收过慢，请重试');
    t.hash.update(chunk.bytes);t.received+=chunk.bytes.length;
    if(t.received===t.size&&t.hash.digest('hex')!==room.offer.hash)throw Error('卡带校验失败，请房主重新加载');
    t.waiting=true;t.lastActivity=Date.now();guest.send(packet,{binary:true});
  }
  function acknowledge(ws,msg){
    const room=ws.room,t=room?.transfer;
    if(!t||msg.id!==t.id)return;
    if(room.players[1]!==ws||!t.waiting||msg.sequence!==t.sequence)throw Error('无效的卡带确认');
    t.waiting=false;t.lastActivity=Date.now();
    send(room.players[0],{type:'rom-ack',id:t.id,sequence:t.sequence});t.sequence++;
    if(t.received===t.size){room.transfer=null;send(ws,{type:'rom-end',id:t.id,offerId:t.offerId});}
  }
  function expire(rooms){for(const room of rooms.values())if(room.transfer&&Date.now()-room.transfer.lastActivity>30000)cancel(room,'卡带传输超时，请重试并保持页面在前台');}
  return {offer,request,binary,acknowledge,cancel,expire};
}
