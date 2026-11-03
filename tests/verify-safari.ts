// AppleのsafaridriverへW3C WebDriverで接続する。個人の通常ウィンドウや認証情報を使わない。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { COURSES } from '../content';

const root = path.resolve(import.meta.dir, '..');
const iface = process.argv.find((a) => a.startsWith('--disconnect-wifi='))?.split('=')[1];
if (iface && !/^en\d+$/.test(iface)) throw new Error('Wi-Fi interfaceの形式が不正です');
if (process.argv[2] === '--restore-wifi') {
  const restore = process.argv[3];
  if (!/^en\d+$/.test(restore)) throw new Error('復旧先interfaceが不正です');
  await Bun.sleep(45000);
  process.exit(Bun.spawnSync(['sudo', '-n', '/usr/sbin/networksetup', '-setairportpower', restore, 'on'], { stdout: 'ignore', stderr: 'ignore' }).exitCode);
}
const driver = 'http://127.0.0.1:9515';
const evidence = path.join(root, '.work/evidence/safari'); mkdirSync(evidence, { recursive: true });
const receipt: Record<string, any> = { startedAt: new Date().toISOString(), target: 'https://chalkfile.com/', engine: 'Apple Safari via safaridriver', offlineRequested: !!iface, pages: [] };
let session = ''; let wifiChanged = false; let watchdog: Bun.Subprocess | undefined; let ownDriver: Bun.Subprocess | undefined;
const record = () => writeFileSync(path.join(evidence, iface ? 'verification-offline.json' : 'verification-online.json'), JSON.stringify(receipt, null, 2));
async function command(method: string, route: string, body?: unknown) {
  const response = await fetch(driver + (route === '/session' ? route : `/session/${session}${route}`), {
    method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000),
  });
  const { value } = await response.json();
  if (!response.ok) throw new Error(`WebDriver ${value?.error ?? response.status}: ${value?.message ?? '失敗'}`);
  return value;
}
const js = (script: string, args: unknown[] = []) => command('POST', '/execute/sync', { script, args });
async function asyncJs(script: string, args: unknown[] = []) {
  const result = await command('POST', '/execute/async', { script: `const done=arguments[arguments.length-1]; (async()=>{${script}})().then(value=>done({ok:true,value})).catch(()=>done({ok:false}));`, args });
  assert.equal(result.ok, true, 'Safari内の非同期処理が失敗しました'); return result.value;
}
async function until(script: string, label: string, ms = 30000) {
  const end = Date.now() + ms;
  do { if (await js(`return !!(${script});`)) return; await Bun.sleep(300); } while (Date.now() < end);
  throw new Error(label);
}
async function click(selector: string) {
  if (await js('return document.visibilityState;') === 'hidden') {
    // ロック中はnative pointerの配送を待たず、同じ保存/字幕ボタンのDOM clickを実行する。
    receipt.interaction = 'DOM click in hidden isolated automation document';
    await js('document.querySelector(arguments[0]).click();', [selector]); return;
  }
  const element = await command('POST', '/element', { using: 'css selector', value: selector });
  await command('POST', `/element/${element['element-6066-11e4-a52e-4f735466cecf']}/click`, {});
}
// 再生してから時刻へ移る（動画は preload="none" で、再生を押すまで読まない）
async function playAt(time: number) {
  await until('!!document.querySelector("video")', '動画がありません');
  await asyncJs('const v=document.querySelector("video");v.muted=true;await v.play();v.currentTime=arguments[0];return true;', [time]);
  await until(`document.querySelector("video").currentTime>${time + 0.4}`, '動画が進みません');
  const result = await js('const v=document.querySelector("video");v.pause();const c=document.createElement("canvas");c.width=320;c.height=180;const x=c.getContext("2d");x.drawImage(v,0,0,c.width,c.height);const rgb=[...x.getImageData(0,0,c.width,c.height).data].filter((_,i)=>i%4!==3);return {time:v.currentTime,frames:v.getVideoPlaybackQuality().totalVideoFrames,visibility:document.visibilityState,width:v.videoWidth,height:v.videoHeight,distinctChannels:new Set(rgb).size,frame:c.toDataURL("image/png"),source:new URL(v.currentSrc).pathname};');
  const frame = Buffer.from(result.frame.split(',')[1], 'base64');
  writeFileSync(path.join(evidence, `video-${time}-${Date.now()}.png`), frame); delete result.frame;
  assert.ok(result.width > 0 && result.height > 0);
  // ロック中のSafariではcompositorのframe数が0になる。実デコードした非単色の画素で確認する。
  assert.ok(result.distinctChannels > 8, 'Safariが動画の非単色フレームを出力していません'); return result;
}
async function screenshot(name: string) { writeFileSync(path.join(evidence, `${name}.png`), Buffer.from(await command('GET', '/screenshot'), 'base64')); }
try {
  try {
    const state = await (await fetch(driver + '/status', { signal: AbortSignal.timeout(1000) })).json();
    if (!state.value?.ready) throw new Error('Safariの別の自動試験が実行中です');
  } catch (error) {
    if (error instanceof Error && error.message.includes('別の自動試験')) throw error;
    ownDriver = Bun.spawn(['/usr/bin/safaridriver', '--port', '9515'], { stdout: 'ignore', stderr: 'ignore' });
    let running = false;
    for (let i = 0; i < 20 && !running; i++) {
      try { running = (await (await fetch(driver + '/status')).json()).value?.ready === true; } catch { await Bun.sleep(200); }
    }
    assert.ok(running, 'safaridriverを起動できません');
  }
  const created = await command('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari', platformName: 'mac', acceptInsecureCerts: false } } });
  session = created.sessionId; receipt.capabilities = created.capabilities; receipt.stage = 'pages'; record();
  await command('POST', '/timeouts', { implicit: 0, pageLoad: 15000, script: 30000 });
  for (const route of ['', ...COURSES.map((c) => `${c.id}/`)]) {
    await command('POST', '/url', { url: `https://chalkfile.com/${route}` });
    const title = COURSES.find((c) => `${c.id}/` === route)?.title ?? 'Chalkfile';
    await until(`location.pathname===${JSON.stringify(`/${route}`)} && document.title.includes(${JSON.stringify(title)}) && document.querySelector("h1")?.textContent.length>0`, '対象の講座を表示できません');
    receipt.pages.push(await js('return {path:location.pathname,title:document.title,heading:document.querySelector("h1").textContent};'));
  }
  await command('POST', '/url', { url: 'https://chalkfile.com/rive-comedy/' });
  await until('navigator.serviceWorker.controller && document.querySelector("#offlineSave") && !document.querySelector("#offlineSave").disabled', 'SWと保存ボタンが有効になりません');
  receipt.scope = await asyncJs('return (await navigator.serviceWorker.ready).scope;');
  assert.equal(receipt.scope, 'https://chalkfile.com/');
  receipt.onlinePlayback = await playAt(30); receipt.onlineSeek = await playAt(90); receipt.stage = 'save'; record();
  await screenshot('online');
  await click('#offlineSave');
  await until('document.querySelector("#savedState").textContent.includes("保存済み・教材と全動画")', 'アプリ内保存に失敗しました', 240000);
  receipt.saved = await asyncJs('return await new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=e=>{c.port1.close();resolve(e.data.courses.find(x=>x.id==="rive-comedy")?.saved)};navigator.serviceWorker.controller.postMessage({protocol:1,type:"STATUS"},[c.port2]);});');
  assert.ok(receipt.saved?.manifest?.files?.length >= 4); record(); console.log(`Safari: 全${COURSES.length + 1}ページ、再生、シーク、Rive講座全体の保存に成功`);
  if (iface) {
    const power = Bun.spawnSync(['/usr/sbin/networksetup', '-getairportpower', iface]);
    assert.match(power.stdout.toString(), /: On/);
    watchdog = Bun.spawn([process.execPath, import.meta.path, '--restore-wifi', iface], { stdout: 'ignore', stderr: 'ignore' });
    // UIの疑似表示ではなくWi-Fiを実際に切る。親が止まっても別プロセスが45秒で復旧する。
    wifiChanged = true;
    assert.equal(Bun.spawnSync(['sudo', '-n', '/usr/sbin/networksetup', '-setairportpower', iface, 'off']).exitCode, 0);
    assert.match(Bun.spawnSync(['/usr/sbin/networksetup', '-getairportpower', iface]).stdout.toString(), /: Off/);
    const probe = `https://chalkfile.com/__offline_probe__${crypto.randomUUID()}`;
    let reachable = false;
    try { await fetch(probe, { cache: 'no-store', signal: AbortSignal.timeout(2500) }); reachable = true; } catch { /* 実際に通信不能であることを確認 */ }
    assert.equal(reachable, false, 'Wi-Fi以外の経路で外部へ接続できるため、オフラインとは扱いません');
    receipt.networkProbe = await asyncJs('try{const r=await fetch(arguments[0],{cache:"no-store",signal:AbortSignal.timeout(3000)});return {navigatorOnline:navigator.onLine,status:r.status}}catch{return {navigatorOnline:navigator.onLine,failed:true}}', [probe]);
    assert.ok(receipt.networkProbe.failed || receipt.networkProbe.status === 503, 'Safariからの非保存URLへの通信が遮断されていません');
    receipt.stage = 'offline'; record();
    const tab = await command('POST', '/window/new', { type: 'tab' });
    await command('POST', '/window', { handle: tab.handle });
    await command('POST', '/url', { url: 'https://chalkfile.com/rive-comedy/' });
    await until('document.querySelector("#savedState")?.textContent.includes("保存済み・教材と全動画")', '通信断の新規タブから保存版を開けません', 10000);
    receipt.offlineNewTabPlayback = await playAt(30);
    if (await js('return document.querySelector("#ccToggle").getAttribute("aria-pressed");') === 'true') await click('#ccToggle');
    await until('!(document.querySelector("video").getAttribute("src") ?? "/R01.cc.").includes("/R01.cc.")', '字幕の版を切り替えられません', 10000);
    receipt.offlineStandardSeek = await playAt(90);
    const entry = JSON.parse(readFileSync(path.join(root, 'content/rive-comedy/generated/media.ja.json'), 'utf8')).entries.find((e: any) => e.lecture === 'R01' && e.kind === 'standard');
    receipt.offlineRange = await asyncJs('const r=await fetch(arguments[0],{headers:{Range:"bytes=1000-1127"}});return {status:r.status,bytes:[...new Uint8Array(await r.arrayBuffer())]};', [`/media/ja/rive-comedy/${entry.filename}`]);
    assert.equal(receipt.offlineRange.status, 206);
    assert.deepEqual(receipt.offlineRange.bytes, [...readFileSync(path.join(root, 'site/media/R01.mp4')).subarray(1000, 1128)]);
    receipt.offlineDownload = await asyncJs('const r=await fetch(arguments[0]+"?download=1");const data=await r.arrayBuffer();const hash=await crypto.subtle.digest("SHA-256",data);return {status:r.status,disposition:r.headers.get("Content-Disposition"),sha256:[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("")};', [`/media/ja/rive-comedy/${entry.filename}`]);
    assert.equal(receipt.offlineDownload.sha256, entry.sha256); assert.match(receipt.offlineDownload.disposition, /attachment/);
    receipt.offlineMethod = 'Wi-Fi interface physically off; independent external request fails; uncached Safari request fails/503; a new automation tab, same isolated Safari session; OS network restored automatically. navigator.onLine is recorded separately because it may stay true in a hidden document.';
    await screenshot('offline'); console.log('Safari: Wi-Fi断、新規タブから保存版起動、字幕切替、Range、90秒シーク、DL payload SHA-256に成功');
  }
  receipt.passed = true;
} catch (error) {
  receipt.passed = false; receipt.failure = String(error);
  if (session) receipt.ui = await js('return {saved:document.querySelector("#savedState")?.textContent,message:document.querySelector("#offlineMessage")?.textContent,progress:document.querySelector("#offlineProgress")?.textContent};').catch(() => null);
  throw error;
}
finally {
  if (wifiChanged) {
    const restored = Bun.spawnSync(['sudo', '-n', '/usr/sbin/networksetup', '-setairportpower', iface!, 'on']);
    receipt.wifiRestored = restored.exitCode === 0;
    if (restored.exitCode === 0) watchdog?.kill();
  }
  receipt.finishedAt = new Date().toISOString(); record();
  if (session) await command('DELETE', '').catch(() => {});
  ownDriver?.kill();
}
