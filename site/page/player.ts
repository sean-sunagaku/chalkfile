// 動画のプレーヤー: 動画と字幕（自前の字幕の帯・全画面のときのネイティブの字幕・字幕を焼き込んだ版への差し替え）・速度・繰り返し・全画面・
// 1 本のダウンロードのリンク・次のレクチャーの案内・再生の状態の文（保存の状態の知らせ OFFLINE_STATE を受ける）
import { type Page, lectureOf } from './context';
import type { LectureData } from './data';
import { byId, closest, put } from './dom';
import { OFFLINE_STATE, type OfflineState } from './events';
import { pad2, vttOf } from './format';

type FullscreenVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

export type Player = ReturnType<typeof createPlayer>;

/**
 * プレーヤーを用意する。onNext は、次のレクチャーを開いて再生するとき（次の案内のボタン・数え終わり）に呼ぶ
 */
export const createPlayer = (page: Page, onNext: () => void) => {
  const { T, tt, video } = page;
  const prefs = page.learning.prefs;
  const player = byId('player');
  const theater = byId('theater');
  const cc = byId('cc');
  const status = byId('playbackStatus');
  const nextup = byId('nextup');
  const download = byId<HTMLAnchorElement>('fileDownload');
  let offline: OfflineState = { saved: false, online: navigator.onLine };
  let nextTimer: ReturnType<typeof setInterval> | null = null;
  const vtt = new Map<string, string>();
  /**
   * まだ読んでいない動画の、読んだら移る時刻（続きの時刻か、選んだ時刻）。動画は preload="none" で、開いただけでは読まない
   * （講座を開くだけで /media/ を呼ばない）。再生を押すか時刻を選ぶと読み始め、長さと形（metadata）が来たら、ここへ移る
   */
  let startAt: number | null = null;
  const unread = () => video.readyState === HTMLMediaElement.HAVE_NOTHING;
  /** 今の時刻（まだ読んでいなければ、読んだら移る時刻） */
  const position = () => (unread() ? (startAt ?? 0) : video.currentTime);
  /** 時刻へ移る（まだ読んでいなければ、読んだら移る） */
  const seekTo = (t: number) => {
    if (unread()) startAt = t;
    else video.currentTime = t;
  };
  video.addEventListener('loadedmetadata', () => {
    if (startAt !== null) video.currentTime = startAt;
    startAt = null;
    video.playbackRate = prefs.rate;
    hideNativeTrack();
  });

  const play = () => {
    video.play().catch(() => {});
  };
  // 保存した版を無効にした講座は、オンラインでは公開中の版のページと動画を使うので、オンライン再生として案内する
  const playbackStatus = () => {
    status.textContent =
      offline.saved && !offline.disabled ? T.playSaved : offline.online ? T.playOnline : T.playNeedNet;
  };
  window.addEventListener(OFFLINE_STATE, (event) => {
    offline = event.detail;
    // 保存版がこのページの版と違えば、止めて開き直しを案内する（無効にした版は、開き直しても公開中のページになるので止めない）
    if (offline.saved && !offline.disabled && offline.pageVersion !== page.data.pageVersion) {
      video.pause();
      status.textContent = T.playUpdated;
    } else playbackStatus();
  });
  video.addEventListener('error', () => {
    status.textContent = T.playError;
  });

  // ネイティブの字幕は全画面（iPhone など）のときだけ使う。ふだんは自前の字幕を出す
  const hideNativeTrack = () => {
    for (const track of Array.from(video.textTracks)) track.mode = 'hidden';
  };
  /** 全画面で出すネイティブの字幕（字幕がオンで、字幕を焼き込んだ版が無いときだけ） */
  const nativeTrack = () => (prefs.cc && !lectureOf(page).videoCc ? video.textTracks[0] : undefined);
  video.addEventListener('webkitbeginfullscreen', () => {
    const track = nativeTrack();
    if (track) track.mode = 'showing';
  });
  video.addEventListener('webkitendfullscreen', hideNativeTrack);
  // 動画だけの全画面（標準のコントロールの全画面ボタン）でも、字幕を焼き込んだ版が無いときはネイティブの字幕を出す
  document.addEventListener('fullscreenchange', () => {
    const track = document.fullscreenElement === video ? nativeTrack() : undefined;
    if (track) track.mode = 'showing';
    else hideNativeTrack();
  });

  /** 全画面のときの字幕（埋め込んだ台本から、その場で WebVTT を作る） */
  const vttUrl = (lec: LectureData) => {
    let url = vtt.get(lec.id);
    if (url === undefined) {
      try {
        url = URL.createObjectURL(new Blob([vttOf(lec.cues)], { type: 'text/vtt' }));
      } catch {
        url = '';
      }
      vtt.set(lec.id, url);
    }
    return url;
  };

  // 字幕を焼き込んだ版（videoCc）があるレクチャーは、字幕オンのとき動画ごと差し替える（どの全画面でも字幕が見える）。
  // 無いレクチャーは、動画を少し縮めて、プレーヤーの中の下に字幕の帯を出す
  const srcFor = (lec: LectureData) => (prefs.cc && lec.videoCc ? lec.videoCc : lec.video);
  const applyCc = () => {
    const lec = lectureOf(page);
    const burned = !!lec.videoCc;
    cc.hidden = !prefs.cc || burned;
    player.classList.toggle('cc-on', prefs.cc && !burned);
    const want = srcFor(lec);
    download.href = `${want}${want.includes('?') ? '&' : '?'}download=1`;
    download.download = `${lec.id}${want === lec.video ? '' : '.captioned'}.mp4`;
  };
  const swapSource = () => {
    // まだレクチャーを開いていない（はじめに字幕の好みを入れるとき）は、開くときに選ぶ
    const now = video.getAttribute('src');
    const want = srcFor(lectureOf(page));
    if (now === null || now === want) return;
    // 差し替えた動画も、同じ時刻から（読み直したら移る）
    const t = position();
    const paused = video.paused;
    video.src = want;
    startAt = t > 0 ? t : null;
    if (!paused) play();
  };
  const setCc = (on: boolean) => {
    prefs.cc = on;
    page.store.savePrefs(prefs);
    byId('ccToggle').setAttribute('aria-pressed', on ? 'true' : 'false');
    applyCc();
    swapSource();
  };
  byId('ccToggle').addEventListener('click', () => setCc(!prefs.cc));

  const renderSpeed = () => {
    for (const b of Array.from(byId('speed').querySelectorAll<HTMLButtonElement>('button'))) {
      b.setAttribute('aria-pressed', Number(b.dataset.rate) === prefs.rate ? 'true' : 'false');
    }
  };
  byId('speed').addEventListener('click', (e) => {
    const b = closest<HTMLButtonElement>(e, 'button');
    if (!b) return;
    prefs.rate = Number(b.dataset.rate);
    video.playbackRate = prefs.rate;
    page.store.savePrefs(prefs);
    renderSpeed();
  });

  const clearNext = () => {
    if (nextTimer) clearInterval(nextTimer);
    nextTimer = null;
    nextup.hidden = true;
  };
  byId('loopToggle').addEventListener('click', () => {
    video.loop = !video.loop;
    byId('loopToggle').setAttribute('aria-pressed', String(video.loop));
    clearNext();
  });
  byId('nextGo').addEventListener('click', () => {
    clearNext();
    onNext();
  });
  byId('nextStay').addEventListener('click', clearNext);

  /** 動画の終わりに、次のレクチャーを 6 秒数えてから開く案内を出す */
  const offerNext = (next: LectureData) => {
    byId('nextTitle').textContent = `L${pad2(next.no)}　${next.title}`;
    nextup.hidden = false;
    let left = 6;
    const label = byId('nextGoLabel');
    label.textContent = tt('nextIn', { n: left });
    nextTimer = setInterval(() => {
      left -= 1;
      label.textContent = left > 0 ? tt('nextIn', { n: left }) : T.play;
      if (left <= 0) {
        clearNext();
        onNext();
      }
    }, 1000);
  };

  /** 全画面（自前の字幕ごと） */
  const toggleFull = () => {
    const v = video as FullscreenVideo;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    const request = (theater as Partial<Pick<HTMLElement, 'requestFullscreen'>>).requestFullscreen;
    if (request) request.call(theater).catch(() => v.webkitEnterFullscreen?.());
    else v.webkitEnterFullscreen?.();
  };
  player.addEventListener('dblclick', (e) => {
    if (e.target === video) {
      e.preventDefault();
      toggleFull();
    }
  });

  /**
   * レクチャーの動画を開く（resume は続きの時刻。3 秒より前と、終わりの 5 秒は頭から）。動画は、再生するか時刻を選ぶまで読まない。
   * 動画は src で渡し、load() を呼ばない（Chrome は load() を呼ぶと、preload="none" でも読み始める。src を変えれば読み直しになる）
   */
  const open = (lec: LectureData, resume: number, autoplay: boolean) => {
    clearNext();
    video.pause();
    put(video);
    video.poster = lec.poster;
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.srclang = page.data.lang.html;
    track.label = page.data.lang.label;
    track.src = vttUrl(lec);
    video.append(track);
    video.src = srcFor(lec);
    startAt = resume > 3 && resume < lec.duration - 5 ? resume : null;
    applyCc();
    playbackStatus();
    if (autoplay) play();
    cc.textContent = '';
  };

  /** 字幕の帯の文字 */
  const caption = (text: string) => {
    cc.textContent = text;
  };

  const togglePlay = () => {
    if (video.paused) play();
    else video.pause();
  };
  const seekBy = (seconds: number) => {
    seekTo(Math.max(0, position() + seconds));
  };
  /** 時刻へ移って再生する（まだ読んでいなければ、読み始めて、読んだらその時刻へ） */
  const seekAndPlay = (t: number) => {
    seekTo(t);
    play();
  };

  renderSpeed();
  return {
    open,
    setCc,
    toggleCc: () => setCc(!prefs.cc),
    toggleFull,
    clearNext,
    offerNext,
    caption,
    togglePlay,
    seekBy,
    seekAndPlay,
    position,
  };
};
