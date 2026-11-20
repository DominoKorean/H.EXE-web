import {mkdir,copyFile,readdir,readFile,writeFile} from 'node:fs/promises';
await mkdir('public/haneul',{recursive:true});
await mkdir('public/generated',{recursive:true});
await mkdir('public/reference',{recursive:true});
for(const name of await readdir('haneul')) await copyFile('haneul/'+name,'public/haneul/'+name);
await copyFile('haneul.jsdos','public/reference/haneul.jsdos');
const exe=await readFile('haneul/H.EXE');
// Data segment is load-module offset 16DE:0000, after the 0x1600-byte MZ header.
const ds=0x183e0;
await writeFile('public/generated/cow.bgi',exe.subarray(0x196fe,0x196fe+390));
const intro=await readFile('haneul/HANUL.LOG');
await writeFile('public/generated/intro-palette.json',JSON.stringify(Array.from({length:16},(_,i)=>Array.from(intro.subarray(0x1910+i*5+2,0x1910+i*5+5),v=>Math.round(v*255/63)))));
await writeFile('public/generated/font-tables.json',JSON.stringify({
  variants:Array.from(exe.subarray(ds+0x34a,ds+0x35e)),
  initial:Array.from(exe.subarray(ds+0x372,ds+0x388)),
  final:Array.from(exe.subarray(ds+0x38a,ds+0x3a0)),
}));
console.log('Original assets and verified font combination tables prepared.');
