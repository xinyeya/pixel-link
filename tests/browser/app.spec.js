import {test,expect} from '@playwright/test';
test('load original demo, pause, remap and persist',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('h1')).toHaveText('老地方，一起玩。');
 await expect(page.locator('#key-up')).toHaveText('W');await expect(page.locator('#key-b')).toHaveText('J');await expect(page.locator('#key-a')).toHaveText('K');await expect(page.locator('#key-select')).toHaveText('Space');
 await page.screenshot({path:'test-results/lobby.png',fullPage:true});
 await page.locator('#demo').click();await expect(page.locator('#screen-empty')).toBeHidden();
 await expect(page.locator('#fps')).not.toHaveText('— FPS');
 await page.waitForTimeout(700);await page.screenshot({path:'test-results/demo.png',fullPage:true});
 await page.locator('#toggle').click();await expect(page.locator('#pause-overlay')).toBeVisible();
 await page.locator('#edit-keys').click();await page.locator('.key-binding').first().click();await page.keyboard.press('j');
 await expect(page.locator('.key-binding').first()).toHaveText('J');await page.getByRole('button',{name:'完成设置'}).click();await expect(page.locator('#key-a')).toHaveText('J');
 await page.reload();await expect(page.locator('#key-a')).toHaveText('J');expect(errors).toEqual([]);
});
test('two browsers create, join, validate, start, stop, restart and leave',async({browser})=>{
 const c1=await browser.newContext(),c2=await browser.newContext();const a=await c1.newPage(),b=await c2.newPage();const errors=[];
 for(const page of [a,b]){page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('#demo').click();}
 await a.locator('#create-room').click();await expect(a.locator('#room-active')).toBeVisible();const code=await a.locator('#active-code').textContent();
 await b.locator('#room-code').fill(code);await b.getByRole('button',{name:'加入房间',exact:true}).click();
 await expect(a.locator('#start-room')).toBeEnabled();await expect(b.locator('#my-player')).toHaveText('2P');
 await a.locator('#start-room').click();await expect(a.locator('#screen-status')).toHaveText('NETPLAY');await expect(b.locator('#screen-status')).toHaveText('NETPLAY');
 await a.waitForTimeout(1000);await a.keyboard.down('d');await b.keyboard.down('a');await a.waitForTimeout(500);await a.keyboard.up('d');await b.keyboard.up('a');
 await expect(a.locator('#fps')).toHaveText(/[1-9][0-9]* FPS/);await expect(b.locator('#fps')).toHaveText(/[1-9][0-9]* FPS/);
 await a.screenshot({path:'test-results/netplay.png',fullPage:true});
 await b.locator('#start-room').click();await expect(a.locator('#start-room')).toHaveText('一起开始游戏');
 await a.locator('#start-room').click();await expect(b.locator('#screen-status')).toHaveText('NETPLAY');
 await b.locator('#leave-room').click();await expect(a.locator('#room-idle')).toBeVisible();await expect(b.locator('#room-idle')).toBeVisible();expect(errors).toEqual([]);
 await c1.close();await c2.close();
});
test('mobile layout and invalid cartridge handling',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 await page.locator('#rom-file').setInputFiles({name:'bad.nes',mimeType:'application/octet-stream',buffer:Buffer.from('bad')});await expect(page.locator('#toast')).toContainText('有效');
 await page.locator('#demo').click();await expect(page.locator('#touch-controls')).toBeVisible();await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});
