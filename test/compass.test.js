import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults,mutate,playerState,validateSession} from '../model.js';
const fixture=()=>({...defaults(),active:'a',maps:{a:{id:'a',name:'Map',asset:'a.png',width:800,height:600,ops:[],cursor:0,grid:{pixels:100,x:0,y:0,overlay:false},view:{locked:true,scale:1,x:0,y:0,rotation:90,ppi:96,squareInches:1,screenWidth:800,screenHeight:600}}}});
test('compass rotates independently of locked geometry and fog, normalizes, and reaches player snapshots',()=>{
 const s=fixture(),next=mutate(s,{type:'compass',compass:{enabled:true,rotation:-15}});
 assert.deepEqual(next.maps.a.compass,{enabled:true,rotation:345});assert.deepEqual(playerState(next).map.compass,next.maps.a.compass);
 assert.deepEqual(next.maps.a.view,s.maps.a.view);assert.deepEqual(next.maps.a.ops,s.maps.a.ops);assert.equal(next.blank,s.blank);
 assert.equal(s.maps.a.compass,undefined);
 for(const compass of [{enabled:true,rotation:NaN},{enabled:true,rotation:Infinity},{enabled:true,rotation:361},{enabled:'yes',rotation:0},null])assert.throws(()=>mutate(s,{type:'compass',compass}),/Invalid compass/);
});
test('legacy saves hide compass; backup validation retains per-map settings and rejects corruption',()=>{
 const s=validateSession(fixture());assert.deepEqual(s.maps.a.compass,{enabled:false,rotation:0});
 s.maps.b={...structuredClone(s.maps.a),id:'b'};
 const next=mutate(s,{type:'compass',compass:{enabled:true,rotation:120}});
 assert.deepEqual(validateSession(JSON.parse(JSON.stringify(next))).maps.a.compass,{enabled:true,rotation:120});
 assert.deepEqual(playerState(mutate(next,{type:'select',id:'b'})).map.compass,{enabled:false,rotation:0});
 next.maps.a.compass.rotation=400;assert.throws(()=>validateSession(next),/Invalid compass/);
});
