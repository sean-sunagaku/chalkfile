// worker/src/generated/media-manifest.json（npm run gen が作る。Git に入れない）の型。JSON がまだ無い checkout でも型を確かめられるように、
// 中身は見ずに unknown とする（Worker は validateMediaManifest で形を確かめてから使う）。worker/tsconfig.json の allowArbitraryExtensions で読む
declare const manifest: unknown;
export default manifest;
