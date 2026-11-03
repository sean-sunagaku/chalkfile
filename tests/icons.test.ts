// アイコンの対応（src/components/icons.ts の ICONS）を確かめる。
// lucide-react は、名前を変えたアイコンの前の名前を別名として残し、次のメジャーで消すことがある。
// 別名で読んでいると、版を上げたときに急に読めなくなるので、正式な名前（アイコンの displayName と同じ名前）で読む
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ICON_NAMES } from '../engine/core/icons';
import { ICONS } from '../src/components/icons';

const SOURCE = readFileSync(path.join(import.meta.dir, '../src/components/icons.ts'), 'utf8');

/** import の名前。キーは icons.ts の中で使う名前（Type as TypeIcon のように付け直したものは TypeIcon → Type） */
const importedNames = (): Map<string, string> => {
  const block = SOURCE.match(/import \{([\s\S]*?)\} from 'lucide-react';/)?.[1] ?? '';
  const out = new Map<string, string>();
  for (const part of block.split(',').map((s) => s.trim())) {
    if (!part || part.startsWith('type ')) continue;
    const [name, as] = part.split(/\s+as\s+/);
    out.set(as ?? name, name);
  }
  return out;
};

describe('アイコンの対応（src/components/icons.ts）', () => {
  test('台本に書ける名前（engine/core/icons.ts の ICON_NAMES）と、描くアイコンの対応が同じ名前を持つ', () => {
    expect(Object.keys(ICONS).sort()).toEqual([...ICON_NAMES].sort());
  });
  test('lucide-react のアイコンを、別名ではなく正式な名前で読む', () => {
    const names = importedNames();
    const rows = [...SOURCE.matchAll(/^\s+(\w+): (\w+),$/gm)].map((m) => ({ key: m[1], local: m[2] }));
    expect(rows.map((r) => r.key).sort()).toEqual([...ICON_NAMES].sort());
    const aliases = rows.flatMap(({ key, local }) => {
      const name = names.get(local);
      const shown = (ICONS as Record<string, { displayName?: string }>)[key]?.displayName;
      return name === shown ? [] : [`${key}: ${name}（正式な名前は ${shown}）`];
    });
    expect(aliases).toEqual([]);
  });
});
