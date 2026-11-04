// 講座の出典と公式リンクの表。章は ID から引き、訳は説明の上書きだけを持つ。
import { defineSources } from '../sources-util';

export const SOURCE_TABLE = defineSources([
  {
    "id": "p-doc-001",
    "title": "pstack の README（GitHub の cursor/plugins。入れ方・スキル・手順書・原則の一覧）",
    "url": "https://github.com/cursor/plugins/tree/main/pstack"
  },
  {
    "id": "p-doc-002",
    "title": "/poteto-mode の説明（GitHub）",
    "url": "https://github.com/cursor/plugins/blob/main/pstack/skills/poteto-mode/SKILL.md"
  },
  {
    "id": "p-doc-003",
    "title": "/poteto-mode の 23 個の手順書（GitHub）",
    "url": "https://github.com/cursor/plugins/tree/main/pstack/skills/poteto-mode/playbooks"
  },
  {
    "id": "p-doc-004",
    "title": "/setup-pstack の説明（GitHub）",
    "url": "https://github.com/cursor/plugins/blob/main/pstack/skills/setup-pstack/SKILL.md"
  },
  {
    "id": "p-doc-005",
    "title": "/interrogate の説明（GitHub）",
    "url": "https://github.com/cursor/plugins/blob/main/pstack/skills/interrogate/SKILL.md"
  },
  {
    "id": "p-doc-006",
    "title": "/arena の説明（GitHub）",
    "url": "https://github.com/cursor/plugins/blob/main/pstack/skills/arena/SKILL.md"
  }
]);
export const SOURCES = SOURCE_TABLE.sources;
export const docsOf = SOURCE_TABLE.docs;
