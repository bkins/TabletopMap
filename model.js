import {ensureWorkspace,validateWorkspace,selectedMap,campaignAction,syncActor} from './campaigns.js';
import {validateCharacters,publicCharacters,changeCharacters,alignCharacters} from './characters.js';
import {atmosphereDefaults,validateAtmosphere,compassDefaults,validateCompass} from './extras.js';
export const defaults = () => ({schemaVersion:1,maps:{}, active:null, blank:true, revision:0,networkEnabled:false});
export function playerState(state) {
  const m=state.maps[state.active];
  return {revision:state.revision,blank:state.blank,map:m?{id:m.id,asset:m.asset,width:m.width,height:m.height,ops:m.ops.slice(0,m.cursor),grid:m.grid,view:m.view,characters:publicCharacters(m),atmosphere:m.atmosphere||atmosphereDefaults(),compass:m.compass||compassDefaults()}:null};
}
const number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function validateOperation(op) {
  if(!op||!['all','brush','rectangle','polygon'].includes(op.type)||typeof op.reveal!=='boolean') throw Error('Invalid visibility operation');
  if(op.type==='all') return {type:'all',reveal:op.reveal};
  if(!Array.isArray(op.points)||op.points.length>20000||op.points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(x=>number(x,-100000,100000)))) throw Error('Invalid points');
  if(op.points.length<(op.type==='polygon'?3:op.type==='rectangle'?2:1)) throw Error('More points required');
  if(op.type==='brush'&&!number(op.size,1,5000)) throw Error('Invalid brush size');
  return {type:op.type,reveal:op.reveal,points:op.points,size:op.type==='brush'?op.size:undefined};
}
export function validateSession(s){
  s.networkEnabled??=false;if(typeof s.networkEnabled!=='boolean')throw Error('Invalid network setting');
  if(!s||![1,2].includes(s.schemaVersion)||typeof s.blank!=='boolean'||!Number.isSafeInteger(s.revision)||s.revision<0||!s.maps||Array.isArray(s.maps)||typeof s.maps!=='object'||(s.active!==null&&!s.maps[s.active]))throw Error('Invalid session structure');
  if(s.schemaVersion===2&&!s.workspace)throw Error('Campaign workspace is missing');
  for(const [id,m] of Object.entries(s.maps)){
    if(m.id!==id||!/^[-a-f0-9]+\.(png|jpg)$/.test(m.asset)||typeof m.name!=='string'||!number(m.width,1,12000)||!number(m.height,1,12000)||m.width*m.height>40000000||!Array.isArray(m.ops)||!Number.isInteger(m.cursor)||m.cursor<0||m.cursor>m.ops.length)throw Error('Invalid saved map');
    m.ops.forEach(validateOperation);const g=m.grid,v=m.view;
    if(v&&v.rotation===undefined)v.rotation=0;
    if(!v||!number(v.rotation,-360,360))throw Error('Invalid saved rotation');
    if(!g||!number(g.pixels,1,10000)||!number(g.x,-100000,100000)||!number(g.y,-100000,100000)||typeof g.overlay!=='boolean'||!v||typeof v.locked!=='boolean'||!number(v.x,-100000,100000)||!number(v.y,-100000,100000)||!number(v.scale,.01,20)||!['ppi','squareInches','screenWidth','screenHeight'].every(k=>number(v[k],.01,100000)))throw Error('Invalid saved calibration');
    validateCharacters(m);
    alignCharacters(m);
    m.atmosphere??=atmosphereDefaults();validateAtmosphere(m.atmosphere);
    m.compass=validateCompass(m.compass??compassDefaults());
  }
  validateWorkspace(s);
  return s;
}
export function mutate(state,action) {
  const s=structuredClone(state);ensureWorkspace(s);const m=selectedMap(s);
  if(campaignAction(s,action)){s.revision++;return validateSession(s);}
  if(action.type==='blank') s.blank=!!action.value;
  else if(action.type==='network'){if(typeof action.enabled!=='boolean')throw Error('Invalid network setting');s.networkEnabled=action.enabled;}
  else {
    if(!m) throw Error('Import a map first');
    if(action.type==='compass')m.compass=validateCompass(action.compass);
    else if(action.type==='atmosphere')m.atmosphere={...validateAtmosphere(action.atmosphere)};
    else if(action.type==='operation') {m.ops=m.ops.slice(0,m.cursor);m.ops.push(validateOperation(action.op));m.cursor=m.ops.length;}
    else if(['characters','token-add','token-update','token-delete','exploration-clear'].includes(action.type)){const old=m.characters?.tokens.find(t=>t.id===action.id);changeCharacters(m,action);if(action.type==='token-delete'&&old?.actorId)delete s.workspace.actors[old.actorId];if(action.type==='token-update')syncActor(s,m,m.characters.tokens.find(t=>t.id===action.id));}
    else if(action.type==='undo') m.cursor=Math.max(0,m.cursor-1);
    else if(action.type==='redo') m.cursor=Math.min(m.ops.length,m.cursor+1);
    else if(action.type==='lock') m.view.locked=!!action.value;
    else if(action.type==='screen') {
      if(!number(action.width,1,100000)||!number(action.height,1,100000)) throw Error('Invalid display dimensions');
      m.view.screenWidth=action.width;m.view.screenHeight=action.height;
    } else if(action.type==='view') {
      if(m.view.locked) throw Error('Unlock the table view first');
      if(action.view.rotation!==undefined&&!number(action.view.rotation,-360,360))throw Error('Invalid rotation');
      if(!['x','y','scale','ppi','squareInches','screenWidth','screenHeight'].every(k=>action.view[k]===undefined||number(action.view[k],k==='x'||k==='y'?-100000:0.01,k==='scale'?20:100000))) throw Error('Invalid table settings');
      for(const k of ['x','y','scale','ppi','squareInches','screenWidth','screenHeight']) if(action.view[k]!==undefined) m.view[k]=action.view[k];
      if(action.view.rotation!==undefined)m.view.rotation=((action.view.rotation%360)+360)%360;
    } else if(action.type==='grid') {
      if(m.view.locked) throw Error('Unlock the table view before calibrating');
      if(!number(action.grid.pixels,1,10000)||!number(action.grid.x,-100000,100000)||!number(action.grid.y,-100000,100000)) throw Error('Invalid grid');
      m.grid={pixels:action.grid.pixels,x:action.grid.x,y:action.grid.y,overlay:!!action.grid.overlay};
      alignCharacters(m);
    } else throw Error('Unknown action');
  }
  s.revision++; return s;
}
