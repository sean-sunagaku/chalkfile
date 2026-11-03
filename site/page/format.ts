// 画面に出す数とリンクの形（DOM を使わない）

/** 2 桁にそろえる（9 → 09。100 以上はそのまま） */
export const pad2 = (n: number) => `${n < 10 ? '0' : ''}${n}`;

/** 秒を「分:秒」にする（65 → 01:05） */
export const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
};

/** リンクに使う URL。https: と http: だけを通し、ほか（javascript: や data:）は # にする */
export const safeUrl = (url: string, base: string) => {
  try {
    const u = new URL(String(url), base);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '#';
  } catch {
    return '#';
  }
};

/** 時刻 t に始まっている最後の台詞の番号（台詞は始まりの順。どれも始まっていなければ -1） */
export const findCue = (cues: readonly { start: number }[], t: number) => {
  let lo = 0;
  let hi = cues.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
};

/** WebVTT の時刻（01:02:03.450） */
const vttTime = (x: number) => {
  const sec = (x % 60).toFixed(3);
  return `${pad2(Math.floor(x / 3600))}:${pad2(Math.floor((x % 3600) / 60))}:${sec.length < 6 ? '0' : ''}${sec}`;
};

/** 台詞から作る WebVTT（全画面のときのネイティブの字幕に使う）。文字の & と < は文字参照にし、--> は矢印にする */
export const vttOf = (cues: readonly { start: number; end: number; text: string }[]) =>
  `WEBVTT\n\n${cues
    .map(
      (c, i) =>
        `${i + 1}\n${vttTime(c.start)} --> ${vttTime(c.end)}\n${String(c.text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/-->/g, '→')}\n`,
    )
    .join('\n')}`;

/** 公式ドキュメントのリンクの下に出す、ホストとパス（読めなければ URL のまま） */
export const hostOf = (url: string) => {
  try {
    const u = new URL(url);
    return u.host + u.pathname.replace(/\/$/, '');
  } catch {
    return url;
  }
};
