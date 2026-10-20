export const BUTTONS=['A','B','SELECT','START','↑','↓','←','→'];
const LEGACY_DEFAULTS=[['KeyX','KeyZ','ShiftRight','Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'],['KeyG','KeyF','KeyR','KeyT','KeyW','KeyS','KeyA','KeyD']];
export const DEFAULTS=[['KeyK','KeyJ','Space','Enter','KeyW','KeyS','KeyA','KeyD'],['Numpad2','Numpad1','Numpad0','NumpadEnter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']];
export const keyName=code=>({ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',ShiftRight:'R Shift',ShiftLeft:'L Shift',Space:'Space',Enter:'Enter',NumpadEnter:'Num ↵',Numpad0:'Num 0',Numpad1:'Num 1',Numpad2:'Num 2',Escape:'Esc'}[code]||code.replace(/^Key|^Digit|^Numpad/,''));
export class Controls {
  constructor(){
    try {const v=JSON.parse(localStorage.getItem('pixel-link.keys'));this.maps=Array.isArray(v)&&v.length===2&&v.every(p=>Array.isArray(p)&&p.length===8&&p.every(k=>typeof k==='string'))?v:structuredClone(DEFAULTS);}catch{this.maps=structuredClone(DEFAULTS);}
    // Upgrade previously saved defaults, preserving individually customized keys.
    for(let p=0;p<2;p++) if(this.maps[p].every((key,i)=>key===LEGACY_DEFAULTS[p][i]))this.maps[p]=[...DEFAULTS[p]];
    this.held=new Set();this.touch=[0,0];this.enabled=true;this.onClear=new Set();
    window.addEventListener('keydown',e=>{if(!this.enabled||e.target.closest('input,textarea,select,dialog'))return;if(this.maps.some(m=>m.includes(e.code))){e.preventDefault();this.held.add(e.code);}});
    window.addEventListener('keyup',e=>this.held.delete(e.code));window.addEventListener('blur',()=>this.clear());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});
  }
  clear(){this.held.clear();this.touch=[0,0];for(const listener of this.onClear)listener();}
  mask(player){return this.maps[player].reduce((mask,key,i)=>this.held.has(key)?mask|(1<<i):mask,this.touch[player]);}
  save(){localStorage.setItem('pixel-link.keys',JSON.stringify(this.maps));}
}
