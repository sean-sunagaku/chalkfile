// ブラウザのテストのサーバー（127.0.0.1 だけで待ち受ける。公開サイト・元の動画・ほかの作業フォルダには触らない）。
//   bun tests/browser-server.ts   # 127.0.0.1:8877 で待ち受け、「chalkfile-e2e: <URL>」を出す（playwright.config.ts が読む）
// テストごとに「セッション」を作る: POST /__test/session（{"site":"ci"|"real"}）が、別の番号で講座サイトを配るサーバーを立て、
// その URL と講座の情報（tests/e2e/site.ts の SiteSession）を返す。障害の差し込みの状態（/__test/control）はセッションごとなので、
// workers を 2 以上にしても混ざらない。DELETE /__test/session/<id> で閉じる。
//   ci: 合成の講座（初めて頼まれたときに、作業フォルダの .work/e2e-<乱数>/ に組み立てる。終わるときに消す）
//   real: 本物の講座（site/dist と site/media）
// このサーバーそのものも、本物の講座のセッションとして答える（tests/capture-saved-records.ts が使う）
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { Session } from './e2e/session';
import type { SiteMode, SiteSession } from './e2e/site';
import { type PreparedSite, prepareFixtureSite, prepareRealSite } from './e2e/sites';

const ROOT = path.resolve(import.meta.dir, '..');
const work = path.join(ROOT, '.work');
let fixtureDir: string | null = null;

/** 配る講座サイト（初めて頼まれたときに 1 回だけ用意し、セッションの間で共有する） */
const sites: Partial<Record<SiteMode, Promise<PreparedSite>>> = {};
const siteOf = (mode: SiteMode): Promise<PreparedSite> => {
  sites[mode] ??= (async () => {
    if (mode === 'real') return prepareRealSite();
    mkdirSync(work, { recursive: true });
    fixtureDir = mkdtempSync(path.join(work, 'e2e-'));
    return prepareFixtureSite(fixtureDir);
  })();
  return sites[mode];
};

type Running = { session: Session; server: ReturnType<typeof Bun.serve> };
const sessions = new Map<string, Running>();
let next = 0;

const open = async (mode: SiteMode): Promise<SiteSession> => {
  const site = await siteOf(mode);
  const session = new Session(site);
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: (req) => session.fetch(req) });
  const id = String(++next);
  sessions.set(id, { session, server });
  return {
    id,
    origin: `http://127.0.0.1:${server.port}`,
    mode,
    dist: site.dist,
    course: site.course,
    legacyVideo: site.legacy.video,
    videoSeconds: site.videoSeconds,
  };
};

/** このサーバーそのものの、本物の講座のセッション（初めて要るときに作る） */
let own: Session | null = null;
const ownSession = async () => {
  own ??= new Session(await siteOf('real'));
  return own;
};

const hub = Bun.serve({
  hostname: '127.0.0.1',
  port: 8877,
  async fetch(req) {
    const u = new URL(req.url);
    if (u.pathname === '/__test/health') return new Response('ok');
    if (u.pathname === '/__test/session' && req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as { site?: string };
      const mode = body.site ?? 'real';
      if (mode !== 'ci' && mode !== 'real') return new Response(`知らないサイト: ${mode}（ci か real）`, { status: 400 });
      try {
        return Response.json(await open(mode));
      } catch (e) {
        return new Response(e instanceof Error ? e.message : String(e), { status: 500 });
      }
    }
    const closing = /^\/__test\/session\/(\d+)$/.exec(u.pathname);
    if (closing && req.method === 'DELETE') {
      sessions.get(closing[1])?.server.stop(true);
      sessions.delete(closing[1]);
      return new Response(null, { status: 204 });
    }
    try {
      return await (await ownSession()).fetch(req);
    } catch (e) {
      return new Response(e instanceof Error ? e.message : String(e), { status: 500 });
    }
  },
});

/** 終わるときに、セッションのサーバーを閉じ、合成の講座のフォルダを消す */
const close = () => {
  for (const { server } of sessions.values()) server.stop(true);
  hub.stop(true);
  if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
  process.exit(0);
};
process.on('SIGTERM', close);
process.on('SIGINT', close);

console.log(`chalkfile-e2e: http://127.0.0.1:${hub.port}/`);
