import './style.css';
import {browserDialog, browserDialogOpen} from './browser-dialog.js';
import {Printer} from './printer.js';
import {originalText} from './original-text.js';
import {decodePlanar,decodeMenuIcons,decodeBgi,decodeArt,decodePcx,encodeArt,encodePcx,rgba,type IndexedImage,type Palette} from './formats.js';
import {BitmapFont,type FontTables} from './font.js';
import {Editor,type Selection} from './editor.js';
import {Raster} from './raster.js';
import {Screen} from './screen.js';
import {loadWork,saveWork} from './storage.js';
import {scrollbar,scrollFromThumb} from './scrollbar.js';

const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=$<HTMLCanvasElement>('screen'), controls=$('controls'),fields=$('fields'),ime=$<HTMLInputElement>('ime');
const fileInput=$<HTMLInputElement>('file');
const assetUrl=(name:string)=>`${import.meta.env.BASE_URL}haneul/${encodeURIComponent(name)}`;
async function bytes(name:string){const response=await fetch(assetUrl(name));if(!response.ok)throw new Error(`${name} 읽기 실패`);return new Uint8Array(await response.arrayBuffer());}
const editor=new Editor();
const toolNames=['연필 / 직선','자유 곡선','사각형','채운 사각형','입체 상자','칠하기','원','채운 원','타원','채운 타원','분무기','붓','색깔 만들기','확대 보기'];
type MenuItem=[string,string];
const menus:{label:string;x:number;w:number;items:MenuItem[]}[]=[
  {label:'하늘',x:88,w:72,items:[['하늘이란 ...','about'],['사용 설명 F1','help'],['시간 보기 @T','time'],['그림 감상 F9','gallery'],['색깔 판 보기','palette'],['음향 효과 ^S','sound']]},
  {label:'도스',x:160,w:72,items:[['바깥 나들이   @S','reference'],['도스 명령어   @J','dos'],['바깥 화면    @F5','fullscreen'],['그만 두기     @X','exit']]},
  {label:'화일',x:232,w:72,items:[['저장 하기   F2','save'],['PCX  저장  @F2','savePcx'],['불러 오기   F3','open'],['문서부르기','textDocument'],['부분 저장','savePart'],['부분 부르기','openPart'],['새 이름으로 @W','rename'],['목록 보기   F6','open'],['경로 바꾸기 @D','open'],['새 그림     @N','new']]},
  {label:'출력',x:304,w:72,items:[['프린터는  ^P','printer'],['전체 찍기 @P','print']]},
  {label:'글쓰기',x:376,w:88,items:[['글자 종류','font'],['글자 모양','font'],['글 쓰기 @G','text']]},
  {label:'편집',x:464,w:72,items:[['원래대로 @U','undo'],['좌우 바꾸기','flipX'],['상하 바꾸기','flipY'],['회전','rotate'],['반전','invert'],['복사','copy'],['이동','move'],['확대 / 축소','resize']]},
];
let screen:Screen, uiFont:BitmapFont, paintFont:BitmapFont,icons:IndexedImage,lines:IndexedImage,splash:IndexedImage;
let menuIcons:IndexedImage[],arrows:IndexedImage[],colors:IndexedImage,cow:IndexedImage,drives:IndexedImage[];
let clockIcons:Uint8Array;
let introPalette:Palette,splashVisible=true,menu=-1,menuRow=0,tool=0,stroke=1,linePattern=0xffff;
let scrollX=0,scrollY=0,zoom=1,viewOnly=false,dirty=false,sound=true;
let pointer={x:0,y:0},drag:{id:number;x:number;y:number;lastX:number;lastY:number;select:boolean;before:Uint8Array;selection:Selection|null}|null=null;
let scrollDrag:{id:number;axis:'x'|'y';grab:number;before:number}|null=null;
let sprayTimer:ReturnType<typeof setInterval>|undefined;
let audioContext:AudioContext|undefined;
let clipboard:IndexedImage|null=null,textAnchor:{x:number;y:number}|null=null;
let textDraft='',fontScaleX=1,fontScaleY=1,fontBold=false,fontKo='H2MYUNG.FNT',fontEn='H2ENG_M.FNT';
let saveTimer:ReturnType<typeof setTimeout>,autosaveFailed=false,revision=0;
interface Dialog {title:string;x:number;y:number;w:number;h:number;lines?:string[];lineStep?:number;titleColor?:number;kind?:'files'|'printer';dismissAnyKey?:boolean;buttons:{label:string;action:()=>void}[];extra?:()=>void}
let dialog:Dialog|null=null,partialOpen=false;
let readGeneration=0,fileIntent:{generation:number;owner:Dialog|null;partial:boolean}|null=null;
const samples=['ROSE.ART','SAE.ART','WON.ART','NASSEH.ART','HEEDONG1.PCX'];
let fileFormat:'ART'|'PCX'='ART',fileChoice='NASSEH.ART';

