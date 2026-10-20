import { randomInt, randomUUID } from 'node:crypto';
import { createROMRelay } from './rom-relay.js';
import { PROTOCOL, MAX_SAVE_BYTES, validateSave } from '../shared/session.js';
export { PROTOCOL };
export function attachRooms(wss) {
  const rooms = new Map();
  const send = (ws, data) => { if (ws.readyState === 1) ws.send(JSON.stringify(data)); };
  const relay=createROMRelay(send);
  const broadcast = (room, data) => room.players.forEach(p => send(p, data));
  const status = room => broadcast(room, {type:'room', code:room.code, players:room.players.length, ready:room.players.map(p=>!!p.game), game:room.players[0].game?.name || '', running:room.running,offer:room.offer||null});
  const leave = ws => {
    const room = ws.room;
    if (!room) return;
    // A disconnect closes the session. Nobody can continue an old frame stream.
    relay.cancel(room,'房间已关闭');
    rooms.delete(room.code);
    room.players.forEach(p => {p.room=null; send(p,{type:'left',reason:p===ws?'已离开房间':'同伴已离开，房间已关闭'});});
  };
  wss.on('connection', ws => {
    ws.alive = true;
    ws.on('pong',()=>{ws.alive=true;});
    let count=0, since=Date.now();
    ws.on('message', (raw,isBinary) => {
      if(Date.now()-since>1000){count=0;since=Date.now();}
      if(++count>240){ws.close(1008,'Rate limit');return;}
      try {
        if(isBinary){try{relay.binary(ws,raw);}catch(error){relay.cancel(ws.room,error.message);}return;}
        const msg=JSON.parse(raw.toString());
        if(msg.type==='hello'){send(ws,{type:'hello',protocol:PROTOCOL});return;}
        if(raw.length>4096&&(msg.type!=='start'||raw.length>MAX_SAVE_BYTES))throw Error('消息过大');
        if(msg.type==='ping'){send(ws,{type:'pong',time:msg.time});return;}
        if(msg.type==='leave'){leave(ws);return;}
        if(msg.type==='create') {
          if(ws.room) throw Error('请先离开当前房间');
          if(rooms.size>=100) throw Error('房间已满，请稍后重试');
          let code; do {code=String(randomInt(100000,1000000));} while(rooms.has(code));
          const room={code,players:[ws],running:false,frame:0,inputs:new Map()};
          rooms.set(code,room); ws.room=room;ws.game=null;
          send(ws,{type:'joined',code,player:1});status(room);return;
        }
        if(msg.type==='join') {
          if(ws.room) throw Error('请先离开当前房间');
          const room=rooms.get(String(msg.code));
          if(!room) throw Error('房间不存在或已关闭');
          if(room.players.length!==1) throw Error('房间已有两位玩家');
          room.players.push(ws);ws.room=room;ws.game=null;
          send(ws,{type:'joined',code:room.code,player:2});status(room);return;
        }
        const room=ws.room;
        if(!room) throw Error('请先创建或加入房间');
        if(msg.type==='request-rom'){relay.request(ws,msg);status(room);return;}
        if(msg.type==='rom-ack'){relay.acknowledge(ws,msg);return;}
        if(msg.type==='rom-cancel'){if(room.transfer&&msg.id===room.transfer.id)relay.cancel(room,'卡带传输已取消，请重试');return;}
        if(msg.type==='ready') {
          if(room.running) throw Error('请先结束本局再更换游戏');
          ws.game=null;status(room);
          if(!/^[a-f0-9]{64}$/.test(msg.hash)||msg.protocol!==PROTOCOL) throw Error('游戏或客户端版本无效，请刷新页面');
          if(room.players[0]===ws)relay.offer(room,ws,msg);
          const other=room.players.find(p=>p!==ws);
          if(room.players[0]!==ws&&other?.game && other.game.hash!==msg.hash) throw Error('游戏文件不一致，请两人选择完全相同的 NES 文件');
          if(room.players[1]===ws&&room.transfer)relay.cancel(room,'同伴已加载卡带');
          ws.game={hash:msg.hash,name:String(msg.name).slice(0,100)};status(room);return;
        }
        if(msg.type==='start') {
          if(room.players[0]!==ws) throw Error('请由房主开始游戏');
          if(room.running) throw Error('游戏已在运行');
          if(room.players.length!==2||!room.players.every(p=>p.game)||room.players[0].game.hash!==room.players[1].game.hash) throw Error('等待两人加载同一游戏');
          if(msg.snapshot)validateSave(msg.snapshot,ws.game.hash);
          room.running=true;room.frame=0;room.inputs.clear();room.epoch=randomUUID();
          broadcast(room,{type:'start',epoch:room.epoch,delay:6,snapshot:msg.snapshot||null});status(room);return;
        }
        if(msg.type==='stop') {
          room.running=false;room.inputs.clear();broadcast(room,{type:'stop'});status(room);return;
        }
        if(msg.type==='input') {
          if(!room.running || msg.epoch!==room.epoch) return;
          if(!Number.isInteger(msg.frame)||msg.frame<room.frame||msg.frame>room.frame+12||!Number.isInteger(msg.buttons)||msg.buttons<0||msg.buttons>255) throw Error('无效的游戏输入');
          let inputs=room.inputs.get(msg.frame);
          if(!inputs){inputs=[null,null];room.inputs.set(msg.frame,inputs);}
          const index=room.players.indexOf(ws);
          if(inputs[index]!==null) throw Error('重复的游戏帧');
          inputs[index]=msg.buttons;
          while(room.inputs.get(room.frame)?.every(v=>v!==null)) {
            const buttons=room.inputs.get(room.frame);room.inputs.delete(room.frame);
            broadcast(room,{type:'frame',frame:room.frame,buttons,epoch:room.epoch});room.frame++;
          }
        }
      } catch(error){send(ws,{type:'error',message:error.message || '请求无效'});}
    });
    ws.on('close',()=>leave(ws));
    ws.on('error',()=>leave(ws));
  });
  const heartbeat=setInterval(()=>{relay.expire(rooms);wss.clients.forEach(ws=>{if(!ws.alive)return ws.terminate();ws.alive=false;ws.ping();});},15000);
  heartbeat.unref(); wss.on('close',()=>clearInterval(heartbeat));
  return rooms;
}
