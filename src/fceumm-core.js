import {sha256} from 'js-sha256';
import {CORE_VERSION} from '../shared/session.js';
// Each instance has its own WASM memory, filesystem, input and save buffers.
let factoryPromise;
let wasmPromise;
export function base64(bytes){let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);}
export function unbase64(text){return Uint8Array.from(atob(text),c=>c.charCodeAt(0));}
export class FCEUmmCore {
  static async create(bytes,{onFrame=()=>{},onAudioSample=()=>{},factory}={}){
    let wasmBinary;
    if(!factory){
      const url='/cores/fceumm.js?v='+CORE_VERSION;
      factoryPromise??=import(/* @vite-ignore */ url).then(m=>m.default).catch(error=>{factoryPromise=null;throw error;});
      // Fetch once per page: restarts and save restores create isolated core
      // instances without repeatedly downloading the ~0.8 MB WASM binary.
      wasmPromise??=fetch('/cores/fceumm.wasm?v='+CORE_VERSION).then(async response=>{
        if(!response.ok)throw Error('模拟核心加载失败，请检查服务器是否上传 cores 目录');
        return new Uint8Array(await response.arrayBuffer());
      }).catch(error=>{wasmPromise=null;throw error;});
      [factory,wasmBinary]=await Promise.all([factoryPromise,wasmPromise]);
    }
    const module=await factory({...(wasmBinary?{wasmBinary}:{}),locateFile:name=>'/cores/'+name+'?v='+CORE_VERSION,print:()=>{},printErr:()=>{}});
    const core=new FCEUmmCore(module,onFrame,onAudioSample);
    const p=module._malloc(bytes.length);
    try{module.HEAPU8.set(bytes,p);if(!module._pl_load(p,bytes.length))throw Error('FCEUmm 无法识别或运行这份卡带');}finally{module._free(p);}
    core.fps=module._pl_fps();return core;
  }
  constructor(module,onFrame,onAudioSample){Object.assign(this,{module,onFrame,onAudioSample,coreVersion:CORE_VERSION,pads:[0,0]});}
  buttonDown(p,b){this.pads[p-1]|=1<<b;}
  buttonUp(p,b){this.pads[p-1]&=~(1<<b);}
  video(){const m=this.module;return m.HEAPU32.subarray(m._pl_video()>>>2,(m._pl_video()>>>2)+256*240);}
  frame(){
    const m=this.module;m._pl_run(...this.pads);this.onFrame(this.video());
    const start=m._pl_audio()>>>1,count=m._pl_audio_count();for(let i=0;i<count;i+=2)this.onAudioSample(m.HEAP16[start+i]/32768,m.HEAP16[start+i+1]/32768);
  }
  toJSON(){
    const m=this.module,size=m._pl_state_size(),p=m._malloc(size);
    try{if(!m._pl_save(p,size))throw Error('无法创建 FCEUmm 存档');const bytes=m.HEAPU8.slice(p,p+size);
      return {kind:'fceumm',data:base64(bytes),digest:sha256(bytes),video:base64(new Uint8Array(this.video().buffer,this.video().byteOffset,256*240*4)),ram:base64(m.HEAPU8.subarray(m._pl_ram(),m._pl_ram()+2048)),pads:[...this.pads]};
    }finally{m._free(p);}
  }
  fromJSON(state){
    const bytes=unbase64(state.data),m=this.module;
    if(sha256(bytes)!==state.digest||bytes.length!==m._pl_state_size())throw Error('存档校验失败');
    const p=m._malloc(bytes.length);
    try{m.HEAPU8.set(bytes,p);if(!m._pl_restore(p,bytes.length))throw Error('核心拒绝读取存档');}finally{m._free(p);}
    m.HEAPU8.set(unbase64(state.video),m._pl_video());this.pads=[...state.pads];
  }
}
