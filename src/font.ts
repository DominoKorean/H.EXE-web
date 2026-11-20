import type {Raster} from './raster.js';
export interface FontTables {variants:number[];initial:number[];final:number[]}
// Extracted from H.EXE DS:034A, DS:0372, DS:038A. See docs/reverse-engineering.md.
export const FONT_TABLES: FontTables={
  variants:[0,1,2,3,0,1,2,3,0,1,2,3,4,5,6,7,8,9,0,0],
  initial:[8,8,8,8,8,8,8,8,8,9,11,11,11,9,10,12,12,12,10,9,11,8],
  final:[0,0,2,0,2,1,2,1,2,3,0,2,1,3,3,1,2,1,3,3,1,1],
};
export interface Glyph {width:number;rows:Uint16Array}
export class BitmapFont {
  private cache=new Map<string,Glyph>();
  constructor(private korean:Uint8Array,private english:Uint8Array,private tables=FONT_TABLES) {
    if(korean.length!==12224||english.length!==1536)throw new Error('원본 글꼴 크기가 올바르지 않습니다.');
  }
  glyph(character:string):Glyph {
    const cached=this.cache.get(character);if(cached)return cached;
    const code=character.codePointAt(0)??32,rows=new Uint16Array(16);let width=16;
    const merge=(glyph:number)=>{for(let y=0;y<16;y++)rows[y]|=(this.korean[glyph*32+y*2]<<8)|this.korean[glyph*32+y*2+1];};
    if(code>=0xac00&&code<=0xd7a3) {
      const s=code-0xac00,l=Math.floor(s/588),v=Math.floor(s%588/28)+1,t=s%28;
      const iv=this.tables.variants[this.tables.initial[v]+(t?5:0)];
      const mv=((l===0||l===15)?0:1)+(t?2:0),tv=this.tables.final[v];
      merge(iv*19+l);merge(190+mv*21+v-1);if(t)merge(274+tv*27+t-1);
    } else if(code>=32&&code<=127) {
      width=8;for(let y=0;y<16;y++)rows[y]=this.english[(code-32)*16+y]<<8;
    } else {
      const jamo='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', vowels='ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
      if(jamo.includes(character))merge(jamo.indexOf(character));
      else if(vowels.includes(character))merge(190+vowels.indexOf(character));
      else rows.set([0,0,0x7ffe,0x4002,0x4002,0x4002,0x4002,0x4002,0x4002,0x4002,0x4002,0x4002,0x7ffe]);
    }
    const glyph={width,rows};this.cache.set(character,glyph);return glyph;
  }
  width(text:string) {return [...text].reduce((w,c)=>w+this.glyph(c).width,0);}
  draw(raster:Raster,text:string,x:number,y:number,color:number,sx=1,sy=sx,bold=false) {
    const start=x;
    for(const c of text) {
      if(c==='\n'){x=start;y+=16*sy;continue;}
      const g=this.glyph(c);
      for(let j=0;j<16;j++)for(let i=0;i<g.width;i++)if(g.rows[j]&(0x8000>>i))
        raster.rect(x+i*sx,y+j*sy,x+(i+1)*sx-1+(bold?1:0),y+(j+1)*sy-1,color,true);
      x+=g.width*sx;
    }
  }
}
