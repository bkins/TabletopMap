import {compose,loadImage,shape,rotatedBounds,fitTableView,loadTokenArt,drawTokens,drawCompass} from './render.js';
const $=id=>document.getElementById(id),canvas=$('dm'),ctx=canvas.getContext('2d');let state=null,map=null,image=null,composition=null,reveal=true,view={x:0,y:0,scale:1},gesture=null,polygon=[],calibration=[],busy=false,loadTicket=0,polling=false;
let selectedToken='',controlsPending=false;
let placementDraft=null,placementDrag=null,placementWheelTimer=null;
let actionTail=Promise.resolve();
function action(a){
  const active=state.active;
  const pending=actionTail.then(()=>{
    if(state.active!==active)throw Error('Active map changed; refresh your controls before editing');
    return saveAction(a);
  });
  actionTail=pending.catch(()=>{});
  return pending;
}
function error(e){$('error').textContent=e.message||String(e);$('error').hidden=false;setTimeout(()=>$('error').hidden=true,7000);}
async function refresh(statusOnly=false){const r=await fetch('/api/state',{signal:AbortSignal.timeout(3000)});if(!r.ok)throw Error('Local server unavailable');const next=await r.json();$('connection').textContent=next.tableScreens.length?`Table connected · ${next.tableScreens[0].width} × ${next.tableScreens[0].height}`:'Table disconnected';$('connection').classList.toggle('connected',!!next.tableScreens.length);if(statusOnly&&state?.active!==next.active)return;if(state?.revision===next.revision){state.tableScreens=next.tableScreens;if(!statusOnly&&controlsPending){updateControls();controlsPending=false;}return;}const changed=state?.active!==next.active;state=next;map=next.maps[next.active];const ticket=++loadTicket;
  if(changed){cancelPlacement();gesture=null;polygon=[];calibration=[];image=null;composition=null;draw();}
  if(map){const loaded=changed||!image?await loadImage('/assets/'+map.asset):image;await loadTokenArt(map);if(ticket!==loadTicket)return;image=loaded;composition=compose(image,map,map.ops.slice(0,map.cursor));if(changed)fitDM();}
  if(statusOnly)controlsPending=true;else{updateControls();controlsPending=false;}draw();
}
function updateControls(){
  $('empty').hidden=!!map;$('mapTitle').textContent=map?.name||'Your next adventure starts here';$('instructions').textContent=map?'Complete map with a shaded fog guide. Your navigation stays private.':'Import a map to begin. New maps start covered and blanked.';$('maps').replaceChildren(...Object.values(state.maps).map(m=>{const o=document.createElement('option');o.value=m.id;o.textContent=m.name;return o;}));$('maps').value=state.active||'';
  $('blank').textContent=state.blank?'Show table · Space':'Blank table · Space';$('previewLabel').textContent=state.blank?'Table is blanked. Show table when ready.':'Same fog, position, and scale as the table display.';
  $('saveStatus').textContent=`Saved locally · revision ${state.revision}`;$('undo').disabled=!map||!map.cursor;$('redo').disabled=!map||map.cursor===map.ops.length;
  for(const id of ['allReveal','allCover','lock','fitDM'])$(id).disabled=!map;
  updateCharacters();
  $('atmosphereEffect').value=map?.atmosphere?.effect||'none';$('atmosphereSound').value=map?.atmosphere?.sound||'none';$('atmosphereVolume').value=map?.atmosphere?.volume??0.2;$('saveAtmosphere').disabled=!map;
  $('compassEnabled').checked=map?.compass?.enabled??false;$('compassRotation').value=map?.compass?.rotation??0;
  $('compassControls').querySelectorAll('input,button').forEach(c=>c.disabled=!map);
  const placementLocked=!map||map.view.locked;
  for(const id of ['bestFit','previewFit','previewSmaller','previewLarger'])$(id).disabled=placementLocked;
  $('previewLock').disabled=!map;$('previewLock').textContent=placementLocked?'Unlock placement…':'Lock placement';
  $('placementSurface').hidden=placementLocked;
  $('placementHint').textContent=placementLocked?'Unlock placement to fit, drag, or resize the player map.':'Drag this preview to move the player map; scroll to resize. Best fit chooses the angle that fills more of the display. Lock when finished. Fitting changes physical square size.';
  if(placementLocked)cancelPlacement();
  if(!map)return;const v=map.view,g=map.grid;$('lock').textContent=v.locked?'🔒 Table position locked':'🔓 Table unlocked — minis may move';
  for(const id of ['x','y','scale','ppi'])$(id).value=v[id];$('rotation').value=v.rotation||0;$('inches').value=v.squareInches;$('pixels').value=g.pixels;$('gridX').value=g.x;$('gridY').value=g.y;$('overlay').checked=g.overlay;
  $('tableControls').querySelectorAll('input,button').forEach(c=>c.disabled=v.locked);
}
async function saveAction(a){busy=true;$('saveStatus').textContent='Saving…';const active=state.active;let revision=state.revision;try{for(let attempt=0;attempt<3;attempt++){const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...a,revision})});const result=await r.json();if(r.ok){await refresh();return;}if(result.error?.startsWith('Session changed')&&attempt<2){const latest=await fetch('/api/state').then(r=>r.json());if(latest.active!==active)throw Error('Active map changed; refresh your controls before editing');revision=latest.revision;continue;}throw Error(result.error);}}catch(e){$('saveStatus').textContent='Save failed — change was not applied';await refresh().catch(()=>{});throw e;}finally{busy=false;}}
const run=fn=>async()=>{try{await fn();}catch(e){error(e);}};
async function confirm(title,text){$('confirmTitle').textContent=title;$('confirmText').textContent=text;return new Promise(resolve=>{$('confirm').addEventListener('close',()=>resolve($('confirm').returnValue==='ok'),{once:true});$('confirm').showModal();});}
function fitDM(){if(!map)return;view.scale=Math.min(canvas.width/map.width,canvas.height/map.height)*.92;view.x=(canvas.width-map.width*view.scale)/2;view.y=(canvas.height-map.height*view.scale)/2;draw();}
function draw(){ctx.fillStyle='#090e16';ctx.fillRect(0,0,canvas.width,canvas.height);if(!image||!map)return;ctx.save();ctx.translate(view.x,view.y);ctx.scale(view.scale,view.scale);ctx.drawImage(image,0,0,map.width,map.height);if(composition){ctx.globalAlpha=.76;ctx.drawImage(composition,0,0);ctx.globalAlpha=1;}
  drawTokens(ctx,map,{dm:true,group:'encounters'});drawTokens(ctx,{...map,characters:{tokens:map.characters?.tokens.filter(t=>(t.kind||'player')==='player'&&t.visible===false)||[]}},{dm:true});
  if(gesture?.op){ctx.fillStyle=ctx.strokeStyle=gesture.op.reveal?'rgba(140,255,181,.4)':'rgba(255,115,148,.5)';shape(ctx,gesture.op);}
  if(polygon.length){ctx.strokeStyle='#b3ffd2';ctx.lineWidth=2/view.scale;ctx.beginPath();ctx.moveTo(...polygon[0]);for(const p of polygon.slice(1))ctx.lineTo(...p);ctx.stroke();for(const p of polygon){ctx.beginPath();ctx.arc(...p,4/view.scale,0,Math.PI*2);ctx.fillStyle='#b3ffd2';ctx.fill();}}
  for(const p of calibration){ctx.beginPath();ctx.arc(...p,5/view.scale,0,Math.PI*2);ctx.fillStyle='#ffd588';ctx.fill();}ctx.restore();drawCompass(ctx,map.compass,canvas.width,canvas.height);
}
new ResizeObserver(()=>{const r=canvas.getBoundingClientRect();canvas.width=Math.round(r.width);canvas.height=Math.round(r.height);draw();}).observe($('stage'));
const screenPoint=e=>{const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};const point=e=>{const p=screenPoint(e);return [(p[0]-view.x)/view.scale,(p[1]-view.y)/view.scale];};
canvas.onpointerdown=e=>{if(!map||busy||e.button===2)return;const tool=$('tool').value;if(tool==='pan'||e.button===1){e.preventDefault();gesture={pan:screenPoint(e),origin:{...view},pointer:e.pointerId};canvas.setPointerCapture(e.pointerId);return;}
  const p=point(e);if(tool==='polygon'){polygon.push(p);$('finish').hidden=false;draw();return;}
  if(tool==='placeToken'){const t=map.characters?.tokens.find(t=>t.id===selectedToken);if(!t){error(Error('Select a character first'));return;}run(()=>action({type:'token-update',id:t.id,token:{x:Math.max(0,Math.min(map.width,p[0])),y:Math.max(0,Math.min(map.height,p[1]))}}))();return;}
  if(tool==='calibrate'){if(map.view.locked){error(Error('Unlock the table view before calibrating'));return;}calibration.push(p);if(calibration.length===2){$('pixels').value=Math.round(Math.hypot(calibration[1][0]-calibration[0][0],calibration[1][1]-calibration[0][1])*100)/100;$('gridX').value=Math.round(calibration[0][0]);$('gridY').value=Math.round(calibration[0][1]);calibration=[];$('instructions').textContent='Grid measured. Apply grid & physical scale, then lock the table.';}draw();return;}
  gesture={pointer:e.pointerId,op:{type:tool,reveal,size:Number($('brush').value),points:tool==='rectangle'?[p,p]:[p]}};canvas.setPointerCapture(e.pointerId);draw();};
