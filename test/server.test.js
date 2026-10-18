import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {start} from '../server.js';import {Store} from '../store.js';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {fileURLToPath} from 'node:url';
test('import, persisted fog history, stale-write protection, backups and restart',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tabletop-test-'));let server=await start({port:0,dir});let base=`http://127.0.0.1:${server.address().port}`;
 const get=async()=>fetch(base+'/api/state').then(r=>r.json());const post=async a=>{const s=await get();return fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:s.revision,...a})});};
 try{
 const imported=await fetch(base+'/api/import',{method:'POST',headers:{'x-map-meta':encodeURIComponent(JSON.stringify({name:'Dungeon',width:100,height:100}))},body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=','base64')});assert.equal(imported.status,200);
 let s=await get();assert.equal(s.blank,true);assert.equal(s.maps[s.active].cursor,0);assert.equal((await post({type:'view',view:{x:4}})).status,400);
 assert.equal((await post({type:'operation',op:{type:'rectangle',reveal:true,points:[[2,2],[10,10]]}})).status,200);
 assert.equal((await post({type:'blank',value:false})).status,200);assert.equal((await post({type:'undo'})).status,200);assert.equal((await post({type:'redo'})).status,200);
 assert.equal((await post({type:'operation',op:{type:'all',reveal:true},revision:0})).status,400);
 assert.equal((await post({type:'lock',value:false})).status,200);assert.equal((await post({type:'grid',grid:{pixels:30,x:2,y:4,overlay:true}})).status,200);assert.equal((await post({type:'view',view:{x:12,y:7,scale:1.2,rotation:90,ppi:110,squareInches:1}})).status,200);assert.equal((await post({type:'lock',value:true})).status,200);
 assert.equal((await fetch(base+'/api/action',{method:'POST',headers:{Origin:'https://unrelated.example'},body:'{}'})).status,403);
 const backup=await fetch(base+'/api/backup').then(r=>r.json());assert.equal(Object.keys(backup.assets).length,1);
 await fs.writeFile(path.join(dir,'export.json'),JSON.stringify(backup));await promisify(execFile)(process.execPath,[fileURLToPath(new URL('../restore-backup.js',import.meta.url)),path.join(dir,'export.json')],{cwd:dir});const restored=(await fs.readdir(dir)).find(f=>f.startsWith('restored-'));const recovered=new Store(path.join(dir,restored));await recovered.open();assert.deepEqual(recovered.state,backup.state);assert.ok(await fs.stat(path.join(dir,restored,Object.keys(backup.assets)[0])));
 const saved=await get();await new Promise(r=>server.close(r));server=await start({port:0,dir});base=`http://127.0.0.1:${server.address().port}`;s=await get();assert.equal(s.revision,saved.revision);assert.deepEqual(s.maps,saved.maps);assert.equal(s.blank,false);assert.ok(await fs.stat(path.join(dir,'session.json.bak')));
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
test('corrupt save is rejected instead of resetting progress',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tabletop-corrupt-'));try{await fs.writeFile(path.join(dir,'session.json'),'broken');await assert.rejects(new Store(dir).open(),/cannot be read/);}finally{await fs.rm(dir,{recursive:true,force:true});}});
test('missing live save with recovery data does not create a blank replacement',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tabletop-missing-'));try{await fs.writeFile(path.join(dir,'session.json.bak'),'{}');await assert.rejects(new Store(dir).open(),/missing/);}finally{await fs.rm(dir,{recursive:true,force:true});}});
test('failed disk save does not advance authoritative state',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tabletop-failed-'));try{const s=new Store(dir);await s.open();await fs.mkdir(s.file+'.tmp');await assert.rejects(s.save({...s.state,revision:1}));assert.equal(s.state.revision,0);}finally{await fs.rm(dir,{recursive:true,force:true});}});
test('emergency blank publishes while an earlier write is delayed',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tabletop-panic-'));const original=Store.prototype.save;let release;let entered;const waiting=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 const server=await start({port:0,dir}),base=`http://127.0.0.1:${server.address().port}`;
 try{
   let s=await fetch(base+'/api/state').then(r=>r.json());await fetch(base+'/api/action',{method:'POST',body:JSON.stringify({type:'blank',value:false,revision:s.revision})});s=await fetch(base+'/api/state').then(r=>r.json());
   let first=true;Store.prototype.save=async function(next){if(first){first=false;entered();await gate;}return original.call(this,next);};
   const pending=fetch(base+'/api/action',{method:'POST',body:JSON.stringify({type:'blank',value:false,revision:s.revision})});await waiting;
   const panicRequest=fetch(base+'/api/action',{method:'POST',body:JSON.stringify({type:'blank',value:true})});
   let blank=false;for(let i=0;i<20&&!blank;i++){blank=(await fetch(base+'/api/player').then(r=>r.json())).blank;if(!blank)await new Promise(r=>setTimeout(r,10));}assert.equal(blank,true);release();assert.equal((await pending).status,200);assert.equal((await panicRequest).status,200);
 }finally{release();Store.prototype.save=original;await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
