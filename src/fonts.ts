// 動画の書体を、手元のファイル（engine/fonts/ の woff2。台本の文字だけを入れたサブセット）から読み込む（@remotion/fonts）。
// 書き出しにも Studio にもネットは要らない。ファイルは Remotion のバンドラ（webpack）がバンドルに写して URL にするので、
// 書き出しの public（render.sh・stills.ts が渡す空のフォルダ）に書体を置かなくてよい（public の声を写さずに済む）。
// 書体の一覧・名前・太さは engine/core/fonts.ts の FONTS、サブセットを作り直すのは scripts/fonts.ts（npm run fonts）
import { loadFont } from '@remotion/fonts';
import { useEffect, useRef, useState } from 'react';
import { cancelRender, continueRender, delayRender } from 'remotion';
import { FONTS, type FontId } from '../engine/core/fonts';

/** webpack の require.context（バンドラが、書いた場所でフォルダの中身に置き換える）。woff2 は、バンドルの中の URL になる */
declare const require: {
  context: (
    directory: string,
    useSubdirectories: boolean,
    regExp: RegExp,
  ) => { keys: () => string[]; (id: string): string | { default: string } };
};

const files = require.context('../engine/fonts', false, /\.woff2$/);

/** 書体のファイルの、バンドルの中の URL */
const urlOf = (file: string): string => {
  const m = files(`./${file}`);
  return typeof m === 'string' ? m : m.default;
};

const loading = new Map<FontId, Promise<void>>();
const loaded = new Set<FontId>();

/** 書体を読み込む（書体ごとに 1 回。可変の書体は、1 つのファイルを太さごとに登録する） */
const load = (id: FontId): Promise<void> => {
  let p = loading.get(id);
  if (!p) {
    const def = FONTS[id];
    p = Promise.all(
      def.files.flatMap((f) =>
        f.weights.map((w) =>
          loadFont({ family: def.family, url: urlOf(f.file), format: 'woff2', weight: String(w), style: 'normal' }),
        ),
      ),
    ).then(() => {
      loaded.add(id);
    });
    loading.set(id, p);
  }
  return p;
};

/** その書体の組を、全部読み込み終わったか */
const allLoaded = (key: string) => key.split(',').every((id) => loaded.has(id as FontId));

/**
 * 書体を読み込み、読み込み終わったら true を返す。初めに読み込む間は、書き出しを待たせる（delayRender）。
 * 文字の幅を測る部品（@remotion/layout-utils）は、読み込む前の書体で測ると幅を取り違えるので、true になってから描く。
 * 書体の組が変わったら（Studio でテーマを変えたとき）、新しい組を読み込み終わるまで false を返す
 */
export const useFonts = (ids: readonly FontId[]): boolean => {
  const key = ids.join(',');
  const [doneKey, setDoneKey] = useState<string | null>(() => (allLoaded(key) ? key : null));
  const [handle] = useState(() => (allLoaded(key) ? null : delayRender(`書体を読み込む: ${key}`)));
  const released = useRef(false);
  const ready = doneKey === key;
  useEffect(() => {
    if (doneKey === key) return;
    let alive = true;
    Promise.all(key.split(',').map((id) => load(id as FontId)))
      .then(() => {
        if (alive) setDoneKey(key);
      })
      .catch((e) => cancelRender(e));
    return () => {
      alive = false;
    };
  }, [key, doneKey]);
  // 読み込んだあとの描画が画面に出てから、書き出しを進める（待たせたのは 1 回だけなので、進めるのも 1 回だけ）
  useEffect(() => {
    if (!ready || handle === null || released.current) return;
    released.current = true;
    continueRender(handle);
  }, [ready, handle]);
  // 読み込み終わる前に外されたときも、待たせたままにしない
  useEffect(
    () => () => {
      if (handle !== null && !released.current) {
        released.current = true;
        continueRender(handle);
      }
    },
    [handle],
  );
  return ready;
};
