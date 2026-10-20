// Each physical pointer owns its own input. Releasing one finger never
// releases another finger's button (including two fingers on the same button).
export function joystickMask(x,y,radius){
  if(Math.hypot(x,y)<Math.max(7,radius*0.18))return 0;
  const directions=[128,128|32,32,32|64,64,64|16,16,16|128];
  return directions[(Math.round(Math.atan2(y,x)/(Math.PI/4))+8)%8];
}
export class MobileControls {
  constructor({element,joystick,controls,unlockAudio}){
    Object.assign(this,{element,joystick,controls,unlockAudio});this.pointers=new Map();this.stickId=null;
    this.buttons=[...element.querySelectorAll('[data-bit]')];
    for(const button of this.buttons){
      button.addEventListener('pointerdown',event=>{
        event.preventDefault();if(!controls.enabled)return;
        this.pointers.set(event.pointerId,{mask:1<<Number(button.dataset.bit),button});
        this.capture(button,event.pointerId);this.apply();void unlockAudio();
      });
      for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,event=>this.release(event.pointerId));
    }
    joystick.addEventListener('pointerdown',event=>{
      event.preventDefault();if(!controls.enabled||this.stickId!==null)return;
      this.stickId=event.pointerId;this.capture(joystick,event.pointerId);this.move(event);void unlockAudio();
    });
    joystick.addEventListener('pointermove',event=>{if(event.pointerId===this.stickId){event.preventDefault();this.move(event);}});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,event=>this.release(event.pointerId));
    // Suppress native scrolling/selection only over the virtual controller.
    for(const type of ['touchstart','touchmove'])element.addEventListener(type,event=>{if(event.cancelable)event.preventDefault();},{passive:false});
    controls.onClear.add(()=>this.reset());
  }
  capture(element,id){try{element.setPointerCapture(id);}catch{}}
  move(event){
    const rect=this.joystick.getBoundingClientRect(),radius=Math.max(1,rect.width/2-27);
    const x=event.clientX-(rect.left+rect.width/2),y=event.clientY-(rect.top+rect.height/2),length=Math.hypot(x,y),scale=length>radius?radius/length:1;
    this.joystick.style.setProperty('--stick-x',`${x*scale}px`);this.joystick.style.setProperty('--stick-y',`${y*scale}px`);
    this.pointers.set(event.pointerId,{mask:joystickMask(x,y,radius),button:null});this.apply();
  }
  release(id){
    if(!this.pointers.has(id))return;this.pointers.delete(id);
    if(this.stickId===id){this.stickId=null;this.center();}this.apply();
  }
  center(){this.joystick.style.setProperty('--stick-x','0px');this.joystick.style.setProperty('--stick-y','0px');}
  apply(){
    let mask=0;for(const pointer of this.pointers.values())mask|=pointer.mask;
    this.controls.touch[0]=this.controls.enabled?mask:0;
    for(const button of this.buttons){const held=[...this.pointers.values()].some(p=>p.button===button);button.classList.toggle('held',held);button.setAttribute('aria-pressed',String(held));}
    this.joystick.classList.toggle('held',this.stickId!==null);
    this.element.dataset.buttons=String(this.controls.touch[0]);
  }
  reset(){this.pointers.clear();this.stickId=null;this.center();this.apply();}
}
