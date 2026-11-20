export type Palette = number[][];
export interface IndexedImage { width: number; height: number; pixels: Uint8Array; palette: Palette }
export const VGA_PALETTE: Palette = [
  [0,0,0],[0,0,170],[0,170,0],[0,170,170],[170,0,0],[170,0,170],[170,85,0],[170,170,170],
  [85,85,85],[85,85,255],[85,255,85],[85,255,255],[255,85,85],[255,85,255],[255,255,85],[255,255,255],
];
const signature = 'HANUL ART IMAGE FILE V2.0';
function dimensions(w: number, h: number) {
  if (!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>4096||h>4096||w*h>4194304)
    throw new Error('그림 크기가 올바르지 않거나 너무 큽니다.');
}
function word(b: Uint8Array, o: number) { return b[o] | (b[o+1]<<8); }
function putWord(b: Uint8Array, o: number, v: number) { b[o]=v&255; b[o+1]=v>>8; }
function unpack(planes: Uint8Array[], width: number, height: number, stride: number, palette: Palette): IndexedImage {
  const pixels=new Uint8Array(width*height);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const i=y*stride+(x>>3), bit=7-(x&7);
    pixels[y*width+x]=planes.reduce((c,p,n)=>c|(((p[i]>>bit)&1)<<n),0);
  }
  return {width,height,pixels,palette};
}
function pack(image: IndexedImage, stride: number): Uint8Array[] {
  dimensions(image.width,image.height);
  if(image.pixels.length!==image.width*image.height || image.palette.length!==16 || image.pixels.some(c=>c>15))
    throw new Error('16색 그림 데이터가 올바르지 않습니다.');
  const planes=Array.from({length:4},()=>new Uint8Array(stride*image.height));
  for(let y=0;y<image.height;y++) for(let x=0;x<image.width;x++) {
    const c=image.pixels[y*image.width+x], i=y*stride+(x>>3), mask=1<<(7-(x&7));
    for(let p=0;p<4;p++) if(c&(1<<p)) planes[p][i]|=mask;
  }
  return planes;
}
export function decodePlanar(b: Uint8Array): IndexedImage {
  if(b.length<16) throw new Error('비트플레인 파일이 너무 짧습니다.');
  const stride=word(b,0), height=word(b,2), width=stride*8;
  dimensions(width,height);
  const size=4+stride*height;
  if(b.length!==size*4) throw new Error('비트플레인 파일 길이가 맞지 않습니다.');
  const planes=Array.from({length:4},(_,p)=>{
    if(word(b,p*size)!==stride||word(b,p*size+2)!==height) throw new Error('비트플레인 머리글이 다릅니다.');
    return b.subarray(p*size+4,(p+1)*size);
  });
  return unpack(planes,width,height,stride,VGA_PALETTE.map(c=>[...c]));
}
export function decodeMenuIcons(b: Uint8Array): IndexedImage[] {
  if(b.length!==780)throw new Error('차림표 아이콘 길이가 맞지 않습니다.');
  // H.EXE file offset C4C7: reads 130 bytes after a synthetic BGI 15,15 header.
  // 16 rows, four MSB-first 16-bit planes per row, followed by two padding bytes.
  return Array.from({length:6},(_,i)=>{
    const pixels=new Uint8Array(256);
    for(let y=0;y<16;y++)for(let x=0;x<16;x++)for(let p=0;p<4;p++)
      pixels[y*16+x]|=((b[i*130+y*8+p*2+(x>>3)]>>(7-(x&7)))&1)<<(3-p);
    return {width:16,height:16,pixels,palette:VGA_PALETTE.map(c=>[...c])};
  });
}
export function decodeBgi(b:Uint8Array):IndexedImage {
  if(b.length<4)throw new Error('BGI 그림 머리글이 없습니다.');
  const width=word(b,0)+1,height=word(b,2)+1;dimensions(width,height);
  const stride=Math.ceil(width/8),size=4+stride*height*4;
  if(b.length!==size&&b.length!==size+2)throw new Error('BGI 그림 길이가 맞지 않습니다.');
  const pixels=new Uint8Array(width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let p=0;p<4;p++)
    pixels[y*width+x]|=((b[4+y*stride*4+p*stride+(x>>3)]>>(7-(x&7)))&1)<<(3-p);
  return {width,height,pixels,palette:VGA_PALETTE.map(c=>[...c])};
}
export function decodeArt(b: Uint8Array): IndexedImage {
  if(b.length<256||new TextDecoder().decode(b.subarray(0,signature.length))!==signature||b[25]!==0||b[0x5a]!==4)
    throw new Error('하늘 2.0 ART 파일이 아닙니다.');
  const width=word(b,0x5b),height=word(b,0x5d); dimensions(width,height);
  if(width%8||width*height/8>65535) throw new Error('지원하지 않는 ART 그림 크기입니다.');
  if(b[0x59]>1) throw new Error('지원하지 않는 ART 압축 방식입니다.');
  const size=width*height/8, planes: Uint8Array[]=[];
  let pos=256;
  for(let p=0;p<4;p++) {
    if(b[0x59]===0) {
      if(pos+size>b.length) throw new Error('ART 그림 데이터가 잘렸습니다.');
      planes.push(b.slice(pos,pos+size)); pos+=size; continue;
    }
    const end=pos+word(b,0x8f+2*p), out=new Uint8Array(size+127);
    if(end>b.length) throw new Error('ART 압축 데이터가 잘렸습니다.');
    let n=0;
    while(pos<end) {
      const control=b[pos++],count=control&127;
      if(!count||n+count>out.length) throw new Error('ART 압축 길이가 올바르지 않습니다.');
      if(control&128) {
        if(pos>=end) throw new Error('ART 반복 데이터가 잘렸습니다.');
        out.fill(b[pos++],n,n+count);
      } else {
        if(pos+count>end) throw new Error('ART 원시 데이터가 잘렸습니다.');
        out.set(b.subarray(pos,pos+count),n);pos+=count;
      }
      n+=count;
    }
    if(n<size) throw new Error('ART 그림 데이터가 부족합니다.');
    // Original files contain a final RLE run extending up to 16 bytes past the plane.
    planes.push(out.slice(0,size));
  }
  const palette=Array.from({length:16},(_,i)=>Array.from(b.subarray(0x5f+3*i,0x62+3*i),v=>Math.round(Math.min(v,63)*255/63)));
  return unpack(planes,width,height,width/8,palette);
}
export function encodeArt(image: IndexedImage): Uint8Array {
  if(image.width%8||image.width*image.height/8>65535) throw new Error('ART는 가로 8의 배수, 최대 524280픽셀까지 저장할 수 있습니다. PCX로 저장하세요.');
  const planes=pack(image,image.width/8),out=new Uint8Array(256+planes[0].length*4);
  out.set(new TextEncoder().encode(signature));out[0x1a]=26;out[0x1b]=32;
  putWord(out,0x1c,800);putWord(out,0x1e,1280);
  out[0x59]=0;out[0x5a]=4;putWord(out,0x5b,image.width);putWord(out,0x5d,image.height);
  image.palette.forEach((c,i)=>c.forEach((v,j)=>out[0x5f+i*3+j]=Math.round(v*63/255)));
  planes.forEach((p,i)=>out.set(p,256+i*p.length));return out;
}
export function decodePcx(b: Uint8Array): IndexedImage {
  if(b.length<128||b[0]!==10||b[3]!==1||b[65]!==4||b[2]>1) throw new Error('16색 PCX 파일이 아닙니다.');
  const width=word(b,8)-word(b,4)+1,height=word(b,10)-word(b,6)+1,stride=word(b,66);
  dimensions(width,height);
  if(stride<Math.ceil(width/8)||stride>4096) throw new Error('PCX 행 길이가 올바르지 않습니다.');
  const planes=Array.from({length:4},()=>new Uint8Array(stride*height));
  let pos=128;
  for(let y=0;y<height;y++) {
    const row=new Uint8Array(stride*4);let n=0;
    while(n<row.length) {
      if(pos>=b.length) throw new Error('PCX 데이터가 잘렸습니다.');
      let value=b[pos++],count=1;
      if(b[2]===1&&(value&192)===192) {
        count=value&63;
        if(!count||pos>=b.length) throw new Error('PCX 압축 데이터가 올바르지 않습니다.');
        value=b[pos++];
      }
      if(n+count>row.length) throw new Error('PCX 행 범위를 넘는 데이터입니다.');
      row.fill(value,n,n+count);n+=count;
    }
    planes.forEach((p,i)=>p.set(row.subarray(i*stride,(i+1)*stride),y*stride));
  }
  const palette=Array.from({length:16},(_,i)=>Array.from(b.subarray(16+i*3,19+i*3)));
  return unpack(planes,width,height,stride,palette);
}
export function encodePcx(image: IndexedImage): Uint8Array {
  const stride=Math.ceil(image.width/16)*2,planes=pack(image,stride),header=new Uint8Array(128),data:number[]=[];
  header.set([10,5,1,1]);putWord(header,8,image.width-1);putWord(header,10,image.height-1);
  putWord(header,12,image.width);putWord(header,14,image.height);header[65]=4;putWord(header,66,stride);putWord(header,68,1);
  image.palette.forEach((c,i)=>header.set(c,16+3*i));
  for(let y=0;y<image.height;y++) for(const plane of planes) {
    let x=0;
    while(x<stride) {
      const v=plane[y*stride+x];let count=1;
      while(x+count<stride&&count<63&&plane[y*stride+x+count]===v) count++;
      if(count>1||v>=192)data.push(192|count);
      data.push(v);x+=count;
    }
  }
  const out=new Uint8Array(128+data.length);out.set(header);out.set(data,128);return out;
}
export function rgba(image: IndexedImage): Uint8ClampedArray<ArrayBuffer> {
  const out=new Uint8ClampedArray(image.pixels.length*4);
  image.pixels.forEach((c,i)=>{out.set(image.palette[c],i*4);out[i*4+3]=255;});return out;
}
