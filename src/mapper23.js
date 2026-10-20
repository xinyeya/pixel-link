// VRC2b (mapper 23, NES 2.0 submapper 3), used by Contra (J).
// Register behavior: https://www.nesdev.org/wiki/VRC2_and_VRC4
// Import the base implementation from our pinned JSNES 2.1.0 dependency.
import Mapper0 from '../node_modules/jsnes/src/mappers/mapper0.js';

export class Mapper23 extends Mapper0 {
  static mapperName = 'VRC2b';
  constructor(nes) {
    super(nes);
    this.prg = [0, 1];
    this.chr = Array.from({length: 8}, (_, i) => i);
    this.latch = 0;
    this.mirroring = nes.rom.getMirroringType();
  }
  loadROM() {
    this.load8kRomBank(this.prg[0], 0x8000);
    this.load8kRomBank(this.prg[1], 0xa000);
    this.loadRomBank(this.nes.rom.romCount - 1, 0xc000);
    this.chr.forEach((bank, i) => this.load1kVromBank(bank, i * 1024));
    this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET);
  }
  load(address) {
    // Contra tests bit 0 through multiple aliases of this one-bit latch.
    if (address >= 0x6000 && address < 0x7000) return (this.nes.cpu.dataBus & 0xfe) | this.latch;
    if (address >= 0x7000 && address < 0x8000) return this.nes.cpu.dataBus;
    return super.load(address);
  }
  write(address, value) {
    if (address >= 0x6000 && address < 0x7000) { this.latch = value & 1; return; }
    if (address >= 0x7000 && address < 0x8000) return;
    if (address < 0x8000) { super.write(address, value); return; }
    const region = address & 0xf000;
    if (region === 0x8000 || region === 0xa000) {
      const slot = region === 0x8000 ? 0 : 1;
      this.prg[slot] = value & 31;
      this.load8kRomBank(this.prg[slot], slot ? 0xa000 : 0x8000);
    } else if (region === 0x9000) {
      this.mirroring = value & 1;
      this.nes.ppu.setMirroring(this.mirroring);
    } else if (region >= 0xb000 && region <= 0xe000) {
      const slot = ((region - 0xb000) >> 11) + ((address >> 1) & 1);
      this.chr[slot] = address & 1
        ? (this.chr[slot] & 15) | ((value & 15) << 4)
        : (this.chr[slot] & 0xf0) | (value & 15);
      this.load1kVromBank(this.chr[slot], slot * 1024);
    }
  }
  toJSON() {
    return {...super.toJSON(), prg: [...this.prg], chr: [...this.chr], latch: this.latch, mirroring: this.mirroring};
  }
  fromJSON(state) {
    super.fromJSON(state);
    this.prg = [...state.prg];
    this.chr = [...state.chr];
    this.latch = state.latch;
    this.mirroring = state.mirroring;
    // CPU/PPU memory and tile caches are restored by NES.fromJSON afterwards.
  }
}
