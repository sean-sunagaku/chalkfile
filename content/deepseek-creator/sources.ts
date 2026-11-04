import { defineSources } from '../sources-util';
const root = 'https://github.com/deepseek-ai/deepseek-harness/blob/8bd073392eef6f54e921a093b95076248eb08cbb/';
export const SOURCE_TABLE = defineSources([
  { id: 'h-doc-001', title: 'DeepSeek Harness 公式サイト（Creator mode と作成例）', url: 'https://www.deepseek.com/harness/en/' },
  { id: 'h-doc-002', title: '公式 README（起動方法・公開形態・MIT）', url: `${root}README.md` },
  { id: 'h-doc-003', title: '公式モード案内（Standard・PTC・Minimal・Creator）', url: `${root}packages/client/ui-agent-preset/src/client/guide-locales.ts` },
  { id: 'h-doc-004', title: 'Agent presets の公式説明（Creator の入口・設定の閲覧）', url: `${root}packages/client/ui-agent-preset/README.md` },
  { id: 'h-doc-005', title: 'Plugins の公式説明（追加・有効化・設定・削除）', url: `${root}packages/client/ui-plugin-manager/README.md` },
  { id: 'h-doc-006', title: '公式 Safety（開発プレビューと実行権限）', url: `${root}SAFETY.md` },
]);
export const docsOf = SOURCE_TABLE.docs;
