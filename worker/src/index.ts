// サイトは assets が先に配信する。Worker を先に通すのは /media/* だけ。
export type Env = { ASSETS: { fetch(request: Request): Promise<Response> } };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname === 'www.chalkfile.com') {
      url.hostname = 'chalkfile.com';
      url.protocol = 'https:';
      return Response.redirect(url.href, 301);
    }
    if (url.pathname.startsWith('/media/')) return new Response('動画が見つかりません。', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
