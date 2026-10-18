import {test} from 'node:test';import assert from 'node:assert/strict';
import {defaults,mutate,playerState,validateSession} from '../model.js';import {moveCharacter,controllerState} from '../characters.js';
const key='a'.repeat(48),otherKey='b'.repeat(48);
test('placement snaps to offset grid centers and occupied moves fail without changing state',()=>{
  let s=fixture();s.maps.a.view.locked=false;s=mutate(s,{type:'grid',grid:{pixels:50,x:10,y:-10,overlay:false}});
  let t=s.maps.a.characters.tokens[0];assert.deepEqual([t.x,t.y],[135,115]);
  s=mutate(s,{type:'token-add',token:{id:'def',key:otherKey,name:'Wizard',color:'#8855aa',radius:1,x:t.x,y:t.y}});
  const other=s.maps.a.characters.tokens[1];assert.notDeepEqual([other.x,other.y],[t.x,t.y]);
  s=mutate(s,{type:'token-update',id:'def',token:{x:180,y:112}});assert.deepEqual([s.maps.a.characters.tokens[1].x,s.maps.a.characters.tokens[1].y],[185,115]);
  assert.throws(()=>mutate(s,{type:'token-update',id:'abc',token:{x:180,y:112}}),/occupied/);
  s=mutate(s,{type:'characters',enabled:true,keepExplored:true});const before=structuredClone(s);
  assert.throws(()=>moveCharacter(s,key,{mapId:'a',direction:'right'}),/occupied/);assert.deepEqual(s,before);
});
test('saved overlaps migrate, hidden encounters reserve cells, and grid changes keep unique centers',()=>{
  let s=fixture();s=mutate(s,{type:'token-add',token:{id:'def',key:otherKey,name:'Monster',kind:'monster',visible:false,color:'#8855aa',radius:0,x:125,y:125}});
  s.maps.a.characters.tokens.forEach(t=>{t.x=100;t.y=100;});validateSession(s);
  assert.equal(new Set(s.maps.a.characters.tokens.map(t=>`${t.x},${t.y}`)).size,2);
  const monster=s.maps.a.characters.tokens[1];assert.throws(()=>mutate(s,{type:'token-update',id:'abc',token:{x:monster.x,y:monster.y}}),/occupied/);
  s.maps.a.view.locked=false;s=mutate(s,{type:'grid',grid:{pixels:200,x:10,y:10,overlay:true}});
  assert.equal(new Set(s.maps.a.characters.tokens.map(t=>`${t.x},${t.y}`)).size,2);
  for(const t of s.maps.a.characters.tokens){assert.equal((t.x-10)/200%1,.5);assert.equal((t.y-10)/200%1,.5);}
});
test('map edges use complete cells and arbitrary table rotations still move square to square',()=>{
  let s=mutate(fixture(),{type:'characters',enabled:true,keepExplored:false});s.maps.a.view.rotation=37;
  s=moveCharacter(s,key,{mapId:'a',direction:'right'});assert.deepEqual([s.maps.a.characters.tokens[0].x,s.maps.a.characters.tokens[0].y],[175,75]);
  s=mutate(s,{type:'token-update',id:'abc',token:{x:1000,y:0}});assert.deepEqual([s.maps.a.characters.tokens[0].x,s.maps.a.characters.tokens[0].y],[975,25]);
  s.maps.a.view.rotation=0;s=moveCharacter(s,key,{mapId:'a',direction:'right'});assert.equal(s.maps.a.characters.tokens[0].x,975);
  s.maps.a.view.locked=false;assert.throws(()=>mutate(s,{type:'grid',grid:{pixels:2000,x:0,y:0,overlay:false}}),/complete square/);
  s.maps.a.width=50;s.maps.a.height=50;s.maps.a.characters.tokens[0].x=25;s.maps.a.characters.tokens[0].y=25;
  assert.throws(()=>mutate(s,{type:'token-add',token:{id:'def',key:otherKey,name:'Wizard',color:'#8855aa',radius:1,x:25,y:25}}),/no free/);
});
function fixture(){let s={...defaults(),active:'a',maps:{a:{id:'a',name:'Dungeon',asset:'a.png',width:1000,height:1000,ops:[],cursor:0,grid:{pixels:50,x:0,y:0,overlay:false},view:{x:0,y:0,scale:1,rotation:0,ppi:96,squareInches:1,locked:true,screenWidth:800,screenHeight:600}}}};s=mutate(s,{type:'token-add',token:{id:'abc',key,name:'Valeria',color:'#6389df',radius:2,x:100,y:100}});return s;}
test('optional character mode defaults off and public state never includes player keys',()=>{const s=fixture();assert.equal(s.maps.a.characters.enabled,false);assert.equal(playerState(s).map.characters.tokens[0].key,undefined);assert.equal(JSON.stringify(playerState(s)).includes(key),false);assert.throws(()=>moveCharacter(s,key,{mapId:'a',direction:'right'}),/not enabled/);});
test('player movement preserves locked map geometry, reveals explored radius, and respects ownership',()=>{let s=mutate(fixture(),{type:'characters',enabled:true,keepExplored:true});const view=structuredClone(s.maps.a.view);s=moveCharacter(s,key,{mapId:'a',direction:'right'});assert.equal(s.maps.a.characters.tokens[0].x,175);assert.deepEqual(s.maps.a.view,view);assert.equal(s.maps.a.characters.explored.at(-1).radius,100);assert.throws(()=>moveCharacter(s,otherKey,{mapId:'a',direction:'right'}),/assigned/);assert.throws(()=>moveCharacter(s,key,{mapId:'other',direction:'right'}),/Map changed/);assert.equal(controllerState(s,key).token.key,undefined);});
test('current-radius mode stores no new trail and rotated directions follow the table',()=>{let s=mutate(fixture(),{type:'characters',enabled:true,keepExplored:false});s.maps.a.view.rotation=90;s=moveCharacter(s,key,{mapId:'a',direction:'right'});assert.ok(Math.abs(s.maps.a.characters.tokens[0].y-75)<1e-9);assert.equal(s.maps.a.characters.explored.length,0);s=moveCharacter(s,key,{mapId:'a',direction:'right'});s=moveCharacter(s,key,{mapId:'a',direction:'right'});assert.equal(s.maps.a.characters.tokens[0].y,25);});
test('removing a token revokes controls and manual visibility is independent of characters',()=>{let s=mutate(fixture(),{type:'operation',op:{type:'all',reveal:true}});s=mutate(s,{type:'characters',enabled:true,keepExplored:true});s=moveCharacter(s,key,{mapId:'a',direction:'down'});s=mutate(s,{type:'characters',enabled:false,keepExplored:true});assert.deepEqual(s.maps.a.ops,[{type:'all',reveal:true}]);s=mutate(s,{type:'token-delete',id:'abc'});assert.throws(()=>controllerState(s,key),/revoked/);assert.ok(s.maps.a.characters.explored.length>0);});
test('old saves migrate to disabled character mode and invalid character settings are rejected',()=>{const s=fixture();delete s.networkEnabled;delete s.maps.a.characters;validateSession(s);assert.equal(s.networkEnabled,false);assert.equal(s.maps.a.characters.enabled,false);assert.throws(()=>mutate(fixture(),{type:'token-update',id:'abc',token:{radius:-1}}));assert.throws(()=>mutate(fixture(),{type:'token-update',id:'abc',token:{x:1001}}));});
