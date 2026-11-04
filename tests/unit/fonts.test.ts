// 書体（engine/fonts/ のサブセット・engine/core/fonts.ts の一覧・scripts/fonts.ts の点検・scripts/lib/woff2.ts の読み取り）。
// 書き出しにネットが要らないこと（Google Fonts から読まないこと）も、ここで確かめる

import { describe, expect, test } from 'bun:test';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { coursesIn, VIDEOS } from '../../content';
import { CHALKFILE, THEMES, themeOf } from '../../content/themes';
import type { Video } from '../../content/types';
import {
  charSet,
  courseText,
  FIXED_TEXT,
  FONT_DIR,
  FONTS,
  type FontId,
  fontsFor,
  inRanges,
  LATIN,
  videoText,
} from '../../engine/core/fonts';
import {
  fontIssues,
  LICENSES,
  readManifest,
  requestedChars,
  SOURCES,
  UPSTREAM,
  upstreamUrl,
} from '../../scripts/fonts';
import { woff2CodePoints, woff2Tables } from '../../scripts/lib/woff2';
import { siteFontText } from '../../scripts/site/font-text';
import { course, lecture, say } from '../fixtures/content/invalid/_base';
import { required } from '../support/required';

const ROOT = path.resolve(import.meta.dir, '../..');
const IDS = Object.keys(FONTS) as FontId[];
const SRC = { videos: VIDEOS, coursesIn, themeOf };
const codePoints = (file: string) => woff2CodePoints(readFileSync(path.join(ROOT, FONT_DIR, file)));

describe('書体の一覧（engine/core/fonts.ts）と fonts.json', () => {
  test('テーマの書体と等幅の書体の、全部のファイルと元の書体・ライセンスの文がある', () => {
    const files = IDS.flatMap((id) => FONTS[id].files.map((f) => f.file));
    for (const f of files) expect(existsSync(path.join(ROOT, FONT_DIR, f))).toBe(true);
    expect(Object.keys(SOURCES).sort()).toEqual([...files].sort());
    for (const id of IDS) {
      expect(existsSync(path.join(ROOT, FONT_DIR, LICENSES[id].file))).toBe(true);
      expect(readFileSync(path.join(ROOT, FONT_DIR, LICENSES[id].file), 'utf8')).toContain(
        'SIL Open Font License, Version 1.1',
      );
    }
    // どのテーマの書体も、一覧にある
    for (const t of Object.values(THEMES))
      for (const lang of ['ja', 'en', 'zh'] as const) for (const f of fontsFor(t, lang)) expect(FONTS[f]).toBeDefined();
  });
  test('fonts.json は、ファイルの sha256 と大きさ・入っている文字の数・元の書体（固定した commit の URL）を持つ', () => {
    const m = readManifest();
    expect(m.upstream).toEqual(UPSTREAM);
    for (const id of IDS) {
      expect(m.fonts[id].family).toBe(FONTS[id].family);
      expect(m.fonts[id].licenseFile).toBe(LICENSES[id].file);
      for (const f of m.fonts[id].files) {
        expect(f.source.url).toBe(upstreamUrl(required(SOURCES[f.file]).path));
        expect(f.source.url).toContain(`/google/fonts/${UPSTREAM.commit}/`);
        expect(f.source.sha256).toBe(required(SOURCES[f.file]).sha256);
        expect(f.bytes).toBe(readFileSync(path.join(ROOT, FONT_DIR, f.file)).length);
        expect(f.chars).toBe(codePoints(f.file).size);
      }
    }
  });
  test('書体のファイルは小さい（台本の文字だけのサブセット。1 つ 1MiB 未満）', () => {
    for (const id of IDS)
      for (const f of FONTS[id].files)
        expect(readFileSync(path.join(ROOT, FONT_DIR, f.file)).length).toBeLessThan(1 << 20);
  });
  test('英字の書体（Inter・JetBrains Mono）は、前に Google Fonts から読んでいた latin の範囲の文字だけを持つ', () => {
    for (const id of ['inter', 'mono'] as const) {
      expect(FONTS[id].ranges).toBe(LATIN);
      for (const cp of codePoints(FONTS[id].files[0].file)) expect(inRanges(cp, LATIN)).toBe(true);
    }
    expect(inRanges('→'.codePointAt(0) ?? 0, LATIN)).toBe(false);
    expect(inRanges('×'.codePointAt(0) ?? 0, LATIN)).toBe(true);
  });
  test('太さごとにファイルがある書体（Zen Maru Gothic）は、どのファイルも同じ文字を持つ', () => {
    const sets = FONTS['zen-maru'].files.map((f) => [...codePoints(f.file)].sort((a, b) => a - b).join(','));
    expect(new Set(sets).size).toBe(1);
  });
});

describe('書体に入れる文字（videoText・courseText・requestedChars）', () => {
  const v = VIDEOS.find((x) => x.lang === 'ja' && x.course.cast) as Video;
  test('動画が描く文字に、場面・題・配役の名前・クレジット・部品の決まった文字（○ ×）が入る', () => {
    const text = videoText(v);
    expect(text).toContain(v.lecture.title);
    expect(text).toContain(v.course.title);
    for (const c of Object.values(v.course.cast ?? {})) expect(text).toContain(c.name);
    expect(text).toContain('ナレーション');
    expect(text).toContain('○×');
    expect(text).toContain(FIXED_TEXT);
  });
  test('書体には対応する言語の台本とサイトの文字を入れる', () => {
    const sc = new Set(requestedChars('noto-sc', SRC));
    const jp = new Set(requestedChars('noto', SRC));
    const ja = new Set(
      charSet([
        ...coursesIn('ja').map(courseText),
        ...coursesIn('en').map(courseText),
        ...siteFontText('ja'),
        ...siteFontText('en'),
      ]),
    );
    const zhOnly = charSet(coursesIn('zh').map(courseText)).filter((cp) => !ja.has(cp) && cp > 0x3000);
    expect(zhOnly.length).toBeGreaterThan(0);
    for (const cp of zhOnly) {
      expect(sc.has(cp)).toBe(true);
      expect(jp.has(cp)).toBe(false);
    }
  });
  test('文字の集まりは、重なりと改行を除いて符号の順に並べる', () => {
    expect(charSet(['ba\nb', 'a\tc'])).toEqual([0x61, 0x62, 0x63]);
  });
});

