import {writeFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
await writeFile('.test-build/package.json','{"type":"module"}');
const files=(await readdir('tests')).filter(n=>n.endsWith('.test.mjs')).map(n=>'tests/'+n);
const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});
process.exit(result.status??1);
