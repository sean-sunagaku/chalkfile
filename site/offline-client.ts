import type { CourseManifest, CourseStatus, DownloadProgress } from './offline-shared';

type AppData = {
  root: string;
  course?: { id: string; title: string; pageVersion: string };
  courses: { id: string; title: string }[];
};
type Reply = { ok?: boolean; error?: string; courses?: CourseStatus[]; manifest?: CourseManifest; progress?: DownloadProgress };
type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
const app = JSON.parse(document.getElementById('pwa-data')!.textContent!) as AppData;
const root = new URL(app.root, location.href);
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
let registration: ServiceWorkerRegistration | undefined;
let latest: CourseManifest | undefined;
let states: CourseStatus[] = [];
let busy = false;
let workingId: string | undefined;
let refreshInProgress = false;
let installPrompt: InstallEvent | null = null;
let locallyDownloading = false;
let localSaveRequest = false;
let messageRevision = 0;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event as InstallEvent;
  $('pwaInstall').hidden = false;
});
function installed() {
  $('pwaInstall').hidden = true;
  $('installState').textContent = 'アプリとして起動中、またはインストール済みです。講座は別途選んで保存してください。';
}
window.addEventListener('appinstalled', installed);
if (matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone) installed();
$('pwaInstall').addEventListener('click', async () => {
  if (!installPrompt) return;
  const prompt = installPrompt;
  installPrompt = null;
  $('pwaInstall').hidden = true;
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    $('installState').textContent = choice.outcome === 'accepted' ? 'インストール操作を受け付けました。講座も選んで保存してください。' : 'インストールを見送りました。ブラウザでも保存して学べます。';
  } catch { $('installState').textContent = 'ブラウザのメニューからインストールしてください。'; }
});

function request(type: string, id?: string, progress?: (p: DownloadProgress) => void): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const worker = navigator.serviceWorker.controller ?? registration?.active;
    if (!worker) { reject(new Error('保存機能を準備できません。オンラインで再読み込みしてください。')); return; }
    const channel = new MessageChannel();
    let timer: ReturnType<typeof setTimeout>;
    const finish = (error?: Error, value?: Reply) => {
      clearTimeout(timer);
      channel.port1.close();
      if (error) reject(error); else resolve(value!);
    };
    const extend = () => { clearTimeout(timer); timer = setTimeout(() => finish(new Error('保存機能からの応答が途切れました。保存状態を確認して再試行してください。')), 150000); };
    channel.port1.onmessage = (event: MessageEvent<Reply>) => {
      extend();
      if (event.data.progress) progress?.(event.data.progress);
      else if (event.data.ok) finish(undefined, event.data);
      else finish(new Error(event.data.error ?? '保存機能を利用できません。'));
    };
    extend();
    worker.postMessage({ protocol: 1, type, id }, [channel.port2]);
  });
}

function network() {
  $('networkState').textContent = navigator.onLine ? 'オンライン（通信状態は取得時に確認）' : 'オフライン：保存済みの講座で学べます';
}
function message(text: string) { messageRevision++; $('offlineMessage').textContent = text; }
function storageMessage() {
  if (!app.course) return '保存状態を確認しました。講座を開いて、使いたい講座の保存ボタンを選んでください。';
  const status = states.find((s) => s.id === app.course!.id);
  if (status?.incomplete) return status.saved
    ? '一部の保存が不完全です。前の完全な保存版を利用できます。オンラインで保存し直してください。'
    : '保存が不完全です。オンラインで保存し直してください。';
  return status?.saved ? '保存済みの教材と全動画を利用できます。通信なしで起動・再生できます。'
    : 'この講座は未保存です。動画の再生とアプリ内保存には通信が必要です。オンラインで保存してください。';
}
function canShowStatus() { return !busy && !locallyDownloading && !states.some((s) => s.progress); }
function drawProgress(p?: DownloadProgress | null) {
  const bar = $<HTMLProgressElement>('offlineProgress');
  bar.hidden = !p;
  if (!p) return;
  bar.max = p.total || 1;
  bar.value = p.loaded;
  message(p.total ? `保存中 ${Math.floor(p.loaded / p.total * 100)}%・${mb(p.loaded)} / ${mb(p.total)}（${p.file} / ${p.count} ファイル）。完了までこの画面を開いておいてください。` : '教材情報を確認しています…');
}

