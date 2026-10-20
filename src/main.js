import './style.css';
import { MobileControls } from './mobile-controls.js';
import { GameStage } from './game-stage.js';
import { initTheme } from './theme.js';
import { RoomROMs } from './room-roms.js';
import { sha256 } from 'js-sha256';
import { snapshot, storeSave, getSaves } from './save-store.js';
import { PROTOCOL, MAX_SAVE_BYTES, validateSave } from '../shared/session.js';
import { Emulator } from './emulator.js';
import { Controls, BUTTONS, DEFAULTS, keyName } from './controls.js';
const icons={pad:'<path d="M6 8h12a4 4 0 0 1 3.9 4.8l-1 5a2.5 2.5 0 0 1-4.2 1.3L14 17h-4l-2.7 2.1a2.5 2.5 0 0 1-4.2-1.3l-1-5A4 4 0 0 1 6 8Z"/><path d="M7 11v5m-2.5-2.5h5M16 12h.01M19 15h.01M9 8V5h6"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',link:'<path d="m10 13 4-4m-6 7-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 3 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(2 -1)"/>',play:'<path d="m8 5 11 7-11 7Z"/>',pause:'<path d="M8 5v14M16 5v14"/>',reset:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',volume:'<path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',fullscreen:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',settings:'<path d="M4 7h16M4 17h16M8 4v6m8 4v6"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',check:'<path d="m5 12 4 4L19 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01"/>'};
const icon=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||''}</svg>`;
document.querySelector('#app').innerHTML=`
<header class="header"><a class="brand" href="/">${icon('pad')}<span>像素同伴<small>PIXEL LINK</small></span></a><nav><span class="nav-active">游戏大厅</span><button id="theme-toggle" class="text-button" aria-label="切换浅色主题">☀ 浅色</button><button id="help" class="text-button">使用指南 ${icon('help')}</button><span class="version">WEB / 01</span></nav></header>
<main><section class="intro"><div><div class="eyebrow"><span></span> GOOD GAMES. BETTER TOGETHER.</div><h1>老地方，<span>一起玩。</span></h1><p>熟悉的像素，熟悉的快乐。和远方的朋友，再来一局。</p></div><div class="intro-note"><span>1P <i>＋</i> 2P</span><small>两个人，才是完整的童年。</small></div></section>
<div class="workspace"><section class="console"><div class="console-top"><span><i class="led" id="game-led"></i><strong id="game-name">等待插入卡带</strong></span><span class="console-meta">NES <b>·</b> <span id="core-label">FCEUmm</span></span></div><div class="game-stage" id="game-stage"><div class="stage-tools"><span>PIXEL LINK</span><div><button id="stage-save" type="button">快速存档</button><button id="exit-fullscreen" type="button">${icon('close')} 退出全屏</button></div></div><div class="portrait-hint" id="portrait-hint"><span>↻ 建议横屏游玩，双手操作更顺手</span><button id="landscape-play" type="button">全屏游玩</button></div><div class="screen-shell" id="screen-shell"><canvas id="screen" width="256" height="240" aria-label="NES 游戏画面"></canvas><div class="screen-empty" id="screen-empty"><div class="pixel-controller"><span class="dpad">✚</span><div class="mini-slots"><i></i><i></i></div><span class="mini-buttons">● ●</span></div><span class="insert">INSERT CARTRIDGE</span><h2>你的下一局，从这里开始</h2><p>将 .nes 游戏文件拖到这里，或点击下方加载</p><button id="load-main" class="button primary">${icon('upload')} 加载游戏 <span>.NES</span></button><button id="demo" class="demo-button">没有卡带？试试原创演示 ${icon('arrow')}</button></div><div class="pause-overlay" id="pause-overlay" hidden><span>Ⅱ</span><strong>已暂停</strong><small>按下继续，快乐接着来</small></div><div class="screen-indicator"><span>PLAYER <b id="screen-player">01</b></span><span id="screen-status">STANDBY</span></div></div><div class="touch-controls" id="touch-controls" hidden><div class="joystick-area"><div id="joystick" class="joystick" role="group" aria-label="移动摇杆"><span class="stick-axis horizontal"></span><span class="stick-axis vertical"></span><span class="stick-knob"></span></div><span class="joystick-caption">移动</span></div><div class="touch-system"><button data-bit="2" type="button">SELECT</button><button data-bit="3" type="button">START</button></div><div class="touch-action"><button data-bit="1" type="button" aria-label="B 键">B</button><button data-bit="0" type="button" aria-label="A 键">A</button></div></div></div><div class="console-toolbar"><div><button id="toggle" class="tool" disabled title="开始 / 暂停" aria-label="开始 / 暂停">${icon('play')}</button><button id="restart" class="tool" disabled title="重新开始" aria-label="重新开始">${icon('reset')}</button><span class="toolbar-divider"></span><button id="sound" class="tool" title="切换声音" aria-label="切换声音">${icon('volume')}</button><span id="fps">— FPS</span></div><div><button id="change-rom" class="small-button">${icon('upload')} 更换卡带</button><button id="fullscreen" class="tool" title="全屏" aria-label="全屏">${icon('fullscreen')}</button></div></div><div class="game-actions"><button id="open-library" class="small-button">${icon('pad')} 游戏库</button><button id="quick-save" class="small-button" disabled>快速存档</button><button id="open-saves" class="small-button" disabled>存档 / 读档</button><span id="save-status">存档保存在当前浏览器</span></div><input type="file" id="rom-file" accept=".nes" hidden></section>
<aside class="side"><section class="panel room-panel"><div class="panel-title"><span class="section-number">01</span><h2>叫上你的游戏搭子</h2>${icon('link')}</div><p class="panel-description">距离再远，也像坐在同一台电视前。</p><div class="room-idle" id="room-idle"><div class="players-illustration"><div class="player-chip green">1P</div><span class="connection-line">·········</span><div class="player-chip outline">2P</div></div><button id="create-room" class="button primary full">${icon('link')} 创建双人房间</button><div class="or"><span></span>或者加入朋友<span></span></div><form id="join-form"><label class="sr-only" for="room-code">六位房间码</label><input id="room-code" placeholder="输入 6 位房间码" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required autocomplete="off"><button class="join-button" aria-label="加入房间">${icon('arrow')}</button></form><p class="room-tip"><i></i> 加入房间后自动接收房主卡带</p></div><div id="room-active" hidden><div class="room-code-display"><small>房间码 · 你是 <b id="my-player">1P</b></small><div><strong id="active-code"></strong><button id="copy-room" class="tool" aria-label="复制邀请链接">${icon('copy')}</button></div></div><div class="room-members" id="room-members"></div><p id="room-hint" class="room-hint"></p><button id="retry-rom" class="small-button full" hidden>重试接收卡带</button><label id="start-mode-label" class="start-mode-label">联机开始方式<select id="start-mode"><option value="resume">继续房主当前进度</option><option value="fresh">从头开始新游戏</option></select></label><button id="start-room" class="button primary full" disabled>两人就绪后开始</button><button id="leave-room" class="text-button full leave-button">离开房间</button></div></section>
<section class="panel controls-panel"><div class="panel-title"><span class="section-number">02</span><h2>找到你的手感</h2><button id="settings" class="icon-button" aria-label="自定义按键">${icon('settings')}</button></div><div class="control-heading"><span id="control-player">玩家 1P</span><small>键盘控制</small></div><div class="key-overview"><div class="arrow-keys"><kbd id="key-up">W</kbd><div><kbd id="key-left">A</kbd><kbd id="key-down">S</kbd><kbd id="key-right">D</kbd></div><small>移动</small></div><div class="action-keys"><div><kbd id="key-b">J</kbd><kbd id="key-a">K</kbd></div><small>B / A</small></div></div><div class="system-keys"><span><kbd id="key-select">Space</kbd> SELECT</span><span><kbd id="key-start">Enter</kbd> START</span></div><button id="edit-keys" class="remap-button">自定义按键 ${icon('arrow')}</button></section></aside></div>
<div class="under-console"><span><i class="tiny-led"></i> <b id="connection-status">本地模式</b><span id="latency"></span></span><span>为每一段快乐，留一个位置。</span></div>
<section class="features"><div><span class="feature-icon">↗</span><div><h3>即开即玩</h3><p>拖入 NES 卡带，回到熟悉的世界</p></div></div><div><span class="feature-icon">⌘</span><div><h3>各有各的手感</h3><p>独立按键映射，习惯不用改变</p></div></div><div><span class="feature-icon">∞</span><div><h3>快乐没有距离</h3><p>分享一个房间，让老朋友重新上线</p></div></div></section>
<footer><span>像素同伴 <i>/</i> MADE FOR PLAYER TWO. <a href="/cores/FCEUmm-LICENSE.txt" target="_blank" rel="noopener">FCEUmm 许可</a> · <a href="/cores/fceumm-source.tar.gz">源码</a></span><span>房间卡带临时转发 · 不存服务器磁盘 · 存档留在本机。</span></footer>

