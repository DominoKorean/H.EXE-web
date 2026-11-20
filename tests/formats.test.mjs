import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const api = await import('../.test-build/formats.js').catch(() => ({}));
const fixture = async name => new Uint8Array(await readFile(new URL('../haneul/'+name, import.meta.url)));

test('original BGI pull-down icons decode six 16 by 16 sprites in VGA plane order', async () => {
  assert.equal(typeof api.decodeMenuIcons,'function');
  const icons=api.decodeMenuIcons(await fixture('PULLDOWN.FNT'));
  assert.equal(icons.length,6);
  assert.ok(icons.every(i=>i.width===16&&i.height===16&&i.pixels.length===256));
  assert.equal(icons[0].pixels[0],11); // Cyan background of the rainbow, not magenta.
  assert.throws(()=>api.decodeMenuIcons(new Uint8Array(12)));
});
test('embedded Haneul cow logo and drive sprites decode their BGI dimensions', async()=>{
  assert.equal(typeof api.decodeBgi,'function');
  const exe=await fixture('H.EXE');
  const logo=api.decodeBgi(exe.slice(0x196fe,0x196fe+390));
  assert.equal(logo.width,32);assert.equal(logo.height,24);assert.equal(logo.pixels[0],15);assert.equal(logo.pixels[32],9);
  const drives=await fixture('DRIVE.FON');
  for(let i=0;i<3;i++){
    const drive=api.decodeBgi(drives.slice(i*326,(i+1)*326));
    assert.equal(drive.width,40);assert.equal(drive.height,16);
  }
});

test('original four-plane ICON.FNT decodes at 64 by 224', async () => {
  assert.equal(typeof api.decodePlanar, 'function');
  const image = api.decodePlanar(await fixture('ICON.FNT'));
  assert.equal(image.width,64); assert.equal(image.height,224);
  assert.equal(image.pixels[0],0); assert.equal(image.pixels[65],15);
});
test('all original ART files decode to their stored 640 by 704 canvas', async () => {
  assert.equal(typeof api.decodeArt, 'function');
  for (const name of ['ROSE.ART','SAE.ART','WON.ART','NASSEH.ART']) {
    const image=api.decodeArt(await fixture(name));
    assert.equal(image.width,640); assert.equal(image.height,704);
    assert.equal(image.pixels.length,450560);
    assert.ok(image.pixels.every(c=>c<16));
  }
});
test('ART encoder preserves pixels and VGA DAC palette', async () => {
  assert.equal(typeof api.encodeArt,'function');
  const image=api.decodeArt(await fixture('ROSE.ART'));
  const restored=api.decodeArt(api.encodeArt(image));
  assert.deepEqual(restored,image);
});
test('original PCX decodes and roundtrips odd-width images with row padding', async () => {
  assert.equal(typeof api.decodePcx,'function');
  const image=api.decodePcx(await fixture('HEEDONG1.PCX'));
  assert.equal(image.width,640); assert.equal(image.height,480);
  const odd={width:13,height:3,pixels:Uint8Array.from({length:39},(_,i)=>i%16),palette:api.VGA_PALETTE};
  assert.deepEqual(api.decodePcx(api.encodePcx(odd)),odd);
});
test('truncated or invalid files fail explicitly before allocating image data', async () => {
  assert.equal(typeof api.decodeArt,'function');
  for (const decode of [api.decodeArt,api.decodePcx,api.decodePlanar]) {
    assert.throws(()=>decode(new Uint8Array(4)));
  }
  const art=await fixture('ROSE.ART');
  assert.throws(()=>api.decodeArt(art.slice(0,art.length-100)));
  const pcx=await fixture('HEEDONG1.PCX');
  assert.throws(()=>api.decodePcx(pcx.slice(0,300)));
});