describe('書体の点検（scripts/fonts.ts の fontIssues）', () => {
  test('今の台本と書体に、誤りも注意も無い（書体に無い文字・古いサブセット・fonts.json との食い違い）', () => {
    expect(fontIssues(SRC).map((x) => `${x.level} ${x.where} ${x.message}`)).toEqual([]);
  });
  test('動画が描く文字が書体に無いと、誤りにする（元の書体にも無い文字は、台本を変えるように言う）', () => {
    // ≈ は Zen Maru Gothic に無い（fonts.json の missing）。Chalkfile のテーマは Zen Maru Gothic だけなので、等幅の書体にも無ければ描けない
    const c = course([lecture([{ kind: 'big', heading: '見出し', text: 'およそ ≈ 半分', lines: say('はい') }])], {
      theme: CHALKFILE.id,
    });
    const bad: Video = { key: 'X01', lang: 'ja', course: c, lecture: required(c.lectures[0]) };
    const got = fontIssues({ ...SRC, videos: [bad] }).filter((x) => x.level === 'error');
    expect(got.map((x) => x.where)).toEqual(['invalid-sample/X01']);
    expect(required(got[0]).message).toContain('≈（U+2248）');
    expect(required(got[0]).message).toContain('元の書体にも無い');
  });
  test('サブセットに入っていない文字は、作り直すように言う（動画の文字なら誤り、台本の文字なら注意）', () => {
    const c = course([lecture([{ kind: 'big', heading: '見出し', text: '鑢', lines: say('はい') }])], {
      theme: CHALKFILE.id,
    });
    const bad: Video = { key: 'X01', lang: 'ja', course: c, lecture: required(c.lectures[0]) };
    const got = fontIssues({
      videos: [...VIDEOS, bad],
      coursesIn: (lang) => (lang === 'ja' ? [...coursesIn('ja'), c] : coursesIn(lang)),
      themeOf,
    });
    expect(got.filter((x) => x.level === 'error').map((x) => x.message.includes('npm run fonts で作り直す'))).toEqual([
      true,
    ]);
    expect(got.filter((x) => x.level === 'warning').length).toBeGreaterThan(0);
  });
  test('書体のファイルが fonts.json の sha256 と合わなければ、誤りにする（手で直したファイル）', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'chalkfile-fonts-test-'));
    try {
      cpSync(path.join(ROOT, FONT_DIR), path.join(tmp, FONT_DIR), { recursive: true });
      const file = path.join(tmp, FONT_DIR, FONTS.inter.files[0].file);
      writeFileSync(file, Buffer.concat([readFileSync(file), Buffer.from([0])]));
      expect(fontIssues(SRC, tmp).map((x) => `${x.level} ${x.where}`)).toEqual([
        `error ${FONT_DIR}/${FONTS.inter.files[0].file}`,
      ]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('WOFF2 の cmap の読み取り（scripts/lib/woff2.ts）', () => {
  test('日本語・中国語・英字の書体から、入れた文字を読める', () => {
    // 台本にある文字（講座の題）と、どの書体にも入れる英数字
    const jp = codePoints(FONTS.noto.files[0].file);
    for (const ch of `${required(coursesIn('ja')[0]).title}A0`) expect(jp.has(ch.codePointAt(0) ?? 0)).toBe(true);
    const sc = codePoints(FONTS['noto-sc'].files[0].file);
    for (const ch of required(coursesIn('zh')[0]).title) expect(sc.has(ch.codePointAt(0) ?? 0)).toBe(true);
    expect(codePoints(FONTS.mono.files[0].file).has('{'.codePointAt(0) ?? 0)).toBe(true);
  });
  test('WOFF2 のテーブルの印の前で切れたファイルは、読み取り前に止める', () => {
    const truncated = Buffer.alloc(48);
    truncated.write('wOF2', 0, 'latin1');
    truncated.writeUInt16BE(1, 12);
    expect(() => woff2Tables(truncated)).toThrow('テーブルの印の前でファイルが終わった');
  });
  test('WOFF2 でないファイルは止める', () => {
    expect(() =>
      woff2CodePoints(Buffer.from('not a font, just some text that is long enough to have a header')),
    ).toThrow('WOFF2');
  });
});

describe('書き出しにネットが要らない', () => {
  test('動画の部品は Google Fonts から読まない（@remotion/google-fonts を使わない・URL を書かない）', () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as Record<
      string,
      Record<string, string>
    >;
    expect({ ...pkg.dependencies, ...pkg.devDependencies }['@remotion/google-fonts']).toBeUndefined();
    const out = Bun.spawnSync(
      ['git', 'grep', '-n', '-I', '-E', 'google-fonts|fonts\\.googleapis|fonts\\.gstatic', '--', 'src', 'engine'],
      { cwd: ROOT },
    );
    expect(out.stdout.toString().trim()).toBe('');
  });
});
