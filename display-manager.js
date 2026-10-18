import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import readline from 'node:readline';
import net from 'node:net';
import {randomBytes} from 'node:crypto';
export class DisplayManager{
  constructor({platform=process.platform}={}){this.platform=platform;this.child=null;this.transport=null;this.starting=null;this.pending=new Map();this.serial=0;this.current={running:false,displays:[],selectedIds:[],bounds:null};this.lastError='';}
  executable(){const executable=fileURLToPath(new URL('./desktop/node_modules/electron/dist/electron.exe',import.meta.url));return fs.existsSync(executable)?executable:null;}
  status(){return {...this.current,supported:this.platform==='win32',installed:!!this.executable(),error:this.lastError};}
  async ensure(origin){
    if(this.starting)return this.starting;if(this.child)return;
    if(this.platform!=='win32')throw Error('Windows display is available on Windows; Browser display still works');
    const executable=this.executable();if(!executable)throw Error('Optional Windows display is not installed. Run desktop/Install-Windows-Display.cmd once, or use Browser display');
    this.starting=(async()=>{
      const token=randomBytes(32).toString('hex'),listener=net.createServer();
      await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(0,'127.0.0.1',resolve);});
      return new Promise((resolve,reject)=>{
        const env={...process.env,TABLETOP_CONTROL_PORT:String(listener.address().port),TABLETOP_CONTROL_TOKEN:token};delete env.ELECTRON_RUN_AS_NODE;
        const child=spawn(executable,[fileURLToPath(new URL('./desktop/main.cjs',import.meta.url)),'--tabletop-origin='+origin],{windowsHide:true,stdio:['ignore','ignore','pipe'],env});this.child=child;
        let ready=false;const timer=setTimeout(()=>{listener.close();reject(Error('Windows display did not start. Browser display remains available'));child.kill();},20000);
        listener.on('connection',socket=>{
          let authenticated=false;const authTimer=setTimeout(()=>{if(!authenticated)socket.destroy();},2000);
          socket.on('error',()=>{});
          readline.createInterface({input:socket}).on('line',line=>{
            try{const message=JSON.parse(line);
              if(!authenticated){if(message.token!==token||!message.ready){socket.destroy();return;}authenticated=true;clearTimeout(authTimer);this.transport=socket;listener.close();}
              if(message.status)this.current=message.status;if(message.notice)this.lastError=message.notice;
              if(message.ready){ready=true;clearTimeout(timer);this.lastError='';resolve();}
              const pending=this.pending.get(message.id);if(pending){clearTimeout(pending.timer);this.pending.delete(message.id);if(message.error){this.lastError=message.error;pending.reject(Error(message.error));}else pending.resolve(message);}
            }catch{}
          });
          socket.on('close',()=>clearTimeout(authTimer));
        });
        child.stderr.on('data',()=>{});
        const ended=error=>{clearTimeout(timer);listener.close();if(this.child!==child)return;this.child=null;this.transport?.destroy();this.transport=null;this.current={running:false,displays:[],selectedIds:[],bounds:null};const failure=error||Error('Windows display closed');if(!ready){this.lastError=failure.message;reject(failure);}for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(failure);}this.pending.clear();};
        child.once('error',ended);child.once('exit',()=>ended());
      });
    })().finally(()=>{this.starting=null;});
    return this.starting;
  }
  async command(command,{origin,ids}={}){
    if(command==='close'&&!this.child)return this.status();
    await this.ensure(origin);if(command==='open'||command==='discover')this.lastError='';
    await this.rpc(command,ids);if(command==='close')this.stop();return this.status();
  }
  rpc(command,ids){return new Promise((resolve,reject)=>{const id=++this.serial,timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Windows display took too long. Use Browser display or retry'));},20000);this.pending.set(id,{resolve,reject,timer});try{this.transport.write(JSON.stringify({id,command,ids})+'\n');}catch(error){clearTimeout(timer);this.pending.delete(id);reject(error);}});}
  stop(){const child=this.child;if(child){this.transport?.end();const timer=setTimeout(()=>child.kill(),2000);timer.unref();}for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(Error('Tabletop server stopped'));}this.pending.clear();this.child=null;this.current={...this.current,running:false,bounds:null,selectedIds:[]};}
}
