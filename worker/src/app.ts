// Worker の中身。サイトは assets が先に配信する。Worker を先に通すのは /media/* だけ（wrangler.jsonc の run_worker_first）。
// 入口は小さなルーター: パスの頭で受け口を選び（/media/ は動画の中継、/api/ は AI チャットの受け口）、どれにも合わなければ assets に渡す。
// 受け口を足しても、run_worker_first に入れるまで本番の要求は届かない。形と、広げる時期は docs/adr/2026-11-03-worker-api-shape.md
// 動画の一覧（許可リスト）を受け取って作る。本番の入口（index.ts）は、npm run gen が作る全講座の一覧を渡し、テストは合成の一覧を渡す。
// Env（binding の型）と ExportedHandler は、wrangler types が wrangler.jsonc から作る worker/worker-configuration.d.ts にある（手で書かない）。
import { allMediaEntries, validateMediaManifest } from '../../site/media-shared';
import { createApiHandler } from './api';
import { createMediaHandler } from './media';

/** 受け口の 1 つ。prefix は / で始まり / で終わるパスの頭（/media/ には /media と /mediax/ が合わない） */
type Route = { prefix: `/${string}/`; handle: (request: Request, url: URL) => Response | Promise<Response> };

/** 一覧と公開先を渡して作る。本番の生成 JSON は index.ts だけが読む。 */
export const createWorker = (manifest: unknown, settings: { origin: string }) => {
  const origin = new URL(settings.origin);
  // www の HTML は assets が返す。Worker が 301 にするのは /media/ だけ。
  const toApex = (url: URL) => {
    const apex = new URL(url);
    apex.host = origin.host;
    apex.protocol = origin.protocol;
    return Response.redirect(apex.href, 301);
  };
  const media = createMediaHandler(allMediaEntries(validateMediaManifest(manifest)));
  const api = createApiHandler();
  const routes: Route[] = [
    {
      prefix: '/media/',
      handle: (request, url) => (url.hostname === `www.${origin.hostname}` ? toApex(url) : media(request)),
    },
    { prefix: '/api/', handle: (request) => api(request) },
  ];
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);
      const route = routes.find((r) => url.pathname.startsWith(r.prefix));
      return route ? route.handle(request, url) : env.ASSETS.fetch(request);
    },
  } satisfies ExportedHandler<Env>;
};