</main><dialog id="library-dialog"><div class="dialog-heading"><div><small>YOUR COLLECTION</small><h2>服务端游戏库</h2></div><button class="tool" data-close aria-label="关闭">${icon('close')}</button></div><p>自动扫描服务器游戏目录及所有层级的子文件夹。添加或移除卡带后，重新打开游戏库即可更新列表。</p><div class="library-search"><label for="library-search">搜索游戏</label><div class="library-search-field"><input id="library-search" type="search" placeholder="搜索游戏名称或子文件夹…" autocomplete="off"><button id="clear-library-search" class="small-button" type="button" hidden>清空</button></div><small id="library-count" role="status" aria-live="polite"></small></div><nav id="library-pagination" class="library-pagination" aria-label="游戏库分页"><label>每页<select id="library-page-size" aria-label="每页游戏数量"><option value="30">30 款</option><option value="60" selected>60 款</option><option value="100">100 款</option></select></label><div class="library-page-actions"><button id="library-first" class="small-button" type="button">首页</button><button id="library-prev" class="small-button" type="button">上一页</button><label><select id="library-page" aria-label="跳转页码"></select></label><button id="library-next" class="small-button" type="button">下一页</button><button id="library-last" class="small-button" type="button">末页</button></div></nav><div id="library-list" class="library-list"></div></dialog>
<dialog id="saves-dialog"><div class="dialog-heading"><div><small>CONTINUE YOUR ADVENTURE</small><h2>存档 / 读档</h2></div><button class="tool" data-close aria-label="关闭">${icon('close')}</button></div><p>每个游戏独立保存。每 30 秒自动存档；手动档不会被自动覆盖。下载备份后可以带到另一台电脑。</p><p id="saves-note" class="saves-note"></p><div id="save-slots"></div><div class="dialog-footer"><button id="import-save" class="small-button">导入存档文件</button><button class="button primary" data-close>完成</button></div><input type="file" id="save-file" accept=".json,.pls" hidden></dialog>
<dialog id="keys-dialog"><div class="dialog-heading"><div><small>MAKE IT YOURS</small><h2>自定义按键</h2></div><button class="tool" data-close aria-label="关闭">${icon('close')}</button></div><p>点击按键，再按下你想使用的键。设置自动保存在当前浏览器。</p><div class="tabs"><button data-player="0" class="active">玩家 1P / 联机按键</button><button data-player="1">玩家 2P / 本地同屏</button></div><div id="key-grid"></div><div class="dialog-footer"><button id="reset-keys" class="text-button">恢复默认</button><button class="button primary" data-close>完成设置 ${icon('check')}</button></div></dialog>
<dialog id="help-dialog"><div class="dialog-heading"><div><small>PRESS START</small><h2>下一局，这样开始</h2></div><button class="tool" data-close aria-label="关闭">${icon('close')}</button></div><ol class="guide"><li><b>插入你的卡带</b><p>加载本机 .nes 文件，或先玩原创演示。支持哪些游戏取决于 JSNES 核心，暂不支持压缩包和所有特殊卡带。</p></li><li><b>选择一个人，或两个人</b><p>本地模式支持两个键盘布局。远程联机时，一人创建房间并复制邀请链接，另一人打开链接加入。</p></li><li><b>同一游戏，一起出发</b><p>打开邀请链接会自动加入房间，并自动加载房主的卡带。房主点击开始即可联机。联机时每人都使用「联机按键」控制自己的角色。</p></li></ol><p class="guide-note">当前使用逐帧同步，约 6 帧输入缓冲。网络较慢或切到后台时可能等待同伴；离开房间后可重新连接。声音在部分浏览器中需要安全连接（HTTPS 或 localhost）。</p><button class="button primary full" data-close>准备好了</button></dialog><div id="toast" role="status" aria-live="polite" hidden></div>`;
const $=id=>document.getElementById(id);
initTheme($('theme-toggle'));
const controls=new Controls(), emulator=new Emulator($('screen'));
let game=null, running=false, room=null, player=1, socket=null, connecting=null, pendingAction=null, epoch=null, queue=[], expected=0, frameNumber=0, lastTime=0, accumulator=0, fpsFrames=0, fpsTime=performance.now(), editPlayer=0, capturing=null, roomState=null, lastFrameAt=0, starting=false, loading=false;
const roomROMs=new RoomROMs({send,sendBinary:bytes=>{if(socket?.readyState!==WebSocket.OPEN)throw Error('房间连接已断开');socket.send(bytes);},context:()=>({room,player,game,offer:roomState?.offer,epoch,starting}),load:loadGame,ready:sendReady,changed:renderRoom});
const gameStage=new GameStage({stage:$('game-stage'),controls,hasGame:()=>!!game,button:$('fullscreen'),exitButton:$('exit-fullscreen'),portraitButton:$('landscape-play')});
new MobileControls({element:$('touch-controls'),joystick:$('joystick'),controls,unlockAudio});
$('stage-save').onclick=()=>saveSlot(1);
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,4500);}
function updateControls(){const m=controls.maps[0];['a','b','select','start','up','down','left','right'].forEach((name,i)=>$('key-'+name).textContent=keyName(m[i]));$('control-player').textContent=room?`你的按键 · ${player}P`:'玩家 1P';}
function updateGameUI(){
  $('core-label').textContent=emulator.nes&&!emulator.nes.coreVersion?'JSNES · 旧存档':'FCEUmm';
  $('game-name').textContent=game?.name||'等待插入卡带';$('game-led').classList.toggle('on',!!game);$('screen-empty').hidden=!!game;
  $('toggle').disabled=!game||!!epoch||starting||loading;$('restart').disabled=!game||!!epoch||starting||loading;
  $('quick-save').disabled=!game||loading||starting;$('open-saves').disabled=!game||loading||starting;$('change-rom').disabled=!!epoch||starting||loading;
  $('toggle').innerHTML=icon(running?'pause':'play');$('pause-overlay').hidden=!game||running||!!epoch;
  $('screen-status').textContent=epoch?'NETPLAY':game?(running?'PLAYING':'PAUSED'):'STANDBY';
  $('screen-player').textContent=String(player).padStart(2,'0');$('touch-controls').hidden=!game;gameStage.update();updateControls();
}
async function unlockAudio(){try{await emulator.unlockAudio();}catch{toast('当前环境无法启用声音，仍可继续游戏。HTTPS 或 localhost 可启用声音。');}}
async function loadGame(bytes,name,options={}){
  if(epoch||starting||loading){toast('请等待当前加载完成或先结束联机，再更换卡带');return;}
  if(bytes.length>8*1024*1024||bytes[0]!==0x4e||bytes[1]!==0x45||bytes[2]!==0x53||bytes[3]!==0x1a){toast('请选择有效的 .nes 游戏文件（最大 8 MB）');return;}
  try{loading=true;updateGameUI();if(game)await autoSave();await emulator.load(bytes);game={bytes,name,hash:sha256(bytes),source:options.source||'relay',libraryId:options.libraryId||null};running=!options.auto;queue=[];accumulator=0;controls.clear();if(!options.auto)void unlockAudio();if(room)sendReady();updateGameUI();if(!options.auto)toast(room?'游戏已加载，将自动同步给同伴':'卡带已插入，按 Enter 开始冒险');return true;}
  catch(error){toast('无法运行这份卡带：'+error.message);return false;}
  finally{loading=false;updateGameUI();}
}
$('rom-file').onchange=async e=>{const file=e.target.files[0];if(file)await loadGame(new Uint8Array(await file.arrayBuffer()),file.name);e.target.value='';};
for(const id of ['load-main','change-rom'])$(id).onclick=()=>$('rom-file').click();
$('demo').onclick=async()=>{try{const response=await fetch('/demo.nes');if(!response.ok)throw Error();await loadGame(new Uint8Array(await response.arrayBuffer()),'PIXEL PARK · 原创双人演示',{source:'demo'});}catch{toast('演示加载失败，请刷新后重试');}};
const shell=$('screen-shell');shell.addEventListener('dragover',e=>{e.preventDefault();shell.classList.add('dragging');});shell.addEventListener('dragleave',()=>shell.classList.remove('dragging'));shell.addEventListener('drop',async e=>{e.preventDefault();shell.classList.remove('dragging');const file=e.dataTransfer.files[0];if(file)await loadGame(new Uint8Array(await file.arrayBuffer()),file.name);});
$('toggle').onclick=async()=>{if(!game||epoch||starting)return;await unlockAudio();running=!running;accumulator=0;emulator.clearAudio();controls.clear();updateGameUI();};
$('restart').onclick=()=>{if(game&&!epoch&&!starting&&!loading)void loadGame(game.bytes,game.name,{source:game.source,libraryId:game.libraryId});};
window.addEventListener('keydown',()=>{if(game&&emulator.audio?.state!=='running')void unlockAudio();});
$('screen-shell').addEventListener('pointerdown',()=>{if(game)void unlockAudio();});
$('sound').onclick=async()=>{await unlockAudio();emulator.setMuted(!emulator.muted);$('sound').classList.toggle('muted',emulator.muted);$('sound').setAttribute('aria-label',emulator.muted?'打开声音':'关闭声音');};

function send(data){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(data));}
function sendReady(){if(game)send({type:'ready',hash:game.hash,name:game.name,protocol:PROTOCOL,size:game.bytes.length,source:game.source,libraryId:game.libraryId});}
function renderRoom(){
  $('room-idle').hidden=!!room;$('room-active').hidden=!room;
  $('connection-status').textContent=room?`联机房间 · ${room}`:'本地模式';$('latency').textContent='';
  if(room){$('active-code').textContent=room;$('my-player').textContent=player+'P';const state=roomState||{players:1,ready:[]};$('room-members').replaceChildren(...[0,1].map(i=>{const d=document.createElement('div');d.className='member';const badge=document.createElement('span');badge.className='member-avatar '+(i===0?'green':'');badge.textContent=(i+1)+'P';const name=document.createElement('span');name.textContent=i===player-1?'你':(i<state.players?'游戏搭子':'等待同伴');const status=document.createElement('small');status.textContent=state.ready[i]?'已就绪':i<state.players?'等待卡带同步':'未加入';d.append(badge,name,status);return d;}));
    const ready=state.players===2&&state.ready.every(Boolean);
    $('start-room').disabled=epoch?false:player!==1||!ready||starting;
    $('start-room').textContent=epoch?'结束本局':starting?'正在开始…':player===2?'等待房主开始':ready?'一起开始游戏':'两人就绪后开始';
    $('start-mode-label').hidden=player!==1||!!epoch;
    $('start-mode').disabled=starting;
    $('retry-rom').hidden=player!==2||!roomROMs.error||!state.offer||!!epoch;
    $('room-hint').textContent=epoch?'逐帧同步中 · 两人都保持游戏页面打开':!game?(player===2?'等待房主选择卡带…':'选择卡带后会自动同步给同伴'):state.players<2?'等待同伴时可继续单机，当前进度不会重置':ready?'卡带一致，搭子已就位！':'正在自动同步房主卡带…';
    if(!epoch&&!ready&&(roomROMs.error||roomROMs.label))$('room-hint').textContent=roomROMs.error||roomROMs.label;
  }updateGameUI();
}
function exitRoom(message){void autoSave();const wasOnline=!!epoch;room=null;roomState=null;epoch=null;starting=false;queue=[];player=1;roomROMs.clear();controls.clear();if(wasOnline)running=false;emulator.clearAudio();renderRoom();if(message)toast(message);}
async function connect(){
  if(socket?.readyState===WebSocket.OPEN)return;
  if(connecting)return connecting;
  connecting=new Promise((resolve,reject)=>{
    socket=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/netplay`);
    let opened=false;
    const timeout=setTimeout(()=>{reject(Error(opened?'房间服务版本过旧，请服主更新 server、shared 目录并在宝塔重启 Node 项目':'连接超时，请检查房间服务'));socket.close();},8000);
    socket.binaryType='arraybuffer';
    socket.onopen=()=>{opened=true;socket.send(JSON.stringify({type:'hello',protocol:PROTOCOL}));};
    socket.onmessage=event=>{try{if(typeof event.data==='string'){
      const message=JSON.parse(event.data);
      if(message.type==='hello'){
        clearTimeout(timeout);
        if(message.protocol!==PROTOCOL){reject(Error('网页与房间服务版本不一致，请服主更新程序并重启 Node 项目，双方刷新页面'));socket.close();return;}
        resolve();return;
      }
      void onMessage(message).catch(error=>{console.error(error);toast(error.message);});
    }else roomROMs.binary(new Uint8Array(event.data));}catch(error){console.error(error);toast('联机处理失败，请离开后重新加入');}};
    socket.onclose=()=>{clearTimeout(timeout);connecting=null;pendingAction=null;if(room)exitRoom('连接已断开，请重新加入房间');reject(Error('无法连接房间服务'));};
    socket.onerror=()=>{clearTimeout(timeout);reject(Error('无法连接房间服务'));};
  }).finally(()=>{connecting=null;});
  return connecting;
}
async function onMessage(msg){
  if(roomROMs.message(msg))return;
  if(msg.type==='error'){if(starting)running=beforeStartRunning;starting=false;pendingAction=null;renderRoom();toast(msg.message);return;}
  if(msg.type==='joined'){pendingAction=null;room=msg.code;player=msg.player;epoch=null;controls.clear();emulator.clearAudio();if(player===1)sendReady();renderRoom();toast(`已加入房间 ${room}，你是 ${player}P`);return;}
  if(msg.type==='room'){roomState=msg;roomROMs.offer(msg.offer);renderRoom();return;}
  if(msg.type==='left'){exitRoom(msg.reason);return;}
  if(msg.type==='start'){
    const startRoom=room;
    if(!game){send({type:'stop'});toast('请重新加载游戏');return;}
    starting=true;renderRoom();
    try{if(msg.snapshot)await emulator.restore(msg.snapshot,game.hash);else await emulator.load(game.bytes);}catch(error){send({type:'stop'});starting=false;running=false;toast(error.message);renderRoom();return;}if(room!==startRoom)return;epoch=msg.epoch;expected=0;queue=[];frameNumber=0;accumulator=0;running=true;starting=false;lastFrameAt=performance.now();controls.clear();
    for(let f=0;f<msg.delay;f++)send({type:'input',epoch,frame:f,buttons:0});renderRoom();return;
  }
  if(msg.type==='stop'){void autoSave();epoch=null;running=false;starting=false;queue=[];controls.clear();emulator.clearAudio();renderRoom();toast('已退出联机同步，当前进度已保留；可继续单机或再次联机');return;}
  if(msg.type==='frame'&&epoch===msg.epoch){
    if(msg.frame!==expected||queue.length>120){send({type:'stop'});toast('同步中断，请重新开始本局');return;}
    expected++;queue.push(msg);lastFrameAt=performance.now();return;
  }
  if(msg.type==='pong'&&room)$('latency').textContent=` / ${Math.round(performance.now()-msg.time)} ms RTT`;
}
async function roomAction(action,{automatic=false}={}){if(pendingAction)return;pendingAction=action;try{if(!automatic)void unlockAudio();await connect();send(action);}catch(error){pendingAction=null;toast(error.message);}}
$('create-room').onclick=()=>{void autoSave();roomAction({type:'create'});};
$('join-form').onsubmit=e=>{e.preventDefault();roomAction({type:'join',code:$('room-code').value.trim()});};
$('retry-rom').onclick=()=>roomROMs.retry();
$('leave-room').onclick=()=>{send({type:'leave'});};
let beforeStartRunning=false;
$('start-room').onclick=async()=>{
  await unlockAudio();if(epoch){send({type:'stop'});return;}
  if(player!==1||!roomState||roomState.players!==2||!roomState.ready.every(Boolean)){toast('同伴还未就绪，可以先继续单机');return;}
  beforeStartRunning=running;running=false;starting=true;controls.clear();renderRoom();
  try{const state=$('start-mode').value==='resume'?snapshot(emulator.nes,game):null;if(state)await autoSave();send({type:'start',snapshot:state});}
  catch(error){starting=false;running=beforeStartRunning;renderRoom();toast(error.message);}
};
$('copy-room').onclick=async()=>{const url=new URL(location.href);url.searchParams.set('room',room);try{await navigator.clipboard.writeText(url.href);toast('邀请链接已复制，发给你的游戏搭子吧');}catch{toast('房间码：'+room+'。请将当前网站地址和房间码发给同伴。');}};
setInterval(()=>{if(room)send({type:'ping',time:performance.now()});},3000);
function showDialog(id){controls.clear();controls.enabled=false;const dialog=$(id);if(!epoch&&['saves-dialog','library-dialog'].includes(id)){dialog.resumeGame=running;running=false;updateGameUI();}dialog.showModal();}
function renderKeys(){$('key-grid').replaceChildren(...BUTTONS.map((label,i)=>{const row=document.createElement('div');row.className='key-row';const text=document.createElement('span');text.textContent=label;const button=document.createElement('button');button.className='key-binding';button.textContent=capturing===i?'按下任意键…':keyName(controls.maps[editPlayer][i]);if(capturing===i)button.classList.add('capturing');button.onclick=()=>{capturing=i;renderKeys();};row.append(text,button);return row;}));}
for(const id of ['settings','edit-keys'])$(id).onclick=()=>{capturing=null;renderKeys();showDialog('keys-dialog');};
$('help').onclick=()=>showDialog('help-dialog');
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',()=>{capturing=null;controls.enabled=true;controls.clear();if('resumeGame' in d){if(!epoch)running=d.resumeGame;delete d.resumeGame;updateGameUI();}}));
document.querySelectorAll('[data-player]').forEach(b=>b.onclick=()=>{editPlayer=Number(b.dataset.player);capturing=null;document.querySelectorAll('[data-player]').forEach(t=>t.classList.toggle('active',t===b));renderKeys();});
window.addEventListener('keydown',e=>{
  if(capturing===null||!$('keys-dialog').open)return;e.preventDefault();e.stopImmediatePropagation();
  if(e.code==='Escape'){capturing=null;renderKeys();return;}
  if(['MetaLeft','MetaRight','ControlLeft','ControlRight','Tab'].includes(e.code)){toast('请选择字母、方向键或其他普通按键');return;}
  const map=controls.maps[editPlayer],duplicate=map.indexOf(e.code),old=map[capturing];if(duplicate!==-1)map[duplicate]=old;map[capturing]=e.code;capturing=null;controls.save();renderKeys();updateControls();
},true);
$('reset-keys').onclick=()=>{controls.maps[editPlayer]=[...DEFAULTS[editPlayer]];controls.save();capturing=null;renderKeys();updateControls();};

