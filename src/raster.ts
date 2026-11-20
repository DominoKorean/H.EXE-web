export class Raster {
  pixels: Uint8Array;
  constructor(public width: number, public height: number, background=15, pixels?: Uint8Array) {
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>4194304) throw new Error('그림 크기가 올바르지 않습니다.');
    this.pixels=pixels?pixels.slice():new Uint8Array(width*height).fill(background);
    if(this.pixels.length!==width*height) throw new Error('그림 크기와 데이터가 다릅니다.');
  }
  get(x:number,y:number) {return x>=0&&y>=0&&x<this.width&&y<this.height?this.pixels[y*this.width+x]:-1;}
  set(x:number,y:number,c:number) { if(x>=0&&y>=0&&x<this.width&&y<this.height)this.pixels[y*this.width+x]=c&15; }
  dot(x:number,y:number,c:number,size=1) {
    const a=Math.floor((size-1)/2);
    for(let j=-a;j<size-a;j++)for(let i=-a;i<size-a;i++)this.set(x+i,y+j,c);
  }
  line(x0:number,y0:number,x1:number,y1:number,c:number,size=1,pattern=0xffff) {
    let dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,err=dx+dy,n=0;
    for(;;) {
      if((pattern>>(15-(n++%16)))&1)this.dot(x0,y0,c,size);
      if(x0===x1&&y0===y1)break;
      const e=2*err;if(e>=dy){err+=dy;x0+=sx;}if(e<=dx){err+=dx;y0+=sy;}
    }
  }
  rect(x0:number,y0:number,x1:number,y1:number,c:number,filled=false,size=1,pattern=0xffff) {
    const l=Math.min(x0,x1),r=Math.max(x0,x1),t=Math.min(y0,y1),b=Math.max(y0,y1);
    if(filled&&(r<0||l>=this.width||b<0||t>=this.height))return;
    if(filled)for(let y=Math.max(0,t);y<=Math.min(this.height-1,b);y++)this.line(Math.max(0,l),y,Math.min(this.width-1,r),y,c);
    else {this.line(l,t,r,t,c,size,pattern);this.line(r,t,r,b,c,size,pattern);this.line(r,b,l,b,c,size,pattern);this.line(l,b,l,t,c,size,pattern);}
  }
  ellipse(x0:number,y0:number,x1:number,y1:number,c:number,filled=false,size=1) {
    const cx=(x0+x1)/2,cy=(y0+y1)/2,rx=Math.abs(x1-x0)/2,ry=Math.abs(y1-y0)/2;
    if(!rx||!ry){this.line(x0,y0,x1,y1,c,size);return;}
    if(filled) {
      for(let y=Math.max(0,Math.ceil(cy-ry));y<=Math.min(this.height-1,Math.floor(cy+ry));y++) {
        const dx=rx*Math.sqrt(Math.max(0,1-((y-cy)/ry)**2));
        this.line(Math.ceil(cx-dx),y,Math.floor(cx+dx),y,c);
      }
    } else {
      const n=Math.ceil(2*Math.PI*Math.max(rx,ry));let px=Math.round(cx+rx),py=Math.round(cy);
      for(let i=1;i<=n;i++) {
        const x=Math.round(cx+rx*Math.cos(i/n*2*Math.PI)),y=Math.round(cy+ry*Math.sin(i/n*2*Math.PI));
        this.line(px,py,x,y,c,size);px=x;py=y;
      }
    }
  }
  flood(x:number,y:number,c:number) {
    const old=this.get(x,y);if(old<0||old===c)return;
    const stack:number[]=[y*this.width+x];this.set(x,y,c);
    while(stack.length) {
      const i=stack.pop()!,xx=i%this.width,yy=Math.floor(i/this.width);
      for(const [nx,ny] of [[xx-1,yy],[xx+1,yy],[xx,yy-1],[xx,yy+1]])
        if(this.get(nx,ny)===old){this.set(nx,ny,c);stack.push(ny*this.width+nx);}
    }
  }
  blit(pixels:Uint8Array,w:number,h:number,x:number,y:number,transparent=-1) {
    for(let j=0;j<h;j++)for(let i=0;i<w;i++)if(pixels[j*w+i]!==transparent)this.set(x+i,y+j,pixels[j*w+i]);
  }
}
