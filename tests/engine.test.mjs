import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const raster=await import('../.test-build/raster.js').catch(()=>({}));
const font=await import('../.test-build/font.js').catch(()=>({}));
const editor=await import('../.test-build/editor.js').catch(()=>({}));
test('integer line raster includes both endpoints and clips negative coordinates',()=>{
  assert.equal(typeof raster.Raster,'function');
  const r=new raster.Raster(8,8,15);r.line(-3,2,5,2,0);
  assert.deepEqual([...r.pixels.slice(16,24)],[0,0,0,0,0,0,15,15]);
});

test('vertical lines and all eight line directions terminate with connected endpoints',()=>{
  for(const [x,y]of [[4,0],[7,0],[8,4],[7,8],[4,8],[0,7],[0,4],[0,0]]){
    const r=new raster.Raster(9,9);r.line(4,4,x,y,0);
    assert.equal(r.get(4,4),0);assert.equal(r.get(x,y),0);
    assert.equal(r.pixels.filter(c=>c===0).length,Math.max(Math.abs(x-4),Math.abs(y-4))+1);
  }
});
test('flood fill stays inside a closed rectangle and same-color fill terminates',()=>{
  assert.equal(typeof raster.Raster,'function');
  const r=new raster.Raster(10,10,15);r.rect(2,2,7,7,0,false);r.flood(3,3,4);
  assert.equal(r.get(3,3),4);assert.equal(r.get(1,1),15);assert.equal(r.get(2,2),0);
  r.flood(3,3,4);assert.equal(r.pixels.filter(c=>c===4).length,16);
});
test('filled rectangles outside the image never paint an edge, and intersecting rectangles clip',()=>{
  const r=new raster.Raster(8,8,15);
  for(const box of [[10,2,12,2],[-4,2,-2,4],[2,-4,4,-2],[2,10,4,12]])r.rect(...box,0,true);
  assert.ok(r.pixels.every(c=>c===15));
  r.rect(-4,2,2,3,0,true);assert.equal(r.pixels.filter(c=>c===0).length,6);
});
test('moving is atomic: cancel leaves source intact; one undo restores a committed overlapping move',()=>{
  const e=new editor.Editor(8,8);e.raster.set(2,2,4);e.raster.set(3,2,1);e.selection={x:2,y:2,w:2,h:1};
  assert.equal(typeof e.beginPaste,'function');
  e.beginPaste(e.copy(),true);assert.equal(e.raster.get(2,2),4);
  e.cancelPaste();assert.equal(e.raster.get(2,2),4);
  e.beginPaste(e.copy(),true);e.placePaste(3,2);
  assert.deepEqual([...e.raster.pixels.slice(18,21)],[15,4,1]);
  e.undo();assert.deepEqual([...e.raster.pixels.slice(18,21)],[4,1,15]);
  e.redo();assert.deepEqual([...e.raster.pixels.slice(18,21)],[15,4,1]);
});
test('paste maps source palette to nearest destination colors and replacement cancels placement',()=>{
  const e=new editor.Editor(8,8),image=e.copy();
  image.pixels.fill(1);image.palette[1]=[170,0,0];
  assert.equal(typeof e.beginPaste,'function');
  e.beginPaste(image);e.placePaste(0,0);assert.equal(e.raster.get(0,0),4);
  e.beginPaste(image,true);e.replace({width:4,height:4,pixels:new Uint8Array(16),palette:e.palette});
  assert.equal(e.placePaste(0,0),false);assert.ok(e.raster.pixels.every(c=>c===0));
});
test('drawing transactions preserve redo on cancel and undo the whole preview on commit',()=>{
  const e=new editor.Editor(8,8);
  assert.equal(typeof e.beginEdit,'function');
  e.beginEdit();e.raster.set(1,1,4);e.commitEdit();e.undo();
  e.beginEdit();e.raster.set(4,4,1);e.cancelEdit();e.redo();
  assert.equal(e.raster.get(1,1),4);assert.equal(e.raster.get(4,4),15);
  e.beginEdit();e.raster.set(3,3,2);e.commitEdit();e.undo();assert.equal(e.raster.get(3,3),15);
});
test('history restores pixels, dimensions and palette across an imported document',()=>{
  assert.equal(typeof editor.Editor,'function');
  const e=new editor.Editor(8,8);e.checkpoint();e.raster.set(2,2,4);
  e.checkpoint();e.replace({width:16,height:8,pixels:new Uint8Array(128),palette:Array.from({length:16},()=>[1,2,3])});
  e.undo();assert.equal(e.raster.width,8);assert.equal(e.raster.get(2,2),4);assert.deepEqual(e.palette[0],[0,0,0]);
  e.undo();assert.equal(e.raster.get(2,2),15);e.redo();assert.equal(e.raster.get(2,2),4);
});
test('selection transforms preserve outside pixels and rotate a nonsquare selection',()=>{
  assert.equal(typeof editor.Editor,'function');
  const e=new editor.Editor(8,8);e.raster.set(2,2,1);e.raster.set(3,2,2);e.raster.set(4,2,3);
  e.selection={x:2,y:2,w:3,h:1};e.transform('flipX');
  assert.deepEqual([...e.raster.pixels.slice(18,21)],[3,2,1]);assert.equal(e.raster.get(0,0),15);
  e.transform('rotate');assert.equal(e.raster.get(2,2),3);assert.equal(e.raster.get(2,4),1);
});
test('Hangul glyphs use the recovered original 10/4/4 tables',async()=>{
  assert.equal(typeof font.BitmapFont,'function');
  const ko=new Uint8Array(await readFile('haneul/H2IYAGI.FNT'));
  const en=new Uint8Array(await readFile('haneul/H2ENG_B.FNT'));
  const f=new font.BitmapFont(ko,en);
  // 하: initial ㅎ variant 0, medial ㅏ variant 1, no final.
  const ha=f.glyph('하');
  for(let row=0;row<16;row++) {
    const a=ko[18*32+row*2]*256+ko[18*32+row*2+1];
    const m=ko[(190+21)*32+row*2]*256+ko[(190+21)*32+row*2+1];
    assert.equal(ha.rows[row],a|m);
  }
  assert.equal(f.glyph('A').width,8);assert.equal(f.glyph('힣').width,16);
});
