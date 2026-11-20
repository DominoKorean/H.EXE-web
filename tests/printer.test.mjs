import assert from 'node:assert/strict';
import test from 'node:test';
import {Printer} from '../.test-build/printer.js';

function harness() {
  const actions = new Map();
  let finished = false, printed = false;
  const screen = {
    font: {width: label => label.length * 8},
    box() {}, center() {}, text() {}, raster: {rect() {}},
    hotspot(id, label, x, y, w, h, run) { actions.set(label, run); }
  };
  const redraw = () => { actions.clear(); printer.draw(screen); };
  const printer = new Printer(redraw, () => { finished = true; }, () => { printed = true; });
  const open = status => { printer.open(status); redraw(); };
  return {printer, open, actions, finished: () => finished, printed: () => printed};
}

test('the 80-column and 132-column 8-pin menus expose different resolutions', () => {
  const {printer, open, actions, finished} = harness();
  open(false);
  printer.key('Enter');
  assert.equal(actions.size, 5);
  printer.key('Escape');
  printer.key('ArrowDown');
  printer.key('Enter');
  assert.equal(actions.size, 7);
  printer.key('ArrowUp');
  printer.key('Enter');
  assert.equal(printer.dpi, 60);
  assert.ok(finished());
});

test('only the print command reaches the browser, and print methods leave source pixels intact', () => {
  const {printer, open, actions, printed} = harness();
  open(true);
  const source = {width:4, height:4, palette:[[128,128,128]], pixels:new Uint8Array(16)};
  const dither = printer.printImage(source);
  actions.get('프린터 방법')();
  actions.get('패턴   방식')();
  const pattern = printer.printImage(source);
  assert.notDeepEqual(dither.pixels, pattern.pixels);
  assert.equal(dither.pixels.reduce((a,b)=>a+b), 8);
  assert.equal(pattern.pixels.reduce((a,b)=>a+b), 8);
  assert.deepEqual(source.pixels, new Uint8Array(16));
  assert.equal(printed(), false);
  actions.get('인쇄')();
  assert.equal(printed(), true);
});
