const {app,BrowserWindow,screen,session}=require('electron');
const readline=require('node:readline');
const net=require('node:net');
const {combinedBounds}=require('./geometry.cjs');
const originArg=process.argv.find(a=>a.startsWith('--tabletop-origin='));
const origin=new URL(originArg?.slice('--tabletop-origin='.length)||'http://127.0.0.1:5180');
if(origin.protocol!=='http:'||origin.hostname!=='127.0.0.1'||origin.pathname!=='/'||origin.username||origin.password)throw Error('Only the local Tabletop server is supported');
const playerUrl=origin.origin+'/table?desktop';
app.setName('Tabletop Player Display');
let player=null,selectedIds=[],quitting=false;
let control;
const emit=data=>{if(control&&!control.destroyed)control.write(JSON.stringify(data)+'\n');};
const displays=()=>screen.getAllDisplays().map((d,index)=>({id:String(d.id),label:d.label||`Screen ${index+1}`,primary:d.id===screen.getPrimaryDisplay().id,bounds:d.bounds,scaleFactor:d.scaleFactor,rotation:d.rotation}));
const status=()=>({running:!!player&&!player.isDestroyed(),selectedIds,bounds:player&&!player.isDestroyed()?player.getBounds():null,displays:displays()});
function closePlayer(){if(player&&!player.isDestroyed())player.destroy();player=null;selectedIds=[];}
app.on('window-all-closed',()=>{});
app.on('before-quit',()=>{quitting=true;closePlayer();});
app.whenReady().then(()=>{
  // No external navigation, downloads, permissions or Node access in the player page.
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  session.defaultSession.on('will-download',event=>event.preventDefault());
  session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith(origin.origin+'/')&&!details.url.startsWith('data:')}));
  for(const event of ['display-removed','display-metrics-changed'])screen.on(event,()=>{
    if(player){closePlayer();emit({status:status(),notice:'Screen layout changed. Reopen the Windows display or use Browser display.'});}
    else emit({status:status()});
  });
  screen.on('display-added',()=>emit({status:status()}));
  const port=Number(process.env.TABLETOP_CONTROL_PORT),token=process.env.TABLETOP_CONTROL_TOKEN;
  if(!Number.isInteger(port)||port<1||port>65535||!/^[a-f0-9]{64}$/.test(token||''))throw Error('Start Windows display from the local DM controls');
  control=net.createConnection({host:'127.0.0.1',port},()=>emit({ready:true,token,status:status()}));
  control.on('error',()=>app.quit());control.on('close',()=>app.quit());
  let tail=Promise.resolve();
  readline.createInterface({input:control}).on('line',line=>{
    tail=tail.then(async()=>{
      let request;try{
        request=JSON.parse(line);
        if(request.command==='open'){
          const bounds=combinedBounds(displays(),request.ids);closePlayer();selectedIds=request.ids.map(String);
          player=new BrowserWindow({...bounds,frame:false,show:false,backgroundColor:'#000000',resizable:false,movable:false,fullscreenable:false,maximizable:false,minimizable:false,autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,devTools:false,backgroundThrottling:false}});
          const window=player;window.setMenu(null);window.setAlwaysOnTop(true,'screen-saver');
          window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
          window.webContents.on('will-navigate',(event,url)=>{if(url!==playerUrl)event.preventDefault();});
          window.webContents.on('will-redirect',event=>event.preventDefault());
          window.webContents.on('before-input-event',(event,input)=>{
            if(input.type==='keyDown'&&input.key==='Escape'){event.preventDefault();closePlayer();emit({status:status()});}
          });
          window.on('closed',()=>{if(player===window){player=null;selectedIds=[];}if(!quitting)emit({status:status()});});
          window.webContents.on('render-process-gone',()=>{closePlayer();emit({status:status(),notice:'Player display stopped. Browser display is still available.'});});
          try{await window.loadURL(playerUrl);if(window.isDestroyed())throw Error('Display closed while opening');window.setBounds(bounds);window.showInactive();}
          catch(error){closePlayer();throw error;}
        }else if(request.command==='close')closePlayer();
        else if(request.command==='stop'){emit({id:request.id,status:status()});app.quit();return;}
        else if(request.command==='inspect'||request.command==='capture'){
          const debug=player?await player.webContents.executeJavaScript('({table:window.__tableDebug?.(),width:innerWidth,height:innerHeight,nodeAccess:typeof require,fullscreen:!!document.fullscreenElement,qrCount:document.querySelector("#playerInvite")?.hidden?0:document.querySelectorAll(".invite-tile").length,hasFullscreenButton:!!document.querySelector("#start"),hasCloseButton:!!document.querySelector("#desktopExit"),mapPixels:(()=>{const c=document.querySelector("#display"),d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>30||d[i+1]>30||d[i+2]>30)n++;return n;})()})'):null;
          const capture=request.command==='capture'&&player?(await player.webContents.capturePage()).toPNG().toString('base64'):undefined;
          emit({id:request.id,status:status(),debug,capture});return;
        }else if(request.command!=='discover')throw Error('Unknown display command');
        emit({id:request.id,status:status()});
      }catch(error){emit({id:request?.id,error:error.message,status:status()});}
    }).catch(error=>emit({error:error.message}));
  }).on('close',()=>app.quit());
}).catch(error=>{emit({error:error.message});app.quit();});