function announce(s:string){$('announcement').textContent=s;}
function beep(){
  if(!sound)return;
  try{
    const context=audioContext??=new AudioContext();
    void context.resume().then(()=>{
      const oscillator=context.createOscillator(),gain=context.createGain();
      oscillator.type='square';oscillator.frequency.value=880;
      gain.gain.setValueAtTime(0.025,context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,context.currentTime+0.045);
      oscillator.connect(gain);gain.connect(context.destination);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
      oscillator.start();oscillator.stop(context.currentTime+0.05);
    }).catch(()=>{});
  }catch{announce('이 환경에서는 음향을 사용할 수 없습니다.');}
}
function changed(){
  dirty=true;revision++;announce(`${editor.filename} — ${tool===14?'글쓰기':toolNames[tool]}`);
  clearTimeout(saveTimer);saveTimer=setTimeout(()=>persist(),700);render();
}
async function persist(){
  if(drag||textAnchor){clearTimeout(saveTimer);saveTimer=setTimeout(()=>persist(),700);return;}
  try{await saveWork({image:editor.image(),filename:editor.filename});autosaveFailed=false;$('storage-notice').hidden=true;}
  catch{if(!autosaveFailed)storageWarning();autosaveFailed=true;}
}
function clampView(){
  scrollX=Math.max(0,Math.min(scrollX,Math.max(0,editor.raster.width-Math.floor(528/zoom))));
  scrollY=Math.max(0,Math.min(scrollY,Math.max(0,editor.raster.height-Math.floor(400/zoom))));
}
function closeDialog(){readGeneration++;dialog=null;fields.replaceChildren();fields.removeAttribute('role');fields.removeAttribute('aria-label');canvas.focus();render();}
function showDialog(d:Dialog){readGeneration++;menu=-1;textAnchor=null;ime.blur();fields.replaceChildren();dialog=d;fields.setAttribute('role','dialog');fields.setAttribute('aria-label',d.title);render();}
function storageWarning(){
  $('storage-notice').hidden=false;
}
$('storage-notice').querySelector('button')!.onclick=()=>{$('storage-notice').hidden=true;canvas.focus();};
function validation(detail:string){browserDialog('입력값 확인',detail);}
function field(id:string,label:string,value:string,x:number,y:number,w:number,type='text') {
  const input=document.createElement('input');input.id=id;input.type=type;input.value=value;input.setAttribute('aria-label',label);
  Object.assign(input.style,{left:x/640*100+'%',top:y/480*100+'%',width:w/640*100+'%',height:24/480*100+'%'});
  fields.append(input);return input;
}
function selectField(id:string,label:string,options:[string,string][],value:string,x:number,y:number,w:number){
  const select=document.createElement('select');select.id=id;select.setAttribute('aria-label',label);
  for(const [v,label]of options){const o=new Option(label,v);select.add(o);}select.value=value;
  Object.assign(select.style,{left:x/640*100+'%',top:y/480*100+'%',width:w/640*100+'%',height:24/480*100+'%'});fields.append(select);return select;
}
function dialogRender(){
  if(!dialog)return;
  const d=dialog;
  if(d.kind==='printer'){printer.draw(screen);return;}
  if(d.kind==='files'){renderFileDialog();return;}
  // Only modal controls participate in keyboard navigation.

  screen.raster.rect(d.x+4,d.y+4,d.x+d.w+3,d.y+d.h+3,0,true);
  screen.box(d.x,d.y,d.w,d.h);screen.box(d.x+4,d.y+4,d.w-8,d.h-8,7,true);
  screen.raster.rect(d.x+6,d.y+6,d.x+d.w-7,d.y+24,9,true);screen.center(d.title,d.x,d.y+8,d.w,d.titleColor??15);
  d.lines?.forEach((line,i)=>screen.text(line,d.x+16,d.y+40+i*(d.lineStep??20)));d.extra?.();
  const gap=12,bw=Math.min(136,(d.w-32-gap*(d.buttons.length-1))/d.buttons.length),start=d.x+(d.w-(bw*d.buttons.length+gap*(d.buttons.length-1)))/2;
  d.buttons.forEach((b,i)=>screen.button('dialog-'+i,b.label,Math.round(start+i*(bw+gap)),d.y+d.h-36,Math.floor(bw),24,b.action));
  if(d.dismissAnyKey)screen.hotspot('dismiss','확인',d.x,d.y,d.w,d.h,closeDialog);
}
function renderBase(interactive=true){
  const r=screen.raster;
  const hot=(id:string,label:string,x:number,y:number,w:number,h:number,action:()=>void)=>{if(interactive)screen.hotspot(id,label,x,y,w,h,action);};
  screen.box(0,0,88,24);
  menus.forEach((m,i)=>{
    screen.box(m.x,0,m.w,24,menu===i?0:7,menu===i);screen.text(m.label,m.x+8,4,menu===i?15:8);
    screen.asset(menuIcons[i],m.x+m.w-26,4);
    hot('menu-'+i,m.label,m.x,0,m.w,24,()=>{menu=menu===i?-1:i;menuRow=0;render();});
  });
  screen.box(536,0,104,24,9);screen.text('하늘소',550,4,14);screen.asset(cow,600,0);hot('about','하늘소 — 하늘이란',536,0,104,24,()=>action('about'));
  screen.box(0,24,80,244);screen.box(6,28,68,228,7,true);screen.asset(icons,8,28);
  toolNames.forEach((name,i)=>{
    const x=8+(i%2)*32,y=28+Math.floor(i/2)*32;
    if(tool===i)r.rect(x+2,y+2,x+29,y+29,8,false);
    hot('tool-'+i,name,x,y,32,32,()=>selectTool(i));
  });
  screen.box(0,268,80,48);screen.asset(lines,8,272);
  for(let row=0;row<4;row++)for(let col=0;col<2;col++)hot(`line-${row}-${col}`,col?`선 두께 ${row+1}`:['실선','점선','짧은 파선','긴 파선'][row],8+col*32,272+row*8,32,8,()=>{if(col)stroke=row+1;else linePattern=[0xffff,0xaaaa,0xf0f0,0xff00][row];render();});
  screen.box(0,376,80,80);screen.box(6,380,68,64,7,true);screen.asset(colors,8,380);
  for(let c=0;c<16;c++){
    const x=8+c%4*16,y=380+Math.floor(c/4)*16;
    hot('color-'+c,`색 ${c}${c===editor.foreground?' 현재 색깔':''}`,x,y,16,16,()=>{editor.foreground=c;render();});
  }
  screen.box(86,30,532,404,7,true);
  const source=editor.raster;
  for(let y=0;y<400;y++)for(let x=0;x<528;x++){
    const c=source.get(scrollX+Math.floor(x/zoom),scrollY+Math.floor(y/zoom));r.set(88+x,32+y,c<0?7:c);
  }
  if(textAnchor&&textDraft){
    const preview=new Raster(source.width,source.height,0,source.pixels);
    paintFont.draw(preview,textDraft,textAnchor.x,textAnchor.y,editor.foreground,fontScaleX,fontScaleY,fontBold);
    for(let y=0;y<400;y++)for(let x=0;x<528;x++){const c=preview.get(scrollX+Math.floor(x/zoom),scrollY+Math.floor(y/zoom));if(c>=0)r.set(88+x,32+y,c);}
  }
  if(editor.selection){
    const s=editor.selection,x=Math.round(88+(s.x-scrollX)*zoom),y=Math.round(32+(s.y-scrollY)*zoom),w=s.w*zoom,h=s.h*zoom;
    for(let xx=Math.max(88,x);xx<Math.min(616,x+w);xx++)for(const yy of [y,y+h-1])if(yy>=32&&yy<432)r.set(xx,yy,(xx%6<3)?0:15);
    for(let yy=Math.max(32,y);yy<Math.min(432,y+h);yy++)for(const xx of [x,x+w-1])if(xx>=88&&xx<616)r.set(xx,yy,(yy%6<3)?0:15);
  }
  screen.box(616,32,16,400);screen.box(88,432,544,16);
  screen.box(616,32,16,16);screen.box(616,416,16,16);screen.box(88,432,16,16);screen.box(600,432,16,16);
  screen.asset(arrows[0],616,32);screen.asset(arrows[1],616,416);screen.asset(arrows[2],88,432);screen.asset(arrows[3],600,432);
  for(let yy=48;yy<416;yy++)for(let xx=616;xx<632;xx++)r.set(xx,yy,(xx+yy)%2?15:8);
  for(let yy=432;yy<448;yy++)for(let xx=104;xx<600;xx++)r.set(xx,yy,(xx+yy)%2?15:8);
  hot('up','위로 스크롤',616,32,16,16,()=>pan(0,-40));hot('down','아래로 스크롤',616,416,16,16,()=>pan(0,40));
  hot('left','왼쪽으로 스크롤',88,432,16,16,()=>pan(-40,0));hot('right','오른쪽으로 스크롤',600,432,16,16,()=>pan(40,0));
  const vertical=scrollMetrics('y'),horizontal=scrollMetrics('x');
  screen.box(618,48+vertical.position,12,vertical.size);
  screen.box(104+horizontal.position,434,horizontal.size,12);
  hot('vtrack','세로 스크롤',616,48,16,368,()=>pan(0,200));hot('htrack','가로 스크롤',104,432,496,16,()=>pan(200,0));
  [0,16,80,200,288,320,392,448,496,640].slice(0,-1).forEach((x,i,a)=>screen.box(x,456,([16,80,200,288,320,392,448,496,640][i])-x,24));
  screen.text('화일명',24,460);screen.text(editor.filename.slice(0,14),88,460);screen.text('현재 색깔',208,460);
  r.rect(296,460,312,476,15,true);r.rect(297,461,304,475,editor.foreground,true);r.rect(305,461,311,475,editor.background,true);
  screen.text('현재 선',328,460);r.line(400,468,431,468,editor.foreground,stroke,linePattern);screen.text('글',464,460);screen.text('비트맵 한글<2>',504,460);
  hot('current-color','현재 색깔 바꾸기',288,456,32,24,()=>action('palette'));hot('current-font','글자 종류',448,456,192,24,()=>action('font'));
  if(zoom>1)screen.text(`${zoom}X`,24,328,0);
}
function render(){
  if(!screen)return;clampView();
  if(splashVisible){screen.begin();screen.asset(splash,0,0);screen.hotspot('start','하늘 그림틀 시작',0,0,640,480,start);screen.present(introPalette);return;}
  if(viewOnly){
    screen.begin(0);const image=editor.image(),ratio=Math.min(640/image.width,480/image.height);
    const w=Math.floor(image.width*ratio),h=Math.floor(image.height*ratio),ox=Math.floor((640-w)/2),oy=Math.floor((480-h)/2);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)screen.raster.set(ox+x,oy+y,image.pixels[Math.floor(y/ratio)*image.width+Math.floor(x/ratio)]);
    screen.hotspot('return','그림 감상 끝내기',0,0,640,480,()=>{viewOnly=false;render();});screen.present(editor.palette);return;
  }
  screen.begin();renderBase(menu<0&&!dialog);
  if(menu>=0){
    const m=menus[menu],breaks=menu===0?[2]:menu===2?[4,6,9]:[];
    const w=Math.max(...m.items.map(([label])=>uiFont.width(label)))+16,x=Math.min(m.x,640-w),h=m.items.length*16+8+breaks.length*16;
    screen.raster.rect(x+2,22,x+w+1,20+h+1,0,true);screen.box(x,20,w,h);
    breaks.forEach((row,i)=>screen.raster.line(x+2,24+row*16+i*16+8,x+w-3,24+row*16+i*16+8,8));
    m.items.forEach(([label,cmd],i)=>{
      const y=24+i*16+breaks.filter(row=>row<=i).length*16;
      if(i===menuRow)screen.raster.rect(x+2,y,x+w-3,y+15,0,true);
      screen.text(label,x+8,y,i===menuRow?15:8);
      if(!dialog)screen.hotspot('item-'+i,label,x+2,y,w-4,16,()=>{menu=-1;action(cmd);});
    });
    if(!dialog)menus.forEach((m,i)=>screen.hotspot('menu-'+i,m.label,m.x,0,m.w,24,()=>{menu=i;menuRow=0;render();}));
  }
  if(dialog)dialogRender();
  screen.present(editor.palette);
}
function start(){splashVisible=false;canvas.focus();action('about');}
function pan(dx:number,dy:number){finishDrag();scrollX+=dx;scrollY+=dy;render();}
function scrollMetrics(axis:'x'|'y'){
  return axis==='x'?scrollbar(editor.raster.width,Math.floor(528/zoom),496,scrollX):scrollbar(editor.raster.height,Math.floor(400/zoom),368,scrollY);
}
function selectTool(index:number){
  finishDrag();commitText();editor.cancelPaste();menu=-1;tool=index;
  if(index===12){action('palette');return;}
  if(index===13){zoom=zoom===1?4:1;render();return;}
  announce(toolNames[index]);beep();render();canvas.focus();
}
function commitText(){
  if(textAnchor&&textDraft){editor.checkpoint();paintFont.draw(editor.raster,textDraft,textAnchor.x,textAnchor.y,editor.foreground,fontScaleX,fontScaleY,fontBold);textAnchor=null;textDraft='';ime.value='';changed();}
  textAnchor=null;textDraft='';ime.value='';
}
function newDialog(){
  showDialog({title:'새 그림 변경',x:184,y:140,w:280,h:196,lines:['가로 크기','세로 크기'],lineStep:32,buttons:[{label:'새 그림',action:()=>{
    const w=Number($<HTMLInputElement>('width').value),h=Number($<HTMLInputElement>('height').value);
    if(!Number.isInteger(w)||!Number.isInteger(h)||w<8||w>4096||h<1||h>4096||w*h>4194304){validation('올바른 크기를 입력하세요.');return;}
    editor.checkpoint();editor.raster=new Raster(w,h);editor.selection=null;editor.filename='NONAME.ART';scrollX=scrollY=0;closeDialog();changed();
  }},{label:'취소',action:closeDialog}]});
  field('width','가로 크기','640',320,178,112,'number');field('height','세로 크기','704',320,210,112,'number');
}
function openDialog(partial=false){
  partialOpen=partial;
  showDialog({title:partial?'부분 부르기':'화일',x:106,y:116,w:496,h:212,kind:'files',buttons:[{label:'선택',action:()=>void openSample(fileChoice)},{label:'취소',action:closeDialog}]});
}
function chooseLocal(){fileIntent={generation:++readGeneration,owner:dialog,partial:partialOpen};fileInput.click();}
function renderFileDialog(){
  screen.box(106,116,496,212);screen.box(110,120,484,196,7,true);
  const heading=(text:string,x:number,y:number,w:number)=>{screen.box(x,y,w,20,9);screen.center(text,x,y+2,w,15);};
  heading('드라이브',120,124,80);heading(' 경로  바꾸기 ',208,124,128);heading('화  일',344,124,128);heading('화일 형식',480,124,104);
  for(const [x,w]of [[120,64],[208,112],[344,112]])screen.box(x,148,w,160,7,true);
  for(const [label,y,index]of [['A',148,0],['C',164,1],['D',180,2]] as const){screen.text(label,128,y+1,8);screen.asset(drives[index],144,y);screen.hotspot('drive-'+label,label==='D'?'내 컴퓨터에서 열기':`드라이브 ${label}`,120,y,64,16,label==='D'?chooseLocal:()=>{fileChoice=fileFormat==='ART'?'NASSEH.ART':'HEEDONG1.PCX';render();});}
  screen.text('..',216,150,8);screen.text('JSDOS~1',216,166,8);screen.hotspot('local-path','내 컴퓨터에서 열기',208,148,112,16,chooseLocal);
  for(const x of [184,320,456]){for(let y=148;y<308;y++)for(let xx=x;xx<x+16;xx++)screen.raster.set(xx,y,(xx+y)%2?15:8);screen.asset(arrows[0],x,148);screen.asset(arrows[1],x,292);}
  samples.filter(n=>n.endsWith(fileFormat)).sort().forEach((name,i)=>{
    const y=148+i*16;if(fileChoice===name)screen.raster.rect(346,y,454,y+15,0,true);
    screen.text(name,352,y+1,fileChoice===name?15:8);
    screen.hotspot('sample-'+i,name,344,y,112,16,()=>{fileChoice=name;render();});
  });
  screen.button('format-art','ART 형식',480,148,104,20,()=>{fileFormat='ART';fileChoice='NASSEH.ART';render();},fileFormat==='ART');
  screen.button('format-pcx','PCX 형식',480,172,104,20,()=>{fileFormat='PCX';fileChoice='HEEDONG1.PCX';render();},fileFormat==='PCX');
  heading('선택된 화일',480,204,104);screen.box(480,228,104,20,7,true);screen.text(fileChoice.slice(0,12),484,230,8);
  for(const [id,label,y,color,handler]of [['select-file','  선   택  ',260,14,()=>void openSample(fileChoice)],['cancel-file','  취   소  ',284,12,closeDialog]] as const){heading(label,480,y,104);screen.center(label,480,y+2,104,color);screen.hotspot(id,label,480,y,104,20,handler);}
}
async function openSample(name:string){
  const generation=++readGeneration,owner=dialog,partial=partialOpen;
  try{const image=decodeFile(await bytes(name));if(generation===readGeneration&&owner===dialog)installImage(image,name,partial);}
  catch(e){if(generation===readGeneration&&owner===dialog)browserDialog('파일을 열 수 없습니다',errorText(e));}
}
function decodeFile(data:Uint8Array){return data[0]===10?decodePcx(data):decodeArt(data);}
function installImage(image:IndexedImage,name:string,partial=false){
  finishDrag();
  if(partial){clipboard=image;editor.beginPaste(image);partialOpen=false;closeDialog();announce('그림을 놓을 위치를 클릭하세요.');return;}
  editor.checkpoint();editor.replace(image);editor.filename=name;scrollX=scrollY=0;closeDialog();changed();
}
function errorText(e:unknown){return e instanceof Error?e.message:'작업을 완료하지 못했습니다.';}
function saveDialog(pcx=false,part=false){
  showDialog({title:'저장할 그림의 이름은?',x:144,y:156,w:352,h:144,buttons:[{label:'저장',action:()=>{
    const name=$<HTMLInputElement>('filename').value.trim()||'NONAME.ART';
    try{const image=part?editor.copy():editor.image(),usePcx=/\.pcx$/i.test(name)||pcx,data=usePcx?encodePcx(image):encodeArt(image);
      const filename=name.replace(/\.(art|pcx)$/i,'')+(usePcx?'.PCX':'.ART');download(data,filename,'application/octet-stream');
      if(!part){editor.filename=filename;dirty=false;void persist();}closeDialog();
    }catch(e){browserDialog('저장할 수 없습니다',errorText(e));}
  }},{label:'취소',action:closeDialog}]});
  const f=field('filename','저장할 화일명',editor.filename.replace(/\.(art|pcx)$/i,pcx?'.PCX':'.ART'),168,204,304);f.focus();f.select();
}
function download(data:Uint8Array|Blob,name:string,type:string){
  const blob=data instanceof Blob?data:new Blob([data.slice().buffer as ArrayBuffer],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function bitmapCanvas(image:IndexedImage){const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d')!.putImageData(new ImageData(rgba(image),image.width,image.height),0,0);return c;}
function fontDialog(){
  showDialog({title:'글자 종류 / 글자 모양',x:128,y:112,w:384,h:280,lines:['한글 글꼴','영문 글꼴','가로 크기','세로 크기'],lineStep:31,buttons:[{label:'선택',action:()=>void applyFont()},{label:'취소',action:closeDialog}]});
  selectField('kfont','한글 글꼴',[['H2MYUNG.FNT','명조체'],['H2GODIK.FNT','고딕체'],['H2PILGI.FNT','필기체'],['H2JUNGO.FNT','반고딕체'],['H2AHNSS.FNT','안상수체'],['H2THREE.FNT','3벌식체'],['H2IYAGI.FNT','이야기체']],fontKo,288,149,192);
  selectField('efont','영문 글꼴',[['H2ENG_M.FNT','명조체 영문'],['H2ENG_B.FNT','굵은체 영문'],['H2ENG_G.FNT','고딕체 영문'],['H2ENG_N.FNT','가는체 영문'],['H2ENG_P.FNT','필기체 영문']],fontEn,288,180,192);
  field('font-x','글 가로 크기',String(fontScaleX),288,211,80,'number');field('font-y','글 세로 크기',String(fontScaleY),288,242,80,'number');
  selectField('font-bold','글자 진하게',[['0','보통모양'],['1','진하게']],fontBold?'1':'0',176,288,288);
}
async function applyFont(){
  const ko=$<HTMLSelectElement>('kfont').value,en=$<HTMLSelectElement>('efont').value;
  const sx=Number($<HTMLInputElement>('font-x').value),sy=Number($<HTMLInputElement>('font-y').value),bold=$<HTMLSelectElement>('font-bold').value==='1';
  if(!Number.isInteger(sx)||!Number.isInteger(sy)||sx<1||sy<1||sx>16||sy>16){validation('글 크기는 1부터 16까지입니다.');return;}
  const generation=++readGeneration,owner=dialog;
  try{const [k,e]=await Promise.all([bytes(ko),bytes(en)]);if(generation!==readGeneration||owner!==dialog)return;paintFont=new BitmapFont(k,e);fontKo=ko;fontEn=en;fontScaleX=sx;fontScaleY=sy;fontBold=bold;closeDialog();}
  catch(e){if(generation===readGeneration&&owner===dialog)browserDialog('글꼴을 열 수 없습니다',errorText(e));}
}
function paletteDialog(){
  const c=editor.palette[editor.foreground];
  showDialog({title:'색깔 만들기',x:176,y:132,w:288,h:224,lines:['빨강','초록','파랑'],lineStep:32,buttons:[{label:'선택',action:()=>{
    const rgb=['red','green','blue'].map(id=>Number($<HTMLInputElement>(id).value));
    if(rgb.some(v=>!Number.isInteger(v)||v<0||v>63)){validation('색깔 값은 0~63입니다.');return;}
    editor.checkpoint();editor.palette[editor.foreground]=rgb.map(v=>Math.round(v*255/63));closeDialog();changed();
  }},{label:'취소',action:closeDialog}]});
  ['red','green','blue'].forEach((id,i)=>field(id,['빨강','초록','파랑'][i],String(Math.round(c[i]*63/255)),304,170+i*32,112,'number'));
}
function resizeDialog(){
  const s=editor.region();showDialog({title:'확대 / 축소',x:184,y:140,w:280,h:196,lines:['가로 크기','세로 크기'],lineStep:32,buttons:[{label:'선택',action:()=>{
    const w=Number($<HTMLInputElement>('width').value),h=Number($<HTMLInputElement>('height').value);
    if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>4096||h>4096||w*h>4194304){validation('올바른 크기를 입력하세요.');return;}
    editor.checkpoint();editor.resizeRegion(w,h);closeDialog();changed();
  }},{label:'취소',action:closeDialog}]});field('width','가로 크기',String(s.w),320,178,112,'number');field('height','세로 크기',String(s.h),320,210,112,'number');
}
function action(cmd:string){
  finishDrag();editor.cancelPaste();if(cmd!=='text')commitText();menu=-1;
  switch(cmd){
    case 'about':showDialog({title:originalText.aboutTitle,x:160,y:120,w:344,h:176,buttons:[],dismissAnyKey:true,extra:()=>{
      originalText.about.forEach((line,i)=>screen.text(line,176,[160,176,192,224,256][i]));
    }});break;
    case 'help':showDialog({title:originalText.helpTitle,x:96,y:52,w:512,h:360,titleColor:11,buttons:[],dismissAnyKey:true,extra:()=>{
      originalText.help.forEach((line,i)=>screen.text(line,104,92+i*32));
      screen.raster.rect(104,378,599,393,0,true);
      // Free conventional memory reported by the bundled DOS configuration at startup.
      screen.text(originalText.helpMemory.replace('%03d','266'),104,378,15);
    }});break;
    case 'new':newDialog();break;
    case 'open':openDialog();break;case 'openPart':openDialog(true);break;
    case 'save':saveDialog();break;case 'savePcx':saveDialog(true);break;case 'savePart':saveDialog(false,true);break;
    case 'rename':saveDialog(/\.pcx$/i.test(editor.filename));break;
    case 'palette':paletteDialog();break;case 'font':fontDialog();break;
    case 'undo':if(editor.undo())changed();else render();break;case 'redo':if(editor.redo())changed();else render();break;
    case 'flipX':case 'flipY':case 'invert':case 'rotate':editor.checkpoint();editor.transform(cmd);changed();break;
    case 'resize':resizeDialog();break;
    case 'copy':clipboard=editor.copy();editor.beginPaste(clipboard);announce('복사할 위치를 클릭하세요.');render();break;
    case 'move':clipboard=editor.copy();editor.beginPaste(clipboard,true);announce('이동할 위치를 클릭하세요. Esc로 취소합니다.');render();break;
    case 'text':tool=14;announce('글을 쓸 위치를 클릭하세요.');render();break;
    case 'textDocument':showTextDocument();break;
    case 'gallery':viewOnly=true;render();break;
    case 'time':showClock();break;
    case 'sound':sound=!sound;beep();showDialog({title:sound?originalText.soundOn:originalText.soundOff,x:184,y:104,w:272,h:36,buttons:[],dismissAnyKey:true});break;
    case 'printer':case 'print':
      printer.open(cmd==='print');
      showDialog({title:cmd==='print'?'프린터 환경 설정 상태':'프린터는',kind:'printer',x:224,y:40,w:272,h:224,buttons:[]});
      if(cmd==='printer'){menu=3;menuRow=0;render();}
      canvas.focus();break;
    case 'fullscreen':void (document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()).catch(()=>browserDialog('전체 화면을 열 수 없습니다','Chrome의 전체 화면 단축키 F11을 사용하세요.'));render();break;
    case 'reference':openReference();render();break;
    case 'dos':render();browserDialog('DOS 명령 실행','DOS 명령을 사용하려면 원본 하늘을 새 탭에서 실행하세요.',[
      {label:'닫기'},{label:'원본 실행',run:openReference}
    ]);break;
    case 'exit':showDialog({title:'하늘을 끝낼까요?',x:192,y:168,w:256,h:136,buttons:[{label:'예',action:()=>{void persist();closeDialog();splashVisible=true;render();}},{label:'아니오',action:closeDialog}]});break;
    default:render();
  }
}
function showTextDocument(){
  render();
  const area=document.createElement('textarea');
  area.setAttribute('aria-label','그림에 넣을 글');
  browserDialog('문서에서 글 가져오기','그림에 넣을 글을 붙여넣고 작업 영역에서 위치를 선택하세요.',[
    {label:'취소'},{label:'위치 선택',run:()=>{textDraft=area.value;tool=14;canvas.focus();render();}}
  ],area);
}
const printer=new Printer(render,closeDialog,()=>{
  closeDialog();
  browserDialog('그림 인쇄','Chrome 인쇄 창에서 프린터와 용지를 선택하세요. PDF로 보관하려면 대상에서 ‘PDF로 저장’을 선택하세요.',[
    {label:'PNG로 저장',run:exportPng},{label:'인쇄 창 열기',run:()=>window.print()}
  ]);
});
function openReference(){
  window.open(`${import.meta.env.BASE_URL}reference/index.html`,'_blank','noopener');
}
function exportPng(){
  const filename=editor.filename.replace(/\.[^.]+$/,'')+'.png';
  bitmapCanvas(editor.image()).toBlob(blob=>{
    if(blob)download(blob,filename,'image/png');
    else browserDialog('PNG를 저장할 수 없습니다','이미지를 다시 내보내세요.');
  },'image/png');
}
window.addEventListener('beforeprint',()=>{
  const page=bitmapCanvas(printer.printImage(editor.image()));
  page.style.width=page.width/printer.dpi+'in';
  $('print-sheet').replaceChildren(page);
});
window.addEventListener('afterprint',()=>$('print-sheet').replaceChildren());

function showClock(){
  const clock:Dialog={title:'  현재 시각은 ',x:152,y:88,w:144,h:60,buttons:[],dismissAnyKey:true,extra:()=>{
    const now=new Date();
    const time=[now.getHours(),now.getMinutes(),now.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':');
    const frame=now.getSeconds()%3;
    for(const left of [168,264]){
      for(let y=0;y<16;y++)for(let x=0;x<16;x++){
        const bit=clockIcons[frame*32+y*2+(x>>3)] & (0x80>>(x%8));
        screen.raster.set(left+x,116+y,bit?15:9);
      }
    }
    screen.raster.rect(192,116,255,131,9,true);
    screen.text(time,192,116,15);
  }};
  showDialog(clock);
  const tick=setInterval(()=>{if(dialog===clock)render();else clearInterval(tick);},1000);
}

function point(e:PointerEvent|MouseEvent){const rect=canvas.getBoundingClientRect();return {x:Math.floor((e.clientX-rect.left)*640/rect.width),y:Math.floor((e.clientY-rect.top)*480/rect.height)};}
function documentPoint(p:{x:number;y:number}){return {x:Math.max(0,Math.min(editor.raster.width-1,scrollX+Math.floor((p.x-88)/zoom))),y:Math.max(0,Math.min(editor.raster.height-1,scrollY+Math.floor((p.y-32)/zoom)))};}
function inPicture(p:{x:number;y:number}){return p.x>=88&&p.x<616&&p.y>=32&&p.y<432;}
function finishDrag(cancel=false){
  clearInterval(sprayTimer);sprayTimer=undefined;
  const current=drag;if(!current)return;drag=null;
  if(canvas.hasPointerCapture(current.id))canvas.releasePointerCapture(current.id);
  if(current.select){if(cancel)editor.selection=current.selection;render();return;}
  if(cancel){editor.cancelEdit();render();}else{editor.commitEdit();changed();}
}
function paint(x:number,y:number){
  if(!drag)return;const r=editor.raster,c=editor.foreground;
  if(drag.select){editor.selection={x:Math.min(drag.x,x),y:Math.min(drag.y,y),w:Math.abs(x-drag.x)+1,h:Math.abs(y-drag.y)+1};return;}
  if(tool===1||tool===11){r.line(drag.lastX,drag.lastY,x,y,c,tool===11?Math.max(4,stroke):stroke,linePattern);}
  else if(tool===10){for(let i=0;i<24;i++){const dx=Math.round((Math.random()-.5)*16),dy=Math.round((Math.random()-.5)*16);if(dx*dx+dy*dy<=64)r.set(x+dx,y+dy,c);}}
  else{
    r.pixels.set(drag.before);
    if(tool===0)r.line(drag.x,drag.y,x,y,c,stroke,linePattern);
    if(tool===2||tool===3)r.rect(drag.x,drag.y,x,y,c,tool===3,stroke,linePattern);
    if(tool===4){r.rect(drag.x,drag.y,x,y,c,false,stroke);r.rect(drag.x+8,drag.y-8,x+8,y-8,c,false,stroke);for(const [xx,yy]of[[drag.x,drag.y],[x,drag.y],[x,y],[drag.x,y]])r.line(xx,yy,xx+8,yy-8,c,stroke);}
    if(tool>=6&&tool<=9){if(tool<8){const d=Math.max(Math.abs(x-drag.x),Math.abs(y-drag.y));x=drag.x+Math.sign(x-drag.x||1)*d;y=drag.y+Math.sign(y-drag.y||1)*d;}r.ellipse(drag.x,drag.y,x,y,c,tool===7||tool===9,stroke);}
  }
  drag.lastX=x;drag.lastY=y;
}
canvas.addEventListener('pointerdown',e=>{
  if(splashVisible){start();return;}if(dialog)return;if(viewOnly){viewOnly=false;render();return;}if(menu>=0){menu=-1;render();return;}
  if(e.button!==0&&e.button!==2)return;
  const p=point(e);if(!inPicture(p))return;
  if(scrollX+Math.floor((p.x-88)/zoom)>=editor.raster.width||scrollY+Math.floor((p.y-32)/zoom)>=editor.raster.height)return;
  canvas.focus();e.preventDefault();const d=documentPoint(p);pointer=d;
  if(e.altKey){editor.foreground=editor.raster.get(d.x,d.y);render();return;}
  if(editor.isPasting&&e.button===0){if(editor.placePaste(d.x,d.y))changed();return;}
  if(tool===14&&e.button===0){commitTextIfActive();textAnchor=d;ime.value=textDraft;ime.style.left=(p.x/640*100)+'%';ime.style.top=(p.y/480*100)+'%';ime.focus();render();return;}
  const select=e.button===2;
  const selection=editor.selection?{...editor.selection}:null;
  if(!select){editor.beginEdit();editor.selection=null;}
  if(tool===5&&!select){editor.raster.flood(d.x,d.y,editor.foreground);editor.commitEdit();changed();return;}
  drag={id:e.pointerId,x:d.x,y:d.y,lastX:d.x,lastY:d.y,select,before:editor.raster.pixels.slice(),selection};canvas.setPointerCapture(e.pointerId);paint(d.x,d.y);render();
  if(tool===10&&!select)sprayTimer=setInterval(()=>{if(drag){paint(drag.lastX,drag.lastY);render();}},40);
});
function commitTextIfActive(){if(textAnchor)commitText();}
canvas.addEventListener('pointermove',e=>{const p=point(e),d=documentPoint(p);pointer=d;if(drag){paint(d.x,d.y);render();}});
canvas.addEventListener('pointerup',e=>{if(drag&&drag.id===e.pointerId){const d=documentPoint(point(e));paint(d.x,d.y);finishDrag();}});
canvas.addEventListener('pointercancel',()=>finishDrag(true));
canvas.addEventListener('lostpointercapture',()=>finishDrag(true));
controls.addEventListener('pointermove',e=>{
  if(menu<0||dialog)return;
  const id=(e.target as HTMLElement).closest<HTMLElement>('[data-hotspot]')?.dataset.hotspot??'';
  if(id.startsWith('menu-')){const index=Number(id.slice(5));if(index!==menu){menu=index;menuRow=0;render();}}
  else if(id.startsWith('item-')){const index=Number(id.slice(5));if(index!==menuRow){menuRow=index;render();}}
});
// Capture on the stable stage: the transparent scrollbar buttons are recreated during rendering.
$('stage').addEventListener('pointerdown',e=>{
  const target=(e.target as HTMLElement).closest<HTMLElement>('[data-hotspot]');
  const id=target?.dataset.hotspot;
  if(e.button!==0||(id!=='vtrack'&&id!=='htrack'))return;
  e.preventDefault();e.stopPropagation();finishDrag();commitText();canvas.focus();
  const axis=id==='htrack'?'x':'y',p=point(e),metrics=scrollMetrics(axis);
  const position=axis==='x'?p.x-104:p.y-48;
  if(position<metrics.position||position>=metrics.position+metrics.size){
    const direction=position<metrics.position?-1:1;
    pan(axis==='x'?direction*Math.floor(528/zoom):0,axis==='y'?direction*Math.floor(400/zoom):0);
    return;
  }
  scrollDrag={id:e.pointerId,axis,grab:position-metrics.position,before:axis==='x'?scrollX:scrollY};
  $('stage').setPointerCapture(e.pointerId);
},true);
$('stage').addEventListener('click',e=>{
  const id=(e.target as HTMLElement).closest<HTMLElement>('[data-hotspot]')?.dataset.hotspot;
  if((id==='vtrack'||id==='htrack')&&e.detail>0){e.preventDefault();e.stopPropagation();}
},true);
$('stage').addEventListener('pointermove',e=>{
  if(!scrollDrag)return;
  const {axis,grab}=scrollDrag,p=point(e);
  const offset=scrollFromThumb((axis==='x'?p.x-104:p.y-48)-grab,scrollMetrics(axis));
  if(axis==='x')scrollX=offset;else scrollY=offset;render();
});
function finishScroll(cancel=false){
  const current=scrollDrag;if(!current)return;scrollDrag=null;
  if(cancel){if(current.axis==='x')scrollX=current.before;else scrollY=current.before;render();}
  if($('stage').hasPointerCapture(current.id))$('stage').releasePointerCapture(current.id);
}
$('stage').addEventListener('pointerup',()=>finishScroll());
$('stage').addEventListener('pointercancel',()=>finishScroll(true));
$('stage').addEventListener('lostpointercapture',()=>finishScroll(true));
$('stage').addEventListener('contextmenu',e=>{
  e.preventDefault();const p=point(e);if(!dialog&&p.x>=8&&p.x<72&&p.y>=380&&p.y<444){editor.background=Math.floor((p.y-380)/16)*4+Math.floor((p.x-8)/16);render();}
});
canvas.addEventListener('wheel',e=>{if(dialog||splashVisible)return;e.preventDefault();pan(e.shiftKey?Math.sign(e.deltaY)*32:0,e.shiftKey?0:Math.sign(e.deltaY)*32);},{passive:false});
ime.addEventListener('input',()=>{textDraft=ime.value;render();});
ime.addEventListener('keydown',e=>{if(e.isComposing)return;if(e.key==='Enter'){e.preventDefault();e.stopPropagation();commitText();canvas.focus();render();}if(e.key==='Escape'){e.stopPropagation();textAnchor=null;textDraft='';ime.value='';canvas.focus();render();}});
fileInput.addEventListener('change',async()=>{
  const file=fileInput.files?.[0],intent=fileIntent;fileInput.value='';if(!file||!intent)return;
  const current=()=>intent.generation===readGeneration&&intent.owner===dialog;
  try{if(file.size>16*1024*1024)throw new Error('16MB 이하의 ART 또는 PCX를 선택하세요.');const image=decodeFile(new Uint8Array(await file.arrayBuffer()));if(current())installImage(image,file.name,intent.partial);}
  catch(e){if(current())browserDialog('파일을 열 수 없습니다',errorText(e));}
});
window.addEventListener('keydown',e=>{
  if(browserDialogOpen()||e.isComposing)return;
  if(e.shiftKey&&e.key==='F1'){
    e.preventDefault();
    browserDialog('웹 버전 조작법','마우스 휠로 세로 이동하고 Shift와 휠로 가로 이동합니다. Ctrl+Z로 실행을 취소하고 Ctrl+Y로 다시 실행합니다.\n\nF2로 그림을 다운로드합니다. PNG 저장과 PDF 인쇄는 출력 → 전체 찍기 → 인쇄에서 선택할 수 있습니다. 편집 중인 그림은 이 브라우저에 임시 보관됩니다.');
    return;
  }
  if(dialog?.kind==='printer' && (e.key!=='Enter'||!(e.target instanceof HTMLButtonElement)) && printer.key(e.key)){
    e.preventDefault();if(!browserDialogOpen())canvas.focus();return;
  }
  if(viewOnly&&!['Tab','Shift','Control','Alt','Meta'].includes(e.key)){e.preventDefault();viewOnly=false;render();return;}
  if(e.key==='Escape'){
    if(scrollDrag){e.preventDefault();finishScroll(true);return;}
    e.preventDefault();if(splashVisible){start();return;}if(dialog){closeDialog();return;}if(viewOnly){viewOnly=false;render();return;}if(drag){finishDrag(true);return;}if(editor.isPasting){editor.cancelPaste();render();return;}if(editor.selection){editor.selection=null;render();return;}menu=menu<0?0:-1;menuRow=0;render();return;
  }
  if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement)return;
  if(splashVisible){if(!e.ctrlKey&&!e.altKey&&!['Tab','Shift','Control','Alt','Meta'].includes(e.key)){e.preventDefault();start();}return;}
  if(dialog){
    if(dialog.dismissAnyKey&&!['Tab','Shift','Control','Alt','Meta'].includes(e.key)){e.preventDefault();closeDialog();return;}
    if(dialog.kind==='files'&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const names=samples.filter(n=>n.endsWith(fileFormat)).sort(),i=names.indexOf(fileChoice);fileChoice=names[(i+(e.key==='ArrowDown'?1:names.length-1))%names.length];render();return;}
    if(e.key==='Enter'&&e.target===canvas){e.preventDefault();dialog.buttons[0]?.action();}return;
  }
  if(menu>=0&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter'].includes(e.key)){
    e.preventDefault();if(e.key==='ArrowLeft')menu=(menu+5)%6;if(e.key==='ArrowRight')menu=(menu+1)%6;
    if(e.key==='ArrowDown')menuRow=(menuRow+1)%menus[menu].items.length;
    if(e.key==='ArrowUp')menuRow=(menuRow+menus[menu].items.length-1)%menus[menu].items.length;
    menuRow=Math.min(menuRow,menus[menu].items.length-1);if(e.key==='Enter'){action(menus[menu].items[menuRow][1]);return;}render();return;
  }
  const k=e.key.toLowerCase();let cmd='';
  if(e.altKey)cmd=({n:'new',u:'undo',g:'text',w:'rename',d:'open',t:'time',p:'print',x:'exit',s:'reference',j:'dos',f2:'savePcx',f5:'fullscreen'} as Record<string,string>)[k]??'';
  else if(e.ctrlKey||e.metaKey)cmd=({z:e.shiftKey?'redo':'undo',y:'redo',s:'sound',o:'open',c:'copy',v:'paste',a:'selectAll',p:'printer'} as Record<string,string>)[k]??'';
  else cmd=({f1:'help',f2:'save',f3:'open',f6:'open',f9:'gallery',f10:'menu',delete:'clear'} as Record<string,string>)[k]??'';
  if(cmd){e.preventDefault();finishDrag();if(cmd==='paste'){if(clipboard)editor.beginPaste(clipboard);announce('붙여넣을 위치를 클릭하세요.');}else if(cmd==='selectAll'){editor.cancelPaste();editor.selection={x:0,y:0,w:editor.raster.width,h:editor.raster.height};}else if(cmd==='clear'){editor.cancelPaste();editor.checkpoint();editor.clear();changed();}else if(cmd==='menu'){menu=menu<0?0:-1;menuRow=0;}else{action(cmd);return;}render();}
  else if(e.key.startsWith('Arrow')){e.preventDefault();pan(e.key==='ArrowLeft'?-16:e.key==='ArrowRight'?16:0,e.key==='ArrowUp'?-16:e.key==='ArrowDown'?16:0);}
});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!splashVisible){finishDrag();void persist();}});