canvas.onpointermove=e=>{if(!gesture)return;if(gesture.pan){const p=screenPoint(e);view.x=gesture.origin.x+p[0]-gesture.pan[0];view.y=gesture.origin.y+p[1]-gesture.pan[1];}else if(gesture.op.type==='rectangle')gesture.op.points[1]=point(e);else if(gesture.op.points.length<20000)gesture.op.points.push(point(e));draw();};
canvas.onpointerup=run(async()=>{const g=gesture;gesture=null;if(g?.op)await action({type:'operation',op:g.op});draw();});canvas.onpointercancel=()=>{gesture=null;draw();};canvas.oncontextmenu=e=>e.preventDefault();
canvas.addEventListener('wheel',e=>{e.preventDefault();const p=screenPoint(e),old=view.scale;view.scale=Math.min(20,Math.max(.01,old*Math.exp(-e.deltaY*.001)));view.x=p[0]-(p[0]-view.x)*view.scale/old;view.y=p[1]-(p[1]-view.y)*view.scale/old;draw();},{passive:false});
async function finish(){if(polygon.length<3)throw Error('Choose at least three polygon corners');const points=polygon.slice();await action({type:'operation',op:{type:'polygon',reveal,points}});polygon=[];$('finish').hidden=true;draw();}
$('finish').onclick=run(finish);$('tool').onchange=()=>{polygon=[];calibration=[];gesture=null;$('finish').hidden=true;draw();};
$('reveal').onclick=()=>{reveal=true;$('reveal').classList.add('selected');$('cover').classList.remove('selected');};$('cover').onclick=()=>{reveal=false;$('cover').classList.add('selected');$('reveal').classList.remove('selected');};$('brush').oninput=()=>{$('brushValue').textContent=$('brush').value+' px';};
$('fitDM').onclick=fitDM;$('open').onclick=()=>{if($('displayMode').value==='browser')window.open('/table','tabletop-player');else $('fillScreens').click();};$('blank').onclick=run(async()=>{if(state?.blank)return action({type:'blank',value:false});const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'blank',value:true})});const result=await r.json();if(!r.ok)throw Error(result.error);await refresh();});$('undo').onclick=run(()=>action({type:'undo'}));$('redo').onclick=run(()=>action({type:'redo'}));
for(const [id,value] of [['allReveal',true],['allCover',false]])$(id).onclick=run(async()=>{if(await confirm(value?'Reveal the entire map?':'Cover the entire map?',value?'Every room will become visible when the table is shown. You can undo this change.':'All discovered areas will be covered. Your earlier discovery history is preserved for Undo.'))await action({type:'operation',op:{type:'all',reveal:value}});});
$('maps').onchange=run(async()=>{const id=$('maps').value;if(await confirm('Switch maps?','The table will go blank. Saved discovery and calibration stay with each map.'))await action({type:'select',id});else $('maps').value=state.active;});
$('lock').onclick=run(async()=>{if(map.view.locked&&!(await confirm('Unlock the table position?','Changing table scale or position can move the map beneath physical miniatures. Remove or record miniature positions before making changes.')))return;await action({type:'lock',value:!map.view.locked});});
$('applyView').onclick=run(()=>action({type:'view',view:{x:Number($('x').value),y:Number($('y').value),scale:Number($('scale').value),rotation:Number($('rotation').value)}}));
for(const [id,delta] of [['rotateLeft',-90],['rotateRight',90]])$(id).onclick=run(()=>action({type:'view',view:{rotation:(((map.view.rotation||0)+delta)%360+360)%360}}));
$('calibration').onclick=run(async()=>{const pixels=Number($('pixels').value),ppi=Number($('ppi').value),squareInches=Number($('inches').value);if(!Number.isFinite(ppi)||ppi<=0||!Number.isFinite(squareInches)||squareInches<=0||!Number.isFinite(pixels)||pixels<=0)throw Error('Enter positive calibration values');await action({type:'grid',grid:{pixels,x:Number($('gridX').value),y:Number($('gridY').value),overlay:$('overlay').checked}});await action({type:'view',view:{ppi,squareInches,scale:ppi*squareInches/pixels}});});
$('fitTable').onclick=run(()=>fitPlayerMap(false));
$('import').onchange=run(async()=>{const file=$('import').files[0];if(!file)return;if(file.size>40*1024*1024)throw Error('Map exceeds 40 MB');const url=URL.createObjectURL(file);let img;try{img=await loadImage(url);}finally{URL.revokeObjectURL(url);}const r=await fetch('/api/import',{method:'POST',headers:{'x-map-meta':encodeURIComponent(JSON.stringify({name:file.name,width:img.naturalWidth,height:img.naturalHeight}))},body:file});const result=await r.json();if(!r.ok)throw Error(result.error);$('import').value='';await refresh();});
window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||$('confirm').open)return;if(e.code==='Space'){e.preventDefault();$('blank').click();}else if(e.key==='Escape'){gesture=null;polygon=[];calibration=[];$('finish').hidden=true;draw();}else if(e.key==='Enter'&&polygon.length)run(finish)();else if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();e.shiftKey?$('redo').click():$('undo').click();}});
setInterval(async()=>{if(polling)return;polling=true;try{const editing=busy||gesture||placementDraft||polygon.length||document.activeElement?.matches('input,select');await refresh(!!editing);if(!editing&&!busy){const s=state.tableScreens[0];if(s&&map&&(s.width!==map.view.screenWidth||s.height!==map.view.screenHeight))await action({type:'screen',width:s.width,height:s.height});}}catch{ $('connection').textContent='Server disconnected';$('connection').classList.remove('connected');}finally{polling=false;}},1000);
refresh().catch(error);

