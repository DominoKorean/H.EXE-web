import {Raster} from './raster.js';
import {VGA_PALETTE,type IndexedImage,type Palette} from './formats.js';
export interface Selection {x:number;y:number;w:number;h:number}
type Snapshot=IndexedImage & {selection:Selection|null;filename:string};
export class Editor {
  raster:Raster;
  palette:Palette=VGA_PALETTE.map(c=>[...c]);
  selection:Selection|null=null;
  foreground=0; background=15; filename='NONAME.ART';
  private past:Snapshot[]=[];private future:Snapshot[]=[];
  private editing:Snapshot|null=null;
  private floating:{image:IndexedImage;source:Selection|null}|null=null;
  constructor(w=640,h=704){this.raster=new Raster(w,h);}
  image():IndexedImage{return {width:this.raster.width,height:this.raster.height,pixels:this.raster.pixels,palette:this.palette};}
  private snapshot():Snapshot{return {...this.image(),pixels:this.raster.pixels.slice(),palette:this.palette.map(c=>[...c]),selection:this.selection?{...this.selection}:null,filename:this.filename};}
  private record(s:Snapshot){this.past.push(s);if(this.past.length>30)this.past.shift();this.future=[];}
  checkpoint(){this.record(this.snapshot());}
  beginEdit(){if(!this.editing)this.editing=this.snapshot();}
  commitEdit(){if(!this.editing)return false;const s=this.editing;this.editing=null;this.record(s);return true;}
  cancelEdit(){if(this.editing){const s=this.editing;this.editing=null;this.restore(s);}}
  replace(image:IndexedImage){this.raster=new Raster(image.width,image.height,15,image.pixels);this.palette=image.palette.map(c=>[...c]);this.selection=null;this.floating=null;this.editing=null;}
  private restore(s:Snapshot){this.replace(s);this.selection=s.selection;this.filename=s.filename;}
  undo(){this.commitEdit();this.cancelPaste();const s=this.past.pop();if(s){this.future.push(this.snapshot());this.restore(s);return true;}return false;}
  redo(){this.commitEdit();this.cancelPaste();const s=this.future.pop();if(s){this.past.push(this.snapshot());this.restore(s);return true;}return false;}
  get isPasting(){return this.floating!==null;}
  beginPaste(image:IndexedImage,move=false){this.floating={image:{...image,pixels:image.pixels.slice(),palette:image.palette.map(c=>[...c])},source:move?{...this.region()}:null};}
  cancelPaste(){this.floating=null;}
  placePaste(x:number,y:number){
    const pending=this.floating;if(!pending)return false;
    if(x<0||y<0||x>=this.raster.width||y>=this.raster.height)return false;
    this.checkpoint();this.floating=null;
    const {image,source}=pending;
    if(source)this.raster.rect(source.x,source.y,source.x+source.w-1,source.y+source.h-1,this.background,true);
    const map=image.palette.map((c,index)=>{
      if(c.every((v,j)=>v===this.palette[index][j]))return index;
      let best=0,distance=Infinity;
      this.palette.forEach((p,i)=>{const d=p.reduce((sum,v,j)=>sum+(v-c[j])**2,0);if(d<distance){distance=d;best=i;}});return best;
    });
    this.raster.blit(image.pixels.map(c=>map[c]),image.width,image.height,x,y);
    this.selection={x,y,w:Math.min(image.width,this.raster.width-x),h:Math.min(image.height,this.raster.height-y)};return true;
  }
  region():Selection{return this.selection??{x:0,y:0,w:this.raster.width,h:this.raster.height};}
  copy(){const s=this.region(),pixels=new Uint8Array(s.w*s.h);for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++)pixels[y*s.w+x]=this.raster.get(s.x+x,s.y+y);return {width:s.w,height:s.h,pixels,palette:this.palette.map(c=>[...c])};}
  clear(){const s=this.region();this.raster.rect(s.x,s.y,s.x+s.w-1,s.y+s.h-1,this.background,true);}
  transform(kind:'flipX'|'flipY'|'invert'|'rotate') {
    const s=this.region(),image=this.copy();
    if(kind==='rotate') {
      this.clear();
      if(!this.selection)this.raster=new Raster(s.h,s.w,this.background);
      for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++)this.raster.set(s.x+s.h-1-y,s.y+x,image.pixels[y*s.w+x]);
      if(this.selection)this.selection={x:s.x,y:s.y,w:Math.min(s.h,this.raster.width-s.x),h:Math.min(s.w,this.raster.height-s.y)};
    } else for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++) {
      const c=image.pixels[(kind==='flipY'?s.h-1-y:y)*s.w+(kind==='flipX'?s.w-1-x:x)];
      this.raster.set(s.x+x,s.y+y,kind==='invert'?15-c:c);
    }
  }
  resizeRegion(w:number,h:number) {
    if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>4194304)throw new Error('그림 크기가 올바르지 않습니다.');
    const s=this.region(),image=this.copy();this.clear();
    if(!this.selection)this.raster=new Raster(w,h,this.background);
    for(let y=0;y<Math.min(h,this.raster.height-s.y);y++)for(let x=0;x<Math.min(w,this.raster.width-s.x);x++)
      this.raster.set(s.x+x,s.y+y,image.pixels[Math.floor(y*s.h/h)*s.w+Math.floor(x*s.w/w)]);
    if(this.selection)this.selection={x:s.x,y:s.y,w:Math.min(w,this.raster.width-s.x),h:Math.min(h,this.raster.height-s.y)};
  }
}
