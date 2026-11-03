// サイトは assets が先に配信する。Worker を先に通すのは /media/* だけ。
import manifest from '../../site/media-manifest.json';
import { allMediaEntries, validateMediaManifest } from '../../site/media-shared';
import { createMediaHandler } from './media';
export type Env = { ASSETS: { fetch(request: Request): Promise<Response> } };
const media = createMediaHandler(allMediaEntries(validateMediaManifest(manifest)));

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // www の HTML も assets が返し、ページの先頭の location.replace で apex へ移す。Worker が 301 にするのは /media/ だけ。
    if (!url.pathname.startsWith('/media/')) return env.ASSETS.fetch(request);
    if (url.hostname === 'www.chalkfile.com') {
      url.hostname = 'chalkfile.com';
      url.protocol = 'https:';
      return Response.redirect(url.href, 301);
    }
    return media(request);
  },
};
