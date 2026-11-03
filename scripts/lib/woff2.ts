// WOFF2 の書体のファイルから、入っている文字（cmap の符号）を読む。台本の検証が「書体に無い文字」を見るのに使う（scripts/fonts.ts）。
// 書体を作る道具（fonttools）を使わずに、CI でも読めるようにする。読むのは表の一覧と cmap だけで、字形は読まない。
// WOFF2 の形（W3C の WOFF File Format 2.0）: 頭（48 バイト）→ 表の一覧（表ごとに印・元の長さ・変換したあとの長さ）→
// 全部の表をつないで brotli で縮めたもの。表は一覧の順に、間を空けずに並ぶ（変換した表は、変換したあとの長さで並ぶ）。cmap は変換しない
import { brotliDecompressSync } from 'node:zlib';

/** 表の一覧の印の番号で引く、よく使う表の名前（WOFF2 の Known Table Tags。番号 63 は、名前を 4 バイトで書く） */
const KNOWN_TAGS = [
  'cmap',
  'head',
  'hhea',
  'hmtx',
  'maxp',
  'name',
  'OS/2',
  'post',
  'cvt ',
  'fpgm',
  'glyf',
  'loca',
  'prep',
  'CFF ',
  'VORG',
  'EBDT',
  'EBLC',
  'gasp',
  'hdmx',
  'kern',
  'LTSH',
  'PCLT',
  'VDMX',
  'vhea',
  'vmtx',
  'BASE',
  'GDEF',
  'GPOS',
  'GSUB',
  'EBSC',
  'JSTF',
  'MATH',
  'CBDT',
  'CBLC',
  'COLR',
  'CPAL',
  'SVG ',
  'sbix',
  'acnt',
  'avar',
  'bdat',
  'bloc',
  'bsln',
  'cvar',
  'fdsc',
  'feat',
  'fmtx',
  'fvar',
  'gvar',
  'hsty',
  'just',
  'lcar',
  'mort',
  'morx',
  'opbd',
  'prop',
  'trak',
  'Zapf',
  'Silf',
  'Glat',
  'Gloc',
  'Feat',
  'Sill',
] as const;

type Table = { tag: string; offset: number; length: number };

/** 7 ビットずつの長さ（UIntBase128）。読んだ値と、次の位置 */
const base128 = (buf: Buffer, at: number): [number, number] => {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const b = buf[at + i];
    if (b === undefined) throw new Error('WOFF2 の表の一覧が途中で切れている');
    if (i === 0 && b === 0x80) throw new Error('WOFF2 の長さの書き方が正しくない（頭に 0 がある）');
    if (value & 0xfe000000) throw new Error('WOFF2 の長さが大きすぎる');
    value = (value << 7) | (b & 0x7f);
    if (!(b & 0x80)) return [value >>> 0, at + i + 1];
  }
  throw new Error('WOFF2 の長さが 5 バイトを超える');
};

/** WOFF2 の表を並べ直したもの（縮めたものを戻した中身と、表ごとの位置） */
export const woff2Tables = (file: Buffer): { data: Buffer; tables: Table[] } => {
  if (file.length < 48 || file.toString('latin1', 0, 4) !== 'wOF2')
    throw new Error('WOFF2 のファイルではない（頭が wOF2 でない）');
  if (file.toString('latin1', 4, 8) === 'ttcf') throw new Error('書体の集まり（TTC）の WOFF2 は読めない');
  const numTables = file.readUInt16BE(12);
  const compressedLength = file.readUInt32BE(20);
  let at = 48;
  let offset = 0;
  const tables: Table[] = [];
  for (let i = 0; i < numTables; i++) {
    const flags = file[at++];
    const index = flags & 0x3f;
    const version = flags >> 6;
    let tag: string;
    if (index === 63) {
      tag = file.toString('latin1', at, at + 4);
      at += 4;
    } else {
      const known = KNOWN_TAGS[index];
      if (!known) throw new Error(`WOFF2 の表の印の番号が分からない: ${index}`);
      tag = known;
    }
    let origLength: number;
    [origLength, at] = base128(file, at);
    // glyf と loca は版 0 が変換あり（3 が変換なし）、ほかの表は版 0 が変換なし
    const transformed = tag === 'glyf' || tag === 'loca' ? version !== 3 : version !== 0;
    let length = origLength;
    if (transformed) [length, at] = base128(file, at);
    tables.push({ tag, offset, length });
    offset += length;
  }
  const data = brotliDecompressSync(file.subarray(at, at + compressedLength));
  if (data.length < offset) throw new Error('WOFF2 の中身が、表の一覧の長さより短い');
  return { data, tables };
};

/** cmap の表から、入っている文字の符号を読む（形式 4 と 12。ほかの形式の副表は読まない） */
export const cmapCodePoints = (cmap: Buffer): Set<number> => {
  const out = new Set<number>();
  const count = cmap.readUInt16BE(2);
  for (let i = 0; i < count; i++) {
    const rec = 4 + i * 8;
    const platform = cmap.readUInt16BE(rec);
    const encoding = cmap.readUInt16BE(rec + 2);
    // Unicode の副表だけ（Windows の BMP・全部の面、Unicode の各版）
    if (!(platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10)))) continue;
    const sub = cmap.readUInt32BE(rec + 4);
    const format = cmap.readUInt16BE(sub);
    if (format === 4) {
      const segX2 = cmap.readUInt16BE(sub + 6);
      const ends = sub + 14;
      const starts = ends + segX2 + 2;
      const deltas = starts + segX2;
      const rangeOffsets = deltas + segX2;
      for (let s = 0; s < segX2; s += 2) {
        const end = cmap.readUInt16BE(ends + s);
        const start = cmap.readUInt16BE(starts + s);
        const delta = cmap.readUInt16BE(deltas + s);
        const rangeOffset = cmap.readUInt16BE(rangeOffsets + s);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let glyph: number;
          if (rangeOffset === 0) glyph = (c + delta) & 0xffff;
          else {
            const g = cmap.readUInt16BE(rangeOffsets + s + rangeOffset + (c - start) * 2);
            glyph = g === 0 ? 0 : (g + delta) & 0xffff;
          }
          if (glyph !== 0) out.add(c);
        }
      }
    } else if (format === 12) {
      const groups = cmap.readUInt32BE(sub + 12);
      for (let g = 0; g < groups; g++) {
        const at = sub + 16 + g * 12;
        const start = cmap.readUInt32BE(at);
        const end = cmap.readUInt32BE(at + 4);
        const glyph = cmap.readUInt32BE(at + 8);
        for (let c = start; c <= end; c++) if (glyph + (c - start) !== 0) out.add(c);
      }
    }
  }
  return out;
};

/** WOFF2 の書体のファイルに入っている文字の符号 */
export const woff2CodePoints = (file: Buffer): Set<number> => {
  const { data, tables } = woff2Tables(file);
  const cmap = tables.find((t) => t.tag === 'cmap');
  if (!cmap) throw new Error('WOFF2 の書体に cmap の表が無い');
  return cmapCodePoints(data.subarray(cmap.offset, cmap.offset + cmap.length));
};