async function savedX(page,slot=1){
 return page.evaluate(async slot=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('pixel-link-saves',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return new Promise(resolve=>{const r=db.transaction('saves').objectStore('saves').getAll();r.onsuccess=()=>resolve((()=>{const s=r.result.find(v=>v.slot===slot)?.save.state;return s?.kind==='fceumm'?atob(s.ram).charCodeAt(0x203):s?.cpu.mem[0x203];})());});},slot);
}
test('waiting alone does not reset progress; saves survive reload and restore locally',async({page})=>{
 await page.goto('/');await page.locator('#demo').click();await page.waitForTimeout(500);
 await page.keyboard.down('d');await page.waitForTimeout(350);await page.keyboard.up('d');await page.locator('#toggle').click();
 await page.locator('#quick-save').click();await expect(page.locator('#save-status')).toContainText('手动存档');const original=await savedX(page);expect(original).toBeGreaterThan(75);
 await page.locator('#create-room').click();await expect(page.locator('#start-room')).toBeDisabled();await expect(page.locator('#toggle')).toBeEnabled();
 await page.locator('#quick-save').click();await expect.poll(()=>savedX(page)).toBe(original);
 await page.locator('#leave-room').click();await expect(page.locator('#room-idle')).toBeVisible();await page.locator('#quick-save').click();await expect.poll(()=>savedX(page)).toBe(original);
 await page.reload();await page.locator('#demo').click();await page.locator('#open-saves').click();await page.locator('.save-slot').first().getByRole('button',{name:'读取',exact:true}).click();
 await expect(page.locator('#pause-overlay')).toBeVisible();await page.locator('#quick-save').click();await expect.poll(()=>savedX(page)).toBe(original);
 await page.locator('#open-saves').click();const download=page.waitForEvent('download');await page.locator('.save-slot').first().getByRole('button',{name:'导出',exact:true}).click();expect((await download).suggestedFilename()).toMatch(/\.pls$/);
});
test('online default resumes the host scene instead of resetting the game',async({browser})=>{
 const c1=await browser.newContext(),c2=await browser.newContext();const a=await c1.newPage(),b=await c2.newPage();
 for(const page of [a,b]){await page.goto('/');await page.locator('#demo').click();}
 await a.waitForTimeout(500);await a.keyboard.down('d');await a.waitForTimeout(350);await a.keyboard.up('d');await a.locator('#toggle').click();await a.locator('#quick-save').click();await expect(a.locator('#save-status')).toContainText('手动');const original=await savedX(a);expect(original).toBeGreaterThan(75);
 await a.locator('#create-room').click();await expect(a.locator('#room-active')).toBeVisible();await b.locator('#room-code').fill(await a.locator('#active-code').textContent());await b.getByRole('button',{name:'加入房间',exact:true}).click();
 await expect(a.locator('#start-room')).toBeEnabled();await expect(a.locator('#start-mode')).toHaveValue('resume');await a.locator('#start-room').click();
 for(const page of [a,b]){await expect(page.locator('#screen-status')).toHaveText('NETPLAY');await page.locator('#quick-save').click();await expect(page.locator('#save-status')).toContainText('手动');await expect.poll(()=>savedX(page)).toBe(original);}
 await b.locator('#start-room').click();await expect(a.locator('#start-room')).toHaveText('一起开始游戏');await a.locator('#start-mode').selectOption('fresh');await a.locator('#start-room').click();await expect(a.locator('#screen-status')).toHaveText('NETPLAY');await a.waitForTimeout(600);await a.locator('#quick-save').click();await expect.poll(()=>savedX(a)).toBe(75);
 await c1.close();await c2.close();
});
test('copying and removing NES files updates frontend after refresh, without configuration',async({page,request})=>{
 const {mkdir,writeFile,readFile,rm}=await import('node:fs/promises');
 const folder='.data/browser-test-library/自动扫描';await mkdir(folder,{recursive:true});
 const file=folder+'/直接复制测试.nes';const rom=await readFile('public/demo.nes');await writeFile(file,Buffer.concat([rom,Buffer.from([1])]));
 try{
  await page.goto('/');await page.locator('#open-library').click();const row=page.locator('.library-entry').filter({hasText:'直接复制测试'});await expect(row).toHaveCount(1);await expect(row).toContainText('自动扫描');
  await expect(page.locator('#library-token,#library-upload,.library-admin')).toHaveCount(0);
  const denied=await request.post('/api/library/upload',{headers:{Origin:'http://localhost:4181','x-library-token':'browser-test-only'},data:'fake'});expect(denied.status()).toBe(404);
  await row.getByRole('button',{name:'开始玩',exact:true}).click();await expect(page.locator('#game-name')).toHaveText('直接复制测试');await expect(page.locator('#screen-status')).toHaveText('PLAYING');
  await rm(file);await page.reload();await page.locator('#open-library').click();await expect(page.locator('.library-entry').filter({hasText:'直接复制测试'})).toHaveCount(0);
 }finally{await rm(folder,{recursive:true,force:true});}
});
test('invite auto-joins and receives a local multi-chunk ROM without importing a file',async({browser})=>{
 const {readFile}=await import('node:fs/promises');const bytes=Buffer.concat([await readFile('public/demo.nes'),Buffer.alloc(90000,3)]);
 const a=await browser.newPage(),b=await browser.newPage();const errors=[];for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
 await a.goto('/');await a.locator('#rom-file').setInputFiles({name:'房主本地卡带.nes',mimeType:'application/octet-stream',buffer:bytes});await a.locator('#create-room').click();await expect(a.locator('#room-active')).toBeVisible();const code=await a.locator('#active-code').textContent();
 await b.goto('/?room='+code);await expect(b.locator('#my-player')).toHaveText('2P');await expect(b.locator('#game-name')).toHaveText('房主本地卡带.nes');await expect(a.locator('#start-room')).toBeEnabled();
 await a.locator('#start-room').click();await expect(b.locator('#screen-status')).toHaveText('NETPLAY');await expect(b.locator('#fps')).toHaveText(/[1-9][0-9]* FPS/);
 await b.locator('#start-room').click();await expect(a.locator('#start-room')).toHaveText('一起开始游戏');
 await a.locator('#rom-file').setInputFiles({name:'换一份本地卡带.nes',mimeType:'application/octet-stream',buffer:Buffer.concat([bytes,Buffer.from([2])])});await expect(b.locator('#game-name')).toHaveText('换一份本地卡带.nes');await expect(a.locator('#start-room')).toBeEnabled();expect(errors).toEqual([]);
 await a.close();await b.close();
});
test('invite auto-loads the host library game directly from the server',async({browser})=>{
 const {mkdir,writeFile,readFile,rm}=await import('node:fs/promises');const file='.data/browser-test-library/自动联机测试.nes';await mkdir('.data/browser-test-library',{recursive:true});await writeFile(file,Buffer.concat([await readFile('public/demo.nes'),Buffer.from([9])]));
 const a=await browser.newPage(),b=await browser.newPage();const downloads=[];b.on('request',r=>{if(/\/api\/library\/[a-f0-9]+\/rom/.test(r.url()))downloads.push(r.url());});
 try{
  await a.goto('/');await a.locator('#open-library').click();await a.locator('.library-entry').filter({hasText:'自动联机测试'}).getByRole('button',{name:'开始玩'}).click();await a.locator('#create-room').click();await expect(a.locator('#room-active')).toBeVisible();
  await b.goto('/?room='+await a.locator('#active-code').textContent());await expect(b.locator('#game-name')).toHaveText('自动联机测试');await expect(a.locator('#start-room')).toBeEnabled();expect(downloads.length).toBeGreaterThan(0);
 }finally{await a.close();await b.close();await rm(file,{force:true});}
});
test('light theme persists and covers desktop, dialogs and mobile',async({page})=>{
 await page.goto('/');await page.locator('#theme-toggle').click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.screenshot({path:'test-results/light-theme.png',fullPage:true});
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.locator('#open-library').click();await page.screenshot({path:'test-results/light-library.png'});await page.locator('#library-dialog [data-close]').click();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await page.locator('#demo').click();await expect(page.locator('#touch-controls')).toBeVisible();await page.screenshot({path:'test-results/light-mobile.png',fullPage:true});
 await page.locator('#theme-toggle').click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});

