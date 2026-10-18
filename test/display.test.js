import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import geometry from '../desktop/geometry.cjs';
import {DisplayManager} from '../display-manager.js';
import {start} from '../server.js';
const screens=[{id:'dm',primary:true,scaleFactor:1.25,bounds:{x:0,y:0,width:1536,height:864}},{id:'top',primary:false,scaleFactor:1,rotation:180,bounds:{x:0,y:-2160,width:1920,height:1080}},{id:'bottom',primary:false,scaleFactor:1,bounds:{x:0,y:-1080,width:1920,height:1080}}];
test('two player monitors form a single borderless rectangle without the main DM screen',()=>{
 assert.deepEqual(geometry.combinedBounds(screens,['top','bottom']),{x:0,y:-2160,width:1920,height:2160});
 assert.deepEqual(geometry.combinedBounds(screens,['bottom','top']),{x:0,y:-2160,width:1920,height:2160});
 const horizontal=structuredClone(screens);horizontal[1].bounds={x:-3840,y:0,width:1920,height:1080};horizontal[2].bounds={x:-1920,y:0,width:1920,height:1080};
 assert.deepEqual(geometry.combinedBounds(horizontal,['top','bottom']),{x:-3840,y:0,width:3840,height:1080});
});
test('screen selection rejects DM, duplicate, missing, gapped and mixed-scale displays',()=>{
 for(const ids of [['dm','top'],['top','top'],['top','missing'],['top']])assert.throws(()=>geometry.combinedBounds(screens,ids));
 const mixed=structuredClone(screens);mixed[2].scaleFactor=1.25;assert.throws(()=>geometry.combinedBounds(mixed,['top','bottom']),/same Windows display scaling/);
 const gap=structuredClone(screens);gap[2].bounds.y=-1000;assert.throws(()=>geometry.combinedBounds(gap,['top','bottom']),/edge to edge/);
});
test('browser display requires neither a Windows runtime nor a started helper',async()=>{
 const manager=new DisplayManager({platform:'linux'});assert.equal(manager.status().supported,false);
 assert.equal((await manager.command('close')).running,false);assert.equal(manager.child,null);
 await assert.rejects(manager.command('discover',{origin:'http://127.0.0.1:5180'}),/available on Windows/);
 const missing=new DisplayManager();missing.executable=()=>null;assert.equal(missing.status().installed,false);assert.equal((await missing.command('close')).running,false);
 if(process.platform==='win32')await assert.rejects(missing.command('discover'),/not installed/);
});
test('display control is local only, transient, and native viewport takes priority only while open',async()=>{
 let stopped=false,calls=[];const current={running:false,supported:true,installed:true,displays:screens};
 const manager={status:()=>({...current}),command:async(command,args)=>{calls.push({command,args});current.running=command==='open';return {...current};},stop:()=>{stopped=true;}};
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tabletop-display-')),server=await start({port:0,dir,displayManager:manager}),url=`http://127.0.0.1:${server.address().port}`;
 const post=(route,data,headers={})=>fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
 try{
  const before=await fetch(url+'/api/backup').then(r=>r.json());
  assert.equal((await fetch(url+'/api/display').then(r=>r.json())).running,false);assert.equal(calls.length,0);
  assert.equal((await post('/api/display',{command:'inspect'})).status,400);
  assert.equal((await post('/api/display',{command:'open'},{Origin:'http://malicious.example'})).status,403);
  assert.equal((await post('/api/display',{command:'open',ids:['top','bottom']})).status,200);
  assert.equal(calls[0].args.origin,url);assert.deepEqual(calls[0].args.ids,['top','bottom']);
  await post('/api/heartbeat',{id:'browser',width:1852,height:1968});await post('/api/heartbeat',{id:'desktop',width:1920,height:2160,mode:'windows'});
  let state=await fetch(url+'/api/state').then(r=>r.json());assert.equal(state.tableScreens[0].width,1920);
  await post('/api/display',{command:'close'});state=await fetch(url+'/api/state').then(r=>r.json());assert.equal(state.tableScreens[0].width,1852);
  assert.deepEqual(await fetch(url+'/api/backup').then(r=>r.json()),before);
  const ip=Object.values(os.networkInterfaces()).flat().find(i=>i.family==='IPv4'&&!i.internal)?.address;
  if(ip){await post('/api/action',{type:'network',enabled:true,revision:0});const lan=`http://${ip}:${server.address().port}`;for(const method of ['GET','POST'])assert.equal((await fetch(lan+'/api/display',{method,...(method==='POST'?{body:JSON.stringify({command:'open'})}:{})})).status,403);}
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
 assert.equal(stopped,true);
});
