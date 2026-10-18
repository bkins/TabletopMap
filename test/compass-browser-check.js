import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {start} from '../server.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tabletop-compass-'));let server=await start({port:0,dir});
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})}),errors=[];
try{
 const dm=await browser.newPage({viewport:{width:1400,height:1000}}),table=await browser.newPage({viewport:{width:800,height:600}});
 for(const p of [dm,table])p.on('pageerror',e=>errors.push(e.message));await dm.goto(base);await table.goto(base+'/table');await table.locator('#start').evaluate(e=>e.remove());await table.locator('#soundToggle').evaluate(e=>e.remove());
 const png=await dm.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=600;const x=c.getContext('2d');x.fillStyle='#334466';x.fillRect(0,0,800,600);return c.toDataURL().split(',')[1];});
 await dm.locator('#import').setInputFiles({name:'compass-test.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await dm.waitForFunction(()=>document.querySelector('#compassEnabled').disabled===false);
 const saved=()=>fetch(base+'/api/state').then(r=>r.json());
 const initial=await saved(),id=initial.active,geometry=initial.maps[id].view;
 await dm.locator('#compassEnabled').check();await dm.waitForFunction(()=>document.querySelector('#saveStatus').textContent.startsWith('Saved locally'));
 await dm.locator('#compassRotation').fill('90');await dm.locator('#applyCompass').click();await dm.waitForFunction(()=>document.querySelector('#compassRotation').value==='90'&&document.querySelector('#saveStatus').textContent.startsWith('Saved locally'));
 assert.deepEqual((await saved()).maps[id].view,geometry);
 await dm.locator('#blank').click();await table.waitForFunction(()=>window.__tableDebug().ready&&!window.__tableDebug().blank);
 const pixel=(page,x,y)=>page.evaluate(({x,y})=>Array.from(document.querySelector('canvas').getContext('2d').getImageData(x,y,1,1).data),{x,y});
 // 90 degrees puts the gold north arrow on the right; it remains visible over covered fog.
 assert.deepEqual(await pixel(table,742,78),[255,199,115,255]);assert.deepEqual(await pixel(table,400,300),[0,0,0,255]);
 const preview=dm.frames().find(f=>f.url().includes('/table?preview'));await preview.waitForFunction(()=>window.__tableDebug().ready&&!window.__tableDebug().blank);
 assert.deepEqual(await preview.evaluate(()=>fetch('/api/player').then(r=>r.json()).then(s=>s.map.compass)),{enabled:true,rotation:90});
 await dm.locator('#compassRight').click();await dm.waitForFunction(()=>document.querySelector('#compassRotation').value==='105');
 await dm.locator('#compassLeft').click();await dm.waitForFunction(()=>document.querySelector('#compassRotation').value==='90');
 // Table rotation contributes to direction, while DM source orientation stays unchanged.
 await dm.evaluate(async()=>{const s=await fetch('/api/state').then(r=>r.json());for(const a of [{type:'lock',value:false},{type:'view',view:{rotation:90}},{type:'lock',value:true}]){const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...a,revision:(await fetch('/api/state').then(r=>r.json())).revision})});if(!r.ok)throw Error(await r.text());}});
 await table.waitForFunction(()=>window.__tableDebug().ready);await table.waitForFunction(()=>Array.from(document.querySelector('canvas').getContext('2d').getImageData(722,98,1,1).data).join() === '255,199,115,255');
 await table.screenshot({path:'test-results/compass-table.png'});await dm.screenshot({path:'test-results/compass-dm.png',fullPage:true});
 await dm.locator('#blank').click();await table.waitForFunction(()=>window.__tableDebug().blank);assert.deepEqual(await pixel(table,722,98),[0,0,0,255]);
 const before=await saved();const backup=await fetch(base+'/api/backup').then(r=>r.json());assert.ok(JSON.stringify(backup).includes('"compass":{"enabled":true,"rotation":90}'));
 // Close connections, restart with the same saved session, and verify persistence.
 await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));server=await start({port:0,dir});const restored=await fetch(`http://127.0.0.1:${server.address().port}/api/state`).then(r=>r.json());assert.deepEqual(restored.maps[id].compass,before.maps[id].compass);assert.deepEqual(errors,[]);
 console.log('PASS: DM controls, locked geometry, table/preview overlay, north direction, map rotation, blanking, backup and restart');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