test('outdated room backend gives an explicit deployment error instead of a waiting P2',async({page})=>{
 await page.routeWebSocket('**/netplay',ws=>ws.onMessage(data=>{if(JSON.parse(String(data)).type==='hello')ws.send(JSON.stringify({type:'hello',protocol:'old-server'}));}));
 await page.goto('/');await page.locator('#create-room').click();await expect(page.locator('#toast')).toContainText('网页与房间服务版本不一致');await expect(page.locator('#room-active')).toBeHidden();
});
test('legacy room backend without a handshake tells the owner to restart Node',async({page})=>{
 await page.routeWebSocket('**/netplay',()=>{});await page.goto('/');await page.locator('#create-room').click();await expect(page.locator('#toast')).toContainText('房间服务版本过旧',{timeout:12000});await expect(page.locator('#room-active')).toBeHidden();
});
test('manual room-code join also automatically receives the host cartridge',async({browser})=>{
 const {readFile}=await import('node:fs/promises');const a=await browser.newPage(),b=await browser.newPage();
 try{await a.goto('/');await a.locator('#rom-file').setInputFiles({name:'自动同步测试.nes',mimeType:'application/octet-stream',buffer:await readFile('public/demo.nes')});await a.locator('#create-room').click();await expect(a.locator('#room-active')).toBeVisible();await b.goto('/');await b.locator('#room-code').fill(await a.locator('#active-code').textContent());await b.locator('#join-form button').click();await expect(b.locator('#game-name')).toHaveText('自动同步测试.nes');await expect(a.locator('#start-room')).toBeEnabled();}finally{await a.close();await b.close();}
});

