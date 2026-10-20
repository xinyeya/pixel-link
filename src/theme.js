export function initTheme(button){
  let saved;try{saved=localStorage.getItem('pixel-link.theme');}catch{}
  function apply(theme){
    document.documentElement.dataset.theme=theme;
    document.documentElement.style.colorScheme=theme;
    const light=theme==='light';button.textContent=light?'☾ 深色':'☀ 浅色';
    button.setAttribute('aria-label',light?'切换深色主题':'切换浅色主题');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',light?'#f0f1e9':'#15191b');
  }
  apply(saved==='light'?'light':'dark');
  button.onclick=()=>{const next=document.documentElement.dataset.theme==='light'?'dark':'light';apply(next);try{localStorage.setItem('pixel-link.theme',next);}catch{}};
}