function updateCharacters(){
  const previousHost=$('inviteHost').value;$('inviteHost').replaceChildren(...(state.networkUrls||[]).map(url=>{const o=document.createElement('option');o.value=url;o.textContent=url;return o;}));if((state.networkUrls||[]).includes(previousHost))$('inviteHost').value=previousHost;
  $('networkEnabled').checked=!!state.networkEnabled;$('networkStatus').textContent=state.networkEnabled?'Wi-Fi enabled. Use the private links below on the same network.':'Wi-Fi disabled. Controls work only on this computer.';
  const c=map?.characters||{enabled:false,keepExplored:true,tokens:[]};$('charactersEnabled').checked=c.enabled;$('visibilityMode').value=c.keepExplored?'explored':'current';
  for(const id of ['charactersEnabled','visibilityMode','addToken','clearExploration'])$(id).disabled=!map;
  if(!c.tokens.some(t=>t.id===selectedToken))selectedToken=c.tokens[0]?.id||'';
  $('tokens').replaceChildren(...c.tokens.map(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=t.name+(t.kind&&t.kind!=='player'?' · '+t.kind:'')+(t.visible===false?' · hidden':'');return o;}));$('tokens').value=selectedToken;
  const t=c.tokens.find(t=>t.id===selectedToken);$('tokenControls').querySelectorAll('input,button').forEach(e=>e.disabled=!t);
  $('showAllQR').disabled=!state.networkEnabled||!c.enabled||!c.tokens.some(t=>(t.kind||'player')==='player'&&t.visible!==false);
  $('showQR').disabled=!state.networkEnabled||!c.enabled||!t||t.visible===false;
  if(!t){$('controlLink').value='';$('artworkPreview').hidden=true;$('playerLinkControls').hidden=true;return;}
  $('tokenName').value=t.name;$('tokenColor').value=t.color;$('tokenRadius').value=t.radius;$('tokenRadius').disabled=(t.kind||'player')!=='player';$('tokenVisible').checked=t.visible!==false;$('tokenX').value=Math.round(t.x*100)/100;$('tokenY').value=Math.round(t.y*100)/100;
  $('artworkPreview').hidden=!t.artwork;if(t.artwork)$('artworkPreview').src=t.artwork;else $('artworkPreview').removeAttribute('src');$('playerLinkControls').hidden=(t.kind||'player')!=='player';
  const base=state.networkEnabled&&state.networkUrls?.length?state.networkUrls[0]:location.origin;$('controlLink').value=base+'/control#'+t.key;
}
const characterSettings=()=>action({type:'characters',enabled:$('charactersEnabled').checked,keepExplored:$('visibilityMode').value==='explored'});
$('charactersEnabled').onchange=run(characterSettings);$('visibilityMode').onchange=run(characterSettings);$('networkEnabled').onchange=run(()=>action({type:'network',enabled:$('networkEnabled').checked}));
$('tokens').onchange=()=>{selectedToken=$('tokens').value;updateCharacters();};
$('addToken').onclick=run(async()=>{const name=$('newTokenName').value.trim(),kind=$('newTokenKind').value;if(!name)throw Error('Enter a token name');await action({type:'token-add',token:{name,kind,visible:kind==='player',color:kind==='monster'?'#cf5050':kind==='npc'?'#44ad8a':'#6389df',radius:kind==='player'?6:0,x:map.width/2,y:map.height/2}});selectedToken=map.characters.tokens.at(-1).id;$('newTokenName').value='';updateCharacters();});
$('saveToken').onclick=run(()=>action({type:'token-update',id:selectedToken,token:{name:$('tokenName').value.trim(),color:$('tokenColor').value,radius:Number($('tokenRadius').value),visible:$('tokenVisible').checked,x:Number($('tokenX').value),y:Number($('tokenY').value)}}));
$('placeToken').onclick=()=>{$('tool').value='placeToken';$('tool').onchange();$('instructions').textContent='Click the map to place the selected character.';};
$('copyLink').onclick=run(async()=>{try{await navigator.clipboard.writeText($('controlLink').value);$('networkStatus').textContent='Private character link copied.';}catch{$('controlLink').focus();$('controlLink').select();throw Error('Copy the selected private link manually');}});
$('openControl').onclick=()=>window.open(location.origin+'/control#'+map.characters.tokens.find(t=>t.id===selectedToken).key,'character-'+selectedToken);
$('deleteToken').onclick=run(async()=>{if(await confirm('Remove this token?','Player control links are revoked when a character is removed. Saved character exploration is retained.'))await action({type:'token-delete',id:selectedToken});});
$('clearExploration').onclick=run(async()=>{if(await confirm('Clear character exploration?','This clears only character discovery history. Manual DM visibility stays intact, and current character radii remain visible. Export a backup first if you need this history.'))await action({type:'exploration-clear'});});
$('tokenArtwork').onchange=run(async()=>{const file=$('tokenArtwork').files[0],id=selectedToken,active=state.active;if(!file)return;try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('Choose a PNG, JPEG or WebP up to 8 MB');const url=URL.createObjectURL(file);let img;try{img=await loadImage(url);}finally{URL.revokeObjectURL(url);}if(img.width*img.height>40000000)throw Error('Artwork is too large');const size=Math.min(img.width,img.height),c=document.createElement('canvas');c.width=c.height=256;c.getContext('2d').drawImage(img,(img.width-size)/2,(img.height-size)/2,size,size,0,0,256,256);if(state.active!==active)throw Error('Map changed; select the token again');await action({type:'token-update',id,token:{artwork:c.toDataURL('image/png')}});}finally{$('tokenArtwork').value='';}});
$('removeArtwork').onclick=run(()=>action({type:'token-update',id:selectedToken,token:{artwork:null}}));
const compassSetting=()=>({enabled:$('compassEnabled').checked,rotation:Number($('compassRotation').value)});
$('applyCompass').onclick=run(()=>action({type:'compass',compass:compassSetting()}));
$('compassEnabled').onchange=run(()=>action({type:'compass',compass:compassSetting()}));
for(const [id,delta] of [['compassLeft',-15],['compassRight',15]])$(id).onclick=run(()=>{
  const c=compassSetting();if(!Number.isFinite(c.rotation)||c.rotation< -360||c.rotation>360)throw Error('Enter a compass angle between -360 and 360');
  c.rotation=((c.rotation+delta)%360+360)%360;$('compassRotation').value=c.rotation;
  return action({type:'compass',compass:c});
});
$('saveAtmosphere').onclick=run(()=>action({type:'atmosphere',atmosphere:{effect:$('atmosphereEffect').value,sound:$('atmosphereSound').value,volume:Number($('atmosphereVolume').value)}}));
window.addEventListener('message',async e=>{const frame=document.querySelector('iframe[title="DM dice roller"]');if(e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.type!=='shared-roll-request')return;try{const r=await fetch('/api/roll',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expression:e.data.expression,mode:e.data.mode}),signal:AbortSignal.timeout(8000)}),result=await r.json();if(!r.ok)throw Error(result.error);e.source.postMessage({type:'shared-roll-result',id:e.data.id,result},location.origin);}catch(err){e.source.postMessage({type:'shared-roll-result',id:e.data.id,error:err.message},location.origin);}});

