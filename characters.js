export const characterDefaults=()=>({enabled:false,keepExplored:true,tokens:[],explored:[]});
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export const isPlayer=t=>(t.kind||'player')==='player';
// Only complete squares can hold tokens, including when the grid has an offset.
function cells(map){const {pixels:p,x,y}=map.grid;return {p,x,y,minX:Math.ceil(-x/p),maxX:Math.floor((map.width-x)/p)-1,minY:Math.ceil(-y/p),maxY:Math.floor((map.height-y)/p)-1};}
function cellOf(g,t){return [Math.round((t.x-g.x)/g.p-.5),Math.round((t.y-g.y)/g.p-.5)];}
function position(map,x,y,id,findFree=false){
  if(!finite(x,0,map.width)||!finite(y,0,map.height))throw Error('Invalid character position');
  const g=cells(map);if(g.minX>g.maxX||g.minY>g.maxY)throw Error('The grid has no complete square for a token');
  const col=Math.max(g.minX,Math.min(g.maxX,Math.floor((x-g.x)/g.p))),row=Math.max(g.minY,Math.min(g.maxY,Math.floor((y-g.y)/g.p)));
  const occupied=new Set((map.characters?.tokens||[]).filter(t=>t.id!==id).map(t=>cellOf(g,t).join(',')));
  let target=[col,row];
  if(occupied.has(target.join(','))){
    if(!findFree)throw Error('That square is occupied by another token');
    let best=Infinity;target=null;
    // With at most 30 tokens, an available nearest square is within 30 cells.
    for(let r=Math.max(g.minY,row-30);r<=Math.min(g.maxY,row+30);r++)for(let c=Math.max(g.minX,col-30);c<=Math.min(g.maxX,col+30);c++){
      const distance=(c-col)**2+(r-row)**2;if(distance<best&&!occupied.has(c+','+r)){best=distance;target=[c,r];}
    }
    if(!target)throw Error('There are no free grid squares for another token');
  }
  return {x:g.x+(target[0]+.5)*g.p,y:g.y+(target[1]+.5)*g.p};
}
export function alignCharacters(map){
  const tokens=map.characters?.tokens||[],placed=[];
  for(const t of tokens){Object.assign(t,position({...map,characters:{tokens:placed}},t.x,t.y,t.id,true));placed.push(t);}
}
export function validateArtwork(value){if(value!==null&&value!==undefined&&(typeof value!=='string'||value.length>400000||!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(value)))throw Error('Artwork must be a small PNG image');}
export function validateCharacters(map){
  map.characters??=characterDefaults();const c=map.characters;
  if(typeof c.enabled!=='boolean'||typeof c.keepExplored!=='boolean'||!Array.isArray(c.tokens)||c.tokens.length>30||!Array.isArray(c.explored)||c.explored.length>100000)throw Error('Invalid character mode');
  const ids=new Set(),keys=new Set();for(const t of c.tokens){
    t.kind??='player';t.visible??=true;t.artwork??=null;
    if(!['player','monster','npc'].includes(t.kind)||typeof t.visible!=='boolean'||(!isPlayer(t)&&t.radius!==0))throw Error('Invalid token type or visibility');validateArtwork(t.artwork);
    if(typeof t.id!=='string'||ids.has(t.id)||!/^[-a-f0-9]+$/.test(t.id)||typeof t.key!=='string'||!/^[a-f0-9]{48}$/.test(t.key)||keys.has(t.key)||typeof t.name!=='string'||!t.name.trim()||t.name.length>60||!/^#[a-f0-9]{6}$/i.test(t.color)||!finite(t.x,0,map.width)||!finite(t.y,0,map.height)||!finite(t.radius,0,100))throw Error('Invalid character');ids.add(t.id);keys.add(t.key);
  }
  for(const p of c.explored)if(!finite(p.x,0,map.width)||!finite(p.y,0,map.height)||!finite(p.radius,0,1000000))throw Error('Invalid explored area');
}
export function publicCharacters(map){const c=map.characters||characterDefaults();return {...c,tokens:c.tokens.filter(t=>t.visible!==false).map(({key,...t})=>t)};}
export function remember(map,token){const c=map.characters;if(!isPlayer(token)||token.visible===false||!c.enabled||!c.keepExplored||token.radius===0)return;const radius=token.radius*map.grid.pixels;if(c.explored.length>=100000)throw Error('Exploration limit reached; export a backup and clear character exploration');const last=c.explored.at(-1);if(!last||last.x!==token.x||last.y!==token.y||last.radius!==radius)c.explored.push({x:token.x,y:token.y,radius});}
export function changeCharacters(map,action){
  map.characters??=characterDefaults();const c=map.characters;
  if(action.type==='characters'){
    if(typeof action.enabled!=='boolean'||typeof action.keepExplored!=='boolean')throw Error('Invalid character settings');c.enabled=action.enabled;c.keepExplored=action.keepExplored;if(c.enabled)c.tokens.forEach(t=>remember(map,t));
  }else if(action.type==='token-add'){
    if(c.tokens.length>=30)throw Error('Maximum 30 characters per map');const t=action.token;
    c.tokens.push({...t,...position(map,t.x,t.y,undefined,true),kind:t.kind||'player',visible:t.visible??((t.kind||'player')==='player'),artwork:t.artwork||null});validateCharacters(map);remember(map,c.tokens.at(-1));
  }else if(action.type==='token-update'){
    const t=c.tokens.find(t=>t.id===action.id);if(!t)throw Error('Character not found');
    if(action.token.x!==undefined||action.token.y!==undefined)Object.assign(t,position(map,action.token.x??t.x,action.token.y??t.y,t.id));
    for(const k of ['name','color','radius','visible','artwork'])if(action.token[k]!==undefined)t[k]=action.token[k];validateCharacters(map);remember(map,t);
  }else if(action.type==='token-delete'){if(!c.tokens.some(t=>t.id===action.id))throw Error('Character not found');c.tokens=c.tokens.filter(t=>t.id!==action.id);
  }else if(action.type==='exploration-clear')c.explored=[];
  else throw Error('Unknown character action');
}
export function moveCharacter(state,key,request){
  const s=structuredClone(state),m=s.maps[s.active];if(!m||!m.characters?.enabled)throw Error('Character mode is not enabled on the active map');if(request.mapId!==m.id)throw Error('Map changed; wait for your controls to refresh');
  const t=m.characters.tokens.find(t=>t.key===key&&isPlayer(t)&&t.visible!==false);if(!t)throw Error('This controller is not assigned to the active map');
  const directions={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0],nw:[-1,-1],ne:[1,-1],sw:[-1,1],se:[1,1]},d=directions[request.direction];if(!d)throw Error('Invalid movement');
  const a=-(m.view.rotation||0)*Math.PI/180,step=m.grid.pixels,dx=d[0]*Math.cos(a)-d[1]*Math.sin(a),dy=d[0]*Math.sin(a)+d[1]*Math.cos(a),length=Math.max(Math.abs(dx),Math.abs(dy));
  Object.assign(t,position(m,Math.max(0,Math.min(m.width,t.x+step*Math.round(dx/length))),Math.max(0,Math.min(m.height,t.y+step*Math.round(dy/length))),t.id));remember(m,t);s.revision++;return s;
}
export function controllerState(state,key){
  for(const m of Object.values(state.maps)){if(state.workspace&&m.campaignId!==state.workspace.currentCampaign)continue;const t=m.characters?.tokens.find(t=>t.key===key&&isPlayer(t));if(t){const {key:secret,...token}=t;return {revision:state.revision,mapId:m.id,mapName:m.name,enabled:state.active===m.id&&!!m.characters.enabled&&t.visible!==false,blank:state.blank,token};}}
  throw Error('Controller link is invalid or has been revoked');
}
export function customizeCharacter(state,key,request){
  const own=controllerState(state,key);
  if(request.mapId!==own.mapId)throw Error('Character map changed; refresh your controls');
  if(Object.keys(request).some(k=>!['mapId','name','artwork'].includes(k)))throw Error('Players can change only their name and avatar');
  if(request.name===undefined&&request.artwork===undefined)throw Error('Enter a name or choose an avatar');
  const s=structuredClone(state),m=s.maps[own.mapId],t=m.characters.tokens.find(t=>t.key===key&&isPlayer(t));
  if(request.name!==undefined){if(typeof request.name!=='string'||!request.name.trim()||request.name.trim().length>60)throw Error('Enter a character name up to 60 characters');t.name=request.name.trim();}
  if(request.artwork!==undefined){validateArtwork(request.artwork);t.artwork=request.artwork;}
  validateCharacters(m);s.revision++;return s;
}
