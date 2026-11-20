import {printerText as text} from './original-text.js';
import type {Screen} from './screen.js';
import type {IndexedImage} from './formats.js';

type List = 'model' | 'method' | 'size';

export class Printer {
  private model = 0;
  private method = 0;
  private size = 0;
  private list: List | null = null;
  private row = 0;
  private fromStatus = false;
  private pickingModel = false;
  private pendingModel = 0;

  constructor(private redraw: () => void, private done: () => void, private print: () => void) {}

  open(status: boolean) {
    this.fromStatus = status;
    this.pickingModel = !status;
    this.pendingModel = this.model;
    this.list = status ? null : 'model';
    this.row = this.model;
  }

  private sizes(model: number, labels: boolean) {
    if (model < 2) {
      const items = labels ? text.dot8 : text.sizes8;
      return model === 0 ? items.slice(0, 5) : items;
    }
    if (model < 4) return labels ? text.dot24 : text.sizes24;
    return labels ? text.laser : text.sizesLaser;
  }

  get dpi() { return parseInt(this.sizes(this.model, false)[this.size], 10); }

  printImage(image: IndexedImage): IndexedImage {
    // 4×4 threshold tables and luminance weights in H.EXE at 1B4A2, 1B4CA and 1B8F3.
    const thresholds = this.method === 0
      ? [0,12,3,15, 8,4,11,7, 2,14,1,13, 10,6,9,5]
      : [0,4,3,7, 8,12,11,15, 2,6,1,5, 10,14,9,13];
    const levels = image.palette.map(([r,g,b]) => Math.round((.30*r+.59*g+.11*b)*16/255));
    const pixels = new Uint8Array(image.pixels.length);
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const i = y*image.width+x;
        pixels[i] = levels[image.pixels[i]] > thresholds[(y%4)*4+x%4] ? 1 : 0;
      }
    }
    return {width:image.width, height:image.height, pixels, palette:[[0,0,0],[255,255,255]]};
  }

  private options() {
    if (this.list === 'model') return text.models;
    if (this.list === 'method') return text.methods;
    return this.sizes(this.pendingModel, true);
  }

  private change(list: List) {
    this.pendingModel = this.model;
    this.pickingModel = list === 'model';
    this.list = list;
    this.row = list === 'model' ? this.model : list === 'method' ? this.method : this.size;
    this.redraw();
  }

  private choose(index: number) {
    if (this.list === 'model') {
      this.pendingModel = index;
      this.list = 'size';
      this.row = index === this.model ? this.size : 0;
    } else {
      if (this.list === 'method') this.method = index;
      else { this.model = this.pendingModel; this.size = index; }
      this.list = null;
      if (!this.fromStatus) { this.done(); return; }
    }
    this.redraw();
  }

  key(key: string) {
    if (key === 'Escape') {
      if (this.list === 'size' && this.pickingModel) {
        this.list = 'model';
        this.row = this.pendingModel;
      } else if (this.fromStatus && this.list) this.list = null;
      else { this.done(); return true; }
    } else if (this.list && (key === 'ArrowUp' || key === 'ArrowDown')) {
      const n = this.options().length;
      this.row = (this.row + (key === 'ArrowUp' ? n - 1 : 1)) % n;
    } else if (key === 'Enter') {
      if (this.list) this.choose(this.row);
      else this.print();
      return true;
    }
    else return false;
    this.redraw();
    return true;
  }

  private drawList(screen: Screen, entries: string[], row: number, x: number, y: number, active: boolean) {
    const w = Math.max(...entries.map(label => screen.font.width(label)));
    const count = entries.length;
    screen.box(x, y, w + 16, 20 + count * 16);
    screen.box(x + 4, y + 4, w + 4, 4 + count * 16, 7, true);
    entries.forEach((label, index) => {
      const top = y + 6 + index * 16;
      if (row === index) screen.raster.rect(x + 6, top, x + 5 + w, top + 15, 0, true);
      screen.text(label, x + 6, top, row === index ? 15 : 8);
      if (active) screen.hotspot('printer-option-' + index, label.trim(), x + 6, top, w, 16, () => this.choose(index));
    });
  }

  draw(screen: Screen) {
    if (this.fromStatus) {
      screen.box(224, 120, 272, 144);
      screen.box(230, 124, 260, 130, 7, true);
      screen.box(232, 128, 256, 20, 9);
      screen.center(text.panel[0], 232, 130, 256, 15);
      const values = [text.modelStatus[this.model], text.methodStatus[this.method], this.sizes(this.model, false)[this.size]];
      (['model', 'method', 'size'] as const).forEach((list, i) => {
        const top = 156 + 24 * i, label = text.panel[i + 1];
        screen.box(240, top, 104, 20);
        screen.center(label, 240, top + 2, 104);
        screen.text(values[i], 352, top + 2, 8);
        if (!this.list) screen.hotspot('printer-' + list, label.trim(), 240, top, 104, 20, () => this.change(list));
      });
      for (const [i, x, w, color, run] of [[4, 240, 120, 14, this.print], [5, 368, 112, 12, this.done]] as const) {
        screen.box(x, 228, w, 20, 9);
        screen.center(text.panel[i], x, 230, w, color);
        if (!this.list) screen.hotspot('printer-panel-' + i, text.panel[i].trim(), x, 228, w, 20, run);
      }
    }
    if (this.list === 'model' || (this.list === 'size' && this.pickingModel)) {
      this.drawList(screen, text.models, this.list === 'model' ? this.row : this.pendingModel, 224, 40, this.list === 'model');
    }
    if (this.list && this.list !== 'model') {
      const y = this.pickingModel ? 60 + 16*this.pendingModel : 156;
      this.drawList(screen, this.options(), this.row, 200, y, true);
    }
  }
}
