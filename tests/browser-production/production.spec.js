import {test,expect} from '@playwright/test';
test('production bundle serves WASM correctly and resumes two FCEUmm peers',async({browser,request})=>{
 const health=await(await request.get('/health')).json();expect(health.core).toBe('fceumm-ac0d00a-pl1');expect(health.romRelay).toBe(true);
 const wasm=await request.get('/cores/fceumm.wasm');expect(wasm.headers()['content-type']).toBe('application/wasm');expect((await wasm.body()).subarray(0,4).toString('hex')).toBe('0061736d');
 expect((await request.get('/cores/FCEUmm-LICENSE.txt')).ok()).toBe(true);expect((await request.get('/cores/fceumm-source.tar.gz')).ok()).toBe(true);
 const a=await browser.newPage(),b=await browser.newPage(),errors=[],downloads=[];a.on('request',r=>{if(r.url().includes('/cores/fceumm.wasm'))downloads.push(r.url());});for(const p of[a,b])p.on('pageerror',e=>errors.push(e.message));
 try{
  await a.goto('/');await a.locator('#demo').click();await expect(a.locator('#screen-empty')).toBeHidden();await expect(a.locator('#core-label')).toHaveText('FCEUmm');await a.waitForTimeout(700);await a.locator('#quick-save').click();
  await a.locator('#create-room').click();await expect(a.locator('#room-active')).toBeVisible();await b.goto('/?room='+await a.locator('#active-code').textContent());await expect(a.locator('#start-room')).toBeEnabled();await a.locator('#start-room').click();
  for(const p of[a,b]){await expect(p.locator('#screen-status')).toHaveText('NETPLAY');await expect(p.locator('#core-label')).toHaveText('FCEUmm');await expect(p.locator('#fps')).toHaveText(/[1-9][0-9]* FPS/);}
  await a.screenshot({path:'test-results/production-fceumm-netplay.png',fullPage:true});expect(errors).toEqual([]);expect(downloads).toHaveLength(1);
 }finally{await a.close();await b.close();}
});
for(const path of JSON.parse(process.env.NES_FCEUMM_ROMS||'[]'))test('production private ROM loads in browser: '+path.split('/').pop(),async({page})=>{
 await page.goto('/');await page.locator('#rom-file').setInputFiles(path);await expect(page.locator('#screen-empty')).toBeHidden();await expect(page.locator('#core-label')).toHaveText('FCEUmm');await expect(page.locator('#fps')).toHaveText(/[1-9][0-9]* FPS/);await page.locator('#quick-save').click();await expect(page.locator('#save-status')).toContainText('手动');
});
