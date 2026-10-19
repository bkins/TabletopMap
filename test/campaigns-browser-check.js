import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {start} from '../server.js';import {Store} from '../store.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tabletop-campaign-browser-'));
let server=await start({port:0,dir});let base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const errors=[];
try{
 const dm=await browser.newPage({viewport:{width:1500,height:1100}}),table=await browser.newPage({viewport:{width:800,height:600}});
 for(const p of [dm,table]){p.setDefaultTimeout(12000);p.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});}await dm.goto(base);await table.goto(base+'/table');console.log('Loaded DM/table');
 const saved=()=>fetch(base+'/api/state').then(r=>r.json()),player=()=>fetch(base+'/api/player').then(r=>r.json());
 const wait=async predicate=>{for(let i=0;i<120;i++){const s=await saved();if(predicate(s))return s;await new Promise(r=>setTimeout(r,50));}throw Error('State did not reach expected condition');};
 const confirm=async id=>{await dm.locator('#'+id).click();await dm.locator('#confirm button[value=ok]').click();};
 const upload=async(name,color)=>{await dm.locator('#setupTab').click();const png=await dm.evaluate(color=>{const c=document.createElement('canvas');c.width=800;c.height=600;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,800,600);return c.toDataURL().split(',')[1];},color);await dm.locator('#import').setInputFiles({name,mimeType:'image/png',buffer:Buffer.from(png,'base64')});await dm.waitForFunction(name=>document.querySelector('#mapTitle').textContent===name,name);};
 await upload('Village.png','#ff3300');console.log('Imported Village');let s=await saved();const village=s.active,rid=s.maps[village].resourceId,campaign=s.workspace.currentCampaign;
 await dm.locator('#playTab').click();await confirm('allReveal');await dm.locator('#publishMap').click();
 await wait(s=>!s.blank&&s.published===village);await table.waitForFunction(()=>window.__tableDebug?.().ready&&!window.__tableDebug().blank);
 console.log('Published Village');await upload('Castle.png','#3366ff');console.log('Imported Castle privately');s=await saved();const castle=s.active;assert.notEqual(castle,village);assert.equal(s.published,village);assert.equal(s.blank,false);
 assert.equal((await player()).map.id,village);
 await dm.locator('#playTab').click();await confirm('allReveal');assert.equal((await player()).map.id,village);assert.equal((await player()).map.ops.length,1);
 await dm.locator('#publishMap').click();await wait(s=>s.published===castle&&!s.blank);const published=await player();await table.waitForFunction(rev=>window.__tableDebug?.().revision>=rev&&window.__tableDebug().ready,published.revision);assert.deepEqual(await table.evaluate(()=>Array.from(document.querySelector('canvas').getContext('2d').getImageData(100,100,1,1).data).slice(0,3)),[51,102,255]);
 console.log('Published Castle');
 // Group organization and quick navigation privately select maps without publishing.
 await dm.locator('#setupTab').click();await dm.locator('#groupName').fill('Old House');await dm.locator('#createGroup').click();
 await wait(s=>Object.keys(s.workspace.groups).length===1);await dm.locator('#addGroupMap').click();await wait(s=>Object.values(s.workspace.groups)[0].resourceIds.length===1);
 await dm.locator('#maps').selectOption(village);await wait(s=>s.active===village);await dm.locator('#addGroupMap').click();s=await wait(s=>Object.values(s.workspace.groups)[0].resourceIds.length===2);
 const group=Object.keys(s.workspace.groups)[0];await dm.locator('#navigationGroup').selectOption(group);assert.equal(await dm.locator('#navigateMap option').count(),2);
 await dm.locator('#navigateMap').selectOption(castle);await wait(s=>s.active===castle);assert.equal((await player()).map.id,castle);
 await dm.locator('#navigateMap').selectOption(village);await wait(s=>s.active===village);assert.equal((await player()).map.id,castle);
 console.log('Group navigation passed');
 // A named NPC moves as one identity; templates create independent instances.
 await dm.locator('#newTokenKind').selectOption('npc');await dm.locator('#newTokenName').fill('Borin');await dm.locator('#addToken').click();s=await wait(s=>s.maps[village].characters.tokens.length===1);const borin=s.maps[village].characters.tokens[0].id;
 await dm.locator('details').filter({has:dm.locator('#registerNPC')}).locator('summary').click();await dm.locator('#registerNPC').click();s=await wait(s=>Object.keys(s.workspace.actors).length===1);const actor=Object.keys(s.workspace.actors)[0];
 await dm.locator('#saveTemplate').click();await wait(s=>Object.keys(s.workspace.templates).length===1);
 await dm.locator('#maps').selectOption(castle);await wait(s=>s.active===castle);await confirm('moveNPC');s=await wait(s=>s.workspace.actors[actor].mapId===castle);
 assert.equal(s.maps[village].characters.tokens.length,0);assert.equal(s.maps[castle].characters.tokens[0].id,borin);
 await dm.locator('#spawnTemplate').click();await wait(s=>s.maps[castle].characters.tokens.length===2);await dm.locator('#spawnTemplate').click();s=await wait(s=>s.maps[castle].characters.tokens.length===3);assert.equal(new Set(s.maps[castle].characters.tokens.map(t=>t.id)).size,3);
 console.log('NPC and templates passed');
 // Sessions resume continuing progress, not fresh copies.
 await dm.locator('#sessionName').fill('Second evening');await dm.locator('#createSession').click();s=await wait(s=>Object.keys(s.workspace.campaigns[campaign].sessions).length===2);assert.equal(s.maps[castle].characters.tokens.length,3);
 // A different campaign reuses preparation defaults but gets independent progress.
 await dm.locator('#campaignName').fill('Other party');await confirm('createCampaign');s=await wait(s=>s.workspace.currentCampaign!==campaign);const other=s.workspace.currentCampaign;assert.equal(s.published,null);assert.equal(s.blank,true);assert.equal(s.networkEnabled,false);
 await dm.locator('details').filter({has:dm.locator('#mapResources')}).locator('summary').click();await dm.locator('#mapResources').selectOption(rid);await dm.locator('#resumeResource').click();s=await wait(s=>s.active!==null);const independent=s.active;assert.notEqual(independent,village);assert.equal(s.maps[independent].cursor,0);assert.equal(s.maps[independent].characters.tokens.length,0);
 await dm.locator('#campaigns').selectOption(campaign);await dm.locator('#confirm button[value=ok]').click();s=await wait(s=>s.workspace.currentCampaign===campaign);assert.equal(s.maps[castle].characters.tokens.length,3);assert.equal(s.published,null);
 // Full backup/restore and restart retain all campaigns, shared resources and NPC IDs.
 const backup=await fetch(base+'/api/backup').then(r=>r.json());assert.ok(backup.state.workspace.campaigns[other]);
 const restoredDir=path.join(dir,'restored-check');await fs.mkdir(restoredDir);for(const [asset,encoded] of Object.entries(backup.assets))await fs.writeFile(path.join(restoredDir,asset),Buffer.from(encoded,'base64'));await fs.writeFile(path.join(restoredDir,'session.json'),JSON.stringify(backup.state));
 const restored=new Store(restoredDir);await restored.open();assert.deepEqual(restored.state,backup.state);
 await fs.mkdir('test-results',{recursive:true});await dm.evaluate(()=>document.querySelector('aside').scrollTop=0);await dm.screenshot({path:'test-results/campaigns-setup.png',fullPage:true});await dm.locator('#playTab').click();await dm.screenshot({path:'test-results/campaigns-play.png',fullPage:true});
 await dm.setViewportSize({width:390,height:844});assert.ok(await dm.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await dm.screenshot({path:'test-results/campaigns-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));server=await start({port:0,dir});base=`http://127.0.0.1:${server.address().port}`;s=await saved();assert.equal(s.workspace.actors[actor].mapId,castle);assert.equal(s.maps[castle].characters.tokens.length,3);assert.ok(s.workspace.campaigns[other]);
 console.log('PASS: complete campaign/session, private map publication, reusable resources, NPC/template, group/navigation, backup/restore/restart and responsive UI workflow');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
