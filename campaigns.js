import {randomUUID,randomBytes} from 'node:crypto';
import {characterDefaults,changeCharacters,validateCharacters,validateArtwork} from './characters.js';

const copy=value=>structuredClone(value);
const uid=()=>randomUUID();
const name=value=>{if(typeof value!=='string'||!value.trim()||value.trim().length>120)throw Error('Enter a name up to 120 characters');return value.trim();};
const own=(object,key)=>typeof key==='string'&&Object.hasOwn(object,key);
const table=value=>value&&typeof value==='object'&&!Array.isArray(value);
export const selectedMap=s=>s.workspace?s.maps[s.workspace.selected]:s.maps[s.active];
export function resourceFromMap(m,id=uid()) {
 return {id,name:m.name,asset:m.asset,width:m.width,height:m.height,grid:copy(m.grid),view:copy(m.view),atmosphere:copy(m.atmosphere),compass:copy(m.compass)};
}
export function ensureWorkspace(s) {
 if(s.workspace){s.schemaVersion=2;return s.workspace;}
 const campaignId='campaign-main',sessionId='session-main',mapIds=Object.keys(s.maps);
 const resources={};for(const m of Object.values(s.maps)){m.resourceId='resource-'+m.id;m.campaignId=campaignId;resources[m.resourceId]=resourceFromMap(m,m.resourceId);}
 s.schemaVersion=2;
 s.workspace={version:1,currentCampaign:campaignId,selected:s.active,resources,templates:{},actors:{},groups:{},campaigns:{[campaignId]:{id:campaignId,name:'My campaign',selected:s.active,activeSession:sessionId,sessions:{[sessionId]:{id:sessionId,name:'Session 1',mapIds}}}}};
 return s.workspace;
}
export const currentCampaign=s=>s.workspace.campaigns[s.workspace.currentCampaign];
export const currentSession=s=>{const c=currentCampaign(s);return c.sessions[c.activeSession];};
function instances(s,campaignId){return Object.values(s.maps).filter(m=>m.campaignId===campaignId);}
function rememberSelected(s,id){const w=s.workspace;w.selected=id;currentCampaign(s).selected=id;}
function attach(s,id){const session=currentSession(s);if(!session.mapIds.includes(id))session.mapIds.push(id);rememberSelected(s,id);}
export function registerImport(s,m) {
 const w=ensureWorkspace(s);m.campaignId=w.currentCampaign;m.resourceId=uid();w.resources[m.resourceId]=resourceFromMap(m,m.resourceId);s.maps[m.id]=m;attach(s,m.id);
 // Preserve the established first-map, covered-and-blank startup; later imports
 // are private preparation and never replace the published map.
 if(!s.active&&instances(s,w.currentCampaign).length===1){s.active=m.id;s.blank=true;}
}
function instantiate(s,resourceId,fresh=false) {
 const w=s.workspace;if(!own(w.resources,resourceId))throw Error('Choose a map from the library');
 let m=!fresh&&instances(s,w.currentCampaign).find(m=>m.resourceId===resourceId);
 if(!m){const r=w.resources[resourceId],id=uid();m={...copy(r),id,resourceId,campaignId:w.currentCampaign,ops:[],cursor:0,characters:characterDefaults()};m.view.locked=true;s.maps[id]=m;}
 attach(s,m.id);return m;
}
function tokenDefaults(t){return {name:t.name,color:t.color,radius:t.radius,kind:t.kind||'player',visible:t.visible!==false,artwork:t.artwork||null};}
function pickedToken(s,a){const m=selectedMap(s),t=m?.characters.tokens.find(t=>t.id===a.tokenId);if(!t)throw Error('Select a token first');return {m,t};}
function tokenFromDefinition(s,definition){const m=selectedMap(s);if(!m)throw Error('Select a map first');const t={...copy(definition),id:uid(),key:randomBytes(24).toString('hex'),x:m.width/2,y:m.height/2};if(t.kind!=='player')t.radius=0;changeCharacters(m,{type:'token-add',token:t});return m.characters.tokens.at(-1);}
export function syncActor(s,map,token){if(!token?.actorId)return;const actor=s.workspace.actors[token.actorId];if(actor)actor.definition=tokenDefaults(token);}