async function tableInvite(request){const r=await fetch('/api/invite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});const result=await r.json();if(!r.ok)throw Error(result.error);}
$('showQR').onclick=run(()=>tableInvite({tokenId:selectedToken,mapId:state.active,base:$('inviteHost').value,layout:$('inviteLayout').value}));
$('showAllQR').onclick=run(()=>tableInvite({all:true,mapId:state.active,base:$('inviteHost').value,layout:$('inviteLayout').value}));
$('hideQR').onclick=run(()=>tableInvite({clear:true}));

// Placement edits live only in the DM preview until the gesture is committed.
function previewPlacement(view){document.querySelector('iframe[title="Exact player composition preview"]').contentWindow.postMessage({type:'table-placement-preview',mapId:map?.id,view},location.origin);}
function cancelPlacement(){clearTimeout(placementWheelTimer);placementWheelTimer=null;placementDrag=null;placementDraft=null;$('placementSurface').classList.remove('dragging');previewPlacement(null);}
function startPlacement(){if(!map||map.view.locked||busy)return false;if(placementDraft?.mapId!==map.id)placementDraft={mapId:map.id,view:{...map.view}};return true;}
function placementPoint(e){const r=$('placementSurface').getBoundingClientRect(),v=placementDraft?.view||map.view,ratio=Math.min(r.width/v.screenWidth,r.height/v.screenHeight);return {x:(e.clientX-r.left-(r.width-v.screenWidth*ratio)/2)/ratio,y:(e.clientY-r.top-(r.height-v.screenHeight*ratio)/2)/ratio};}
async function commitPlacement(){clearTimeout(placementWheelTimer);placementWheelTimer=null;const draft=placementDraft;placementDraft=null;placementDrag=null;$('placementSurface').classList.remove('dragging');if(!draft)return;try{if(map?.id!==draft.mapId||map.view.locked)throw Error('Map changed or placement was locked; adjustment canceled');await action({type:'view',view:draft.view});}finally{previewPlacement(null);}}
async function fitPlayerMap(best){cancelPlacement();if(!map||map.view.locked)throw Error('Unlock placement first');const s=state.tableScreens[0]||{width:map.view.screenWidth,height:map.view.screenHeight};await action({type:'view',view:fitTableView(map.width,map.height,s.width,s.height,map.view.rotation||0,best)});}
function resizePlacement(factor,anchor){if(!startPlacement())return;const v=placementDraft.view,p=anchor||{x:v.screenWidth/2,y:v.screenHeight/2},scale=Math.max(.01,Math.min(20,v.scale*factor));v.x=p.x-(p.x-v.x)*scale/v.scale;v.y=p.y-(p.y-v.y)*scale/v.scale;v.scale=scale;previewPlacement(v);}
$('bestFit').onclick=run(()=>fitPlayerMap(true));$('previewFit').onclick=run(()=>fitPlayerMap(false));
$('previewLock').onclick=run(async()=>{await commitPlacement();await $('lock').onclick();});
for(const [id,factor] of [['previewSmaller',1/1.1],['previewLarger',1.1]])$(id).onclick=run(async()=>{resizePlacement(factor);await commitPlacement();});
$('placementSurface').onpointerdown=e=>{if(e.button!==0||!startPlacement())return;e.preventDefault();clearTimeout(placementWheelTimer);placementWheelTimer=null;placementDrag={pointer:e.pointerId,start:placementPoint(e),view:{...placementDraft.view}};$('placementSurface').setPointerCapture(e.pointerId);$('placementSurface').classList.add('dragging');};
$('placementSurface').onpointermove=e=>{if(!placementDrag||e.pointerId!==placementDrag.pointer)return;const p=placementPoint(e);placementDraft.view.x=placementDrag.view.x+p.x-placementDrag.start.x;placementDraft.view.y=placementDrag.view.y+p.y-placementDrag.start.y;previewPlacement(placementDraft.view);};
$('placementSurface').onpointerup=run(commitPlacement);$('placementSurface').onpointercancel=cancelPlacement;
$('placementSurface').addEventListener('wheel',e=>{e.preventDefault();if(placementDrag||!startPlacement())return;resizePlacement(Math.exp(-e.deltaY*.001),placementPoint(e));clearTimeout(placementWheelTimer);placementWheelTimer=setTimeout(()=>commitPlacement().catch(error),250);},{passive:false});
window.addEventListener('keydown',e=>{if(e.key==='Escape')cancelPlacement();});

let displayBusy=false,displayStatus=null;
let displayTail=Promise.resolve();
const rememberDisplay=()=>{try{localStorage.setItem('tabletop-display-mode',$('displayMode').value);localStorage.setItem('tabletop-player-screens',JSON.stringify([$('playerScreenA').value,$('playerScreenB').value]));}catch{}};
try{if(localStorage.getItem('tabletop-display-mode')==='windows')$('displayMode').value='windows';}catch{}
function showDisplayStatus(status){
  displayStatus=status;
  const windows=$('displayMode').value==='windows';
  $('windowsDisplayOptions').hidden=!windows;$('open').textContent=windows?'Fill both table screens':'Open table display ↗';
  $('browserFallback').hidden=!windows;
  const available=status.supported&&status.installed;
  $('refreshDisplays').disabled=displayBusy||!available;
  $('fillScreens').disabled=displayBusy||!available||(status.displays||[]).filter(d=>!d.primary).length<2;
  $('closeWindowsDisplay').disabled=displayBusy||!status.running;
  $('playerScreenA').disabled=$('playerScreenB').disabled=displayBusy;
  let old=[$('playerScreenA').value,$('playerScreenB').value];
  try{if(!old[0]&&!old[1]){const saved=JSON.parse(localStorage.getItem('tabletop-player-screens')||'[]');if(Array.isArray(saved))old=saved;}}catch{}
  const players=(status.displays||[]).filter(d=>!d.primary).sort((a,b)=>a.bounds.y-b.bounds.y||a.bounds.x-b.bounds.x);
  for(const [index,id] of ['playerScreenA','playerScreenB'].entries()){
    $(id).replaceChildren(...players.map((d,i)=>{const option=document.createElement('option');option.value=d.id;const position=players.length===2?(players[0].bounds.x===players[1].bounds.x?(i===0?'Upper':'Lower'):(i===0?'First':'Second')):`Screen ${i+1}`;option.textContent=`${position} · ${d.label} · ${d.bounds.width} × ${d.bounds.height}${d.rotation===180?' · flipped':''}`;return option;}));
    $(id).value=players.some(d=>d.id===old[index])?old[index]:(players[index]?.id||'');
  }
  if(windows){
    $('displayStatus').textContent=!status.supported?'Windows display requires Windows. Browser display remains available.':!status.installed?'Optional component not installed. Run desktop/Install-Windows-Display.cmd once, then refresh this page. Browser display still works.':status.error|| (status.running?'Windows display is open. Escape or Close Windows display exits it.':players.length?'Choose two table screens and click Fill both table screens.':'Click Find connected screens to choose the two table monitors.');
  }else $('displayStatus').textContent=status.running?'Browser mode selected. Close the Windows display before opening the browser if it remains visible.':'Browser display · current method. Both methods use the same campaign.';
}
async function displayRequest(command){
  const response=await fetch('/api/display',command?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command,ids:[$('playerScreenA').value,$('playerScreenB').value]}),signal:AbortSignal.timeout(25000)}:{signal:AbortSignal.timeout(3000)});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Display unavailable');return result;
}
function changeDisplay(command){const task=displayTail.then(()=>performDisplayChange(command));displayTail=task.catch(()=>{});return task;}
async function performDisplayChange(command){
  if(command==='open'&&$('displayMode').value!=='windows')return displayStatus;
  displayBusy=true;if(displayStatus)showDisplayStatus(displayStatus);
  try{const result=await displayRequest(command);displayBusy=false;showDisplayStatus(result);return result;}
  catch(e){displayBusy=false;if(displayStatus)showDisplayStatus(displayStatus);$('displayStatus').textContent=e.message+' Browser display is still available.';throw e;}
}
$('displayMode').onchange=run(async()=>{
  rememberDisplay();
  if($('displayMode').value==='browser'){
    // Closing this optional process cannot change maps, fog, tokens or saved transforms.
    try{await changeDisplay('close');}finally{if(displayStatus)showDisplayStatus(displayStatus);}
  }else{const status=await changeDisplay();if($('displayMode').value==='windows'&&status.supported&&status.installed)await changeDisplay('discover');}
});
$('refreshDisplays').onclick=run(()=>changeDisplay('discover'));
$('fillScreens').onclick=run(async()=>{if(!displayStatus?.displays?.length)await changeDisplay('discover');rememberDisplay();await changeDisplay('open');});
$('closeWindowsDisplay').onclick=run(()=>changeDisplay('close'));
$('browserFallback').onclick=run(async()=>{
  window.open('/table','tabletop-player');$('displayMode').value='browser';rememberDisplay();await changeDisplay('close');
});
for(const id of ['playerScreenA','playerScreenB'])$(id).onchange=rememberDisplay;
// Browser is the initial default. Remember an explicit choice, without auto-opening a display.
displayRequest().then(showDisplayStatus).catch(()=>{$('displayStatus').textContent='Browser display remains available. Refresh to check the optional Windows component.';});
setInterval(()=>{if(!displayBusy&&$('displayMode').value==='windows'&&!['playerScreenA','playerScreenB'].includes(document.activeElement?.id))displayRequest().then(showDisplayStatus).catch(()=>{});},2000);
