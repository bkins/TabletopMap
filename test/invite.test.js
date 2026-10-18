import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {start} from '../server.js';

test('QR invitations are DM-only, temporary and revoked with their character or Wi-Fi',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tabletop-invite-')),server=await start({port:0,dir}),url=`http://127.0.0.1:${server.address().port}`;
  const state=()=>fetch(url+'/api/state').then(r=>r.json()),snapshot=()=>fetch(url+'/api/player').then(r=>r.json());
  const post=(route,data)=>fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const action=async a=>{const s=await state();const r=await post('/api/action',{...a,revision:s.revision});assert.equal(r.status,200,await r.text());};
  try{
    await fetch(url+'/api/import',{method:'POST',headers:{'x-map-meta':encodeURIComponent(JSON.stringify({name:'Invite',width:1000,height:1000}))},body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=','base64')});
    await action({type:'token-add',token:{name:'Ranger',color:'#228866',radius:2,x:200,y:200}});
    let s=await state();const token=s.maps[s.active].characters.tokens[0],request={mapId:s.active,tokenId:token.id,base:s.networkUrls[0]};
    assert.equal((await post('/api/invite',request)).status,400);
    await action({type:'network',enabled:true});await action({type:'characters',enabled:true,keepExplored:true});
    if(!request.base)return;
    await action({type:'blank',value:false});
    assert.equal((await post('/api/invite',{...request,base:'http://example.com'})).status,400);
    assert.equal((await fetch(request.base+'/api/invite',{method:'POST',body:JSON.stringify(request)})).status,403);
    const before=await state();assert.equal((await post('/api/invite',request)).status,200);
    let card=(await snapshot()).invite;assert.equal(card.name,'Ranger');assert.match(card.svg,/<svg/);assert.ok(card.expires>Date.now());assert.deepEqual(await state(),before);
    assert.equal((await fetch(url+'/api/backup').then(r=>r.json())).state.invite,undefined);
    const realNow=Date.now;try{const expired=card.expires+1;Date.now=()=>expired;assert.equal((await snapshot()).invite,null);}finally{Date.now=realNow;}
    assert.equal((await snapshot()).invite,null);await post('/api/invite',request);
    await post('/api/invite',{clear:true});assert.equal((await snapshot()).invite,null);
    await post('/api/invite',request);await action({type:'token-update',id:token.id,token:{visible:false}});assert.equal((await snapshot()).invite,null);
    assert.equal((await post('/api/invite',request)).status,400);await action({type:'token-update',id:token.id,token:{visible:true}});assert.equal((await snapshot()).invite,null);
    await post('/api/invite',request);await action({type:'blank',value:true});assert.equal((await snapshot()).invite,null);
    assert.equal((await post('/api/invite',request)).status,400);await action({type:'blank',value:false});
    await post('/api/invite',request);await action({type:'network',enabled:false});assert.equal((await snapshot()).invite,null);
    await action({type:'network',enabled:true});assert.equal((await snapshot()).invite,null);
    await post('/api/invite',request);await action({type:'token-delete',id:token.id});assert.equal((await snapshot()).invite,null);assert.equal((await post('/api/invite',request)).status,400);
  }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});

test('all-player invitations exclude encounters and permanently revoke hidden cards',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tabletop-group-invite-')),server=await start({port:0,dir}),url=`http://127.0.0.1:${server.address().port}`;
  const get=route=>fetch(url+route).then(r=>r.json());
  const post=(route,data)=>fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const action=async data=>{const s=await get('/api/state');const r=await post('/api/action',{...data,revision:s.revision});assert.equal(r.status,200,await r.text());};
  try{
    await fetch(url+'/api/import',{method:'POST',headers:{'x-map-meta':encodeURIComponent(JSON.stringify({name:'Group',width:1000,height:1000}))},body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=','base64')});
    for(const [name,kind] of [['Ranger','player'],['Wizard','player'],['Goblin','monster']])await action({type:'token-add',token:{name,kind,color:'#228866',radius:kind==='player'?2:0,x:200,y:200}});
    await action({type:'network',enabled:true});await action({type:'characters',enabled:true,keepExplored:true});await action({type:'blank',value:false});
    const s=await get('/api/state'),tokens=s.maps[s.active].characters.tokens,request={all:true,mapId:s.active,base:s.networkUrls[0],layout:'sides'};
    if(!request.base)return;
    assert.equal((await post('/api/invite',{...request,layout:'bad'})).status,400);
    assert.equal((await post('/api/invite',request)).status,200);
    let invite=(await get('/api/player')).invite;assert.equal(invite.layout,'sides');assert.deepEqual(invite.cards.map(c=>c.name),['Ranger','Wizard']);
    assert.equal(invite.cards[0].tokenId,undefined);assert.equal(invite.cards[0].key,undefined);assert.notEqual(invite.cards[0].svg,invite.cards[1].svg);
    await action({type:'token-update',id:tokens[0].id,token:{visible:false}});
    assert.deepEqual((await get('/api/player')).invite.cards.map(c=>c.name),['Wizard']);
    await action({type:'token-update',id:tokens[0].id,token:{visible:true}});
    assert.deepEqual((await get('/api/player')).invite.cards.map(c=>c.name),['Wizard']);
    await action({type:'token-update',id:tokens[1].id,token:{name:'Mage'}});assert.equal((await get('/api/player')).invite.cards[0].name,'Mage');
    await action({type:'token-delete',id:tokens[1].id});assert.equal((await get('/api/player')).invite,null);
    await post('/api/invite',request);await action({type:'characters',enabled:false,keepExplored:true});assert.equal((await get('/api/player')).invite,null);
  }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
