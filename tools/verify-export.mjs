// Builds an isolated DOS comparison fixture from a file exported by the browser.
// Usage: node tools/verify-export.mjs /absolute/path/to/export.ART
import {createWriteStream} from 'node:fs';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {once} from 'node:events';
import archiver from 'archiver';
const input=process.argv[2];
if(!input)throw new Error('Pass the path to an ART exported by the web editor.');
const data=await readFile(input);
await mkdir('artifacts',{recursive:true});
const output=createWriteStream('artifacts/compat.jsdos');
const archive=archiver('zip',{zlib:{level:9}});
archive.on('error',error=>output.destroy(error));archive.pipe(output);
for(const name of await readdir('haneul'))if(!name.endsWith('.ART'))archive.file('haneul/'+name,{name});
archive.append(data,{name:'WEBTEST.ART'});
archive.append('[dosbox]\nmachine=svga_s3\nmemsize=16\n[cpu]\ncycles=max\n[autoexec]\nmount c .\nc:\nH.EXE\n',{name:'.jsdos/dosbox.conf'});
const finished=once(output,'close');await archive.finalize();await finished;
const html=(await readFile('public/reference/index.html','utf8')).replace("url:'haneul.jsdos'","url:'compat.jsdos'");
await writeFile('artifacts/compat.html',html);
console.log('Open /artifacts/compat.html, then F3 and WEBTEST.ART in the original program.');