function render() {
  network();
  const status = states.find((s) => s.id === app.course?.id);
  const anyProgress = states.find((s) => s.progress)?.progress;
  const wasWorking = !!workingId;
  workingId = anyProgress?.id;
  const processing = busy || !!anyProgress;
  if (app.course) {
    const saved = status?.saved;
    $('savedState').textContent = saved ? `保存済み・教材と全動画 ${mb(saved.manifest.bytes)}・${new Date(saved.savedAt).toLocaleString('ja-JP')}${status?.incomplete ? '（前の完全な版を利用中）' : ''}` : status?.incomplete ? '保存が不完全です。オンラインで保存し直してください。' : '未保存・動画はオンラインで再生します';
    const same = saved?.manifest.revision === latest?.revision;
    const save = $<HTMLButtonElement>('offlineSave');
    save.textContent = saved && latest && !same ? '新しい版に更新して保存' : status?.incomplete ? '保存し直す' : 'この講座をアプリ内に保存';
    save.disabled = !registration || !navigator.onLine || processing || !latest || (!!same && !status?.incomplete);
    $<HTMLButtonElement>('offlineDelete').disabled = !registration || processing || (!saved && !status?.incomplete);
    $('offlineCancel').hidden = !anyProgress && !locallyDownloading;
    $<HTMLButtonElement>('offlineCancel').disabled = !workingId && !locallyDownloading;
    $<HTMLButtonElement>('offlineCheck').disabled = !registration || !navigator.onLine || processing;
    $('downloadSize').textContent = latest ? `保存対象：台本・字幕・クイズ・全動画とポスター、合計 ${mb(latest.bytes)}。` : 'オンラインで保存サイズと更新を確認できます。';
    const changed = saved && saved.manifest.pageVersion !== app.course.pageVersion;
    $('offlineReload').hidden = !changed;
    if (changed) message('保存版が切り替わりました。「保存した版を開く」で教材と動画をそろえてください。');
    window.dispatchEvent(new CustomEvent('chalkfile:offline-state', { detail: {
      saved: !!saved, pageVersion: saved?.manifest.pageVersion, incomplete: status?.incomplete, online: navigator.onLine,
    } }));
  }
  const list = $('savedCourses');
  list.replaceChildren();
  const courses = [...app.courses];
  for (const s of states) if (s.saved && !courses.some((c) => c.id === s.id)) courses.push({ id: s.id, title: s.saved.manifest.title });
  for (const course of courses) {
    const s = states.find((v) => v.id === course.id);
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = new URL(`${course.id}/`, root).href;
    a.textContent = course.title;
    const label = document.createElement('span');
    label.textContent = s?.progress ? '保存中・完了前' : s?.saved ? `保存済み ${mb(s.saved.manifest.bytes)}` : s?.incomplete ? '不完全・要再保存' : '未保存・オンラインで開く';
    li.append(a, label);
    list.append(li);
  }
  // 自分の保存の最終状態を確認するまでは、古い STATUS で完了・エラーを描き直さない。
  if (!locallyDownloading && !localSaveRequest) {
    drawProgress(anyProgress);
    if (wasWorking && !anyProgress && !localSaveRequest) message('別のタブでの保存処理が終了しました。現在の保存状態を確認してください。');
  }
  if (localSaveRequest && !busy && !locallyDownloading && !anyProgress) localSaveRequest = false;
}

