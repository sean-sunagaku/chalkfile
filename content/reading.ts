// 読みのエンジンと、全講座で共通の読みの辞書。中身は engine/core/reading.ts にあり、ここは再 export だけ。
// 講座の辞書（content/<講座>/reading.ts）は、今までどおり '../reading' から型（Reading）を読む
export * from '../engine/core/reading';
