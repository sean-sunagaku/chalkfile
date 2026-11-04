// Worker の入口。中身は app.ts。動画の一覧（許可リスト）は、npm run gen が講座ごとの content/<講座>/generated/media.<言語>.json を
// つないで作る worker/src/generated/media-manifest.json（Git に入れない）。wrangler（dev・deploy）の前に流す（npm run dev:worker・
// CI の build・ci.yml は流す）。型は generated/media-manifest.d.json.ts（JSON が無い checkout でも型を確かめられる）
import { createWorker } from './app';
import manifest from './generated/media-manifest.json';
import settings from './generated/project-settings.json';

export default createWorker(manifest, settings);
