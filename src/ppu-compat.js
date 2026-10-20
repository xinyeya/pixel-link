// Correct JSNES 2.1.0's 8x16 sprite addressing. Bit 0 selects the pattern
// table; the remaining bits select an EVEN top tile, followed by its odd
// bottom tile. In particular OAM tile $01 means tiles $100/$101, not $FF/$100.
export function fixSpriteRendering(ppu) {
  const originalRender = ppu.renderSpritesPartially.bind(ppu);
  ppu.renderSpritesPartially = (start, count, bgPriority) => {
    if (ppu.f_spriteSize === 0) return originalRender(start, count, bgPriority);
    if (ppu.f_spVisibility !== 1) return;
    const mapper = ppu.nes.mmap;
    for (let scan = Math.max(0, start); scan < Math.min(240, start + count); scan++) {
      const base = scan * 32;
      for (let i = 0; i < ppu.scanlineSpriteCount[scan]; i++) {
        const offset = base + i * 4;
        const [y, tile, attr, x] = ppu.scanlineSecondaryOAM.subarray(offset, offset + 4);
        if (((attr >> 5) & 1) !== bgPriority) continue;
        const row = scan - (y + 1);
        if (row < 0 || row >= 16) continue;
        const flipped = (attr & 0x80) !== 0;
        const sourceRow = flipped ? 15 - row : row;
        const tileBase = ((tile & 1) << 8) | (tile & 0xfe);
        const pattern = mapper.getSpritePatternTile(tileBase + (sourceRow >> 3));
        // Tile.render applies the flip within this 8px half; select the other
        // half above for vertical flips, but keep destination rows unchanged.
        const localRow = row & 7;
        pattern.render(ppu.buffer, 0, localRow, 8, localRow + 1,
          x, y + 1 + (row & 8), (attr & 3) << 2, ppu.sprPalette,
          (attr & 0x40) !== 0, flipped, i, ppu.pixrendered);
        const address = ((tile & 1) << 12) + (tile & 0xfe) * 16;
        mapper.latchAccess(address + 8);
        mapper.latchAccess(address + 24);
      }
    }
  };
  const originalCheck = ppu.checkSprite0.bind(ppu);
  ppu.checkSprite0 = scan => {
    if (ppu.f_spriteSize === 0) return originalCheck(scan);
    ppu.spr0HitX = ppu.spr0HitY = -1;
    if (scan < 0 || scan >= 240 || !ppu.scanlineSprite0[scan] || !ppu.scanlineSpriteCount[scan]) return false;
    const base = scan * 32;
    const [y, tile, attr, x] = ppu.scanlineSecondaryOAM.subarray(base, base + 4);
    const row = scan - (y + 1);
    if (row < 0 || row >= 16 || x >= 256) return false;
    const sourceRow = (attr & 0x80) ? 15 - row : row;
    const tileIndex = ((tile & 1) << 8) + (tile & 0xfe) + (sourceRow >> 3);
    const pattern = ppu.nes.mmap.getSpritePatternTile(tileIndex);
    return ppu._checkSpr0Pixels(pattern, (sourceRow & 7) * 8, x, (attr & 0x40) !== 0,
      scan, ppu.f_spClipping === 0 || ppu.f_bgClipping === 0);
  };
}
