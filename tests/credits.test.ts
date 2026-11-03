// 声のクレジット（キャラクターの利用規約）。どれも台詞の声から作る（content/voices.ts の creditsIn）。
// 納品物の README（scripts/export_deliverables.ts）・読む教材（scripts/build_materials.ts）・講座のページの確かめ（scripts/validate.ts）
import { describe, expect, test } from 'bun:test';
import { COURSES, coursesIn, VIDEOS, videoOf } from '../content';
import { creditsIn, voicesOf } from '../content/voices';
import { courseVoicesLine, materialOutputs, speakersLine } from '../scripts/build_materials';
import { creditLine } from '../scripts/export_deliverables';
import { creditProblems } from '../scripts/validate';

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

describe('講座のページのクレジット（validate の creditProblems）', () => {
  test('今の講座は、ページ（日本語は講師と呼び込みと sourceNote）が全部の声を含む', () => {
    expect(creditProblems(coursesIn)).toEqual([]);
  });
  test('sourceNote に書いていない声を、注意で知らせる（ページを声から作ったら、誤りにする）', () => {
    const noted = (lang: Parameters<typeof coursesIn>[0]) =>
      coursesIn(lang).map((c) =>
        c.id === 'ga4-comedy' ? { ...c, sourceNote: 'ボケの声は VOICEVOX:ずんだもん。' } : c,
      );
    expect(creditProblems(noted)).toEqual([
      {
        level: 'warning',
        rule: 'credit',
        where: 'ga4-comedy',
        message:
          '講座のページのクレジットに VOICEVOX:玄野武宏 が無い（講座の sourceNote に「ボケの声は VOICEVOX:ずんだもん」のように書く）',
      },
    ]);
    expect(creditProblems(noted, 'error').map((x) => x.level)).toEqual(['error']);
  });
});
