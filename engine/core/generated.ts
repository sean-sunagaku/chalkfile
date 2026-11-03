// 講座のフォルダの中の生成物の置き場所（リポジトリの直下からの相対パス）。スクリプトが作り、手で直さない・手でマージしない
// （.gitattributes で linguist-generated。ぶつかったら main の側を取って作り直す。AGENTS.md の「並行作業のきまり」）。
//   content/<講座>/generated/timeline/<key>.json   場面と台詞の始まるフレーム（scripts/synth.ts が書く。engine/core/timeline.ts）
// 講座を足す PR が触るのは自分の講座のフォルダだけなので、並行の PR とぶつからない

/** 講座の生成物のフォルダ */
export const generatedDir = (courseId: string) => `content/${courseId}/generated`;

/** 動画 1 本の timeline（key は動画の名前。日本語は S01、訳は S01.en） */
export const timelineFile = (courseId: string, key: string) => `${generatedDir(courseId)}/timeline/${key}.json`;

/** timeline のファイルのパスから、講座 ID と動画の名前を取り出す（timeline のファイルでなければ null） */
export const parseTimelineFile = (file: string): { course: string; key: string } | null => {
  const m = /^content\/([^/]+)\/generated\/timeline\/([^/]+)\.json$/.exec(file);
  return m ? { course: m[1], key: m[2] } : null;
};
