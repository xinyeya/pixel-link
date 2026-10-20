import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CompatibleNES} from '../src/nes-core.js';
function setup(tile,attr){
 const nes=new CompatibleNES();nes.loadROM(readFileSync(new URL('../public/demo.nes',import.meta.url)));
 const p=nes.ppu;p.f_spVisibility=1;p.f_spriteSize=1;p.f_spClipping=p.f_bgClipping=1;
 p.buffer.fill(0);p.pixrendered.fill(255);p.sprPalette.set([0,0x11,0x22,0x33]);
 // Unique per-pixel source pattern, so swapped halves and flip errors fail.
 for(let t=0;t<512;t++)for(let y=0;y<8;y++)for(let x=0;x<8;x++)p.ptTile[t].pix[y*8+x]=1+((t+2*y+x)%3);
 for(let scan=21;scan<37;scan++){p.scanlineSpriteCount[scan]=1;p.scanlineSprite0[scan]=1;p.scanlineSecondaryOAM.set([20,tile,attr,40],scan*32);}
 return p;
}
for(const tile of [0,1,2,3,254,255])for(const attr of [0,0x40,0x80,0xc0]){
 test(`8x16 tile ${tile.toString(16)}, flips ${attr.toString(16)}: both halves match pattern pixels`,()=>{
  const p=setup(tile,attr);p.renderSpritesPartially(21,16,0);
  for(let y=0;y<16;y++)for(let x=0;x<8;x++){
   const sy=(attr&0x80)?15-y:y,sx=(attr&0x40)?7-x:x;
   const index=((tile&1)<<8)+(tile&254)+(sy>>3);
   const expected=p.sprPalette[p.ptTile[index].pix[(sy&7)*8+sx]];
   assert.equal(p.buffer[(21+y)*256+40+x],expected,`pixel ${x},${y}`);
  }
 });
}
test('8x16 sprite zero hit uses the same flipped pattern row as rendering',()=>{
 for(const tile of [0,1,255])for(const attr of [0,0x40,0x80,0xc0]){
  const p=setup(tile,attr);
  for(let row=0;row<16;row++){
   for(const t of p.ptTile)t.pix.fill(0);
   const sy=(attr&0x80)?15-row:row,sx=(attr&0x40)?4:3;
   const index=((tile&1)<<8)+(tile&254)+(sy>>3);
   p.ptTile[index].pix[(sy&7)*8+sx]=1;
   p.pixrendered.fill(255);p.pixrendered[(row+21)*256+43]=0x1ff;
   assert.equal(p.checkSprite0(row+21),true);assert.equal(p.spr0HitX,43);assert.equal(p.spr0HitY,row+21);
  }
 }
});
test('sprite rendering respects priority, transparency and the eight sprite selection',()=>{
 const p=setup(1,0x20);p.renderSpritesPartially(21,16,0);assert.equal(p.buffer[21*256+40],0);
 p.ptTile[256].pix.fill(0);p.renderSpritesPartially(21,16,1);assert.equal(p.buffer[21*256+40],0);assert.notEqual(p.buffer[29*256+40],0);
});