test('old JSNES saves resume with the legacy core and synchronize that core to P2',async({browser})=>{
 const {readFile}=await import('node:fs/promises');const {CompatibleNES}=await import('../../src/nes-core.js');const {snapshot}=await import('../../src/save-store.js');const {createHash}=await import('node:crypto');
 const bytes=await readFile('public/demo.nes'),old=new CompatibleNES();old.loadROM(bytes);for(let i=0;i<120;i++){old.buttonDown(1,7);old.frame();}
 const save=snapshot(old,{name:'old demo',hash:createHash('sha256').update(bytes).digest('hex')});const a=await browser.newPage(),b=await browser.newPage();
 try{
  await a.goto('/');await a.locator('#demo').click();await expect(a.locator('#core-label')).toHaveText('FCEUmm');await expect(a.locator('#screen-empty')).toBeHidden();await a.locator('#open-saves').click();await a.locator('#save-file').setInputFiles({name:'legacy.pls',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});await expect(a.locator('#core-label')).toContainText('JSNES');
  await a.locator('#create-room').click();await expect(a.locator('#room-active')).toBeVisible();await b.goto('/?room='+await a.locator('#active-code').textContent());await expect(a.locator('#start-room')).toBeEnabled();await a.locator('#start-room').click();await expect(b.locator('#screen-status')).toHaveText('NETPLAY');await expect(b.locator('#core-label')).toContainText('JSNES');
 }finally{await a.close();await b.close();}
});

