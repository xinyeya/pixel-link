import { CompatibleNES as NES } from './nes-core.js';
import { FCEUmmCore } from './fceumm-core.js';
import { LEGACY_CORE_VERSION } from '../shared/session.js';
import { validateSave } from '../shared/session.js';
export class Emulator {
  constructor(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});
    this.image=this.ctx.createImageData(256,240);this.pixels=new Uint32Array(this.image.data.buffer);
    this.samples=[];this.muted=false;
  }
  async unlockAudio(){
    if(!this.audio){
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio)return;
      this.audio=new Audio({sampleRate:48000});
      if(this.audio.audioWorklet){
        await this.audio.audioWorklet.addModule('/audio-worklet.js');
        this.node=new AudioWorkletNode(this.audio,'nes-speaker',{outputChannelCount:[2]});
        this.gain=this.audio.createGain();this.node.connect(this.gain).connect(this.audio.destination);this.setMuted(this.muted);
      }
    }
    await this.audio.resume();
  }
  async create(bytes,core){
    const callbacks={sampleRate:48000,onFrame:buffer=>this.present(buffer),onAudioSample:(l,r)=>this.samples.push(l,r)};
    if(core===LEGACY_CORE_VERSION){const nes=new NES(callbacks);nes.loadROM(bytes);return nes;}
    return FCEUmmCore.create(bytes,callbacks);
  }
  async load(bytes){
    const nes=await this.create(bytes);this.nes=nes;this.bytes=bytes;this.clearAudio();
  }
  get fps(){return this.nes?.fps||60;}
  present(buffer){
    for(let i=0;i<buffer.length;i++)this.pixels[i]=0xff000000|buffer[i];
    this.ctx.putImageData(this.image,0,0);
  }
  async restore(save,hash){
    validateSave(save,hash);
    const old=this.nes;
    try{const nes=await this.create(this.bytes,save.core);nes.fromJSON(save.state);this.nes=nes;this.present(nes.video?nes.video():nes.ppu.buffer);this.clearAudio();}
    catch(error){this.nes=old;if(old)this.present(old.video?old.video():old.ppu.buffer);throw Error('存档已损坏，当前进度保持不变：'+error.message);}
  }
  frame(buttons){
    if(!this.nes)return;
    for(let p=1;p<=2;p++)for(let b=0;b<8;b++){
      if(buttons[p-1]&(1<<b))this.nes.buttonDown(p,b);else this.nes.buttonUp(p,b);
    }
    this.samples=[];this.nes.frame();
    if(this.node&&this.audio.state==='running'){
      const samples=new Float32Array(this.samples);this.node.port.postMessage(samples,[samples.buffer]);
    }
  }
  clearAudio(){this.node?.port.postMessage('clear');}
  setMuted(value){this.muted=value;if(this.gain)this.gain.gain.value=value?0:0.65;}
}
