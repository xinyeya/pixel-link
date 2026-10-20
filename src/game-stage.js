export class GameStage {
  constructor({stage,controls,hasGame,button,exitButton,portraitButton}){
    Object.assign(this,{stage,controls,hasGame,button});this.active=false;
    button.onclick=()=>this.toggle();exitButton.onclick=()=>this.exit();portraitButton.onclick=()=>this.enter();
    this.resize=()=>{controls.clear();this.update();};
    window.addEventListener('resize',this.resize);
    document.addEventListener('fullscreenchange',()=>this.fullscreenChanged());
    document.addEventListener('webkitfullscreenchange',()=>this.fullscreenChanged());
    window.addEventListener('keydown',event=>{if(event.code==='Escape'&&this.active&&!this.nativeElement())void this.exit();});
    this.update();
  }
  nativeElement(){return document.fullscreenElement||document.webkitFullscreenElement;}
  touch(){return navigator.maxTouchPoints>0||matchMedia('(any-pointer: coarse)').matches||window.innerWidth<=760;}
  update(){
    const touch=this.touch();this.stage.classList.toggle('touch-ui',touch);
    this.stage.classList.toggle('has-game',this.hasGame());
    this.stage.classList.toggle('is-immersive',this.active);
    document.body.classList.toggle('game-immersive',this.active);
    this.button.setAttribute('aria-label',this.active?'退出全屏':'全屏游玩');
    this.button.title=this.active?'退出全屏':'全屏游玩';
  }
  async toggle(){if(this.active)await this.exit();else await this.enter();}
  async enter(){
    this.controls.clear();this.active=true;this.update();
    // The fullscreen subtree includes the canvas AND all touch controls.
    // Where element fullscreen is unavailable (e.g. some phone browsers),
    // the same stage expands to the visual viewport as an in-page fallback.
    try{
      if(this.stage.requestFullscreen)await this.stage.requestFullscreen({navigationUI:'hide'});
      else if(this.stage.webkitRequestFullscreen)await this.stage.webkitRequestFullscreen();
    }catch{/* Keep the usable in-page fullscreen layout. */}
    if(this.touch())try{await screen.orientation?.lock?.('landscape');}catch{/* Portrait hint asks the player to rotate manually. */}
    this.update();
  }
  async exit(){
    this.controls.clear();
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else if(document.webkitFullscreenElement)await document.webkitExitFullscreen();
    }catch{}
    try{screen.orientation?.unlock?.();}catch{}
    this.active=false;this.update();
  }
  fullscreenChanged(){
    if(this.nativeElement()===this.stage)this.active=true;
    else this.active=false;
    this.controls.clear();this.update();
  }
}
