import fs from 'node:fs/promises';import path from 'node:path';import {validateSession} from './model.js';
// Always restore into a new folder, never overwrite a running or existing campaign.
try{
 if(!process.argv[2])throw Error('Usage: node restore-backup.js <session-backup.json>');
 const bundle=JSON.parse(await fs.readFile(process.argv[2],'utf8'));if(bundle.format!==1||!bundle.assets)throw Error('Unsupported backup');validateSession(bundle.state);
 const entries=Object.values(bundle.state.maps).map(m=>{const encoded=bundle.assets[m.asset];if(typeof encoded!=='string')throw Error('Missing asset: '+m.asset);const bytes=Buffer.from(encoded,'base64');if(!bytes.length||bytes.length>40*1024*1024)throw Error('Invalid asset');return [m.asset,bytes];});
 const dir=path.resolve('restored-'+new Date().toISOString().replace(/[:.]/g,'-'));await fs.mkdir(dir);for(const [name,bytes] of entries)await fs.writeFile(path.join(dir,name),bytes);await fs.writeFile(path.join(dir,'session.json'),JSON.stringify(bundle.state));
 console.log(`Restored into ${dir}\nStop the server, then run in PowerShell:\n$env:TABLETOP_DATA='${dir.replace(/'/g,"''")}'; npm start`);
}catch(e){console.error(e.message);process.exitCode=1;}
