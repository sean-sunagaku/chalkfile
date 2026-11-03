// 効果音の一覧の正本（名前・ミックスの音量・何の音か）。台本の台詞の sfx・sfxAfter には、ここの名前を書く。
// - 音は scripts/audio/music/sfx.py がコードで合成し（npm run build:music → public/audio/sfx/<名前>.wav。ピーク -3 dBFS）、素材のブランチに置く
// - Python の道具（scripts/mix.py・scripts/build_music.py）は、npm run gen がここから書き出す scripts/audio/sfx.json を読む
//   （JSON も Git に入れる。ずれると npm test が止める）
// - 台本の型の SfxId（engine/core/schema.ts）は、ここの名前から作る。台本の検証の効果音の名前の一覧（engine/core/validate.ts）も、ここから作る
// - 足すときは、ここと scripts/audio/music/sfx.py の SFX（合成）に足し、npm run gen と npm run build:music -- --only <名前> を流す。
//   名前の一覧がずれると、テスト（tests/handoff.test.ts）と build_music.py が止める
// 純粋なデータだけを置く（Node・React・Remotion に依存しない）。台本と道具は content/sfx.ts からも読める（再 export）

export type SfxSpec = {
  /** ミックスでの音量（dB。ピーク -3 dBFS にそろえた効果音の WAV に掛ける）。聞こえの大きさが近くなるように決める */
  db: number;
  /** 何の音か・どこで鳴らすか */
  use: string;
};

export const SFX = {
  pop: { db: -14, use: '短い「ポン」。画面に要素が出る台詞の頭' },
  whoosh: { db: -15, use: '「シュッ」。場面の切り替わり（mix.py が鳴らす。台本には書かない）' },
  chime: { db: -13, use: 'ベルの音。一番言いたい台詞' },
  tick: { db: -9, use: '時計の「カチ」。クイズの考える時間（mix.py が、問いを読んだあとに 3 回鳴らす）' },
  reveal: { db: -7, use: '答え合わせ' },
  correct: { db: -7, use: '正解' },
  type: { db: -14, use: 'キーを打つ短い音' },
  // ここから、お笑い版の掛け合い用（聞こえの大きさを reveal・chime の近くにそろえる。使い方は comedy.md）
  harisen: { db: -4, use: 'ハリセンの「パシッ」。ツッコミの台詞の頭' },
  chin: { db: -14, use: 'おりんの「チーン」。スベった後の間（sfxAfter）' },
  drumroll: { db: -10, use: '溜めのドラムロールと最後の「ジャン」（1.5 秒。sfxAfter と pause: 1.5）' },
  deden: { db: -7, use: '衝撃の「デデーン」。天の声の大げさな宣言' },
  zuko: { db: -16, use: 'ずっこけの「ヒューン」。予想外の告白の後（sfxAfter）' },
} as const satisfies Record<string, SfxSpec>;

/** 効果音。台詞の sfx・sfxAfter に書ける名前（上の SFX の名前）。harisen 以降はお笑い版の掛け合い用（ツッコミ・スベり・溜め・衝撃・ずっこけ） */
export type SfxId = keyof typeof SFX;