// Returns false only for existing per-map gameplay commands handled by model.js.
export function campaignAction(s,a) {
 const w=ensureWorkspace(s),c=currentCampaign(s),m=selectedMap(s);
 switch(a.type){
 case 'campaign-create':{const id=uid(),sessionId=uid();w.campaigns[id]={id,name:name(a.name),selected:null,activeSession:sessionId,sessions:{[sessionId]:{id:sessionId,name:'Session 1',mapIds:[]}}};w.currentCampaign=id;w.selected=null;s.active=null;s.blank=true;s.networkEnabled=false;return true;}
 case 'campaign-rename':c.name=name(a.name);return true;
 case 'campaign-select':if(!own(w.campaigns,a.id))throw Error('Campaign not found');w.currentCampaign=a.id;w.selected=currentCampaign(s).selected;s.active=null;s.blank=true;s.networkEnabled=false;return true;
 case 'session-create':{const id=uid();c.sessions[id]={id,name:name(a.name),mapIds:[...currentSession(s).mapIds]};c.activeSession=id;return true;}
 case 'session-rename':currentSession(s).name=name(a.name);return true;
 case 'session-select':if(!own(c.sessions,a.id))throw Error('Session not found');c.activeSession=a.id;rememberSelected(s,c.sessions[a.id].mapIds.includes(w.selected)?w.selected:c.sessions[a.id].mapIds[0]||null);return true;
 case 'select':if(!currentSession(s).mapIds.includes(a.id))throw Error('Map is not in this session');rememberSelected(s,a.id);return true;
 case 'publish':if(!m)throw Error('Choose a prepared map first');s.active=m.id;s.blank=false;return true;
 case 'resource-use':instantiate(s,a.id,a.fresh===true);return true;
 case 'resource-save':if(!m)throw Error('Choose a map first');w.resources[m.resourceId]=resourceFromMap(m,m.resourceId);if(a.name!==undefined){w.resources[m.resourceId].name=name(a.name);m.name=w.resources[m.resourceId].name;}return true;
 case 'map-rename':if(!m)throw Error('Choose a map first');m.name=name(a.name);return true;
 case 'template-save':{const {t}=pickedToken(s,a);const id=uid();w.templates[id]={id,name:name(a.name||t.name),definition:{...tokenDefaults(t),name:name(a.name||t.name)}};return true;}
 case 'template-spawn':if(!own(w.templates,a.id))throw Error('Choose a token template');tokenFromDefinition(s,w.templates[a.id].definition);return true;
 case 'actor-register':{const {m:map,t}=pickedToken(s,a);if(t.actorId)throw Error('This token already has a persistent identity');if(t.kind!=='npc')throw Error('Persistent identities are for named NPCs');const id=uid();w.actors[id]={id,campaignId:w.currentCampaign,mapId:map.id,tokenId:t.id,definition:tokenDefaults(t)};t.actorId=id;return true;}
 case 'actor-move':{const actor=w.actors[a.id];if(!actor||actor.campaignId!==w.currentCampaign||!m)throw Error('Choose an NPC from this campaign and a destination map');if(actor.mapId===m.id)throw Error('This NPC is already on the selected map');const old=s.maps[actor.mapId],token=old.characters.tokens.find(t=>t.id===actor.tokenId&&t.actorId===actor.id);if(!token)throw Error('NPC placement is missing');if(m.characters.tokens.length>=30)throw Error('Destination map has 30 tokens');const replacement={...copy(token),x:m.width/2,y:m.height/2};changeCharacters(m,{type:'token-add',token:replacement});old.characters.tokens=old.characters.tokens.filter(t=>t.id!==token.id);actor.mapId=m.id;return true;}
 case 'group-create':{const id=uid();w.groups[id]={id,name:name(a.name),campaignId:w.currentCampaign,resourceIds:[]};return true;}
 case 'group-rename':{const g=w.groups[a.id];if(!g||g.campaignId!==w.currentCampaign)throw Error('Choose a map group');g.name=name(a.name);return true;}
 case 'group-add':{const g=w.groups[a.id];if(!g||g.campaignId!==w.currentCampaign||!m)throw Error('Choose a group and map');if(!g.resourceIds.includes(m.resourceId))g.resourceIds.push(m.resourceId);return true;}
 case 'group-remove':{const g=w.groups[a.id];if(!g||g.campaignId!==w.currentCampaign||!m)throw Error('Choose a group and map');g.resourceIds=g.resourceIds.filter(id=>id!==m.resourceId);return true;}
 default:return false;
 }
}

