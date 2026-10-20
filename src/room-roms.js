import {sha256} from 'js-sha256';
import {MAX_ROM_BYTES,ROM_CHUNK_BYTES,encodeROMChunk,decodeROMChunk} from '../shared/rom-transfer.js';
export class RoomROMs {
  constructor({send,sendBinary,context,load,ready,changed}){Object.assign(this,{send,sendBinary,context,load,ready,changed});this.handled='';this.label='';this.error='';}
  clear(){
    this.fetching?.abort();this.fetching=null;const old=this.outgoing;this.outgoing=null;old?.waiting?.reject(Error('已取消'));this.incoming=null;this.handled='';this.label='';this.error='';this.changed();
  }
  progress(label){this.label=label;this.error='';this.changed();}
  fail(message){this.label='';this.error=message;this.changed();}
  key(offer){return `${this.context().room}:${offer.id}`;}
  matches(key){const c=this.context();return c.room&&c.player===2&&c.offer&&this.key(c.offer)===key&&!c.epoch;}
  offer(offer){
    const c=this.context();if(c.player!==2||!c.room||!offer||c.epoch)return;
    const key=this.key(offer);if(this.handled===key)return;
    this.fetching?.abort();this.incoming=null;this.handled=key;
    if(c.game?.hash===offer.hash){this.label='';this.error='';this.ready();this.changed();return;}
    if(offer.source==='library'||offer.source==='demo')void this.download(offer,key);
    else {this.progress('正在请求房主的卡带…');this.send({type:'request-rom',offerId:offer.id});}
  }
  retry(){const offer=this.context().offer;if(!offer)return;this.handled='';this.offer(offer);}
  async download(offer,key){
    const controller=new AbortController();this.fetching=controller;
    this.progress(offer.source==='library'?'正在自动加载游戏库卡带…':'正在自动加载演示卡带…');
    try{
      const url=offer.source==='library'?`/api/library/${offer.libraryId}/rom`:'/demo.nes';
      const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error('卡带下载失败');
      const bytes=new Uint8Array(await response.arrayBuffer());if(!this.matches(key))return;
      await this.install(bytes,offer,key);
    }catch(error){if(controller.signal.aborted||!this.matches(key))return;this.progress('正在请求房主转发卡带…');this.send({type:'request-rom',offerId:offer.id});}
    finally{if(this.fetching===controller)this.fetching=null;}
  }
  async install(bytes,offer,key){
    if(bytes.length!==offer.size||sha256(bytes)!==offer.hash)throw Error('卡带校验失败，请重试');
    if(!this.matches(key))return;
    const loaded=await this.load(bytes,offer.name,{auto:true,source:offer.source,libraryId:offer.libraryId});
    if(!loaded)throw Error('当前模拟核心无法运行房主的卡带');
    if(this.matches(key)){this.label='卡带已自动加载';this.error='';this.changed();}
  }
  async transmit(message){
    const c=this.context();
    if(c.player!==1||!c.game||c.game.hash!==message.offer.hash||c.offer?.id!==message.offer.id){this.send({type:'rom-cancel',id:message.id});return;}
    const previous=this.outgoing;this.outgoing=null;previous?.waiting?.reject(Error('已取消'));
    const task={id:message.id,room:c.room,bytes:c.game.bytes};this.outgoing=task;
    try{
      for(let offset=0,sequence=0;offset<task.bytes.length;offset+=ROM_CHUNK_BYTES,sequence++){
        if(this.outgoing!==task||this.context().room!==task.room) return;
        const chunk=task.bytes.subarray(offset,offset+ROM_CHUNK_BYTES);
        await new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>reject(Error('卡带传输超时，请重试')),30000);
          task.waiting={sequence,resolve:()=>{clearTimeout(timer);resolve();},reject:error=>{clearTimeout(timer);reject(error);}};
          try{this.sendBinary(encodeROMChunk(task.id,sequence,chunk));}catch(error){task.waiting.reject(error);}
        });
        task.waiting=null;this.progress(`正在转发卡带 · ${Math.round(Math.min(offset+chunk.length,task.bytes.length)*100/task.bytes.length)}%`);
      }
      if(this.outgoing===task){this.outgoing=null;this.progress('卡带已送达，等待同伴就绪');}
    }catch(error){if(this.outgoing===task){this.outgoing=null;this.send({type:'rom-cancel',id:task.id});this.fail(error.message);}}
  }
  message(message){
    const c=this.context();
    if(message.type==='rom-request'){void this.transmit(message);return true;}
    if(message.type==='rom-begin'){
      if(c.player!==2||!c.offer||message.offer.id!==c.offer.id)return true;
      const size=message.offer.size;
      if(!Number.isInteger(size)||size<16||size>MAX_ROM_BYTES){this.fail('卡带过大或无效');this.send({type:'rom-cancel',id:message.id});return true;}
      this.incoming={id:message.id,offer:message.offer,key:this.key(message.offer),bytes:new Uint8Array(size),received:0,sequence:0};this.progress('正在接收房主卡带 · 0%');return true;
    }
    if(message.type==='rom-ack'){
      const task=this.outgoing;if(task?.id===message.id&&task.waiting?.sequence===message.sequence)task.waiting.resolve();return true;
    }
    if(message.type==='rom-end'){
      const incoming=this.incoming;if(!incoming||incoming.id!==message.id)return true;this.incoming=null;
      if(incoming.received!==incoming.bytes.length){this.fail('卡带不完整，请重试');return true;}
      void this.install(incoming.bytes,incoming.offer,incoming.key).catch(error=>{if(this.matches(incoming.key))this.fail(error.message);});return true;
    }
    if(message.type==='rom-cancelled'){
      let relevant=false;
      if(this.incoming?.id===message.id){this.incoming=null;relevant=true;}
      if(this.outgoing?.id===message.id){const task=this.outgoing;this.outgoing=null;task.waiting?.reject(Error(message.message));relevant=true;}
      if(relevant&&c.room&&c.game?.hash!==c.offer?.hash)this.fail(message.message);else if(relevant){this.label='';this.changed();}
      return true;
    }
    return false;
  }
  binary(packet){
    const incoming=this.incoming;if(!incoming)return;
    try{
      const chunk=decodeROMChunk(packet);if(chunk.id!==incoming.id||!this.matches(incoming.key))return;
      if(chunk.sequence!==incoming.sequence||incoming.received+chunk.bytes.length>incoming.bytes.length)throw Error('卡带数据包无效，请重试');
      incoming.bytes.set(chunk.bytes,incoming.received);incoming.received+=chunk.bytes.length;incoming.sequence++;
      this.progress(`正在接收房主卡带 · ${Math.round(incoming.received*100/incoming.bytes.length)}%`);
      this.send({type:'rom-ack',id:incoming.id,sequence:chunk.sequence});
    }catch(error){this.incoming=null;this.send({type:'rom-cancel',id:incoming.id});this.fail(error.message);}
  }
}