test('large nested library searches all games by name and folder, independent of pagination',async({page})=>{
 const {mkdir,writeFile,readFile,rm}=await import('node:fs/promises');const root='.data/browser-test-library/搜索测试';const folder=root+'/动作/汉化/经典';await mkdir(folder,{recursive:true});const rom=await readFile('public/demo.nes');const baseline=(await(await page.request.get('/api/library')).json()).games.length;
 try{
  await Promise.all(Array.from({length:65},(_,i)=>writeFile(`${folder}/Adventure-${String(i).padStart(2,'0')}.NES`,Buffer.concat([rom,Buffer.from([100,i])]))));
  await page.goto('/');await page.locator('#open-library').click();await expect(page.locator('#library-count')).toContainText(`共 ${baseline+65} 款`);await expect(page.locator('.library-entry')).toHaveCount(60);await expect(page.locator('#library-next')).toBeEnabled();
  const search=page.getByRole('searchbox',{name:'搜索游戏'});await search.fill('ADVENTURE-64');await expect(page.locator('.library-entry')).toHaveCount(1);await expect(page.locator('.library-entry')).toContainText('Adventure-64');await expect(page.locator('.library-entry')).toContainText('动作/汉化/经典');await expect(page.locator('#library-count')).toContainText('找到 1 款');await expect(page.locator('#library-next')).toBeDisabled();
  await search.fill('汉化 Adventure-63');await expect(page.locator('.library-entry')).toHaveCount(1);await expect(page.locator('.library-entry')).toContainText('Adventure-63');
  await search.fill('不存在的游戏');await expect(page.locator('.library-entry')).toHaveCount(0);await expect(page.locator('#library-list')).toContainText('没有找到');await page.locator('#clear-library-search').click();await expect(page.locator('.library-entry')).toHaveCount(60);await page.locator('#library-next').click();await expect(page.locator('.library-entry')).toHaveCount(baseline+5);await expect(page.locator('#library-next')).toBeDisabled();await page.locator('#library-first').click();await expect(page.locator('.library-entry')).toHaveCount(60);await page.locator('#library-page-size').selectOption('30');await expect(page.locator('.library-entry')).toHaveCount(30);await page.locator('#library-page').selectOption('2');await expect(page.locator('#library-page')).toHaveValue('2');await search.fill('Adventure-64');await expect(page.locator('#library-page')).toHaveValue('1');
  await page.setViewportSize({width:390,height:844});await page.locator('#theme-toggle').dispatchEvent('click');await search.fill('经典 adventure-64');await expect(page.locator('.library-entry')).toHaveCount(1);expect(await search.evaluate(e=>e.getBoundingClientRect().right)).toBeLessThanOrEqual(390);
  await page.locator('.library-entry').getByRole('button',{name:'开始玩'}).click();await expect(page.locator('#game-name')).toHaveText('Adventure-64');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('pagination stays bounded for over one thousand games and resets for search',async({page})=>{
 const games=Array.from({length:1205},(_,i)=>({id:i.toString(16).padStart(64,'0'),name:`分页测试-${String(i).padStart(4,'0')}`,folder:'分类/动作',size:32768}));
 await page.route('**/api/library',route=>route.fulfill({json:{games,defaultId:null}}));await page.goto('/');await page.locator('#open-library').click();await expect(page.locator('#library-count')).toContainText('1205');await expect(page.locator('.library-entry')).toHaveCount(60);await expect(page.locator('#library-prev')).toBeDisabled();
 await page.locator('#library-last').click();await expect(page.locator('#library-page')).toHaveValue('21');await expect(page.locator('.library-entry')).toHaveCount(5);await expect(page.locator('.library-entry').last()).toContainText('1204');await expect(page.locator('#library-next')).toBeDisabled();
 await page.locator('#library-prev').click();await expect(page.locator('#library-page')).toHaveValue('20');await expect(page.locator('.library-entry')).toHaveCount(60);await page.locator('#library-page-size').selectOption('100');await expect(page.locator('#library-page')).toHaveValue('1');await expect(page.locator('.library-entry')).toHaveCount(100);
 await page.locator('#library-last').click();await page.locator('#library-search').fill('分页测试-1204');await expect(page.locator('#library-page')).toHaveValue('1');await expect(page.locator('.library-entry')).toHaveCount(1);await expect(page.locator('#library-prev')).toBeDisabled();await expect(page.locator('#library-next')).toBeDisabled();
 await page.locator('#library-search').fill('不存在');await expect(page.locator('.library-entry')).toHaveCount(0);await expect(page.locator('#library-page')).toBeDisabled();await page.locator('#clear-library-search').click();await expect(page.locator('.library-entry')).toHaveCount(100);
 await page.setViewportSize({width:390,height:844});await expect(page.locator('#library-next')).toBeVisible();expect(await page.locator('#library-pagination').evaluate(e=>e.getBoundingClientRect().right)).toBeLessThanOrEqual(390);await page.screenshot({path:'test-results/library-pagination-mobile.png'});
});