async function boot(){
  const [k,en,pko,pen,ic,li,intro,tables,palette,mi,ar,co,logo,dr,clockFrames]=await Promise.all([
    bytes('H2IYAGI.FNT'),bytes('H2ENG_M.FNT'),bytes(fontKo),bytes(fontEn),bytes('ICON.FNT'),bytes('LINE.FNT'),bytes('HANUL.^_^'),
    fetch(`${import.meta.env.BASE_URL}generated/font-tables.json`).then(r=>r.json() as Promise<FontTables>),
    fetch(`${import.meta.env.BASE_URL}generated/intro-palette.json`).then(r=>r.json() as Promise<Palette>),
    bytes('PULLDOWN.FNT'),bytes('ARROW.FNT'),bytes('COLOR.FNT'),
    fetch(`${import.meta.env.BASE_URL}generated/cow.bgi`).then(r=>r.arrayBuffer()).then(b=>new Uint8Array(b)),bytes('DRIVE.FON'),bytes('TIME.FNT'),
  ]);
  clockIcons=clockFrames;
  uiFont=new BitmapFont(k,en,tables);paintFont=new BitmapFont(pko,pen,tables);icons=decodePlanar(ic);lines=decodePlanar(li);splash=decodePlanar(intro);introPalette=palette;
  menuIcons=decodeMenuIcons(mi);arrows=Array.from({length:8},(_,i)=>decodePlanar(ar.slice(i*144,(i+1)*144)));colors=decodePlanar(co);
  cow=decodeBgi(logo);drives=Array.from({length:3},(_,i)=>decodeBgi(dr.slice(i*326,(i+1)*326)));
  screen=new Screen(canvas,controls,uiFont);
  try{const saved=await loadWork();if(saved){editor.replace(saved.image);editor.filename=saved.filename;}}catch{storageWarning();}
  $('loading').hidden=true;render();if(!browserDialogOpen())canvas.focus();
}
void boot().catch(e=>{$('loading').textContent=`하늘을 불러오지 못했습니다: ${errorText(e)}. 새로고침해 주세요.`;});
