// 講座の出典と公式リンクの表。章は ID から引き、訳は説明の上書きだけを持つ。
import { defineSources } from '../sources-util';

export const SOURCE_TABLE = defineSources([
  {
    "id": "r-doc-001",
    "title": "Rive のランタイム（公式ドキュメント。対応環境・オープンソースと MIT ライセンス）",
    "url": "https://rive.app/docs/runtimes"
  },
  {
    "id": "r-doc-002",
    "title": "ステートマシン（公式ドキュメント）",
    "url": "https://rive.app/docs/editor/state-machine/state-machine"
  },
  {
    "id": "r-doc-003",
    "title": "料金プラン（公式）",
    "url": "https://rive.app/pricing"
  }
]);
export const SOURCES = SOURCE_TABLE.sources;
export const docsOf = SOURCE_TABLE.docs;
