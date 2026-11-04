// 講座の言語の一覧（値の正本は chalkfile.config.ts）と、言語の名前・フォルダの正規表現。台本（engine/core/i18n.ts が読み込み直して出す）・動画・
// サイトの組み立て・画面・Service Worker・Worker が同じものを読む。ほかのファイルを import しない（sw.js と Worker にも入る。
// 読みの差分と素材の片付けは content/ と engine/core/ を取り出して読む）。content/langs.ts は再 export だけ。
// 値の正本は chalkfile.config.ts。LANG_LIST と LANG_INFO は npm run gen が書く。言語を足したら、型のエラーに従う（手順は .claude/skills/study-video-course/references/i18n.md の「言語を足す」）

const LANG_LIST = ["ja","en","zh"] as const;

/** 講座の言語。ja が正本。zh は簡体字（zh-Hans） */
export type Lang = (typeof LANG_LIST)[number];
export const LANGS: Lang[] = [...LANG_LIST];
/** 訳の言語（日本語の台本に上書きを重ねて作る言語） */
export type TranslatedLang = Exclude<Lang, 'ja'>;
export const TRANSLATED_LANGS: TranslatedLang[] = LANGS.filter((l): l is TranslatedLang => l !== 'ja');

/** 言語の名前（切り替えのリンクに、その言語で出す）・HTML の lang・サイトの URL の頭（訳の言語は、言語の名前のフォルダ） */
export const LANG_INFO: Record<Lang, { label: string; html: string; path: string }> = {
  "ja": {
    "label": "日本語",
    "html": "ja",
    "path": ""
  },
  "en": {
    "label": "English",
    "html": "en",
    "path": "en/"
  },
  "zh": {
    "label": "中文",
    "html": "zh-Hans",
    "path": "zh/"
  }
};

export const isLang = (s: string): s is Lang => (LANGS as string[]).includes(s);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 正規表現に入れる、言語の名前の選び（(?:ja|en|zh)）。動画の置き場所 /media/<言語>/ と、動画の一覧の lang（site/media-shared.ts）。
 * 一覧に無い言語の名前は通さない
 */
export const LANG_PATTERN = `(?:${LANGS.map(escapeRe).join('|')})`;

/**
 * 正規表現に入れる、訳の言語のフォルダの名前の選び（(?:en|zh)）。訳の講座の URL の頭（/en/<講座>/）・保存の講座の ID の頭（en/<講座>）・
 * 動画の名前の終わり（S01.en）。日本語はフォルダを作らない
 */
export const FOLDER_PATTERN = `(?:${TRANSLATED_LANGS.map(escapeRe).join('|')})`;

const FOLDER = new RegExp(`^${FOLDER_PATTERN}$`);
/** 訳の言語のフォルダの名前か（en・zh） */
export const isLangFolder = (s: string): boolean => FOLDER.test(s);
