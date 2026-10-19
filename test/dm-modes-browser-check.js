// Isolated browser acceptance: never uses the live campaign or port 5180.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {start} from '../server.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tabletop-dm-modes-'));
const server=await start({port:0,dir}),base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const errors=[];
try {
 const dm=await browser.newPage({viewport:{width:1440,height:1000}}),table=await browser.newPage({viewport:{width:800,height:600}});
 for(const page of [dm,table])page.on('pageerror',e=>errors.push(e.message));
 await dm.goto(base);await table.goto(base+'/table');
 const png=await dm.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=600;const x=c.getContext('2d');x.fillStyle='#385346';x.fillRect(0,0,800,600);return c.toDataURL().split(',')[1];});
 await dm.locator('#import').setInputFiles({name:'mode-test.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await dm.waitForFunction(()=>document.querySelector('#mapTitle').textContent==='mode-test.png');
 const saved=()=>fetch(base+'/api/state').then(r=>r.json());
 const command=async a=>{let active;for(let attempt=0;attempt<3;attempt++){const s=await saved();active??=s.active;assert.equal(s.active,active,'Active DM map changed during test command');const r=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...a,revision:s.revision})});const message=await r.text();if(r.status===400&&message.includes('Session changed')&&attempt<2)continue;assert.equal(r.status,200,message);return;}};
 await command({type:'token-add',token:{name:'Ranger',kind:'player',color:'#6389df',radius:0,x:150,y:150}});
 await command({type:'operation',op:{type:'rectangle',reveal:true,points:[[0,0],[300,300]]}});
 await command({type:'blank',value:false});
 await command({type:'lock',value:false});
 await dm.waitForFunction(()=>document.querySelector('#tokenName').value==='Ranger');
 await dm.waitForFunction(()=>!document.querySelector('#inches').disabled);
 await dm.waitForFunction(()=>document.querySelector('#connection').textContent.includes('800'));
 // Wait for the existing viewport-save queue to settle before counting writes.
 await dm.waitForTimeout(1300);
 assert.equal(await dm.locator('#calibration').isVisible(),true);
 assert.equal(await dm.locator('#reveal').isVisible(),false);
 await dm.locator('#tokenName').fill('Ranger draft');
 await dm.locator('#inches').fill('1.5');
 const mapBox=await dm.locator('#dm').boundingBox();await dm.mouse.move(mapBox.x+mapBox.width/2,mapBox.y+mapBox.height/2);await dm.mouse.wheel(0,-140);
 const before=await saved(),playerBefore=await fetch(base+'/api/player').then(r=>r.json());
 const canvasBefore=await dm.locator('#dm').evaluate(c=>c.toDataURL());
 const framesBefore=dm.frames().map(f=>f.url());let modeWrites=0;
 const onRequest=r=>{if(r.method()==='POST')modeWrites++;};dm.on('request',onRequest);
 await dm.locator('#playTab').click();
 assert.equal(await dm.locator('#reveal').isVisible(),true);
 assert.equal(await dm.locator('#calibration').isVisible(),false);
 assert.equal(await dm.locator('#tokenVisible').isVisible(),true);
 assert.equal(await dm.locator('#placementSurface').isVisible(),false);
 await dm.waitForTimeout(1300);
 await dm.locator('#setupTab').click();
 assert.equal(await dm.locator('#tokenName').inputValue(),'Ranger draft');
 assert.equal(await dm.locator('#inches').inputValue(),'1.5');
 assert.equal(await dm.locator('#dm').evaluate(c=>c.toDataURL()),canvasBefore,'DM viewport preserved');
 assert.deepEqual(dm.frames().map(f=>f.url()),framesBefore,'iframes never recreated');
 const after=await saved(),playerAfter=await fetch(base+'/api/player').then(r=>r.json());
 assert.equal(after.revision,before.revision,'mode switches must not save campaign state');
 assert.deepEqual(after.maps,before.maps);assert.deepEqual(playerAfter.map,playerBefore.map);
 assert.equal(modeWrites,0);dm.off('request',onRequest);
 // A successful gameplay token edit uses the same object and setup draft.
 await dm.locator('#playTab').click();await dm.locator('#saveToken').click();
 await dm.waitForFunction(()=>document.querySelector('#saveStatus').textContent.startsWith('Saved locally'));
 assert.equal((await saved()).maps[before.active].characters.tokens[0].name,'Ranger draft');
 await dm.locator('#setupTab').click();assert.equal(await dm.locator('#inches').inputValue(),'1.5');
 // Delayed saves remain queued while the DM switches modes.
 await command({type:'lock',value:false});
 await dm.waitForFunction(()=>!document.querySelector('#applyView').disabled);
 await dm.locator('#x').fill('25');let release,started;
 const gate=new Promise(r=>release=r),pending=new Promise(r=>started=r);
 await dm.route('**/api/action',async route=>{if(route.request().postDataJSON().type==='view'){const response=await route.fetch();started();await gate;await route.fulfill({response});}else await route.continue();});
 await dm.locator('#applyView').click();await pending;await dm.locator('#playTab').click();release();
 await dm.waitForFunction(()=>document.querySelector('#saveStatus').textContent.startsWith('Saved locally'));
 await dm.unroute('**/api/action');await dm.locator('#setupTab').click();
 assert.equal(await dm.locator('#x').inputValue(),'25');assert.equal(await dm.locator('#inches').inputValue(),'1.5');
 // Failed configuration saves retain the draft for correction/retry.
 await dm.locator('#scale').fill('100');await dm.locator('#applyView').click();
 await dm.waitForFunction(()=>!document.querySelector('#error').hidden);
 await dm.locator('#playTab').click();await dm.locator('#setupTab').click();
 assert.equal(await dm.locator('#scale').inputValue(),'100');
 assert.notEqual((await saved()).maps[before.active].view.scale,100);
 await dm.locator('#scale').fill('1');await dm.locator('#applyView').click();
 await dm.waitForFunction(()=>document.querySelector('#saveStatus').textContent.startsWith('Saved locally'));
 // Keyboard tabs, small screen layout, and one shared map canvas.
 await dm.locator('#setupTab').focus();await dm.keyboard.press('ArrowRight');
 assert.equal(await dm.locator('#playTab').getAttribute('aria-selected'),'true');
 assert.equal(await dm.locator('#dm').count(),1);
 await fs.mkdir('test-results',{recursive:true});
 await dm.evaluate(()=>{document.querySelector('aside').scrollTop=0;document.querySelector('#error').hidden=true;});
 await dm.screenshot({path:'test-results/dm-modes-play.png',fullPage:true});
 await dm.locator('#setupTab').click();await dm.evaluate(()=>document.querySelector('aside').scrollTop=0);await dm.screenshot({path:'test-results/dm-modes-setup.png',fullPage:true});
 await dm.setViewportSize({width:390,height:844});
 assert.ok(await dm.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no mobile horizontal overflow');
 await dm.screenshot({path:'test-results/dm-modes-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: mode visibility, zero-write switching, draft retention, shared tokens, DM viewport/player continuity, pending/failed saves, keyboard tabs and mobile layout');
} finally {
 await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});
}
