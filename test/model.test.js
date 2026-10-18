import {test} from 'node:test';import assert from 'node:assert/strict';
import {defaults,mutate,playerState,validateSession} from '../model.js';
import {rotatedBounds,fitTableView} from '../render.js';
const fixture=()=>({...defaults(),active:'a',maps:{a:{id:'a',asset:'a.png',width:100,height:100,ops:[],cursor:0,grid:{pixels:10,x:0,y:0,overlay:false},view:{locked:true,scale:1,x:0,y:0}}}});
test('best fit centers the full rotated map across a tall combined display',()=>{
 const current=fitTableView(302,495,1920,2160,90),best=fitTableView(302,495,1920,2160,90,true);
 assert.ok(best.scale>current.scale);assert.equal(best.rotation,0);
 for(const angle of [0,45,90,180,270]){const v=fitTableView(302,495,1920,2160,angle),b=rotatedBounds(302,495,angle);assert.ok(v.x>=-1e-8&&v.y>=-1e-8);assert.ok(Math.abs(v.x*2+b.width*v.scale-1920)<1e-8);assert.ok(Math.abs(v.y*2+b.height*v.scale-2160)<1e-8);}
 assert.equal(fitTableView(100,100,1920,2160,90,true).rotation,90); // Equal fits preserve the chosen direction.
 assert.equal(fitTableView(1,1,1920,2160).scale,20);
});
test('fog starts covered; independent operations survive undo, redo, and branch edits',()=>{
 let s=fixture();assert.equal(playerState(s).map.ops.length,0);assert.equal(s.blank,true);
 for(const x of [5,70])s=mutate(s,{type:'operation',op:{type:'rectangle',reveal:true,points:[[x,5],[x+10,20]]}});
 assert.equal(playerState(s).map.ops.length,2);s=mutate(s,{type:'undo'});assert.equal(playerState(s).map.ops.length,1);s=mutate(s,{type:'redo'});assert.equal(playerState(s).map.ops.length,2);
 s=mutate(mutate(s,{type:'undo'}),{type:'operation',op:{type:'all',reveal:false}});assert.equal(s.maps.a.cursor,s.maps.a.ops.length);assert.equal(s.maps.a.ops.at(-1).reveal,false);
});
test('server lock rejects both table movement and calibration but allows dimension reporting',()=>{
 const s=fixture();assert.throws(()=>mutate(s,{type:'view',view:{x:3}}),/Unlock/);assert.throws(()=>mutate(s,{type:'grid',grid:{pixels:10,x:0,y:0}}),/Unlock/);const next=mutate(s,{type:'screen',width:800,height:600});assert.equal(next.maps.a.view.scale,1);
 const unlocked=mutate(s,{type:'lock',value:false});assert.equal(mutate(unlocked,{type:'view',view:{scale:2}}).maps.a.view.scale,2);
});
test('malformed operations and invalid positions cannot enter persisted state',()=>{
 for(const op of [{type:'polygon',reveal:true,points:[[1,2]]},{type:'brush',reveal:true,points:[[NaN,2]],size:3},{type:'brush',reveal:true,points:[[1,2]],size:0}])assert.throws(()=>mutate(fixture(),{type:'operation',op}));
 assert.throws(()=>mutate(mutate(fixture(),{type:'lock',value:false}),{type:'view',view:{scale:Infinity}}));
});
test('rotation is guarded by lock, normalized, and fits rotated image bounds',()=>{
 const s=fixture();assert.throws(()=>mutate(s,{type:'view',view:{rotation:90}}),/Unlock/);const unlocked=mutate(s,{type:'lock',value:false});const rotated=mutate(unlocked,{type:'view',view:{rotation:-90}});assert.equal(rotated.maps.a.view.rotation,270);assert.deepEqual(rotated.maps.a.ops,s.maps.a.ops);assert.equal(rotated.maps.a.view.scale,1);
 for(const rotation of [NaN,Infinity,361])assert.throws(()=>mutate(unlocked,{type:'view',view:{rotation}}));
 const b=rotatedBounds(400,300,90);assert.ok(Math.abs(b.width-300)<1e-8);assert.ok(Math.abs(b.height-400)<1e-8);assert.ok(Math.abs(rotatedBounds(400,300,45).width-700/Math.sqrt(2))<1e-8);
 const legacy=fixture();legacy.maps.a.name='Legacy map';Object.assign(legacy.maps.a.view,{ppi:96,squareInches:1,screenWidth:800,screenHeight:600});assert.equal(validateSession(legacy).maps.a.view.rotation,0);
});
