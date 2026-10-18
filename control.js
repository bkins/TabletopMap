const $=id=>document.getElementById(id),key=location.hash.slice(1);let current=null,moving=false,polling=false,moveErrorUntil=0;
let profileDirty=false,profileSaving=false,avatarLoading=false,draftArtwork=undefined,avatarTicket=0;
const headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'};
function message(text){$('controlStatus').textContent=text;}
function buttons(){document.querySelectorAll('[data-direction]').forEach(b=>b.disabled=moving||profileSaving||!current?.enabled);profileButtons();}
function show(s){if(current&&s.revision<current.revision)return;current=s;if($('playerDice').dataset.character!==s.token.id){$('playerDice').dataset.character=s.token.id;$('playerDice').src='/dice/?scope=character-'+s.token.id;}$('characterName').textContent=s.token.name;$('controlMap').textContent=s.mapName;$('characterBadge').textContent=s.token.name.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();$('characterBadge').style.backgroundColor=s.token.color;$('characterBadge').style.backgroundImage=s.token.artwork?'url('+s.token.artwork+')':'none';$('characterBadge').style.backgroundSize='cover';$('characterBadge').style.backgroundPosition='center';if(s.token.artwork)$('characterBadge').textContent='';$('controlPosition').textContent=`Position: ${Math.round(s.token.x)}, ${Math.round(s.token.y)} · Reveal radius: ${s.token.radius} squares`;if(Date.now()>=moveErrorUntil)message(s.enabled?(s.blank?'Connected · table is blanked by the DM':'Connected · ready to move'):'Waiting for the DM to activate this map and character mode');renderProfile();buttons();}
async function refresh(){try{const r=await fetch('/api/control',{headers,signal:AbortSignal.timeout(3500),cache:'no-store'}),s=await r.json();if(!r.ok)throw Error(s.error);show(s);}catch(e){current=null;buttons();message(e.message||'Disconnected — retrying');}}
async function move(direction){if(moving||profileSaving||!current?.enabled)return;moving=true;moveErrorUntil=0;buttons();message('Moving…');try{const r=await fetch('/api/move',{method:'POST',headers,body:JSON.stringify({mapId:current.mapId,direction}),signal:AbortSignal.timeout(8000)}),s=await r.json();if(!r.ok)throw Error(s.error);show(s);}catch(e){await refresh();moveErrorUntil=Date.now()+4000;message(e.message);}finally{moving=false;buttons();}}
document.querySelectorAll('[data-direction]').forEach(b=>b.onclick=()=>move(b.dataset.direction));window.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select')||e.target.isContentEditable)return;const d={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[e.key];if(d){e.preventDefault();move(d);}});
setInterval(async()=>{if(moving||profileSaving||polling)return;polling=true;try{await refresh();}finally{polling=false;}},1000);buttons();refresh();
window.addEventListener('message',async e=>{if(e.origin!==location.origin||e.source!==$('playerDice').contentWindow||e.data?.type!=='shared-roll-request')return;try{if(!current?.enabled)throw Error('Wait for the DM to activate your character');const r=await fetch('/api/roll',{method:'POST',headers,body:JSON.stringify({mapId:current.mapId,expression:e.data.expression,mode:e.data.mode}),signal:AbortSignal.timeout(8000)}),result=await r.json();if(!r.ok)throw Error(result.error);e.source.postMessage({type:'shared-roll-result',id:e.data.id,result},location.origin);}catch(err){e.source.postMessage({type:'shared-roll-result',id:e.data.id,error:err.message},location.origin);}});

function profileButtons(){for(const id of ['profileName','profileAvatar','profileRemove','profileSave','profileCancel'])$(id).disabled=!current||profileSaving||avatarLoading;}
function renderProfile(){if(!current||profileDirty||profileSaving||avatarLoading)return;$('profileName').value=current.token.name;draftArtwork=undefined;previewAvatar(current.token.artwork);}
function previewAvatar(artwork){$('profilePreview').hidden=!artwork;if(artwork)$('profilePreview').src=artwork;else $('profilePreview').removeAttribute('src');}
$('profileName').oninput=()=>{profileDirty=true;$('profileStatus').textContent='Unsaved changes';};
$('profileRemove').onclick=()=>{avatarTicket++;draftArtwork=null;profileDirty=true;previewAvatar(null);$('profileAvatar').value='';$('profileStatus').textContent='Unsaved changes';};
$('profileCancel').onclick=()=>{avatarTicket++;profileDirty=false;draftArtwork=undefined;$('profileAvatar').value='';$('profileStatus').textContent='';renderProfile();};
$('profileAvatar').onchange=async()=>{
 const file=$('profileAvatar').files[0];if(!file)return;const ticket=++avatarTicket;avatarLoading=true;profileButtons();$('profileStatus').textContent='Preparing avatar…';
 try{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('Choose a PNG, JPEG or WebP up to 8 MB');
  const url=URL.createObjectURL(file),img=new Image();try{img.src=url;await img.decode();}finally{URL.revokeObjectURL(url);}
  if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>40000000)throw Error('Choose an image up to 40 megapixels');
  const size=Math.min(img.naturalWidth,img.naturalHeight),c=document.createElement('canvas');c.width=c.height=256;c.getContext('2d').drawImage(img,(img.naturalWidth-size)/2,(img.naturalHeight-size)/2,size,size,0,0,256,256);
  const artwork=c.toDataURL('image/png');if(artwork.length>400000)throw Error('Choose a simpler image for your avatar');
  if(ticket!==avatarTicket)return;draftArtwork=artwork;profileDirty=true;previewAvatar(artwork);$('profileStatus').textContent='Unsaved changes';
 }catch(e){$('profileStatus').textContent=e.message||'Could not read the avatar image';}finally{avatarLoading=false;$('profileAvatar').value='';profileButtons();}
};
$('profileForm').onsubmit=async e=>{
 e.preventDefault();if(!current||profileSaving||avatarLoading)return;const request={mapId:current.mapId,name:$('profileName').value.trim()};if(draftArtwork!==undefined)request.artwork=draftArtwork;
 if(!request.name){$('profileStatus').textContent='Enter a character name';return;}
 profileSaving=true;buttons();$('profileStatus').textContent='Saving…';
 try{const r=await fetch('/api/character',{method:'POST',headers,body:JSON.stringify(request),signal:AbortSignal.timeout(8000)}),s=await r.json();if(!r.ok)throw Error(s.error);profileDirty=false;draftArtwork=undefined;show(s);$('profileStatus').textContent='Character saved';}
 catch(e){$('profileStatus').textContent=e.message||'Could not save. Your changes are still here; try again.';}
 finally{profileSaving=false;renderProfile();buttons();}
};