function tick(now){
  const elapsed=Math.min(now-lastTime,100);lastTime=now;
  if(game&&running&&!loading&&!starting){accumulator+=elapsed;let steps=0;try{while(accumulator>=1000/emulator.fps&&steps<6){
    if(epoch){if(!queue.length){accumulator=Math.min(accumulator,1000/emulator.fps);break;}const next=queue.shift();emulator.frame(next.buttons);send({type:'input',epoch,frame:next.frame+6,buttons:controls.mask(0)});frameNumber++;}
    else emulator.frame([controls.mask(0),controls.mask(1)]);
    accumulator-=1000/emulator.fps;steps++;fpsFrames++;
  }}catch(error){running=false;if(epoch)send({type:'stop'});toast('模拟器停止：'+error.message);updateGameUI();}
  }else accumulator=0;
  if(now-fpsTime>=1000){$('fps').textContent=game?`${Math.round(fpsFrames*1000/(now-fpsTime))} FPS`:'— FPS';fpsFrames=0;fpsTime=now;
    if(epoch)$('screen-status').textContent=now-lastFrameAt>1500?'等待同伴…':'NETPLAY';
  }requestAnimationFrame(tick);
}
let libraryData={games:[],defaultId:null,canManage:false};
async function libraryRequest(url,options={}){
  const response=await fetch(url,options);const result=await response.json();if(!response.ok)throw Error(result.error||'请求失败');return result;
}
async function chooseLibraryGame(entry,auto=false){
  if(epoch||starting){toast('请先结束联机再切换游戏');return;}
  try{
    const response=await fetch(`/api/library/${entry.id}/rom`);if(!response.ok)throw Error('游戏文件加载失败');
    const bytes=new Uint8Array(await response.arrayBuffer());if(auto&&game)return;
    if(!auto)void autoSave();await loadGame(bytes,entry.name,{auto,source:'library',libraryId:entry.id});
    if($('library-dialog').open){$('library-dialog').resumeGame=!auto;$('library-dialog').close();}
  }catch(error){toast(error.message);}
}
let libraryPage=1,libraryPageSize=60;
function renderLibrary(){
  const list=$('library-list');list.replaceChildren();
  const normalize=text=>text.normalize('NFKC').toLocaleLowerCase().replaceAll('\\','/');
  const query=$('library-search').value.trim(),terms=normalize(query).split(/\s+/).filter(Boolean);
  const matches=text=>terms.every(term=>normalize(text).includes(term));
  const games=libraryData.games.filter(entry=>matches(`${entry.name}.nes ${entry.folder||''}`));
  $('clear-library-search').hidden=!query;
  const pages=Math.max(1,Math.ceil(games.length/libraryPageSize));libraryPage=Math.min(libraryPage,pages);
  const offset=(libraryPage-1)*libraryPageSize;
  $('library-page').replaceChildren(...Array.from({length:pages},(_,i)=>{const option=document.createElement('option');option.value=String(i+1);option.textContent=`第 ${i+1} / ${pages} 页`;return option;}));
  $('library-page').value=String(libraryPage);
  $('library-first').disabled=$('library-prev').disabled=libraryPage===1;
  $('library-next').disabled=$('library-last').disabled=libraryPage===pages;
  $('library-page').disabled=!games.length;
  $('library-count').textContent=`${query?'找到 '+games.length+' 款 · ':''}共 ${libraryData.games.length} 款游戏${games.length?' · 当前 '+(offset+1)+'–'+Math.min(offset+libraryPageSize,games.length)+' 款':''}`;
  const showDemo=libraryPage===1&&matches('PIXEL PARK 原创双人演示');
  if(showDemo){const demo=document.createElement('button');demo.className='library-demo';demo.textContent='PIXEL PARK · 原创双人演示';demo.onclick=()=>{$('library-dialog').close();$('demo').click();};list.append(demo);}
  if(libraryData.games.length&&!games.length&&!showDemo){const empty=document.createElement('p');empty.className='empty-note';empty.textContent='没有找到匹配的游戏，试试其他名称或文件夹关键词。';list.append(empty);}
  if(!libraryData.games.length){const empty=document.createElement('p');empty.className='empty-note';empty.textContent='游戏库暂时为空，先试试原创演示，或加载你本机的 NES 卡带。';list.append(empty);}
  for(const entry of games.slice(offset,offset+libraryPageSize)){
    const row=document.createElement('div');row.className='library-entry';
    const info=document.createElement('div'),name=document.createElement('strong'),meta=document.createElement('small');name.textContent=entry.name;meta.textContent=`${entry.folder?entry.folder+' · ':''}${Math.round(entry.size/1024)} KB${entry.id===libraryData.defaultId?' · 默认游戏':''}`;info.append(name,meta);
    const buttons=document.createElement('div');buttons.className='library-buttons';
    const choose=document.createElement('button');choose.className='small-button';choose.textContent='开始玩';choose.disabled=!!epoch||starting;choose.onclick=()=>chooseLibraryGame(entry);
    buttons.append(choose);row.append(info,buttons);list.append(row);
  }
  list.scrollTop=0;
}
async function refreshLibrary(auto=false){
  try{libraryData=await libraryRequest('/api/library');renderLibrary();
    if(auto&&libraryData.defaultId&&!game){const entry=libraryData.games.find(g=>g.id===libraryData.defaultId);if(entry)await chooseLibraryGame(entry,true);}
  }catch(error){if(!auto)toast(error.message);}
}
$('library-search').oninput=()=>{libraryPage=1;renderLibrary();};
$('clear-library-search').onclick=()=>{$('library-search').value='';libraryPage=1;renderLibrary();$('library-search').focus();};
function changeLibraryPage(page){libraryPage=page;renderLibrary();$('library-list').scrollTop=0;}
$('library-first').onclick=()=>changeLibraryPage(1);
$('library-prev').onclick=()=>changeLibraryPage(libraryPage-1);
$('library-next').onclick=()=>changeLibraryPage(libraryPage+1);
$('library-last').onclick=()=>changeLibraryPage(Number($('library-page').lastElementChild.value));
$('library-page').onchange=event=>changeLibraryPage(Number(event.target.value));
$('library-page-size').onchange=event=>{libraryPageSize=Number(event.target.value);changeLibraryPage(1);};
$('open-library').onclick=()=>{libraryPage=1;renderLibrary();showDialog('library-dialog');void refreshLibrary();};
async function autoSave(){
  if(!game||!emulator.nes)return;
  try{await storeSave(snapshot(emulator.nes,game),'auto');$('save-status').textContent='自动存档已保存 · 本机';}
  catch(error){$('save-status').textContent='自动存档未保存，请手动导出备份';}
}
async function saveSlot(slot){
  if(!game)return;
  try{await storeSave(snapshot(emulator.nes,game),slot);$('save-status').textContent=`手动存档 ${slot} 已保存`;$('stage-save').textContent='已存档';setTimeout(()=>$('stage-save').textContent='快速存档',2000);toast(`已保存到手动存档 ${slot}`);if($('saves-dialog').open)await renderSaves();}
  catch(error){toast(error.message);}
}
async function restoreSave(save){
  if(epoch||starting){toast('联机进行中不能单独读档，请先结束本局，再由房主读档后继续联机');return;}
  try{
    validateSave(save,game?.hash);if(!game)throw Error('请先加载存档对应的游戏');
    // Preserve the current scene before restoring an older manual slot.
    await storeSave(snapshot(emulator.nes,game),'auto');
    loading=true;running=false;updateGameUI();await emulator.restore(save,game.hash);running=false;controls.clear();accumulator=0;updateGameUI();
    $('saves-dialog').resumeGame=false;$('saves-dialog').close();toast('存档已恢复，点击播放继续；也可邀请同伴接着玩');
  }catch(error){toast(error.message);}
  finally{loading=false;updateGameUI();}
}
function exportSave(save){
  const blob=new Blob([JSON.stringify(save)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${save.name.replace(/[^\p{L}\p{N}._ -]/gu,'_')}-${save.savedAt.slice(0,10)}.pls`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function renderSaves(){
  if(!game)return;
  $('saves-note').textContent=epoch?'联机时可以存档；读档需先结束本局，再由房主恢复进度。':`当前卡带：${game.name}`;
  try{const rows=await getSaves(game.hash),slots=$('save-slots');slots.replaceChildren();
    for(const slot of [1,2,3,'auto']){
      const record=rows.find(r=>r.slot===slot),row=document.createElement('div');row.className='save-slot';
      const info=document.createElement('div'),name=document.createElement('strong'),time=document.createElement('small');name.textContent=slot==='auto'?'自动存档':`手动存档 ${slot}`;time.textContent=record?new Date(record.save.savedAt).toLocaleString('zh-CN')+(record.save.core.startsWith('jsnes')?' · 旧版存档，使用旧核心读取':' · FCEUmm'):'尚未保存';info.append(name,time);
      const buttons=document.createElement('div');buttons.className='save-buttons';
      if(slot!=='auto'){const save=document.createElement('button');save.className='small-button';save.textContent='保存';save.onclick=()=>saveSlot(slot);buttons.append(save);}
      const load=document.createElement('button');load.className='small-button';load.textContent='读取';load.disabled=!record||!!epoch||starting;load.onclick=()=>restoreSave(record.save);
      const download=document.createElement('button');download.className='text-button';download.textContent='导出';download.disabled=!record;download.onclick=()=>exportSave(record.save);
      buttons.append(load,download);row.append(info,buttons);slots.append(row);
    }
  }catch(error){toast(error.message);}
}
$('quick-save').onclick=()=>saveSlot(1);
$('open-saves').onclick=()=>{showDialog('saves-dialog');void renderSaves();};
$('import-save').onclick=()=>$('save-file').click();
$('save-file').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  try{if(file.size>MAX_SAVE_BYTES)throw Error('存档文件过大');await restoreSave(JSON.parse(await file.text()));}
  catch(error){toast(error instanceof SyntaxError?'存档格式无效':error.message);}
  finally{event.target.value='';}
};
setInterval(()=>{if(game&&running&&!starting)void autoSave();},30000);
window.addEventListener('pagehide',()=>{void autoSave();});

const invited=new URL(location.href).searchParams.get('room');if(/^\d{6}$/.test(invited||'')){$('room-code').value=invited;toast('正在自动加入朋友的房间…');void roomAction({type:'join',code:invited},{automatic:true});}
updateGameUI();requestAnimationFrame(tick);
void refreshLibrary(!/^\d{6}$/.test(invited||''));
