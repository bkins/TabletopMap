(function(root) {
  'use strict';
  const dot = (a,b) => a.reduce((sum,v,i) => sum + v*b[i],0);
  const sub = (a,b) => a.map((v,i) => v-b[i]);
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit = a => { const length = Math.hypot(...a); return a.map(v => v/length); };
  function hull(vertices) {
    const faces = []; const seen = new Set();
    for(let i=0;i<vertices.length;i++) for(let j=i+1;j<vertices.length;j++) for(let k=j+1;k<vertices.length;k++) {
      let normal = cross(sub(vertices[j],vertices[i]),sub(vertices[k],vertices[i]));
      if(Math.hypot(...normal)<1e-7) continue;
      normal = unit(normal);
      let distance = dot(normal,vertices[i]);
      const offsets = vertices.map(v => dot(normal,v)-distance);
      if(offsets.some(v=>v>1e-6) && offsets.some(v=>v< -1e-6)) continue;
      if(distance<0) { normal=normal.map(v=>-v); distance=-distance; }
      const indices = vertices.map((v,n)=>Math.abs(dot(normal,v)-distance)<1e-6?n:-1).filter(n=>n>=0);
      const key = indices.join(','); if(seen.has(key)) continue; seen.add(key);
      const center = [0,1,2].map(axis=>indices.reduce((sum,n)=>sum+vertices[n][axis],0)/indices.length);
      const u = unit(sub(vertices[indices[0]],center)); const v = cross(normal,u);
      indices.sort((a,b)=>Math.atan2(dot(sub(vertices[a],center),v),dot(sub(vertices[a],center),u))-Math.atan2(dot(sub(vertices[b],center),v),dot(sub(vertices[b],center),u)));
      faces.push({indices,normal,center});
    }
    return faces;
  }
  const cache = new Map();
  function mesh(sides) {
    const key = sides === 100 ? 10 : [4,6,8,10,12,20].includes(sides) ? sides : 20;
    if(cache.has(key)) return cache.get(key);
    const phi = (1+Math.sqrt(5))/2;
    let vertices=[];
    if(key===4) vertices=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]];
    if(key===6 || key===12) for(const x of [-1,1]) for(const y of [-1,1]) for(const z of [-1,1]) vertices.push([x,y,z]);
    if(key===8) vertices=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    if(key===12 || key===20) for(const a of [-1,1]) for(const b of [-1,1]) {
      const p = key===12 ? [0,a/phi,b*phi] : [0,a,b*phi];
      vertices.push(p,[p[2],p[0],p[1]],[p[1],p[2],p[0]]);
    }
    if(key===10) {
      // The dual of a pentagonal antiprism has ten kite-shaped faces.
      const antiprism=[];
      for(let i=0;i<10;i++) { const angle=i*Math.PI/5; antiprism.push([Math.cos(angle),Math.sin(angle),i%2 ? -.55 : .55]); }
      vertices=hull(antiprism).map(face=>face.normal.map(n=>n/dot(face.normal,face.center)));
    }
    const radius=Math.max(...vertices.map(v=>Math.hypot(...v)));
    vertices=vertices.map(v=>v.map(n=>n/radius));
    const result={vertices,faces:hull(vertices)}; cache.set(key,result); return result;
  }
  function rotate(point, angle) {
    let [x,y,z]=point;
    let c=Math.cos(angle[0]),s=Math.sin(angle[0]); [y,z]=[y*c-z*s,y*s+z*c];
    c=Math.cos(angle[1]);s=Math.sin(angle[1]);[x,z]=[x*c+z*s,-x*s+z*c];
    c=Math.cos(angle[2]);s=Math.sin(angle[2]);return [x*c-y*s,x*s+y*c,z];
  }
  function create(sides,value) {
    const canvas=document.createElement('canvas'); canvas.className='solid-die'; canvas.setAttribute('aria-hidden','true');
    canvas.width=240;canvas.height=240;
    const context=canvas.getContext('2d'); const geometry=mesh(sides);
    function draw(angle=[.35,.45,.15], faceValue=value, lift=0) {
      const ctx=context;ctx.clearRect(0,0,240,240);
      const points=geometry.vertices.map(v=>rotate(v,angle));
      const project=([x,y,z])=>[120+x*82*3.8/(3.8-z),112+y*82*3.8/(3.8-z)-lift];
      ctx.save();ctx.translate(120,213);ctx.scale(1,.22); const shadow=ctx.createRadialGradient(0,0,0,0,0,75);shadow.addColorStop(0,'#0008');shadow.addColorStop(1,'#0000');ctx.fillStyle=shadow;ctx.beginPath();ctx.arc(0,0,75,0,Math.PI*2);ctx.fill();ctx.restore();
      const faces=geometry.faces.map(face=>({...face,normal:rotate(face.normal,angle),center:rotate(face.center,angle)})).filter(face=>dot(face.normal,sub([0,0,3.8],face.center))>0).sort((a,b)=>a.center[2]-b.center[2]);
      const front=faces.reduce((best,face)=>!best || face.normal[2]>best.normal[2]?face:best,null);
      faces.forEach((face,index)=> {
        const polygon=face.indices.map(n=>project(points[n]));
        const light=Math.max(0,dot(face.normal,unit([-.6,-.8,1.5])));
        ctx.beginPath();polygon.forEach(([x,y],n)=>n?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
        const gradient=ctx.createLinearGradient(40,20,190,200);gradient.addColorStop(0,`rgb(${65+light*110},${42+light*85},${98+light*125})`);gradient.addColorStop(1,`rgb(${35+light*65},${23+light*47},${58+light*86})`);
        ctx.fillStyle=gradient;ctx.fill();ctx.strokeStyle=`rgba(218,186,255,${.2+light*.45})`;ctx.lineWidth=1.6;ctx.stroke();
        if(face===front) {
          const [x,y]=project(face.center);ctx.fillStyle='#f4e8ff';ctx.font=`700 ${String(faceValue).length>2?25:32}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='#170921';ctx.shadowBlur=5;ctx.fillText(String(faceValue),x,y);ctx.shadowBlur=0;
        }
      });
    }
    draw();return {canvas,draw};
  }
  root.Arcana3D={create,mesh};
  if(typeof module!=='undefined') module.exports=root.Arcana3D;
})(globalThis);
