// 講座のフォルダの中の生成物の置き場所（リポジトリの直下からの相対パス）。スクリプトが作り、手で直さない・手でマージしない
// （.gitattributes で linguist-generated。ぶつかったら main の側を取って作り直す。AGENTS.md の「並行作業のきまり」）。
//   content/<講座>/generated/timeline/<key>.json   場面と台詞の始まるフレーム（scripts/synth.ts が書く。engine/core/timeline.ts）
//   content/<講座>/generated/posters/<key>.jpg     動画のポスター（scripts/stages/video/render.ts が書く。サイトの組み立てが読む）
//   content/<講座>/generated/media.<言語>.json      Releases に置いた動画の一覧（scripts/media.ts push --course が書く。形は site/media-shared.ts）
// 講座を足す PR が触るのは自分の講座のフォルダだけなので、並行の PR とぶつからない。全講座の動画の一覧（Worker の許可リスト）は
// npm run gen が worker/src/generated/media-manifest.json に作る（Git に入れない）

/** 講座の生成物のフォルダ */
export const generatedDir = (courseId: string) => `content/${courseId}/generated`;

/** 動画 1 本の timeline（key は動画の名前。日本語は S01、訳は S01.en） */
export const timelineFile = (courseId: string, key: string) => `${generatedDir(courseId)}/timeline/${key}.json`;

/** 動画 1 本のポスター（key は動画の名前） */
export const posterFile = (courseId: string, key: string) => `${generatedDir(courseId)}/posters/${key}.jpg`;

/** 講座の、ある言語の動画の一覧 */
export const mediaListFile = (courseId: string, lang: string) => `${generatedDir(courseId)}/media.${lang}.json`;

/** timeline のファイルのパスから、講座 ID と動画の名前を取り出す（timeline のファイルでなければ null） */
export const parseTimelineFile = (file: string): { course: string; key: string } | null => {
  const m = /^content\/([^/]+)\/generated\/timeline\/([^/]+)\.json$/.exec(file);
  return m ? { course: m[1], key: m[2] } : null;
};

/** 動画の一覧のファイルのパスから、講座 ID と言語を取り出す（動画の一覧のファイルでなければ null） */
export const parseMediaListFile = (file: string): { course: string; lang: string } | null => {
  const m = /^content\/([^/]+)\/generated\/media\.([^/.]+)\.json$/.exec(file);
  return m ? { course: m[1], lang: m[2] } : null;
};
