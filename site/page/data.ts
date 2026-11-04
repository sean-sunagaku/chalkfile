// 講座のページの中の JSON（site/template.html の <script id="course-data">）の形。画面（site/course-page.ts）が読み、
// 組み立て（scripts/site/model.ts の courseJson）が作る。組み立ての側は satisfies CourseData で、この形に合うかを型で確かめる。
// 形を変えると、保存版の HTML には前の画面のコードと前の形の JSON が一緒に入っているので、保存版は前のまま動く（同じ HTML の中でそろう）。
// ここは型だけ（DOM も Node も使わない。組み立ての型検査からも読む）
import type { CourseText } from '../i18n';

/** 教材の根拠の種類（札の色と文字） */
export type Evidence = 'research' | 'official' | 'practice' | 'example';

/** セクション（カリキュラムのまとまり） */
export type SectionRef = { no: number; title: string };

/** 教材の節の出典（発行元・年・URL） */
export type SourceLink = { publisher: string; year: string; title: string; url: string };

/** 読む教材・実践課題・AI に聞く（教材を持つレクチャーだけ）。文字は **強調** と「- 」の箇条書きだけを使える */
export type MaterialData = {
  id: string;
  goals: string[];
  prerequisites: string[];
  sections: { id: string; title: string; body: string[]; evidence: Evidence[]; sources: SourceLink[] }[];
  figures: {
    id: string;
    title: string;
    caption: string;
    evidence: Evidence;
    /** 表。1 行目が見出し */
    table?: string[][];
    /** 流れ（左から右へ） */
    flow?: string[];
    code?: string;
  }[];
  exercise: {
    id: string;
    title: string;
    goal: string;
    timebox: string;
    steps: string[];
    deliverable: string;
    example: { title: string; body: string[] };
    rubric: { criterion: string; good: string; fair: string; poor: string }[];
  };
  summary: string[];
  askExamples: { q: string; refs: string[] }[];
};

/** レクチャー 1 本 */
export type LectureData = {
  id: string;
  no: number;
  section: SectionRef;
  title: string;
  summary: string;
  /** 注意書き（無ければ空） */
  caution: string;
  takeaways: string[];
  /** 「公式ドキュメント」タブのリンク */
  docs: { title: string; url: string }[];
  quiz: { q: string; choices: string[]; answer: number; explain: string }[];
  material: MaterialData | null;
  /** 動画の長さ（秒） */
  duration: number;
  /** チャプター（場面の頭の時刻と見出し。場面の番号で引く） */
  chapters: { start: number; heading: string }[];
  /** 台詞（字幕と台本）。scene は場面の番号 */
  cues: { start: number; end: number; text: string; scene: number }[];
  /** 動画（通常版）の URL */
  video: string;
  /** 字幕を焼き込んだ版の URL（無ければ空） */
  videoCc: string;
  /** ポスターの URL（?v= は教材の版） */
  poster: string;
};

/** ページの中の JSON の全体 */
export type CourseData = {
  course: {
    id: string;
    title: string;
    subtitle: string;
    sections: SectionRef[];
    /** フッターのクレジットの後ろに足す、台本のもと */
    sourceNote: string;
    /** 見出しの下の注意書き（無ければ空） */
    disclaimer: string;
    /** 見出しの横のリンク */
    links: { label: string; url: string }[];
    /** 1 本の呼び名 */
    unitLabel: 'LECTURE' | 'CHAPTER';
    /** 講座に合わせた言葉（概要の要点の見出し・公式ドキュメントのタブの名前・台本の検索の例） */
    ui: { takeaways?: string; docs?: string; searchHint?: string };
    /** まだ動画の無い章（カリキュラムに「準備中」で出す） */
    planned: { no: number; section: number; title: string; minutes: number }[];
  };
  /** ナレーションのクレジット */
  credits: string[];
  /** 教材の版（scripts/site-version.ts。保存の状態の版と比べる） */
  pageVersion: string;
  /** code は学習の記録の鍵に、html は字幕の言語に、label は字幕の名前に使う */
  lang: { code: string; html: string; label: string };
  /** 決まった文字（site/i18n の courseText。このページの言語の common と course） */
  text: CourseText;
  lectures: LectureData[];
};
