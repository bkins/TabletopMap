function combinedBounds(displays,ids){
  if(!Array.isArray(ids)||ids.length!==2||new Set(ids.map(String)).size!==2)throw Error('Choose two different player screens');
  const selected=ids.map(id=>displays.find(d=>String(d.id)===String(id)));
  if(selected.some(d=>!d))throw Error('A selected screen is no longer connected. Refresh the screen list');
  if(selected.some(d=>d.primary))throw Error('Keep the main DM screen available; choose the two other screens');
  if(Math.abs(selected[0].scaleFactor-selected[1].scaleFactor)>.001)throw Error('The player screens need the same Windows display scaling. Use Browser display until their scales match');
  const [a,b]=selected.map(d=>d.bounds),near=(a,b)=>Math.abs(a-b)<=1;
  const vertical=near(a.x,b.x)&&near(a.width,b.width)&&(near(a.y+a.height,b.y)||near(b.y+b.height,a.y));
  const horizontal=near(a.y,b.y)&&near(a.height,b.height)&&(near(a.x+a.width,b.x)||near(b.x+b.width,a.x));
  if(!vertical&&!horizontal)throw Error('Align the two player screens edge to edge in Windows Display Settings, without a gap. Browser display remains available');
  const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);
  return {x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y};
}
module.exports={combinedBounds};
