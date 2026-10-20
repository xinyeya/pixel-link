// Original NROM demo: a tiny two-player park, assembled locally. No third-party ROM.
import { writeFileSync } from 'node:fs';
const prg=new Uint8Array(16384).fill(0xea), chr=new Uint8Array(8192);
let pc=0;const labels={},fixups=[];
const emit=(...bytes)=>{prg.set(bytes,pc);pc+=bytes.length;};
const label=n=>labels[n]=pc+0xc000;
const branch=(op,n)=>{emit(op,0);fixups.push({pos:pc-1,n,relative:true});};
const jump=n=>{emit(0x4c,0,0);fixups.push({pos:pc-2,n});};
const lda=v=>emit(0xa9,v),sta=a=>emit(0x8d,a&255,a>>8);
label('reset');emit(0x78,0xd8,0xa2,0xff,0x9a,0xe8);emit(0x8e,0,0x20,0x8e,1,0x20,0x8e,0x10,0x40);
label('vblank');emit(0x2c,2,0x20);branch(0x10,'vblank');
lda(0);emit(0xa2,0);label('clear');emit(0x95,0,0x9d,0,2,0xe8);branch(0xd0,'clear');
lda(100);sta(0x200);lda(1);sta(0x201);lda(0);sta(0x202);lda(75);sta(0x203);
lda(140);sta(0x204);lda(1);sta(0x205);lda(1);sta(0x206);lda(170);sta(0x207);
// Hide all unused sprites.
lda(0xff);emit(0xa2,8);label('hide');emit(0x9d,0,2,0xe8);branch(0xd0,'hide');
// Palette.
lda(0x3f);sta(0x2006);lda(0);sta(0x2006);emit(0xa2,0);label('palette');emit(0xbd,0,0);fixups.push({pos:pc-2,n:'palData'});sta(0x2007);emit(0xe8,0xe0,32);branch(0xd0,'palette');
// Nametable, unrolled as 4 pages.
lda(0x20);sta(0x2006);lda(0);sta(0x2006);
for(let page=0;page<4;page++){emit(0xa2,0);label('map'+page);emit(0xbd,0,0);fixups.push({pos:pc-2,n:'mapData',offset:page*256});sta(0x2007);emit(0xe8);branch(0xd0,'map'+page);}
lda(0);sta(0x2005);sta(0x2005);lda(0x1e);sta(0x2001);
label('loop');emit(0x2c,2,0x20);branch(0x10,'loop');
// Both controllers serialized into RAM $10/$11. A, B, Select, Start, Up, Down, Left, Right => bits 7..0.
lda(1);sta(0x4016);lda(0);sta(0x4016);sta(0x10);sta(0x11);emit(0xa2,8);
label('read');emit(0xad,0x16,0x40,0x4a,0x26,0x10,0xad,0x17,0x40,0x4a,0x26,0x11,0xca);branch(0xd0,'read');
for(let p=0;p<2;p++){
  const pad=0x10+p,x=0x203+p*4,y=0x200+p*4;
  for(const [mask,addr,opcode,name] of [[1,x,0xee,'right'],[2,x,0xce,'left'],[4,y,0xee,'down'],[8,y,0xce,'up']]){
    emit(0xa5,pad,0x29,mask);branch(0xf0,'skip'+p+name);emit(opcode,addr&255,addr>>8);label('skip'+p+name);
  }
}
lda(0);sta(0x2003);lda(2);sta(0x4014);lda(0);sta(0x2005);sta(0x2005);
label('waitEnd');emit(0x2c,2,0x20);branch(0x30,'waitEnd');jump('loop');
label('palData');emit(...[0x0f,0x1a,0x2a,0x30, 0x0f,0x19,0x29,0x30, 0x0f,0x12,0x22,0x30, 0x0f,0x16,0x26,0x30, 0x0f,0x29,0x19,0x30, 0x0f,0x26,0x16,0x30, 0x0f,0x12,0x22,0x30, 0x0f,0x16,0x26,0x30]);
const font={A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],I:['11111','00100','00100','00100','00100','00100','11111'],J:['00111','00010','00010','00010','10010','10010','01100'],K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],Q:['01110','10001','10001','10001','10101','10010','01101'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],W:['10001','10001','10001','10101','10101','11011','10001'],X:['10001','10001','01010','00100','01010','10001','10001'],Y:['10001','10001','01010','00100','00100','00100','00100'],Z:['11111','00001','00010','00100','01000','10000','11111'],'1':['00100','01100','00100','00100','00100','00100','01110'],'2':['01110','10001','00001','00010','00100','01000','11111'],'+':['00000','00100','00100','11111','00100','00100','00000'],'.':['00000','00000','00000','00000','00000','00110','00110']};
const tile=(id,rows)=>rows.forEach((r,y)=>{chr[id*16+y]=r;});
tile(1,[0x3c,0x7e,0x5a,0x7e,0x3c,0x7e,0x5a,0x24]);tile(2,[0,0,0x10,0x28,0,0,0,0]);tile(3,[0,0x18,0x3c,0x7e,0xff,0x18,0x18,0]);tile(4,[255,0,0,0,0,0,0,255]);
const charIds={};let id=16;for(const [c,rows] of Object.entries(font)){charIds[c]=id;tile(id++,rows.map(r=>parseInt(r,2)<<2));}
const map=new Uint8Array(1024);for(let y=10;y<24;y++)for(let x=3;x<29;x++)map[y*32+x]=(x%7===0&&y%4===0)?3:((x+y)%5===0?2:0);
function text(y,s){let x=Math.floor((32-s.length)/2);for(const c of s)map[y*32+x++]=charIds[c]||0;}
text(3,'P I X E L  P A R K');text(6,'1P + 2P');text(26,'A LITTLE ROOM FOR TWO');text(28,'MOVE. MEET. PLAY.');for(let x=2;x<30;x++)map[8*32+x]=4;
label('mapData');emit(...map);
for(const f of fixups){const addr=labels[f.n]+(f.offset||0);if(f.relative){const delta=addr-(0xc000+f.pos+1);if(delta < -128||delta>127)throw Error('branch too far');prg[f.pos]=delta&255;}else{prg[f.pos]=addr&255;prg[f.pos+1]=addr>>8;}}
for(const at of [0x3ffa,0x3ffc,0x3ffe]){prg[at]=labels.reset&255;prg[at+1]=labels.reset>>8;}
const header=Uint8Array.from([0x4e,0x45,0x53,0x1a,1,1,0,0,0,0,0,0,0,0,0,0]);
writeFileSync(new URL('../public/demo.nes',import.meta.url),Buffer.concat([header,prg,chr]));console.log('Original two-player demo generated.');
