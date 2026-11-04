// テスト 1 つ分の講座サイト（セッション）の応答。配り方は本番に合わせた scripts/site/serve-files.ts を使い、その上に、
// 通信・更新の障害の差し込み（POST /__test/control の Control）と数え上げ（GET /__test/stats）を重ねる。
// 状態はセッションごとに持つので、ほかのテストの差し込みが混ざらない（Playwright の workers を 2 以上にできる）。
// 旧 Pages（scope は site/legacy-config.json）は、前の公開（tests/fixtures/legacy-pages）と、公開済みの移行の案内（tests/fixtures/legacy-migration）を配る。
// 移行の案内は凍結した公開物をそのまま使い、今のソース（site/legacy-sw.ts・scripts/build_migration.ts）から作り直さない
import { required } from '../support/required';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  bodyResponse,
  fileResponse,
  findStatic,
  mediaHeaders,
  notFoundResponse,
  type ServeHeaders,
} from '../../scripts/site/serve-files';
import legacyConfig from '../../site/legacy-config.json';
import type { CourseManifest } from '../../site/offline-shared';
import { type Control, UPDATE_NEWS } from './site';
import type { PreparedSite } from './sites';

const ROOT = path.resolve(import.meta.dir, '../..');
/** 旧 Pages の scope（そのパスの下に、旧 Pages の公開物を配る） */
const LEGACY_SCOPE = legacyConfig.scope;
const LEGACY = {
  old: path.join(ROOT, 'tests/fixtures/legacy-pages'),
  migrated: path.join(ROOT, 'tests/fixtures/legacy-migration'),
};

export const DEFAULT_CONTROL: Control = {
  mode: 'normal',
  faultTarget: 'video',
  update: false,
  workerUpdate: false,
  disabledRevisions: [],
  manifestMode: 'normal',
  mediaDown: false,
  installDelay: 0,
  legacyPhase: 'old',
};

/** テストが読む数（保存の動画の全体の取得の回数とバイト数・保存の manifest の取得と、その失敗の回数） */
/** 数えたもの。mediaRequests は /media/ への要求の全部（Range の要求も。本番では Worker の回数の枠を使う） */
export type Stats = { fullVideoDownloads: number; fullVideoBytes: number; manifestRequests: number; manifestFailures: number; mediaRequests: number };
const NO_STATS: Stats = { fullVideoDownloads: 0, fullVideoBytes: 0, manifestRequests: 0, manifestFailures: 0, mediaRequests: 0 };

/** 応答はキャッシュさせない（障害の差し込みを変えたら、すぐ効くように） */
const NO_STORE: ServeHeaders = { 'Cache-Control': 'no-store' };
const sha256 = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');

/** sw.js の設定の「無効にした保存版の revision」を、revisions にする（組み立てたままの sw.js は空の一覧。形が変わっていたら止める） */
export const withDisabled = (sw: string, revisions: string[]): string => {
  const empty = /disabledRevisions:\s*\[\]/g;
  if (!empty.test(sw)) throw new Error('sw.js に、無効にした保存版の一覧（disabledRevisions: []）が見つからない');
  return sw.replace(empty, `disabledRevisions:${JSON.stringify(revisions)}`);
};

export class Session {
  control: Control = { ...DEFAULT_CONTROL };
  stats: Stats = { ...NO_STATS };

  constructor(readonly site: PreparedSite) {}

  /** 講座のページと保存の manifest（update は新しい版に、external は外の動画を指す manifest にする） */
  private variant(): { manifest: CourseManifest; page: string } {
    const dir = path.join(this.site.dist, this.site.course.id);
    const m = JSON.parse(readFileSync(path.join(dir, 'offline-manifest.json'), 'utf8')) as CourseManifest;
    let page = readFileSync(path.join(dir, 'index.html'), 'utf8');
    if (this.control.update) {
      const version = sha256(`${m.pageVersion}:更新テスト`);
      page = page.replaceAll(m.pageVersion, version).replace('</title>', '（更新テスト）</title>');
      m.pageVersion = version;
      for (const f of m.files) if (f.url.includes('?v=')) f.url = f.url.replace(/\?v=.*/, `?v=${version}`);
      required(m.files[0]).sha256 = sha256(page);
      required(m.files[0]).bytes = Buffer.byteLength(page);
      m.bytes = m.files.reduce((n, f) => n + f.bytes, 0);
      m.revision = sha256(JSON.stringify(m.files));
      // 新しい版で変わったこと（画面は、保存した日より後の日付のものを出す。テストの日の日付にする）
      m.news = [{ date: new Date().toISOString().slice(0, 10), text: UPDATE_NEWS }, ...(m.news ?? [])];
    }
    if (this.control.mode === 'external') {
      required(m.files[1]).url = 'https://example.com/restricted.mp4';
      m.revision = sha256(JSON.stringify(m.files));
    }
    return { manifest: m, page };
  }

  /** 旧 Pages（LEGACY_SCOPE の下） */
  private legacy(req: Request, relative: string): Response | Promise<Response> {
    const folder = LEGACY[this.control.legacyPhase];
    let file = path.resolve(folder, relative || 'index.html');
    if (!file.startsWith(folder + path.sep) && file !== folder) return new Response(null, { status: 403 });
    if (this.control.legacyPhase === 'old') {
      // 動画は fixture に入れない（real は手元の本物、ci は合成の動画。ci の保存の manifest は、合成の動画に合わせたもの）
      const video = /^pstack-comedy\/media\/P01(\.cc)?\.mp4$/.exec(relative);
      if (video) file = video[1] ? this.site.legacy.captioned : this.site.legacy.video;
      if (relative === 'pstack-comedy/offline-manifest.json' && this.site.legacy.manifest !== null) {
        return fileResponse(req, file, Buffer.from(this.site.legacy.manifest), NO_STORE);
      }
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!existsSync(file)) return new Response(null, { status: 404 });
    return fileResponse(req, file, undefined, NO_STORE);
  }

