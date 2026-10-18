import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {start} from '../server.js';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tabletop-save-browser-'));
const server=await start({port:0,dir}),url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
let release;
try{
  const dm=await browser.newPage(),errors=[];
  dm.on('pageerror',e=>errors.push(e.message));
  await dm.goto(url);
  const png=await dm.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=300;return c.toDataURL().split(',')[1];});
  await dm.locator('#import').setInputFiles({name:'save-test.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await dm.waitForFunction(()=>document.querySelector('#mapTitle').textContent==='save-test.png');
  await dm.locator('#newTokenName').fill('Phone test');
  await dm.locator('#newTokenName').blur();
  let started;
  const pending=new Promise(resolve=>started=resolve),gate=new Promise(resolve=>release=resolve);
  await dm.route('**/api/action',async route=>{
    if(route.request().postDataJSON().type==='screen'){
      const response=await route.fetch();started();await gate;await route.fulfill({response});
    }else await route.continue();
  });
  await fetch(url+'/api/heartbeat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'save-test',width:777,height:555})});
  // Keep the synthetic table connected while its save is delayed.
  const heartbeat=setInterval(()=>fetch(url+'/api/heartbeat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'save-test',width:777,height:555})}).catch(()=>{}),1000);
  try{
    await Promise.race([pending,new Promise((_,reject)=>setTimeout(()=>reject(Error('Display save did not start')),10000))]);
    await dm.locator('#addToken').click();
    await dm.waitForTimeout(150);
    assert.equal(await dm.locator('#error').isVisible(),false,'Add token must wait for the display save without showing an error');
    release();
    await dm.waitForFunction(()=>document.querySelector('#tokenName').value==='Phone test');
    const s=await fetch(url+'/api/state').then(r=>r.json()),m=s.maps[s.active];
    assert.equal(m.characters.tokens.length,1);
    assert.equal(m.characters.tokens[0].name,'Phone test');
    assert.equal(m.view.screenWidth,777);
    assert.equal(m.view.screenHeight,555);
    assert.deepEqual(errors,[]);
    console.log('PASS: Add token waits for the display-size save and creates exactly one token');
  }finally{clearInterval(heartbeat);}
}finally{release?.();await browser.close();await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
