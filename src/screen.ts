import {Raster} from './raster.js';
import {BitmapFont} from './font.js';
import {rgba,VGA_PALETTE,type IndexedImage} from './formats.js';
interface Hotspot {id:string;label:string;x:number;y:number;w:number;h:number;action:()=>void}
export class Screen {
  raster=new Raster(640,480,7);
  private hotspots:Hotspot[]=[];private previous='';private activeHotspots:Hotspot[]=[];
  context:CanvasRenderingContext2D;
  constructor(public canvas:HTMLCanvasElement,public overlay:HTMLElement,public font:BitmapFont) {
    this.context=canvas.getContext('2d',{alpha:false})!;
    this.context.imageSmoothingEnabled=false;
  }
  begin(color=7){this.raster.pixels.fill(color);this.hotspots=[];}
  box(x:number,y:number,w:number,h:number,color=7,sunken=false) {
    const r=this.raster;r.rect(x,y,x+w-1,y+h-1,color,true);
    r.line(x,y,x+w-1,y,sunken?0:15);r.line(x,y,x,y+h-1,sunken?0:15);
    r.line(x+w-1,y,x+w-1,y+h-1,sunken?15:0);r.line(x,y+h-1,x+w-1,y+h-1,sunken?15:0);
  }
  text(text:string,x:number,y:number,color=0){this.font.draw(this.raster,text,x,y,color);}
  center(text:string,x:number,y:number,w:number,color=0){this.text(text,Math.round(x+(w-this.font.width(text))/2),y,color);}
  asset(image:IndexedImage,x:number,y:number){this.raster.blit(image.pixels,image.width,image.height,x,y);}
  hotspot(id:string,label:string,x:number,y:number,w:number,h:number,action:()=>void){this.hotspots.push({id,label,x,y,w,h,action});}
  button(id:string,label:string,x:number,y:number,w:number,h:number,action:()=>void,active=false) {
    this.box(x,y,w,h,7,active);this.center(label,x,y+Math.floor((h-16)/2),w);
    this.hotspot(id,label,x,y,w,h,action);
  }
  present(palette=VGA_PALETTE) {
    this.context.putImageData(new ImageData(rgba({...this.raster,palette}),640,480),0,0);
    this.activeHotspots=this.hotspots;
    const key=JSON.stringify(this.hotspots.map(({action,...rest})=>rest));
    if(this.previous===key)return;
    this.previous=key;
    const focused=(document.activeElement as HTMLElement)?.dataset.hotspot;
    this.overlay.replaceChildren(...this.hotspots.map(h=>{
      const b=document.createElement('button');b.type='button';b.dataset.hotspot=h.id;b.title=h.label;b.setAttribute('aria-label',h.label);
      Object.assign(b.style,{left:h.x/640*100+'%',top:h.y/480*100+'%',width:h.w/640*100+'%',height:h.h/480*100+'%'});
      b.onclick=()=>this.activeHotspots.find(x=>x.id===h.id)?.action();
      return b;
    }));
    if(focused)this.overlay.querySelector<HTMLButtonElement>(`[data-hotspot="${focused}"]`)?.focus({preventScroll:true});
  }
}