export function validateWorkspace(s) {
 const w=ensureWorkspace(s);
 if(w.version!==1||!['campaigns','resources','templates','actors','groups'].every(k=>table(w[k]))||!own(w.campaigns,w.currentCampaign))throw Error('Invalid campaign workspace');
 const knownMaps=new Set();
 for(const [id,c] of Object.entries(w.campaigns)){
  if(c.id!==id||name(c.name)!==c.name||!table(c.sessions)||!own(c.sessions,c.activeSession))throw Error('Invalid campaign');
  for(const [sid,session] of Object.entries(c.sessions)){
   if(session.id!==sid||name(session.name)!==session.name||!Array.isArray(session.mapIds)||new Set(session.mapIds).size!==session.mapIds.length||session.mapIds.some(mid=>!own(s.maps,mid)||s.maps[mid].campaignId!==id))throw Error('Invalid campaign session');
   session.mapIds.forEach(mid=>knownMaps.add(mid));
  }
  if(c.selected!==null&&(!own(s.maps,c.selected)||s.maps[c.selected].campaignId!==id))throw Error('Invalid campaign selection');
 }
 for(const [id,r] of Object.entries(w.resources)){
  if(r.id!==id||name(r.name)!==r.name||!/^[-a-f0-9]+\.(png|jpg)$/.test(r.asset)||!Number.isInteger(r.width)||r.width<1||r.width>12000||!Number.isInteger(r.height)||r.height<1||r.height>12000||r.width*r.height>40000000||!table(r.grid)||!table(r.view))throw Error('Invalid reusable map');
  const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;const g=r.grid,v=r.view;
  if(!finite(g.pixels,1,10000)||!finite(g.x,-100000,100000)||!finite(g.y,-100000,100000)||typeof g.overlay!=='boolean'||typeof v.locked!=='boolean'||!finite(v.scale,.01,20)||!finite(v.rotation,-360,360)||!finite(v.x,-100000,100000)||!finite(v.y,-100000,100000)||!['ppi','squareInches','screenWidth','screenHeight'].every(k=>finite(v[k],.01,100000)))throw Error('Invalid reusable map configuration');
 }
 for(const m of Object.values(s.maps))if(!knownMaps.has(m.id)||!own(w.campaigns,m.campaignId)||!own(w.resources,m.resourceId))throw Error('Map ownership is missing');
 if(w.selected!==null&&(!currentSession(s).mapIds.includes(w.selected)||s.maps[w.selected]?.campaignId!==w.currentCampaign))throw Error('Invalid prepared map selection');
 if(s.active!==null&&s.maps[s.active]?.campaignId!==w.currentCampaign)throw Error('Published map belongs to another campaign');
 for(const [id,t] of Object.entries(w.templates)){
  if(t.id!==id||name(t.name)!==t.name||!table(t.definition)||Object.keys(t.definition).some(k=>!['name','color','radius','kind','visible','artwork'].includes(k)))throw Error('Invalid token template');
  validateDefinition(t.definition);
 }
 const identities=new Set();
 for(const [id,actor] of Object.entries(w.actors)){
  const map=s.maps[actor.mapId],token=map?.characters.tokens.find(t=>t.id===actor.tokenId&&t.actorId===id);
  if(actor.id!==id||!token||token.kind!=='npc'||map.campaignId!==actor.campaignId||!own(w.campaigns,actor.campaignId)||identities.has(actor.tokenId))throw Error('Invalid persistent NPC');
  identities.add(actor.tokenId);validateDefinition(actor.definition);
 }
 for(const m of Object.values(s.maps))for(const t of m.characters.tokens)if(t.actorId&&(!own(w.actors,t.actorId)||w.actors[t.actorId].mapId!==m.id||w.actors[t.actorId].tokenId!==t.id))throw Error('Invalid NPC identity reference');
 for(const [id,g] of Object.entries(w.groups))if(g.id!==id||name(g.name)!==g.name||!own(w.campaigns,g.campaignId)||!Array.isArray(g.resourceIds)||new Set(g.resourceIds).size!==g.resourceIds.length||g.resourceIds.some(rid=>!own(w.resources,rid)))throw Error('Invalid map group');
 return w;
}
function validateDefinition(d){validateArtwork(d.artwork);const map={width:1000,height:1000,characters:{enabled:false,keepExplored:true,explored:[],tokens:[{...copy(d),id:'a',key:'a'.repeat(48),x:50,y:50}]}};validateCharacters(map);}
