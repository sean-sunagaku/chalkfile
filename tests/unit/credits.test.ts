// 声のクレジット（キャラクターの利用規約）。どれも台詞の声から作る（content/voices.ts の creditsIn）。
// 納品物の README（scripts/export_deliverables.ts）・読む教材（scripts/build_materials.ts）・講座のページと一覧のページ（scripts/site/model.ts）と、その確かめ（scripts/validate.ts）
import { describe, expect, test } from 'bun:test';
import { COURSES, coursesIn, VIDEOS, videoOf } from '../../content';
import { creditsIn, voicesOf } from '../../content/voices';
import { courseVoicesLine, materialOutputs, speakersLine } from '../../scripts/build_materials';
import { creditLine } from '../../scripts/export_deliverables';
import { courseCredits, homeCredits } from '../../scripts/site/model';
import { creditProblems } from '../../scripts/validate';

const comedy = VIDEOS.filter((v) => v.course.cast);

describe('納品物の README（export_deliverables）', () => {
  test('お笑い版の動画は、使った全部の声のクレジットを出す（講師と呼び込みだけにしない）', () => {
    expect(comedy.length).toBeGreaterThan(0);
    for (const v of comedy.filter((x) => x.lang === 'ja')) {
      const line = creditLine(v);
      for (const c of creditsIn('ja', voicesOf(v.lecture))) expect(line).toContain(c);
    }
    const g01 = creditLine(videoOf('G01'));
    expect(g01).toContain('VOICEVOX:ずんだもん');
    expect(g01).toContain('VOICEVOX:玄野武宏');
  });
  test('訳の動画は、Kokoro のモデルと話者を出す', () => {
    const p01en = videoOf('P01.en');
    expect(creditLine(p01en)).toContain(
      `- ナレーション: ${creditsIn('en', voicesOf(p01en.lecture)).join('、')}（モデルの重みは Apache-2.0。`,
    );
  });
});

describe('読む教材（build_materials）', () => {
  test('章の話者と講座の README に、使った全部の声のクレジットが出る', () => {
    const out = materialOutputs();
    for (const c of COURSES.filter((x) => x.syllabus)) {
      const readme = out.get(`${c.id}/README.md`) ?? '';
      for (const credit of creditsIn('ja', c.lectures.flatMap(voicesOf))) expect(readme).toContain(credit);
      for (const lec of c.lectures) {
        if (!lec.material) continue;
        const md = out.get(`${c.id}/${lec.material.id}.md`) ?? '';
        for (const credit of creditsIn('ja', voicesOf(lec))) expect(md).toContain(credit);
      }
    }
  });
  test('お笑い版の講座でも、話者の行と講座の声に、ずんだもんと天の声が出る', () => {
    const { course, lecture } = videoOf('G01');
    const line = speakersLine(course, lecture);
    expect(line).toContain('VOICEVOX:ずんだもん');
    expect(line).toContain('VOICEVOX:玄野武宏');
    expect(courseVoicesLine(course).join('')).toContain('VOICEVOX:玄野武宏');
  });
});

describe('講座のページと一覧のページのクレジット（scripts/site/model.ts・validate の creditProblems）', () => {
  test('講座のページのクレジットは、その講座の動画で使った全部の声（お笑い版は、ずんだもんと天の声も）', () => {
    for (const lang of ['ja', 'en', 'zh'] as const) {
      for (const c of coursesIn(lang))
        expect(courseCredits(c, lang)).toEqual(creditsIn(lang, c.lectures.flatMap(voicesOf)));
    }
    const ga4 = COURSES.find((c) => c.id === 'ga4-comedy');
    if (!ga4) throw new Error('ga4-comedy が無い');
    expect(courseCredits(ga4, 'ja')).toEqual([
      'VOICEVOX:No.7',
      'VOICEVOX:青山龍星',
      'VOICEVOX:ずんだもん',
      'VOICEVOX:玄野武宏',
    ]);
    // 掛け合いの無い講座は、講師と呼び込みだけ
    const stripe = COURSES.find((c) => c.id === 'stripe-billing');
    if (!stripe) throw new Error('stripe-billing が無い');
    expect(courseCredits(stripe, 'ja')).toEqual(['VOICEVOX:No.7', 'VOICEVOX:青山龍星']);
  });
  test('一覧のページのクレジットは、その言語の全部の講座で使った声', () => {
    expect(homeCredits(coursesIn('ja'), 'ja')).toEqual(
      creditsIn(
        'ja',
        COURSES.flatMap((c) => c.lectures.flatMap(voicesOf)),
      ),
    );
    expect(homeCredits(coursesIn('ja'), 'ja')).toContain('VOICEVOX:ずんだもん');
  });
  test('今の講座は、ページのクレジットが全部の声を含む', () => {
    expect(creditProblems(coursesIn)).toEqual([]);
  });
  test('ページのクレジットから声が抜けたら、誤りで止める（前の、講師と呼び込みだけを出す形）', () => {
    const fixed = (_: unknown, lang: string) => (lang === 'ja' ? ['VOICEVOX:No.7', 'VOICEVOX:青山龍星'] : []);
    const ja = (lang: Parameters<typeof coursesIn>[0]) =>
      lang === 'ja' ? coursesIn('ja').filter((c) => c.id === 'ga4-comedy') : [];
    expect(creditProblems(ja, fixed)).toEqual([
      {
        level: 'error',
        rule: 'credit',
        where: 'ga4-comedy',
        message:
          '講座のページのクレジットに VOICEVOX:ずんだもん・VOICEVOX:玄野武宏 が無い（scripts/site/model.ts の courseCredits は、台詞の声から content/voices.ts の creditsIn で作る）',
      },
    ]);
  });
});
