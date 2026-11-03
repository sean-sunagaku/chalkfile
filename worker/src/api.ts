// /api/* の受け口（AI チャット。足すのは M4）。受け口を足すまでは、どのパスとメソッドにも、決まった 404 を JSON で返す。
// 本番の要求は、wrangler.jsonc の run_worker_first に /api/* を足すまで、ここに届かない（assets が先に 404 のページを返す）。
// 足すのは、受け口と守り（レート制限・1 日の予算）を入れる PR だけ。決めたことは docs/adr/2026-11-03-worker-api-shape.md
export type ApiHandler = (request: Request) => Response | Promise<Response>;

const NOT_FOUND = JSON.stringify({ error: 'not_found' });

const notFound = () =>
  new Response(NOT_FOUND, {
    status: 404,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  });

export const createApiHandler = (): ApiHandler => () => notFound();
