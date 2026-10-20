class NESSpeaker extends AudioWorkletProcessor {
  constructor(){super();this.buffer=new Float32Array(32768);this.read=0;this.write=0;this.count=0;this.primed=false;this.port.onmessage=({data})=>{
    if(data==='clear'){this.read=this.write=this.count=0;this.primed=false;return;}
    for(const sample of data){if(this.count===this.buffer.length){this.read=(this.read+2)%this.buffer.length;this.count-=2;}this.buffer[this.write]=sample;this.write=(this.write+1)%this.buffer.length;this.count++;}
  };}
  process(inputs,outputs){const out=outputs[0];if(!this.primed&&this.count>=2048)this.primed=true;
    for(let i=0;i<out[0].length;i++){
      if(this.primed&&this.count>=2){out[0][i]=this.buffer[this.read];this.read=(this.read+1)%this.buffer.length;out[1][i]=this.buffer[this.read];this.read=(this.read+1)%this.buffer.length;this.count-=2;}
      else {out[0][i]=out[1][i]=0;this.primed=false;}
    }return true;}
}
registerProcessor('nes-speaker',NESSpeaker);
