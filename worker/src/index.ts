// サイトは assets が先に配信する。Worker を先に通すのは /media/* だけ。
import manifest from '../../site/media-manifest.json';
import { validateMediaManifest } from '../../site/media-shared';
import { createMediaHandler } from './media';
export type Env = { ASSETS: { fetch(request: Request): Promise<Response> } };
const media = createMediaHandler(validateMediaManifest(manifest).entries);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname === 'www.chalkfile.com') {
      url.hostname = 'chalkfile.com';
      url.protocol = 'https:';
      return Response.redirect(url.href, 301);
    }
    if (url.pathname.startsWith('/media/')) return media(request);
    return env.ASSETS.fetch(request);
  },
};
