import {test,expect} from '@playwright/test';
async function setup(browser,viewport={width:390,height:844}){
 const context=await browser.newContext({viewport,isMobile:true,hasTouch:true});const page=await context.newPage();await page.goto('/');await page.locator('#demo').tap();await expect(page.locator('#touch-controls')).toBeVisible();return {context,page};
}
async function point(locator,dx=0,dy=0){const r=await locator.boundingBox();return {x:r.x+r.width/2+dx,y:r.y+r.height/2+dy};}
const finger=(id,p)=>({id,x:p.x,y:p.y,radiusX:8,radiusY:8,force:1});
async function buttons(page,value){await expect(page.locator('#touch-controls')).toHaveAttribute('data-buttons',String(value));}
test('real simultaneous touches keep joystick + A + B independent and reach the emulated controller',async({browser})=>{
 const {context,page}=await setup(browser);const cdp=await context.newCDPSession(page);const joystick=page.locator('#joystick');const canvasBox=await page.locator('#screen').boundingBox(),shellBox=await page.locator('#screen-shell').boundingBox();expect(canvasBox.height).toBeLessThanOrEqual(shellBox.height);expect(canvasBox.width).toBeLessThanOrEqual(shellBox.width);await joystick.scrollIntoViewIfNeeded();
 const stick=await point(joystick,32,0),a=await point(page.getByRole('button',{name:'A 键',exact:true})),b=await point(page.getByRole('button',{name:'B 键',exact:true}));
 const left=finger(1,stick),right=finger(2,a),third=finger(3,b);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[left]});await buttons(page,128);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[left,right]});await buttons(page,129);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[left,right,third]});await buttons(page,131);
 // Save while fingers are held: the original demo polls controller 1 into RAM $10.
 await page.waitForTimeout(120);await page.locator('#quick-save').dispatchEvent('click');await expect(page.locator('#save-status')).toContainText('手动');
 const pad=await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('pixel-link-saves');r.onsuccess=()=>resolve(r.result);});return new Promise(resolve=>{const r=db.transaction('saves').objectStore('saves').getAll();r.onsuccess=()=>resolve(atob(r.result.find(v=>v.slot===1).save.state.ram).charCodeAt(0x10));});});expect(pad&0xc1).toBe(0xc1);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[third]});await buttons(page,129);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[right]});await buttons(page,128);
 const up=await point(joystick,0,-32);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[finger(1,up)]});await buttons(page,16);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[finger(1,up)]});await buttons(page,0);
 await context.close();
});
test('fullscreen contains joystick and action buttons; landscape layout fits and exit restores page',async({browser})=>{
 const {context,page}=await setup(browser,{width:844,height:390});await page.locator('#fullscreen').tap();await expect(page.locator('#game-stage')).toHaveClass(/is-immersive/);
 await expect(page.locator('#joystick')).toBeVisible();await expect(page.getByRole('button',{name:'A 键',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>{const s=document.querySelector('#game-stage');return (!document.fullscreenElement||document.fullscreenElement===s)&&s.contains(document.querySelector('#touch-controls'));})).toBe(true);
 for(const selector of ['#joystick','[aria-label="A 键"]','[aria-label="B 键"]','#exit-fullscreen']){
  const box=await page.locator(selector).boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(845);expect(box.y+box.height).toBeLessThanOrEqual(391);
 }
 const screenBox=await page.locator('#screen-shell').boundingBox(),systemBox=await page.locator('.touch-system').boundingBox();
 expect(screenBox.height).toBeGreaterThanOrEqual(390);expect(screenBox.width).toBeGreaterThanOrEqual(840);expect(systemBox.y).toBeGreaterThan(screenBox.y);expect(systemBox.y+systemBox.height).toBeLessThanOrEqual(screenBox.y+screenBox.height);
 const stickBox=await page.locator('#joystick').boundingBox(),actionBox=await page.getByRole('button',{name:'A 键',exact:true}).boundingBox();
 expect(stickBox.x).toBeGreaterThan(844*.1);expect(844-actionBox.x-actionBox.width).toBeGreaterThan(844*.08);
 await page.locator('.touch-system button[data-bit="3"]').dispatchEvent('pointerdown',{pointerId:90,pointerType:'touch'});await buttons(page,8);await page.locator('.touch-system button[data-bit="3"]').dispatchEvent('pointerup',{pointerId:90,pointerType:'touch'});await buttons(page,0);
 await page.screenshot({path:'test-results/mobile-landscape-fullscreen.png'});
 const cdp=await context.newCDPSession(page),stick=finger(1,await point(page.locator('#joystick'),32,0)),action=finger(2,await point(page.getByRole('button',{name:'A 键',exact:true})));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[stick,action]});await buttons(page,129);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await buttons(page,0);
 await page.locator('#exit-fullscreen').tap();await expect(page.locator('#game-stage')).not.toHaveClass(/is-immersive/);await expect(page.locator('.header')).toBeVisible();await context.close();
});
test('portrait hint and in-page fullscreen work when the browser has no element fullscreen API',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();
 await page.addInitScript(()=>{Object.defineProperty(Element.prototype,'requestFullscreen',{value:undefined,configurable:true});Object.defineProperty(Element.prototype,'webkitRequestFullscreen',{value:undefined,configurable:true});});
 await page.goto('/');await page.locator('#demo').tap();await expect(page.locator('#portrait-hint')).toContainText('建议横屏');await page.locator('#landscape-play').tap();await expect(page.locator('#game-stage')).toHaveClass(/is-immersive/);
 expect(await page.evaluate(()=>document.fullscreenElement)).toBeNull();await expect(page.locator('#joystick')).toBeVisible();await expect(page.getByRole('button',{name:'A 键',exact:true})).toBeVisible();await page.screenshot({path:'test-results/mobile-portrait-fullscreen.png'});
 await page.setViewportSize({width:844,height:390});await expect(page.locator('#portrait-hint')).toBeHidden();await page.screenshot({path:'test-results/mobile-landscape-fallback.png'});
 await page.locator('#exit-fullscreen').tap();await expect(page.locator('#game-stage')).not.toHaveClass(/is-immersive/);await context.close();
});
test('losing focus clears all touch state instead of leaving movement held',async({browser})=>{
 const {context,page}=await setup(browser);const cdp=await context.newCDPSession(page);await page.locator('#joystick').scrollIntoViewIfNeeded();
 const stick=finger(1,await point(page.locator('#joystick'),30,30));await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[stick]});await buttons(page,160);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await buttons(page,0);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await context.close();
});


test('compact landscape keeps inset controls separated from system buttons',async({browser})=>{
 const {context,page}=await setup(browser,{width:568,height:320});await page.locator('#fullscreen').tap();await expect(page.locator('#game-stage')).toHaveClass(/is-immersive/);
 const stick=await page.locator('#joystick').boundingBox(),actions=await page.locator('.touch-action').boundingBox(),system=await page.locator('.touch-system').boundingBox();
 expect(stick.x).toBeGreaterThan(568*.1);expect(568-actions.x-actions.width).toBeGreaterThan(568*.08);expect(stick.x+stick.width).toBeLessThan(system.x);expect(system.x+system.width).toBeLessThan(actions.x);
 await page.screenshot({path:'test-results/mobile-compact-fullscreen.png'});await context.close();
});
