export function shape(ctx,op){
  const p=op.points;if(op.type==='all'){ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);return;}
  ctx.beginPath();
  if(op.type==='rectangle'){ctx.rect(p[0][0],p[0][1],p[1][0]-p[0][0],p[1][1]-p[0][1]);ctx.fill();}
  if(op.type==='polygon'){ctx.moveTo(...p[0]);for(const point of p.slice(1))ctx.lineTo(...point);ctx.closePath();ctx.fill();}
  if(op.type==='brush'){ctx.lineWidth=op.size;ctx.lineCap='round';ctx.lineJoin='round';ctx.moveTo(...p[0]);for(const point of p.slice(1))ctx.lineTo(...point);ctx.stroke();ctx.beginPath();ctx.arc(...p[0],op.size/2,0,Math.PI*2);ctx.fill();}
}
export function compose(image,map,ops=map.ops){
  const c=document.createElement('canvas');c.width=map.width;c.height=map.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0,c.width,c.height);
  if(map.grid.overlay){const g=map.grid;ctx.strokeStyle='rgba(230,240,255,.45)';ctx.lineWidth=1;ctx.beginPath();for(let x=((g.x%g.pixels)+g.pixels)%g.pixels;x<c.width;x+=g.pixels){ctx.moveTo(x,0);ctx.lineTo(x,c.height);}for(let y=((g.y%g.pixels)+g.pixels)%g.pixels;y<c.height;y+=g.pixels){ctx.moveTo(0,y);ctx.lineTo(c.width,y);}ctx.stroke();}
  const fog=document.createElement('canvas');fog.width=c.width;fog.height=c.height;const f=fog.getContext('2d');f.fillStyle='#000';f.fillRect(0,0,c.width,c.height);
  const characters=map.characters;
  if(characters?.enabled&&characters.keepExplored){f.globalCompositeOperation='destination-out';for(const p of characters.explored||[]){f.beginPath();f.arc(p.x,p.y,p.radius,0,Math.PI*2);f.fill();}}
  for(const op of ops){f.globalCompositeOperation=op.reveal?'destination-out':'source-over';shape(f,op);}
  if(characters?.enabled){f.globalCompositeOperation='destination-out';for(const t of characters.tokens.filter(t=>(t.kind||'player')==='player'&&t.visible!==false)){f.beginPath();f.arc(t.x,t.y,t.radius*map.grid.pixels,0,Math.PI*2);f.fill();}}
  drawTokens(ctx,map,{group:'encounters'});ctx.drawImage(fog,0,0);if(characters?.enabled)drawTokens(ctx,map,{group:'players'});return c;
}
const artCache=new Map();
export async function loadTokenArt(map){await Promise.all((map.characters?.tokens||[]).filter(t=>t.artwork&&!artCache.has(t.artwork)).map(async t=>{try{artCache.set(t.artwork,await loadImage(t.artwork));}catch{artCache.set(t.artwork,null);}}));}
export function drawTokens(ctx,map,{group='all',dm=false}={}){for(const t of map.characters?.tokens||[]){const player=(t.kind||'player')==='player';if(!dm&&t.visible===false||group==='players'&&!player||group==='encounters'&&player)continue;const r=map.grid.pixels*.38;ctx.save();ctx.translate(t.x,t.y);if(t.visible===false)ctx.globalAlpha=.65;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle=t.color;ctx.fill();const art=artCache.get(t.artwork);if(art){ctx.save();ctx.clip();const size=Math.min(art.width,art.height);ctx.drawImage(art,(art.width-size)/2,(art.height-size)/2,size,size,-r,-r,r*2,r*2);ctx.restore();}ctx.strokeStyle=t.visible===false?'#ffc773':'#fff';ctx.lineWidth=r*.08;if(t.visible===false)ctx.setLineDash([r*.2,r*.15]);ctx.stroke();if(!art){ctx.fillStyle='#fff';ctx.font=`bold ${r*.8}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t.name.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase(),0,0);}ctx.restore();}}
export function loadImage(url){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Map image could not be loaded'));i.src=url;});}
export function rotatedBounds(width,height,degrees=0){const radians=degrees*Math.PI/180,c=Math.abs(Math.cos(radians)),s=Math.abs(Math.sin(radians));return {width:width*c+height*s,height:width*s+height*c};}
export function fitTableView(width,height,screenWidth,screenHeight,rotation=0,bestOrientation=false){
  const fit=angle=>{const bounds=rotatedBounds(width,height,angle),scale=Math.min(20,Math.max(.01,Math.min(screenWidth/bounds.width,screenHeight/bounds.height)));return {scale,x:(screenWidth-bounds.width*scale)/2,y:(screenHeight-bounds.height*scale)/2,rotation:((angle%360)+360)%360,screenWidth,screenHeight};};
  const current=fit(rotation),turned=fit(rotation-90);
  return bestOrientation&&turned.scale>current.scale+1e-8?turned:current;
}
// A screen overlay: map zoom and panning never change its size or position.
export function drawCompass(ctx,compass,width,height,mapRotation=0){
  if(!compass?.enabled)return;
  const radius=Math.min(58,width*.16,height*.16),margin=Math.min(20,width*.04,height*.04);
  ctx.save();ctx.translate(width-radius-margin,radius+margin);
  ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fillStyle='rgba(9,14,22,.88)';ctx.fill();ctx.strokeStyle='#d6bd85';ctx.lineWidth=2;ctx.stroke();
  ctx.rotate((compass.rotation+mapRotation)*Math.PI/180);
  for(let i=0;i<4;i++){
    ctx.save();ctx.rotate(i*Math.PI/2);ctx.beginPath();ctx.moveTo(0,-radius*.62);ctx.lineTo(radius*.12,0);ctx.lineTo(0,radius*.17);ctx.lineTo(-radius*.12,0);ctx.closePath();ctx.fillStyle=i===0?'#ffc773':'#a9b8ce';ctx.fill();ctx.restore();
  }
  // Cardinal letters stay upright while their positions follow the compass rose.
  ctx.font=`bold ${radius*.26}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';
  for(const [i,label] of ['N','E','S','W'].entries()){
    const angle=i*Math.PI/2,x=Math.sin(angle)*radius*.8,y=-Math.cos(angle)*radius*.8;
    ctx.save();ctx.translate(x,y);ctx.rotate(-(compass.rotation+mapRotation)*Math.PI/180);ctx.fillStyle=i===0?'#ffc773':'#fff';ctx.fillText(label,0,0);ctx.restore();
  }
  ctx.restore();
}
export function drawTable(ctx,composition,view,width,height,clearBackground=true){if(clearBackground){ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);}ctx.save();ctx.translate(view.x,view.y);ctx.scale(view.scale,view.scale);const angle=view.rotation||0,bounds=rotatedBounds(composition.width,composition.height,angle);ctx.translate(bounds.width/2,bounds.height/2);ctx.rotate(angle*Math.PI/180);ctx.translate(-composition.width/2,-composition.height/2);ctx.drawImage(composition,0,0);ctx.restore();}
export function visibilityMask(map){const c=document.createElement('canvas'),ratio=Math.min(1,1024/Math.max(map.width,map.height));c.width=Math.ceil(map.width*ratio);c.height=Math.ceil(map.height*ratio);const x=c.getContext('2d');x.scale(ratio,ratio);x.fillStyle='#fff';const characters=map.characters;
  const circle=p=>{x.beginPath();x.arc(p.x,p.y,p.radius,0,Math.PI*2);x.fill();};
  if(characters?.enabled&&characters.keepExplored)for(const p of characters.explored||[])circle(p);
  for(const op of map.ops){x.globalCompositeOperation=op.reveal?'source-over':'destination-out';if(op.type==='all')x.fillRect(0,0,map.width,map.height);else shape(x,op);}
  x.globalCompositeOperation='source-over';if(characters?.enabled)for(const t of characters.tokens.filter(t=>(t.kind||'player')==='player'&&t.visible!==false))circle({...t,radius:t.radius*map.grid.pixels});return c;
}
