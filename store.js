import fs from 'node:fs/promises';
import path from 'node:path';
import {defaults,validateSession} from './model.js';
export class Store {
  constructor(dir){this.dir=dir;this.file=path.join(dir,'session.json');this.state=defaults();}
  async open(){await fs.mkdir(this.dir,{recursive:true});try{this.state=validateSession(JSON.parse(await fs.readFile(this.file,'utf8')));}catch(e){if(e.code==='ENOENT'){const files=await fs.readdir(this.dir);if(files.some(f=>/\.(png|jpg)$/.test(f)||f.startsWith('session.json')))throw Error('Saved session is missing but map assets or recovery files remain. Preserve this folder and restore a backup before starting.');}else throw Error('Saved session cannot be read. Restore session.json from a backup before starting. '+e.message);}return this.state;}
  async save(next){
    // A failed save never becomes the authoritative live state.
    const temp=this.file+'.tmp';await fs.writeFile(temp,JSON.stringify(next));
    const handle=await fs.open(temp,'r+');try{await handle.sync();}finally{await handle.close();}
    try {await fs.copyFile(this.file,this.file+'.bak');}catch(e){if(e.code!=='ENOENT')throw e;}
    await fs.rename(temp,this.file);this.state=next;
  }
}