  /** 動画（/media/）。faultLecture の通常版の全体の取得（Range の無い GET）に、Control の mode の失敗を差し込む */
  private async media(req: Request): Promise<Response> {
    this.stats.mediaRequests++;
    const found = this.site.media.get(new URL(req.url).pathname);
    if (!found || !existsSync(found.file) || this.control.mediaDown) return new Response('not found', { status: 404 });
    if (!['GET', 'HEAD'].includes(req.method))
      return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    const headers = mediaHeaders(req, found.entry, NO_STORE);
    const whole = req.method === 'GET' && !req.headers.has('Range');
    if (whole) {
      this.stats.fullVideoDownloads++;
      this.stats.fullVideoBytes += found.entry.bytes;
    }
    const target =
      this.control.faultTarget === 'video' &&
      found.entry.lecture === this.site.course.faultLecture &&
      found.entry.kind === 'standard';
    if (!whole || !target) return bodyResponse(req, Bun.file(found.file), headers);
    return (await this.faultOf(req, readFileSync(found.file), headers)) ?? bodyResponse(req, Bun.file(found.file), headers);
  }

  /** Control の mode の失敗の応答（失敗を差し込まないときは null。delay は待ってから、そのまま返す） */
  private async faultOf(req: Request, file: Uint8Array, headers: ServeHeaders): Promise<Response | null> {
    const mode = this.control.mode;
    if (!['fail', 'redirect', 'partial', 'corrupt', 'truncated', 'delay'].includes(mode)) return null;
    if (mode === 'fail') return new Response('通信失敗テスト', { status: 500 });
    if (mode === 'redirect') return Response.redirect('https://example.com/restricted.mp4', 302);
    let data = file;
    if (mode === 'partial') {
      return new Response(new Blob([data.slice(0, 100)]), {
        status: 206,
        headers: { 'Content-Type': headers['Content-Type'] ?? 'application/octet-stream', 'Content-Range': `bytes 0-99/${data.length}` },
      });
    }
    if (mode === 'corrupt') {
      data = Buffer.from(data);
      const byte = data[100];
      if (byte === undefined) throw new Error('破損の検査には 101 バイト以上の動画が要る');
      data[100] = byte ^ 255;
    }
    if (mode === 'truncated') data = data.subarray(0, Math.floor(data.length / 2));
    if (mode === 'delay') await Bun.sleep(8000);
    return bodyResponse(req, data, headers);
  }

  async fetch(req: Request): Promise<Response> {
    const u = new URL(req.url);
    if (u.pathname === '/__test/health') return new Response('ok');
    if (u.pathname === '/__test/control' && req.method === 'POST') {
      this.control = { ...DEFAULT_CONTROL, ...((await req.json()) as Partial<Control>) };
      this.stats = { ...NO_STATS };
      return Response.json(this.control);
    }
    if (u.pathname === '/__test/stats') return Response.json(this.stats);
    if (u.pathname.startsWith(LEGACY_SCOPE)) {
      try {
        return await this.legacy(req, decodeURIComponent(u.pathname.slice(LEGACY_SCOPE.length)));
      } catch {
        return new Response(null, { status: 400 });
      }
    }
    if (u.pathname.startsWith('/media/')) return this.media(req);
    const target = findStatic(this.site.dist, u.pathname);
    if (target.kind !== 'file') return notFoundResponse(target, this.site.dist, NO_STORE);
    const course = this.site.course.id;
    if (target.rel === `${course}/index.html`)
      return fileResponse(req, target.file, Buffer.from(this.variant().page), NO_STORE);
    if (target.rel === `${course}/offline-manifest.json`) {
      this.stats.manifestRequests++;
      const { manifestMode } = this.control;
      if (manifestMode === 'fail' || (manifestMode === 'delay-first-fail' && this.stats.manifestRequests === 1)) {
        if (manifestMode === 'delay-first-fail') await Bun.sleep(3000);
        this.stats.manifestFailures++;
        return new Response('教材情報の通信失敗テスト', { status: 503 });
      }
      return fileResponse(req, target.file, Buffer.from(JSON.stringify(this.variant().manifest)), NO_STORE);
    }
    // オフラインの案内のページを取るのは SW の install だけ。遅らせると、SW が動き出すまでの間が長くなる
    if (target.rel === 'offline/index.html' && this.control.installDelay > 0) await Bun.sleep(this.control.installDelay);
    if (target.rel === 'sw.js' && this.control.workerUpdate) {
      const data = Buffer.concat([readFileSync(target.file), Buffer.from('\n// worker更新テスト\n')]);
      return fileResponse(req, target.file, data, NO_STORE);
    }
    if (target.rel === 'sw.js' && this.control.disabledRevisions.length) {
      return fileResponse(req, target.file, Buffer.from(withDisabled(readFileSync(target.file, 'utf8'), this.control.disabledRevisions)), NO_STORE);
    }
    // faultLecture のポスターの全体の取得（Range の無い GET）に、Control の mode の失敗を差し込む（faultTarget が poster のとき）
    if (
      this.control.faultTarget === 'poster' &&
      target.rel === `${course}/media/${this.site.course.faultLecture}.jpg` &&
      req.method === 'GET' &&
      !req.headers.has('Range')
    ) {
      const fault = await this.faultOf(req, readFileSync(target.file), { 'Content-Type': 'image/jpeg', ...NO_STORE });
      if (fault) return fault;
    }
    return fileResponse(req, target.file, undefined, NO_STORE);
  }
}
