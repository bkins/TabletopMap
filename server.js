import {registerImport} from './campaigns.js';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,randomBytes} from 'node:crypto';
import {networkInterfaces} from 'node:os';
import {spawn} from 'node:child_process';
import {Store} from './store.js';
import {mutate,playerState} from './model.js';
import {moveCharacter,controllerState,characterDefaults,customizeCharacter} from './characters.js';
import './dice/dice.js';
import {atmosphereDefaults,compassDefaults} from './extras.js';
import qrcode from './vendor/qrcode.cjs';
import {DisplayManager} from './display-manager.js';
export async function start({port=Number(process.env.PORT||5180),dir=process.env.TABLETOP_DATA||path.join(path.dirname(fileURLToPath(import.meta.url)),'data'),displayManager=new DisplayManager()}={}) {
  const store=new Store(dir);await store.open();const clients=new Set(),screens=new Map();let queue=Promise.resolve(),panic=false,panicEpoch=0;
  const serialize=fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;};
  let sharedRolls=[],rollSeq=0;const rollTimes=new Map();
  let invite=null,inviteSeq=0;
  const activeInvite=()=>{
    if(!invite)return null;
    const m=store.state.maps[store.state.active];
    if(invite.expires<=Date.now()||panic||store.state.blank||!store.state.networkEnabled||store.state.active!==invite.mapId||!m?.characters?.enabled){invite=null;inviteSeq++;return null;}
    const cards=invite.cards.flatMap(card=>{const t=m.characters.tokens.find(t=>t.id===card.tokenId);return t&&t.visible!==false&&(t.kind||'player')==='player'?[{...card,name:t.name}]:[];});
    if(cards.length!==invite.cards.length){invite.cards=cards;inviteSeq++;}
    if(!cards.length){invite=null;return null;}
    const publicCards=cards.map(({tokenId,...card})=>card);
    return {expires:invite.expires,layout:invite.layout,cards:publicCards,...(publicCards.length===1?publicCards[0]:{})};
  };
  const snapshot=()=>({...playerState(store.state),blank:panic||store.state.blank,displayMode:displayManager.status().running?'windows':'browser',invite:activeInvite(),inviteSeq,rollSeq,sharedRolls:sharedRolls.filter(r=>r.expires>Date.now())});
  const publish=()=>{for(const res of clients)res.write('data: '+JSON.stringify(snapshot())+'\n\n');};
  const json=(res,data,code=200)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  async function body(req){let chunks=[],size=0;for await(const c of req){size+=c.length;if(size>40*1024*1024)throw Error('Map exceeds 40 MB');chunks.push(c);}return Buffer.concat(chunks);}
  const server=http.createServer(async(req,res)=>{
    try{
      const local=req.socket.remoteAddress==='127.0.0.1'||req.socket.remoteAddress==='::1'||req.socket.remoteAddress==='::ffff:127.0.0.1';
      const ips=Object.values(networkInterfaces()).flat().filter(i=>i.family==='IPv4'&&!i.internal).map(i=>i.address);
      const host=(req.headers.host||'').split(':')[0];if(!['localhost','127.0.0.1',...ips].includes(host))return json(res,{error:'Invalid host'},403);
      if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return json(res,{error:'Invalid origin'},403);
      const url=new URL(req.url,'http://localhost');
      const diceFiles=['index.html','app.js','dice.js','dice3d.js','styles.css'];
      const diceName=url.pathname==='/dice/'?'index.html':url.pathname.startsWith('/dice/')?url.pathname.slice(6):null;
      const isDice=diceName!==null&&diceFiles.includes(diceName);
      const phoneRoutes=['/control','/control.html','/control.js','/styles.css','/api/control','/api/move','/api/roll','/api/character'];
      if(!local&&(!store.state.networkEnabled||(!phoneRoutes.includes(url.pathname)&&!isDice)))return json(res,{error:'Only assigned player controls are available over Wi-Fi'},403);
      if(url.pathname==='/api/display'){
        if(req.method==='GET')return json(res,displayManager.status());
        if(req.method!=='POST')return json(res,{error:'Invalid method'},405);
        const request=JSON.parse((await body(req)).toString());
        if(!['discover','open','close'].includes(request.command))throw Error('Unknown display command');
        const result=await displayManager.command(request.command,{ids:request.ids,origin:`http://127.0.0.1:${server.address().port}`});
        publish();
        return json(res,result);
      }
      if(url.pathname==='/api/invite'&&req.method==='POST'){
        const request=JSON.parse((await body(req)).toString());
        if(request.clear){invite=null;inviteSeq++;publish();return json(res,{ok:true});}
        const m=store.state.maps[store.state.active];
        const tokens=m?.characters?.tokens.filter(t=>(request.all||t.id===request.tokenId)&&t.visible!==false&&(t.kind||'player')==='player')||[];
        if(!store.state.networkEnabled)throw Error('Enable player controls on Wi-Fi first');
        if(request.mapId!==store.state.active||!m?.characters?.enabled||!tokens.length)throw Error('Select an active, visible player character with digital minis enabled');
        if(request.layout!==undefined&&!['center','sides'].includes(request.layout))throw Error('Choose center or sides for QR placement');
        if(panic||store.state.blank)throw Error('Show the table before displaying QR codes');
        const bases=ips.map(ip=>`http://${ip}:${server.address().port}`);
        if(!bases.includes(request.base))throw Error('Choose this computer’s Wi-Fi address');
        const cards=tokens.map(t=>{const qr=qrcode(0,'M');qr.addData(request.base+'/control#'+t.key);qr.make();return {tokenId:t.id,svg:qr.createSvgTag({cellSize:8,margin:32,scalable:true})};});
        invite={cards,mapId:m.id,layout:request.layout||(request.all?'sides':'center'),expires:Date.now()+120000};inviteSeq++;publish();return json(res,{ok:true});
      }
      if(url.pathname==='/api/roll'&&req.method==='POST'){
        const request=JSON.parse((await body(req)).toString());let name='DM',owner='dm';
        const key=(req.headers.authorization||'').replace(/^Bearer /,'');
        if(!local||key){const own=controllerState(store.state,key);if(!own.enabled||own.mapId!==request.mapId)throw Error('Wait for your character to be active before sharing a roll');name=own.token.name;owner=own.token.id;}
        else if(!store.state.active)throw Error('Import a map first');
        if(typeof request.expression!=='string'||request.expression.length>200)throw Error('Invalid roll expression');
        const now=Date.now();if(now-(rollTimes.get(owner)||0)<1000)throw Error('Wait a moment before sharing another roll');
        const result=globalThis.ArcanaDice.roll(request.expression,request.mode);rollTimes.set(owner,now);
        sharedRolls=sharedRolls.filter(r=>r.expires>now);sharedRolls.push({...result,id:randomUUID(),name,mapId:store.state.active,expires:now+12000});sharedRolls=sharedRolls.slice(-3);rollSeq++;publish();return json(res,result);
      }
      if(url.pathname==='/api/control'||url.pathname==='/api/move'||url.pathname==='/api/character'){
        const key=(req.headers.authorization||'').replace(/^Bearer /,'');if(!/^[a-f0-9]{48}$/.test(key))return json(res,{error:'Open the private character link from your DM'},401);
        if(url.pathname==='/api/control'&&req.method==='GET')return json(res,controllerState(store.state,key));
        if(url.pathname==='/api/character'&&req.method==='POST'){
          const request=JSON.parse((await body(req)).toString());await serialize(async()=>{const next=customizeCharacter(store.state,key,request);if(panic)next.blank=true;await store.save(next);publish();});return json(res,controllerState(store.state,key));
        }
        if(url.pathname==='/api/move'&&req.method==='POST'){
          const request=JSON.parse((await body(req)).toString());await serialize(async()=>{const next=moveCharacter(store.state,key,request);if(panic)next.blank=true;await store.save(next);publish();});return json(res,controllerState(store.state,key));
        }return json(res,{error:'Invalid method'},405);
      }
      if(url.pathname==='/api/state'){
        const desktopRunning=displayManager.status().running;
        const tableScreens=[...screens.values()].filter(s=>Date.now()-s.seen<3500&&(s.mode!=='windows'||desktopRunning)).sort((a,b)=>Number(b.mode==='windows')-Number(a.mode==='windows'));
        return json(res,{...store.state,active:store.state.workspace.selected,published:store.state.active,blank:panic||store.state.blank,networkUrls:ips.map(ip=>`http://${ip}:${server.address().port}`),tableScreens});
      }
      if(url.pathname==='/api/player')return json(res,snapshot());
      if(url.pathname==='/api/events'){
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive'});res.write('data: '+JSON.stringify(snapshot())+'\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return;
      }
      if(req.method==='POST'&&url.pathname==='/api/heartbeat'){
        const s=JSON.parse((await body(req)).toString());if(typeof s.id!=='string'||!Number.isFinite(s.width)||!Number.isFinite(s.height))throw Error('Invalid screen');screens.set(s.id,{width:s.width,height:s.height,mode:s.mode==='windows'?'windows':'browser',seen:Date.now()});return json(res,{ok:true});
      }
      if(req.method==='POST'&&url.pathname==='/api/action'){
        const a=JSON.parse((await body(req)).toString());const emergency=a.type==='blank'&&a.value===true;
        if(a.type==='token-add')a.token={...a.token,id:randomUUID(),key:randomBytes(24).toString('hex')};
        // Emergency blank publishes immediately, including during a pending disk save.
        // It remains fail-closed if persistence fails; only an explicit successful Show clears it.
        if(emergency){panic=true;panicEpoch++;invite=null;inviteSeq++;publish();}const acceptedPanicEpoch=panicEpoch;
        await serialize(async()=>{
          if(!emergency&&a.revision!==store.state.revision)throw Error('Session changed. Refresh controls and retry.');
          const next=mutate(store.state,a);const showing=a.type==='blank'||a.type==='publish';if(panic&&(!showing||acceptedPanicEpoch!==panicEpoch))next.blank=true;
          await store.save(next);if(['campaign-create','campaign-select'].includes(a.type)){sharedRolls=[];rollSeq++;rollTimes.clear();invite=null;inviteSeq++;}if((a.type==='blank'||a.type==='publish')&&acceptedPanicEpoch===panicEpoch)panic=false;publish();
        });return json(res,{ok:true});
      }
      if(req.method==='POST'&&url.pathname==='/api/import'){
        const bytes=await body(req),meta=JSON.parse(decodeURIComponent(req.headers['x-map-meta']||''));
        const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
        if(!png&&!jpg)throw Error('Choose a PNG or JPEG image');
        if(!Number.isInteger(meta.width)||!Number.isInteger(meta.height)||meta.width<1||meta.height<1||meta.width>12000||meta.height>12000||meta.width*meta.height>40000000)throw Error('Map must be at most 40 megapixels and 12,000 pixels per side');
        await serialize(async()=>{const id=randomUUID(),asset=id+(png?'.png':'.jpg');await fs.writeFile(path.join(dir,asset),bytes);const next=structuredClone(store.state);
          const imported={id,name:String(meta.name||'Untitled map').slice(0,120),asset,width:meta.width,height:meta.height,ops:[],cursor:0,grid:{pixels:100,x:0,y:0,overlay:false},characters:characterDefaults(),atmosphere:atmosphereDefaults(),compass:compassDefaults(),view:{x:0,y:0,scale:0.96,rotation:0,ppi:96,squareInches:1,locked:true,screenWidth:1920,screenHeight:1080}};registerImport(next,imported);next.revision++;await store.save(next);publish();
        });return json(res,{ok:true});
      }
      if(url.pathname==='/api/backup'){
        return await serialize(async()=>{const assets={};for(const m of Object.values(store.state.maps))assets[m.asset]=(await fs.readFile(path.join(dir,m.asset))).toString('base64');res.writeHead(200,{'Content-Type':'application/json','Content-Disposition':'attachment; filename="tabletop-session-backup.json"','Cache-Control':'no-store'});res.end(JSON.stringify({format:1,state:store.state,assets}));});
      }
      let file, type;
      if(isDice){file=path.join(path.dirname(fileURLToPath(import.meta.url)),'dice',diceName);type=diceName.endsWith('.html')?'text/html':diceName.endsWith('.css')?'text/css':'text/javascript';}
      else if(url.pathname.startsWith('/assets/')){const asset=url.pathname.slice(8);if(!/^[a-f0-9-]+\.(png|jpg)$/.test(asset))throw Error('Invalid asset');file=path.join(dir,asset);type=asset.endsWith('.png')?'image/png':'image/jpeg';}
      else {const name=url.pathname==='/control'?'control.html':url.pathname==='/table'?'table.html':url.pathname==='/'?'index.html':url.pathname.slice(1);if(!['index.html','table.html','control.html','control.js','app.js','table.js','render.js','ambience.js','styles.css'].includes(name))return json(res,{error:'Not found'},404);file=path.join(path.dirname(fileURLToPath(import.meta.url)),name);type=name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'text/javascript';}
      const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);
    }catch(e){json(res,{error:e.message},400);}
  });
  const timer=setInterval(()=>{for(const res of clients)res.write('event: pulse\ndata: {}\n\n');for(const [id,s] of screens)if(Date.now()-s.seen>10000)screens.delete(id);},1000);
  server.on('close',()=>{clearInterval(timer);displayManager.stop();});await new Promise((resolve,reject)=>{server.once('error',e=>{clearInterval(timer);reject(e);});server.listen(port,'0.0.0.0',resolve);});return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))start().then(s=>{const url=`http://localhost:${s.address().port}`;console.log(`Tabletop Map: ${url}\nKeep this terminal open. Table display: /table`);if(process.argv.includes('--open')&&process.platform==='win32')spawn('explorer.exe',[url],{windowsHide:true});}).catch(e=>{console.error(e.message);process.exitCode=1;});
