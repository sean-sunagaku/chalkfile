import type { CourseManifest, CourseStatus, DownloadProgress, OfflineBroadcast, OfflineOperation, OfflineReply, OfflineResults } from './offline-shared';
import type { SiteText } from './i18n';
import { OFFLINE_STATE, type OfflineState } from './page/events';

type AppData = {
  root: string;
  course?: { id: string; title: string; pageVersion: string };
  courses: { id: string; title: string }[];
  /** このページの言語（保存機能のエラーもこの言語で返してもらう）と、決まった文字（site/i18n.ts） */
  lang: string;
  locale: string;
  text: SiteText;
};
type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
const app = JSON.parse(document.getElementById('pwa-data')!.textContent!) as AppData;
const T = app.text;
const tt = (k: keyof SiteText, v: Record<string, string | number> = {}) => T[k].replace(/\{(\w+)\}/g, (m, n: string) => (n in v ? String(v[n]) : m));
const root = new URL(app.root, location.href);
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
/**
 * SW が動き出したあと（navigator.serviceWorker.ready のあと）にだけ入れる。register のあと ready の前（初めて開いて SW を入れている間）は、
 * controller も active も無いので、状態を問い合わせても「保存機能を準備できません」になる。それまでは問い合わせず、ボタンも押せないままにする
 */
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
  $('installState').textContent = T.ocInstalled;
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
    $('installState').textContent = choice.outcome === 'accepted' ? T.ocInstallAccepted : T.ocInstallDismissed;
  } catch { $('installState').textContent = T.ocInstallMenu; }
});

/** SW に頼み、答えを待つ（SAVE の途中の進み具合は progress に渡す）。頼みごとと答えの形は offline-shared.ts の OfflineRequest・OfflineReply */
function request<K extends OfflineOperation>(type: K, id?: string, progress?: (p: DownloadProgress) => void): Promise<OfflineResults[K]>;
function request(type: OfflineOperation, id?: string, progress?: (p: DownloadProgress) => void): Promise<OfflineResults[OfflineOperation]> {
  return new Promise((resolve, reject) => {
    const worker = navigator.serviceWorker.controller ?? registration?.active;
    if (!worker) { reject(new Error(T.ocNoWorker)); return; }
    const channel = new MessageChannel();
    let timer: ReturnType<typeof setTimeout>;
    const finish = (error?: Error, value?: OfflineResults[OfflineOperation]) => {
      clearTimeout(timer);
      channel.port1.close();
      if (error) reject(error); else resolve(value!);
    };
    const extend = () => { clearTimeout(timer); timer = setTimeout(() => finish(new Error(T.ocTimeout)), 150000); };
    channel.port1.onmessage = (event: MessageEvent<OfflineReply>) => {
      extend();
      if (event.data.progress) progress?.(event.data.progress);
      else if (event.data.ok) finish(undefined, event.data);
      else finish(new Error(event.data.error ?? T.ocUnavailable));
    };
    extend();
    worker.postMessage({ protocol: 1, type, id, lang: app.lang }, [channel.port2]);
  });
}

/** 文字が変わったときだけ書く（読み上げの欄は、同じ文を書き直すと読み直すことがある） */
function setText(id: string, text: string) {
  const el = $(id);
  if (el.textContent !== text) el.textContent = text;
}
function network() {
  setText('networkState', navigator.onLine ? T.ocOnline : T.ocOffline);
}
/**
 * 案内の文（画面の #offlineMessage）。読み上げの欄（#offlineLive）にも書く。保存の進み具合（step は 10% ごとの段）は、
 * 段が変わったときだけ読み上げの欄に書く（画面の文は毎回書く。読み上げの欄に毎回書くと、1 秒に何度も読み上げが割り込む）
 */
