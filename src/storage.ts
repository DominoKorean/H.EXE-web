import type {IndexedImage} from './formats.js';
export interface SavedWork {image:IndexedImage;filename:string}
let database:Promise<IDBDatabase>|null=null;
function db(){return database??=new Promise((resolve,reject)=>{
  const request=indexedDB.open('haneul-web',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('work');
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});}
export async function saveWork(work:SavedWork){
  // Capture a single revision before opening IndexedDB yields to another edit.
  work={filename:work.filename,image:{...work.image,pixels:work.image.pixels.slice(),palette:work.image.palette.map(c=>[...c])}};
  const d=await db();await new Promise<void>((resolve,reject)=>{
    const tx=d.transaction('work','readwrite');tx.objectStore('work').put(work,'latest');
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
export async function loadWork():Promise<SavedWork|undefined>{
  const d=await db();return new Promise((resolve,reject)=>{
    const request=d.transaction('work').objectStore('work').get('latest');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
