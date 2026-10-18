import {compose,loadImage,drawTable,loadTokenArt,drawCompass} from './render.js';
import {Atmosphere} from './ambience.js';
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),preview=new URLSearchParams(location.search).has('preview'),desktop=new URLSearchParams(location.search).has('desktop');let serial=0,lastPulse=0,ready=false,loading=false,recovering=false,composition=null,current=null,image=null,asset=null,seenRevision=-1;
const atmosphere=new Atmosphere(preview),rolls=document.createElement('div');rolls.id='sharedRolls';rolls.setAttribute('aria-live','polite');document.body.append(rolls);
const inviteCard=document.createElement('div');inviteCard.id='playerInvite';inviteCard.hidden=true;document.body.append(inviteCard);
let previewView=null;
window.addEventListener('message',e=>{
  if(!preview||parent===window||e.source!==parent||e.origin!==location.origin||e.data?.type!=='table-placement-preview')return;
  if(e.data.view===null){previewView=null;paint();return;}
  const v=e.data.view;
  if(current?.map?.id!==e.data.mapId||current.map.view.locked||!v||!Number.isFinite(v.x)||!Number.isFinite(v.y)||!Number.isFinite(v.scale)||v.scale<.01||v.scale>20)return;
  previewView={...current.map.view,...v};paint();
});
const clear=()=>{ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);if(!ready)inviteCard.hidden=true;if(!ready||current?.blank){atmosphere.active=false;atmosphere.sound();atmosphere.paint();rolls.replaceChildren();}};
const resize=()=>{canvas.width=innerWidth;canvas.height=innerHeight;clear();paint();atmosphere.resize();};
function paint(){clear();if(!ready||!current||current.blank||!composition)return;const v=preview&&previewView?previewView:current.map.view;if(preview){const ratio=Math.min(innerWidth/v.screenWidth,innerHeight/v.screenHeight);ctx.save();ctx.translate((innerWidth-v.screenWidth*ratio)/2,(innerHeight-v.screenHeight*ratio)/2);ctx.scale(ratio,ratio);ctx.beginPath();ctx.rect(0,0,v.screenWidth,v.screenHeight);ctx.clip();drawTable(ctx,composition,v,v.screenWidth,v.screenHeight);drawCompass(ctx,current.map.compass,v.screenWidth,v.screenHeight,v.rotation||0);ctx.restore();}else {drawTable(ctx,composition,v,innerWidth,innerHeight);drawCompass(ctx,current.map.compass,innerWidth,innerHeight,v.rotation||0);}}
async function accept(s){
  if(s.revision<seenRevision)return;seenRevision=s.revision;const ticket=++serial;ready=false;loading=true;clear();
  try{let next=null;if(s.map){let img=image;if(asset!==s.map.asset)img=await loadImage('/assets/'+s.map.asset);await loadTokenArt(s.map);if(ticket!==serial)return;next=compose(img,s.map);image=img;asset=s.map.asset;}
    if(ticket!==serial)return;if(s.map?.id!==current?.map?.id||s.map?.view.locked)previewView=null;composition=next;current=s;ready=true;paint();atmosphere.update(s,!s.blank&&!!s.map&&(preview||desktop||s.displayMode!=='windows'));showRolls();showInvite();
  }catch{if(ticket===serial){ready=false;clear();}}finally{if(ticket===serial)loading=false;}
}
const events=new EventSource('/api/events');events.onmessage=e=>{lastPulse=Date.now();accept(JSON.parse(e.data));};events.addEventListener('pulse',()=>{lastPulse=Date.now();});events.onerror=()=>{++serial;ready=false;loading=false;clear();};
setInterval(()=>{if(Date.now()-lastPulse>3000){++serial;ready=false;loading=false;clear();}},500);
// Some browsers suspend an existing SSE request while offline without reopening it.
// Fetch a fresh authoritative snapshot to recover; never reuse an old visible frame.
setInterval(async()=>{if(loading||recovering)return;recovering=true;try{const r=await fetch('/api/player',{cache:'no-store',signal:AbortSignal.timeout(2500)});if(!r.ok)throw Error('Disconnected');const s=await r.json();lastPulse=Date.now();if(!ready||s.revision!==current?.revision||s.blank!==current?.blank||s.displayMode!==current?.displayMode||s.rollSeq!==current?.rollSeq||s.inviteSeq!==current?.inviteSeq||!!s.invite!==!!current?.invite)await accept(s);}catch{++serial;ready=false;loading=false;clear();}finally{recovering=false;}},1000);
const id=crypto.randomUUID();async function heartbeat(){if(preview)return;try{await fetch('/api/heartbeat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,width:innerWidth,height:innerHeight,mode:desktop?'windows':'browser'})});}catch{ready=false;clear();}}
setInterval(heartbeat,1000);heartbeat();
window.addEventListener('resize',()=>{resize();heartbeat();});resize();
document.querySelector('#start').onclick=async()=>{try{await atmosphere.enable();document.querySelector('#soundToggle').textContent='Mute sound';}catch{}try{await document.documentElement.requestFullscreen();}catch{}};
if(preview||desktop)document.querySelector('#start').remove();
if(desktop&&!preview){const exit=document.createElement('button');exit.id='desktopExit';exit.textContent='Close display · Esc';exit.onclick=()=>window.close();document.body.append(exit);}
if(preview)document.querySelector('#soundToggle').remove();else document.querySelector('#soundToggle').onclick=async()=>{try{if(atmosphere.allowed){atmosphere.mute();document.querySelector('#soundToggle').textContent='Enable sound';}else{await atmosphere.enable();document.querySelector('#soundToggle').textContent='Mute sound';}}catch{document.querySelector('#soundToggle').textContent='Retry sound';}};
let rollSignature='';function showRolls(){const visible=ready&&!current?.blank?(current?.sharedRolls||[]).filter(r=>r.mapId===current?.map?.id&&r.expires>Date.now()):[],signature=visible.map(r=>r.id).join();if(signature===rollSignature&&rolls.childElementCount===visible.length)return;rollSignature=signature;rolls.replaceChildren(...visible.map(r=>{const card=document.createElement('div');card.className='shared-roll';const label=document.createElement('span');label.textContent=r.name+' · '+r.expression+(r.mode==='normal'?'':' · '+r.mode);const total=document.createElement('strong');total.textContent=r.total;const detail=document.createElement('small');detail.textContent=r.groups.map(g=>g.sides?'d'+g.sides+': '+g.values.join(', ')+(g.kept!==null?' → '+g.values[g.kept]+' kept':''):(g.sign<0?'−':'+')+g.modifier).join(' · ');card.append(label,total,detail);return card;}));}setInterval(showRolls,250);
// The table accepts no zoom, pan, wheel, or editing input, even while unlocked.
window.addEventListener('wheel',e=>e.preventDefault(),{passive:false});window.addEventListener('keydown',e=>{if(['+','-','=','0'].includes(e.key)&&(e.ctrlKey||e.metaKey))e.preventDefault();});
window.__tableDebug=()=>({ready,revision:current?.revision,blank:current?.blank,connected:Date.now()-lastPulse<3000,atmosphere:{active:atmosphere.active,effect:atmosphere.setting.effect,sound:atmosphere.soundType||'none',allowed:atmosphere.allowed,preview},rolls:rolls.childElementCount});

let inviteSignature='';function showInvite(){
  const invite=ready&&!current?.blank&&current?.invite?.expires>Date.now()?current.invite:null;
  if(!invite){inviteCard.hidden=true;inviteSignature='';return;}
  if(preview&&current?.map){
    const v=current.map.view,ratio=Math.min(innerWidth/v.screenWidth,innerHeight/v.screenHeight);
    inviteCard.style.width=v.screenWidth+'px';inviteCard.style.height=v.screenHeight+'px';
    inviteCard.style.transformOrigin='top left';inviteCard.style.transform=`translate(${(innerWidth-v.screenWidth*ratio)/2}px,${(innerHeight-v.screenHeight*ratio)/2}px) scale(${ratio})`;
    inviteCard.style.setProperty('--qr-width',v.screenWidth+'px');inviteCard.style.setProperty('--qr-height',v.screenHeight+'px');
  }
  const cards=invite.cards||[invite],layout=invite.layout||'center',signature=JSON.stringify([cards,layout]);
  if(signature!==inviteSignature){
    inviteSignature=signature;inviteCard.className=layout+(cards.length===1?' single':'');
    const rows=layout==='sides'?2:Math.ceil(cards.length/2),columns=Math.max(2,Math.ceil(cards.length/2));
    inviteCard.style.setProperty('--rows',rows);
    inviteCard.style.setProperty('--columns',columns);
    inviteCard.replaceChildren(...cards.map((card,index)=>{
      const tile=document.createElement('section');tile.className='invite-tile';
      if(layout==='sides'){
        const slot=Math.floor(index/2),column=slot%2===0?slot/2+1:columns-Math.floor(slot/2);
        tile.style.gridColumn=String(cards.length===2&&index===1?columns:column);tile.style.gridRow=String(index%2+1);
        tile.style.alignSelf=index%2===0?'start':'end';
        const actualColumn=Number(tile.style.gridColumn);tile.style.justifySelf=actualColumn===1?'start':actualColumn===columns?'end':'center';
      }
      const heading=document.createElement('h2');heading.textContent=card.name+' · scan to join';
      const image=document.createElement('img');image.alt='QR code for '+card.name+' private player controls';image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(card.svg);
      const hint=document.createElement('p');hint.textContent='Phone camera · same Wi-Fi';
      tile.append(heading,image,hint);return tile;
    }));
  }
  inviteCard.hidden=false;
}setInterval(showInvite,250);
