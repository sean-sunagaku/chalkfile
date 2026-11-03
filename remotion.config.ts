// Remotion Studio（npm run studio）と npx remotion の設定。動画の書き出し（npm run render）は scripts/stages/video/render.ts が
// @remotion/renderer で行い、このファイルは読まない。書き出しの設定の正本は scripts/stages/video/render.config.ts で、
// Studio から書き出すときも同じ画像の形式と品質にする（並列の数は Remotion の既定。CPU の数の半分で、8 まで）
import { Config } from '@remotion/cli/config';
import { RENDER } from './scripts/stages/video/render.config';

Config.setVideoImageFormat(RENDER.master.imageFormat);
Config.setJpegQuality(RENDER.master.jpegQuality);
Config.setOverwriteOutput(true);
