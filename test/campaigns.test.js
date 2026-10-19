import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults,mutate,validateSession,playerState} from '../model.js';
import {registerImport} from '../campaigns.js';
import {controllerState,moveCharacter} from '../characters.js';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {Store} from '../store.js';
const key='a'.repeat(48);
function fixture(){const s=defaults();const m={id:'a',name:'Village',asset:'a.png',width:1000,height:1000,ops:[],cursor:0,grid:{pixels:50,x:0,y:0,overlay:true},view:{x:0,y:0,scale:1,rotation:0,ppi:96,squareInches:1,locked:true,screenWidth:800,screenHeight:600}};s.maps.a=m;s.active='a';return validateSession(s);}
const selected=s=>s.maps[s.workspace.selected];
const act=(s,a)=>validateSession(mutate(s,a));
test('legacy migration retains maps, published map, tokens and fog with a stable workspace',()=>{
 const s=fixture(),again=validateSession(structuredClone(s));assert.deepEqual(again,s);
 assert.equal(s.workspace.selected,'a');assert.equal(s.active,'a');assert.equal(selected(s).name,'Village');
 const broken=structuredClone(s);broken.workspace.version=99;assert.throws(()=>validateSession(broken),/workspace/);
});
test('prepared selection, imports and edits never replace the player map before explicit publication',()=>{
 let s=fixture();s=act(s,{type:'blank',value:false});const original=playerState(s).map;
 registerImport(s,{...structuredClone(s.maps.a),id:'b',name:'Castle'});
 assert.equal(s.active,'a');assert.equal(s.blank,false);assert.equal(s.workspace.selected,'b');
 s=act(s,{type:'operation',op:{type:'all',reveal:true}});assert.equal(s.maps.a.cursor,0);assert.equal(s.maps.b.cursor,1);assert.deepEqual(playerState(s).map,original);
 s=act(s,{type:'publish'});assert.equal(playerState(s).map.id,'b');assert.equal(s.blank,false);
 s=act(s,{type:'select',id:'a'});assert.equal(playerState(s).map.id,'b');assert.equal(s.blank,false);
});
test('new sessions reference continuing map progress; resuming an older session never resets it',()=>{
 let s=act(fixture(),{type:'operation',op:{type:'all',reveal:true}});const old=s.workspace.campaigns['campaign-main'].activeSession;
 s=act(s,{type:'session-create',name:'Session 2'});assert.equal(selected(s).cursor,1);assert.deepEqual(s.workspace.campaigns['campaign-main'].sessions[s.workspace.campaigns['campaign-main'].activeSession].mapIds,['a']);
 s=act(s,{type:'operation',op:{type:'all',reveal:false}});s=act(s,{type:'session-select',id:old});assert.equal(selected(s).cursor,2);
});
test('an empty privately selected session never redirects map edits to the published map',()=>{
 let s=fixture();const c=s.workspace.campaigns['campaign-main'];c.sessions.empty={id:'empty',name:'Empty preparation',mapIds:[]};
 s=act(s,{type:'session-select',id:'empty'});assert.equal(s.workspace.selected,null);assert.equal(s.active,'a');
 assert.throws(()=>mutate(s,{type:'operation',op:{type:'all',reveal:true}}),/Import a map/);assert.equal(s.maps.a.cursor,0);
 assert.throws(()=>mutate(s,{type:'publish'}),/Choose a prepared map/);
});
test('a reused map starts independent progress in another campaign; switching campaigns blanks and disables Wi-Fi',()=>{
 let s=act(fixture(),{type:'operation',op:{type:'all',reveal:true}}),resource=s.maps.a.resourceId;
 s=act(s,{type:'network',enabled:true});s=act(s,{type:'campaign-create',name:'Other party'});assert.equal(s.active,null);assert.equal(s.blank,true);assert.equal(s.networkEnabled,false);
 s=act(s,{type:'resource-use',id:resource});const independent=selected(s);assert.notEqual(independent.id,'a');assert.equal(independent.cursor,0);assert.equal(s.maps.a.cursor,1);assert.equal(independent.characters.tokens.length,0);
 s=act(s,{type:'session-create',name:'Continue'});s=act(s,{type:'resource-use',id:resource});assert.equal(selected(s).id,independent.id);
 s=act(s,{type:'campaign-select',id:'campaign-main'});assert.equal(selected(s).id,'a');assert.equal(selected(s).cursor,1);assert.equal(s.active,null);
 assert.throws(()=>act(s,{type:'select',id:independent.id}),/not in this session/);
});
test('resource defaults are explicit preparation snapshots; updates never reset existing progress',()=>{
 let s=fixture(),rid=s.maps.a.resourceId;s=act(s,{type:'lock',value:false});s=act(s,{type:'grid',grid:{pixels:40,x:0,y:0,overlay:true}});
 assert.equal(s.workspace.resources[rid].grid.pixels,50);
 s=act(s,{type:'resource-save',name:'Village library'});assert.equal(s.workspace.resources[rid].grid.pixels,40);
 s=act(s,{type:'resource-use',id:rid,fresh:true});assert.equal(selected(s).grid.pixels,40);assert.equal(selected(s).cursor,0);assert.notEqual(selected(s).id,'a');assert.equal(s.maps.a.grid.pixels,40);
});
test('persistent named NPC moves between maps with identity and artwork, while templates spawn independent tokens',()=>{
 let s=act(fixture(),{type:'token-add',token:{id:'abc',key,name:'Borin',kind:'npc',color:'#44ad8a',radius:0,visible:false,x:150,y:150}});
 s=act(s,{type:'actor-register',tokenId:'abc'});const actorId=s.maps.a.characters.tokens[0].actorId;
 s=act(s,{type:'template-save',tokenId:'abc',name:'Blacksmith'});const templateId=Object.keys(s.workspace.templates)[0];
 registerImport(s,{...structuredClone(s.maps.a),id:'b',name:'Castle',characters:{enabled:false,keepExplored:true,tokens:[],explored:[]}});
 s=act(s,{type:'actor-move',id:actorId});const borin=s.maps.b.characters.tokens[0];assert.equal(borin.id,'abc');assert.equal(borin.actorId,actorId);assert.equal(borin.visible,false);assert.equal(s.maps.a.characters.tokens.length,0);
 s=act(s,{type:'token-update',id:borin.id,token:{name:'Borin the smith'}});assert.equal(s.workspace.actors[actorId].definition.name,'Borin the smith');
 s=act(s,{type:'template-spawn',id:templateId});s=act(s,{type:'template-spawn',id:templateId});const tokens=s.maps.b.characters.tokens;assert.equal(new Set(tokens.map(t=>t.id)).size,3);assert.equal(new Set(tokens.map(t=>t.key)).size,3);assert.equal(tokens[1].actorId,undefined);assert.equal(tokens[2].actorId,undefined);assert.notEqual(tokens[1].x+','+tokens[1].y,tokens[2].x+','+tokens[2].y);
 s=act(s,{type:'token-delete',id:borin.id});assert.equal(s.workspace.actors[actorId],undefined);
});
test('map groups reference reusable resources independently of session placements or spatial connections',()=>{
 let s=fixture();s=act(s,{type:'group-create',name:'Old House'});const id=Object.keys(s.workspace.groups)[0];s=act(s,{type:'group-add',id});s=act(s,{type:'group-add',id});assert.deepEqual(s.workspace.groups[id].resourceIds,[s.maps.a.resourceId]);
 const before=structuredClone(s.maps.a);s=act(s,{type:'group-rename',id,name:'Village buildings'});assert.deepEqual(s.maps.a,before);s=act(s,{type:'group-remove',id});assert.deepEqual(s.workspace.groups[id].resourceIds,[]);
});
test('phone controllers stay on the published map while DM privately prepares another map',()=>{
 let s=act(fixture(),{type:'token-add',token:{id:'abc',key,name:'Ranger',kind:'player',color:'#6389df',radius:1,x:150,y:150}});s=act(s,{type:'characters',enabled:true,keepExplored:true});
 registerImport(s,{...structuredClone(s.maps.a),id:'b',name:'Castle',characters:{enabled:false,keepExplored:true,tokens:[],explored:[]}});
 assert.equal(controllerState(s,key).enabled,true);s=moveCharacter(s,key,{mapId:'a',direction:'right'});assert.equal(s.maps.a.characters.tokens[0].x,225);assert.equal(s.workspace.selected,'b');
 s=act(s,{type:'publish'});assert.equal(controllerState(s,key).enabled,false);assert.throws(()=>moveCharacter(s,key,{mapId:'a',direction:'right'}),/not enabled|Map changed|assigned/);
 s=act(s,{type:'campaign-create',name:'Unrelated party'});assert.throws(()=>controllerState(s,key),/invalid|revoked/);
});
test('legacy disk upgrade preserves a permanent original, saves version 2 and resumes distinct DM/player maps',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tabletop-upgrade-'));
 try{
  const legacy=fixture();delete legacy.workspace;legacy.schemaVersion=1;for(const m of Object.values(legacy.maps)){delete m.campaignId;delete m.resourceId;}
  const original=JSON.stringify(legacy);await fs.writeFile(path.join(dir,'session.json'),original);
  const store=new Store(dir);await store.open();assert.equal(store.state.schemaVersion,2);assert.equal(await fs.readFile(path.join(dir,'session.before-campaign-workspace-v1.json'),'utf8'),original);assert.equal(await fs.readFile(path.join(dir,'session.json'),'utf8'),original,'read migration never overwrites source save');
  const next=structuredClone(store.state);registerImport(next,{...structuredClone(next.maps.a),id:'b',name:'Castle'});await store.save(next);
  const reopened=new Store(dir);await reopened.open();assert.equal(reopened.state.active,'a');assert.equal(reopened.state.workspace.selected,'b');assert.equal(await fs.readFile(path.join(dir,'session.before-campaign-workspace-v1.json'),'utf8'),original);
  const broken=structuredClone(reopened.state);delete broken.workspace;assert.throws(()=>validateSession(broken),/workspace is missing/);
  const corrupt=structuredClone(reopened.state);corrupt.workspace.resources[corrupt.maps.a.resourceId].view.scale=-10;assert.throws(()=>validateSession(corrupt),/reusable map configuration/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