let spokenStep: number | null = null;
function message(text: string, step: number | null = null) {
  messageRevision++;
  $('offlineMessage').textContent = text;
  if (step === null || step !== spokenStep) setText('offlineLive', text);
  spokenStep = step;
}
function storageMessage() {
  if (!app.course) return T.ocStatusHome;
  const status = states.find((s) => s.id === app.course!.id);
  if (status?.incomplete) return status.saved ? T.ocIncompleteWithOld : T.ocIncomplete;
  return status?.saved ? T.ocSavedReady : T.ocNotSaved;
}
function canShowStatus() { return !busy && !locallyDownloading && !states.some((s) => s.progress); }
function drawProgress(p?: DownloadProgress | null) {
  const bar = $<HTMLProgressElement>('offlineProgress');
  bar.hidden = !p;
  if (!p) return;
  bar.max = p.total || 1;
  bar.value = p.loaded;
  const pct = p.total ? Math.floor(p.loaded / p.total * 100) : 0;
  // 読み上げの段: 始め（教材情報の確認）が -1、保存中は 10% ごとに 0〜10
  message(p.total ? tt('ocProgress', { pct, loaded: mb(p.loaded), total: mb(p.total), file: p.file, count: p.count }) : T.ocProgressStart, p.total ? Math.floor(pct / 10) : -1);
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
    $('savedState').textContent = saved ? tt('ocSavedState', { size: mb(saved.manifest.bytes), at: new Date(saved.savedAt).toLocaleString(app.locale), old: status?.incomplete ? T.ocSavedStateOld : '' }) : status?.incomplete ? T.ocIncomplete : T.ocUnsavedState;
    const same = saved?.manifest.revision === latest?.revision;
    const save = $<HTMLButtonElement>('offlineSave');
    save.textContent = saved && latest && !same ? T.ocSaveUpdate : status?.incomplete ? T.ocSaveRetry : T.offSave;
    save.disabled = !registration || !navigator.onLine || processing || !latest || (!!same && !status?.incomplete);
    $<HTMLButtonElement>('offlineDelete').disabled = !registration || processing || (!saved && !status?.incomplete);
    $('offlineCancel').hidden = !anyProgress && !locallyDownloading;
    $<HTMLButtonElement>('offlineCancel').disabled = !workingId && !locallyDownloading;
    $<HTMLButtonElement>('offlineCheck').disabled = !registration || !navigator.onLine || processing;
    $('downloadSize').textContent = latest ? tt('ocSize', { size: mb(latest.bytes) }) : T.ocSizeOnline;
    const changed = saved && saved.manifest.pageVersion !== app.course.pageVersion;
    $('offlineReload').hidden = !changed;
    if (changed) message(T.ocSwitched);
    // 講座のページの画面（site/course-page.ts の player）が、再生の状態の文に使う
    window.dispatchEvent(new CustomEvent<OfflineState>(OFFLINE_STATE, { detail: {
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
    label.textContent = s?.progress ? T.ocLibSaving : s?.saved ? tt('ocLibSaved', { size: mb(s.saved.manifest.bytes) }) : s?.incomplete ? T.ocLibIncomplete : T.ocLibNone;
    li.append(a, label);
    list.append(li);
  }
  // 自分の保存の最終状態を確認するまでは、古い STATUS で完了・エラーを描き直さない。
  if (!locallyDownloading && !localSaveRequest) {
    drawProgress(anyProgress);
    if (wasWorking && !anyProgress && !localSaveRequest) message(T.ocOtherTab);
  }
  if (localSaveRequest && !busy && !locallyDownloading && !anyProgress) localSaveRequest = false;
}

async function capacity() {
  try {
    const estimate = await navigator.storage?.estimate?.();
    const persistent = await navigator.storage?.persisted?.();
    $('storageState').textContent = `${estimate?.quota ? tt('ocUsage', { usage: mb(estimate.usage ?? 0), quota: mb(estimate.quota) }) : T.ocUsageUnknown}${persistent ? T.ocPersisted : T.ocNotPersisted}`;
    $<HTMLButtonElement>('offlinePersist').disabled = !navigator.storage?.persist || !!persistent;
  } catch { $('storageState').textContent = T.ocNoEstimate; }
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
  if (!app.course || !navigator.onLine || !registration) return;
  $<HTMLButtonElement>('offlineCheck').disabled = true;
  const before = messageRevision;
  try {
    latest = (await request('CHECK', app.course.id)).manifest;
    const status = states.find((s) => s.id === app.course!.id);
    const saved = status?.saved;
    if (status && before === messageRevision && canShowStatus()) message(status.incomplete ? storageMessage() : saved && saved.manifest.revision !== latest?.revision ? T.ocNewVersion : saved ? T.ocSameVersion : storageMessage());
  } catch (error) {
    // 確認を待つ間に始まった保存や、別操作の結果を遅い応答で置き換えない。
    if (before === messageRevision && canShowStatus()) {
      latest = undefined;
      message(tt('ocCheckFailed', { error: (error as Error).message }));
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
    message(T.ocSaved);
  } catch (error) { message(tt('ocSaveFailed', { error: (error as Error).message })); }
  finally { busy = false; locallyDownloading = false; drawProgress(); await refresh(); }
});
$('offlineCancel').addEventListener('click', async () => {
  try {
    await request('CANCEL', workingId ?? app.course?.id);
    message(T.ocCancelAccepted);
  } catch (error) { message((error as Error).message); }
});
$('offlineDelete').addEventListener('click', async () => {
  if (!app.course || busy) return;
  busy = true;
  render();
  try {
    await request('DELETE', app.course.id);
    message(T.ocDeleted);
  } catch (error) { message((error as Error).message); }
  finally { busy = false; await refresh(); }
});
$('offlineCheck').addEventListener('click', () => { void check(); });
$('offlineReload').addEventListener('click', () => location.reload());
$('offlinePersist').addEventListener('click', async () => {
  try {
    const granted = await navigator.storage.persist();
    message(granted ? T.ocPersistGranted : T.ocPersistDenied);
    await capacity();
  } catch { message(T.ocPersistError); }
});
window.addEventListener('online', () => { render(); void check(); });
window.addEventListener('offline', () => { render(); });
window.addEventListener('pageshow', () => { void refresh(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
network();

async function init() {
  if (!('serviceWorker' in navigator) || !isSecureContext || !('caches' in window)) {
    message(T.ocNoSupport);
    return;
  }
  // SW からの知らせ（OfflineBroadcast）。ほかの版の SW からも来るので、項目があるとは限らない
  navigator.serviceWorker.addEventListener('message', (event: MessageEvent<Partial<OfflineBroadcast> | null>) => {
    if (event.data?.protocol === 1 && event.data?.type === 'CHANGED') void refresh();
  });
  try {
    const registered = await navigator.serviceWorker.register(new URL('sw.js', root), { scope: root.pathname, updateViaCache: 'none' });
    await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error(T.ocSwTimeout)), 30000))]);
    // ここから問い合わせる（pageshow・visibilitychange・CHANGED の知らせ・online が先に来ても、refresh と check は待つ）
    registration = registered;
    const updateNotice = () => { if (registered.waiting) $('appUpdate').hidden = false; };
    updateNotice();
    registered.addEventListener('updatefound', () => registered.installing?.addEventListener('statechange', updateNotice));
    await refresh();
    await check();
    // 別タブでの保存・キャンセルも反映する。通常時はフォーカスを戻したときに確認。
    setInterval(() => { if (!document.hidden && (workingId || busy)) void refresh(); }, 2000);
  } catch { message(T.ocSwFailed); }
}
void init();