async function capacity() {
  try {
    const estimate = await navigator.storage?.estimate?.();
    const persistent = await navigator.storage?.persisted?.();
    $('storageState').textContent = `${estimate?.quota ? `同一サイト全体の使用量（推定）${mb(estimate.usage ?? 0)} / ${mb(estimate.quota)}。` : '保存容量はブラウザによって異なります。'}${persistent ? '保存の保持が許可されています。' : '保存の保持は未許可です。ブラウザが保存を削除する場合があります。'}`;
    $<HTMLButtonElement>('offlinePersist').disabled = !navigator.storage?.persist || !!persistent;
  } catch { $('storageState').textContent = '保存容量を取得できません。空き容量は保証されません。'; }
}
async function refresh() {
  if (!registration || refreshInProgress) return false;
  refreshInProgress = true;
  try {
    states = (await request('STATUS')).courses ?? [];
    render(); await capacity();
    // 初期案内だけを確定する。進捗・操作結果・通信エラーは状態確認で上書きしない。
    if (messageRevision === 0 && canShowStatus()) message(storageMessage());
    return true;
  }
  catch (error) { message((error as Error).message); return false; }
  finally { refreshInProgress = false; }
}
async function check() {
  if (!app.course || !navigator.onLine) return;
  $<HTMLButtonElement>('offlineCheck').disabled = true;
  const before = messageRevision;
  try {
    latest = (await request('CHECK', app.course.id)).manifest;
    const status = states.find((s) => s.id === app.course!.id);
    const saved = status?.saved;
    if (status && before === messageRevision && canShowStatus()) message(status.incomplete ? storageMessage() : saved && saved.manifest.revision !== latest?.revision ? '新しい版があります。更新は選んだときだけ行います。失敗した場合は今の保存を維持します。' : saved ? '公開中の版と保存版は同じです。' : storageMessage());
  } catch (error) {
    // 確認を待つ間に始まった保存や、別操作の結果を遅い応答で置き換えない。
    if (before === messageRevision && canShowStatus()) {
      latest = undefined;
      message(`${(error as Error).message} 保存済みの版は引き続き利用できます。`);
    }
  }
  render();
}

$('offlineSave').addEventListener('click', async () => {
  if (!app.course || busy) return;
  busy = true;
  locallyDownloading = true;
  localSaveRequest = true;
  render();
  drawProgress({ id: app.course.id, loaded: 0, total: 0, file: 0, count: 0 });
  try {
    await request('SAVE', app.course.id, drawProgress);
    message('教材と全動画の保存が完了しました。通信を切って再生を確認してください。');
  } catch (error) { message(`${(error as Error).message} 以前の完全な保存があれば維持します。再試行は保存ボタンから行えます。`); }
  finally { busy = false; locallyDownloading = false; drawProgress(); await refresh(); }
});
$('offlineCancel').addEventListener('click', async () => {
  try {
    await request('CANCEL', workingId ?? app.course?.id);
    message('キャンセルを受け付けました。処理が終わるまでお待ちください。');
  } catch (error) { message((error as Error).message); }
});
$('offlineDelete').addEventListener('click', async () => {
  if (!app.course || busy) return;
  busy = true;
  render();
  try {
    await request('DELETE', app.course.id);
    message('この講座の教材・動画と以前の保存版を削除しました。ノートと学習進捗は残ります。');
  } catch (error) { message((error as Error).message); }
  finally { busy = false; await refresh(); }
});
$('offlineCheck').addEventListener('click', () => { void check(); });
$('offlineReload').addEventListener('click', () => location.reload());
$('offlinePersist').addEventListener('click', async () => {
  try {
    const granted = await navigator.storage.persist();
    message(granted ? 'ブラウザが保存の保持を許可しました。サイトデータを消すと保存も消えます。' : 'ブラウザは保存の保持を許可しませんでした。保存は利用できますが、削除される場合があります。');
    await capacity();
  } catch { message('保存の保持を要求できませんでした。ブラウザの設定を確認してください。'); }
});
window.addEventListener('online', () => { render(); void check(); });
window.addEventListener('offline', () => { render(); });
window.addEventListener('pageshow', () => { void refresh(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
network();

async function init() {
  if (!('serviceWorker' in navigator) || !isSecureContext || !('caches' in window)) {
    message('このブラウザではアプリ内保存を利用できません。HTTPS 対応のブラウザで開いてください。オンライン再生は利用できます。');
    return;
  }
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.protocol === 1 && event.data?.type === 'CHANGED') void refresh();
  });
  try {
    registration = await navigator.serviceWorker.register(new URL('sw.js', root), { scope: root.pathname, updateViaCache: 'none' });
    await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('保存機能の準備が時間切れになりました。')), 30000))]);
    const updateNotice = () => { if (registration?.waiting) $('appUpdate').hidden = false; };
    updateNotice();
    registration.addEventListener('updatefound', () => registration?.installing?.addEventListener('statechange', updateNotice));
    await refresh();
    await check();
    // 別タブでの保存・キャンセルも反映する。通常時はフォーカスを戻したときに確認。
    setInterval(() => { if (!document.hidden && (workingId || busy)) void refresh(); }, 2000);
  } catch { message('保存機能を準備できません。通信とブラウザの保存設定を確認し、オンラインで再読み込みしてください。'); }
}
void init();
