import { NES } from 'jsnes';
import ROM from '../node_modules/jsnes/src/rom.js';
import { Mapper23 } from './mapper23.js';
import { fixSpriteRendering } from './ppu-compat.js';

// JSNES 2.1.0's MMC1 accepts both writes of a 6502 read-modify-write
// instruction. Real MMC1 ignores a write on the cycle immediately after
// an accepted write. Snow Bros. uses this hardware behavior during startup.
function fixMMC1(mapper, nes) {
  if (nes.rom.mapperType !== 1) return mapper;
  mapper.lastMMC1WriteCycle = null;
  const write = mapper.write.bind(mapper);
  mapper.write = (address, value) => {
    if (address >= 0x8000) {
      const cycle = nes.cpu._cpuCycleBase + nes.cpu.instrBusCycles;
      if (mapper.lastMMC1WriteCycle !== null && cycle === mapper.lastMMC1WriteCycle + 1) return;
      mapper.lastMMC1WriteCycle = cycle;
    }
    write(address, value);
  };
  const toJSON = mapper.toJSON.bind(mapper);
  const fromJSON = mapper.fromJSON.bind(mapper);
  mapper.toJSON = () => ({ ...toJSON(), lastMMC1WriteCycle: mapper.lastMMC1WriteCycle });
  mapper.fromJSON = state => {
    fromJSON(state);
    mapper.lastMMC1WriteCycle = state.lastMMC1WriteCycle ?? null;
  };
  return mapper;
}

export class CompatibleNES extends NES {
  toJSON() {
    const state=super.toJSON();
    // JSNES includes live Tile cache objects here; serialize their actual pixel
    // data instead of instance metadata, and preserve their shape after JSON.
    state.ppu.scantile=state.ppu.scantile.map(tile=>tile?{
      pix:Array.from(tile.pix),opaque:Array.from(tile.opaque),
    }:null);
    return state;
  }
  reset() {
    super.reset();
    fixSpriteRendering(this.ppu);
  }
  loadROM(bytes) {
    // Match the pinned upstream loader, installing our factory before reset.
    // Keep the original ROM header and bytes intact.
    this.rom = new ROM(this);
    this.rom.load(bytes);
    const createMapper = this.rom.createMapper.bind(this.rom);
    this.rom.createMapper = () => {
      if (this.rom.mapperType === 23) {
        if (this.rom.isNES2 && ![0, 3].includes(this.rom.subMapper)) {
          throw Error('尚未支持这份 Mapper 23 卡带的 VRC4 子类型');
        }
        return new Mapper23(this);
      }
      return fixMMC1(createMapper(), this);
    };
    this.reset();
    this.mmap = this.rom.createMapper();
    this.mmap.loadROM();
    this.ppu.setMirroring(this.rom.getMirroringType());
    this.romData = bytes;
  }
}
