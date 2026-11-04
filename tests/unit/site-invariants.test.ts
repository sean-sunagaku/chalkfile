import { required } from '../support/required';
import { afterEach, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { asset, hash } from '../../scripts/pwa';
import { HEADERS } from '../../scripts/site/headers';
import { assertSiteInvariants, type SiteInvariantInput, siteInvariantProblems } from '../../scripts/site-invariants';
import { PAGE_VERSION_MARK } from '../../scripts/site-version';
import { OFFLINE_FILE_MAX_BYTES, WORKERS_ASSET_MAX_BYTES } from '../../site/limits';
import { type MediaEntry, mediaFilename, mediaPath } from '../../site/media-shared';
import type { CourseManifest } from '../../site/offline-shared';

// 組み立てたサイトの決まり（scripts/site-invariants.ts）。決まりを守った小さなサイト（講座 1 つ・動画 1 本）を一時フォルダに作り、
// 1 か所ずつ壊して、壊した所だけを過不足なく見つけるかを見る
const scope = 'https://chalkfile.com/';
const b64 = (s: string) => createHash('sha256').update(s).digest('base64');
/** CSP（scripts/build_site.ts の csp と同じ形）を付けたページ。scripts は、ページで動く script の中身 */
const page = (body: string, scripts: string[], head = '') => {
  const src = scripts.length ? scripts.map((s) => `'sha256-${b64(s)}'`).join(' ') : "'none'";
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src ${src}; object-src 'none'">${scripts.map((s) => `<script>${s}</script>`).join('')}${head}</head><body>${body}</body></html>`;
};
const entry = (sha: string, bytes = 1000): MediaEntry => {
  const e = {
    lang: 'ja',
    course: 'sample',
    lecture: 'S01',
    kind: 'standard' as const,
    bytes,
    sha256: sha.repeat(64),
    tag: 'media-ja-sample',
  };
  return { ...e, filename: mediaFilename(e) };
};

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** 決まりを守ったサイト。input（scope・動画の一覧・起動用ファイル・講座）も、これに合わせる */
const makeSite = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'chalkfile-invariants-'));
  dirs.push(dir);
  const write = (rel: string, data: string | Uint8Array) => {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), data);
  };
  const version = 'b'.repeat(64);
  const video = entry('c');
  // 講座のページ。台本の中身は JSON のデータに入る（コードの場面の {{name}}・__FILE__ は、置き換えの印ではない）
  const data = JSON.stringify({ pageVersion: version, code: 'Hello, {{name}} from __FILE__' });
  const course = page(`<h1>サンプル</h1><script id="course-data" type="application/json">${data}</script>`, [
    'run("course")',
  ]);
  write('sample/index.html', course);
  const poster = Buffer.from('poster');
  write('sample/media/S01.jpg', poster);
  const manifest = (files: CourseManifest['files']): CourseManifest => ({
    schema: 1,
    id: 'sample',
    title: 'サンプル',
    pageVersion: version,
    revision: hash(JSON.stringify(files)),
    bytes: files.reduce((n, f) => n + f.bytes, 0),
    files,
  });
  const files = [
    asset('sample/', Buffer.from(course), 'text/html'),
    { url: mediaPath(video), bytes: video.bytes, sha256: video.sha256, type: 'video/mp4' },
    asset(`sample/media/S01.jpg?v=${version}`, poster, 'image/jpeg'),
  ];
  write('sample/offline-manifest.json', JSON.stringify(manifest(files)));
  const home = page('<h1>講座の一覧</h1>', ['run("home")', 'run("www")']);
  write('index.html', home);
  // オフラインの案内のページ（__ROOT__ は、SW が配るときに置き換える）
  const offline = '<!doctype html><html lang="ja"><body><a href="__ROOT__">一覧へ</a></body></html>';
  write('offline/index.html', offline);
  const icon = Buffer.from([137, 80, 78, 71]);
  write('icons/icon-180.png', icon);
  write('404.html', page('<h1>見つかりません</h1>', []));
  write(
    '_headers',
    '/*\n  X-Content-Type-Options: nosniff\n  Cache-Control: public, max-age=0, must-revalidate, no-transform\n',
  );
  write('.assetsignore', '**/*.mp4\n.*\n');
  const input: SiteInvariantInput = {
    dist: dir,
    scope,
    media: { schema: 1, entries: [video] },
    shell: [
      asset('./', Buffer.from(home), 'text/html'),
      asset('offline/', Buffer.from(offline), 'text/html'),
      asset('icons/icon-180.png', icon, 'image/png'),
    ],
    courses: ['sample'],
  };
  /** 保存の manifest を書き換える（revision と合計は、書き換えたあとの files から数え直す） */
  const editManifest = (edit: (files: CourseManifest['files']) => void) => {
    const m = JSON.parse(readFileSync(path.join(dir, 'sample/offline-manifest.json'), 'utf8')) as CourseManifest;
    edit(m.files);
    write('sample/offline-manifest.json', JSON.stringify(manifest(m.files)));
  };
  return { dir, write, input, editManifest, video };
};

describe('組み立てたサイトの決まり（assertSiteInvariants）', () => {
  test('決まりを守ったサイトは通る（JSON のデータの中の {{name}}・__FILE__ と、オフラインの案内のページの __ROOT__ は印に数えない）', () => {
    const site = makeSite();
    expect(siteInvariantProblems(site.input)).toEqual([]);
    expect(() => assertSiteInvariants(site.input)).not.toThrow();
  });

  test('Workers の 1 ファイルの上限を超えるファイルで止まる（ちょうどは通す）', () => {
    const site = makeSite();
    const big = path.join(site.dir, 'assets/big.jpg');
    site.write('assets/big.jpg', '');
    truncateSync(big, WORKERS_ASSET_MAX_BYTES);
    expect(siteInvariantProblems(site.input)).toEqual([]);
    truncateSync(big, WORKERS_ASSET_MAX_BYTES + 1);
    expect(siteInvariantProblems(site.input)).toEqual([
      'Workers の静的 assets の 1 ファイルの上限（25.0 MiB）を超えています: assets/big.jpg（25.0 MiB）',
    ]);
    expect(() => assertSiteInvariants(site.input)).toThrow('assets/big.jpg');
  });
  test('Workers のファイルの数の上限を超えたら止まる（隠しファイルも数える）', () => {
    const site = makeSite();
    // ページ 4・ポスター・manifest・アイコン・_headers・.assetsignore の 9 ファイル
    expect(siteInvariantProblems({ ...site.input, maxFiles: 9 })).toEqual([]);
    expect(siteInvariantProblems({ ...site.input, maxFiles: 8 })).toEqual([
      'Workers の静的 assets のファイルの数が上限（8）を超えています: 9',
    ]);
  });
  test('MP4 が入っていたら止まる（動画は Releases から /media/ で配る）', () => {
    const site = makeSite();
    site.write('sample/media/S01.MP4', 'video');
    expect(siteInvariantProblems(site.input)).toEqual([
      '公開物に MP4 があります（動画は Releases から /media/ で配る）: sample/media/S01.MP4',
    ]);
  });

  test('HTML に置き換えの印が残っていたら止まる', () => {
    const site = makeSite();
    site.write('404.html', page('<h1>__TITLE__</h1><p>{{tabQuiz}} {{ ja.offPageTitle }} __ROOT__</p>', []));
    expect(siteInvariantProblems(site.input)).toEqual([
      '404.html: 置き換えの印が残っています: __TITLE__・{{tabQuiz}}・{{ ja.offPageTitle }}・__ROOT__',
    ]);
  });
  test('版の印が残っていたら止まる（JSON のデータの中でも）', () => {
    const site = makeSite();
    site.write(
      '404.html',
      page(
        `<p>${PAGE_VERSION_MARK}</p><script type="application/json">{"pageVersion":"${PAGE_VERSION_MARK}"}</script>`,
        [],
      ),
    );
    expect(siteInvariantProblems(site.input)).toEqual([
      `404.html: JSON のデータに版の印 ${PAGE_VERSION_MARK} が残っています`,
      `404.html: 置き換えの印が残っています: ${PAGE_VERSION_MARK}`,
    ]);
  });
  test('JSON のデータが JSON として読めなければ止まる（置き換え忘れの __COURSE_JSON__ など）', () => {
    const site = makeSite();
    site.write('404.html', page('<script id="course-data" type="application/json">__COURSE_JSON__</script>', []));
    expect(siteInvariantProblems(site.input)).toEqual([
      '404.html: <script type="application/json"> の中身が JSON として読めません（置き換えの印が残っていないか見る）',
    ]);
  });

  test('CSP のハッシュの数と、動く script の数が合わなければ止まる', () => {
    const site = makeSite();
    // ハッシュの無い script・module（今の CSP の作り方は <script> だけを数える）・外のファイルの script
    const cases: [string, string[]][] = [
      [
        page('', ['run(1)'], '<script>run(2)</script>'),
        [
          '404.html: CSP の script のハッシュ（1）と、動く script（2）の数が合いません',
          '404.html: 2 つ目の script のハッシュが CSP にありません（ブラウザが止める）',
        ],
      ],
      [
        page('', [], '<script type="module">run(1)</script>'),
        [
          '404.html: CSP の script のハッシュ（0）と、動く script（1）の数が合いません',
          '404.html: 1 つ目の script のハッシュが CSP にありません（ブラウザが止める）',
        ],
      ],
      [
        page('', [], '<script src="/app.js"></script>'),
        [
          '404.html: CSP の script のハッシュ（0）と、動く script（1）の数が合いません',
          '404.html: 1 つ目の script が外のファイルを読みます（CSP のハッシュで許していないので動かない）',
        ],
      ],
      [
        '<!doctype html><html><head><script>run(1)</script></head></html>',
        [
          '404.html: CSP の script のハッシュ（0）と、動く script（1）の数が合いません',
          '404.html: 1 つ目の script のハッシュが CSP にありません（ブラウザが止める）',
        ],
      ],
    ];
    for (const [html, expected] of cases) {
      site.write('404.html', html);
      expect(siteInvariantProblems(site.input)).toEqual(expected);
    }
    // 数が同じでも、中身が CSP のハッシュと違えば止まる
    site.write('404.html', page('', ['run(1)']).replace('<script>run(1)</script>', '<script>run(2)</script>'));
    expect(siteInvariantProblems(site.input)).toEqual([
      '404.html: 1 つ目の script のハッシュが CSP にありません（ブラウザが止める）',
    ]);
  });

  test('組み立てが入れる信頼できる script のほかの script は、CSP にハッシュがあっても止まる（エスケープし忘れの <script>）', () => {
    const site = makeSite();
    const trusted = { ...site.input, scripts: ['run("course")', 'run("home")', 'run("www")'] };
    expect(siteInvariantProblems(trusted)).toEqual([]);
    // 組み上がった HTML の <script> から CSP を作ると、紛れ込んだ script のハッシュも CSP に入ってしまう
    site.write('404.html', page('<p>台本の文字</p>', ['alert(1)']));
    expect(siteInvariantProblems(site.input)).toEqual([]);
    expect(siteInvariantProblems(trusted)).toEqual([
      '404.html: 1 つ目の script は、組み立てが入れる信頼できる script ではありません（エスケープし忘れて紛れ込んでいないか見る）',
    ]);
  });

  test('保存の manifest が、SW の validateManifest を通らなければ止まる（動画が保存の 1 ファイルの上限を超えるなど）', () => {
    const site = makeSite();
    const big = entry('d', OFFLINE_FILE_MAX_BYTES + 1);
    site.editManifest((files) => {
      files[1] = { url: mediaPath(big), bytes: big.bytes, sha256: big.sha256, type: 'video/mp4' };
    });
    expect(siteInvariantProblems({ ...site.input, media: { schema: 1, entries: [big] } })).toEqual([
      'sample/offline-manifest.json: SW の validateManifest が format で受け付けない。このままでは、この講座を保存できません',
    ]);
    site.write('sample/offline-manifest.json', '{"schema":');
    expect(siteInvariantProblems(site.input)[0]).toStartWith('sample/offline-manifest.json: 読めない（');
  });
  test('保存の manifest の revision・ページとポスターの中身・動画が、置いたものと合わなければ止まる', () => {
    const site = makeSite();
    const m = JSON.parse(readFileSync(path.join(site.dir, 'sample/offline-manifest.json'), 'utf8')) as CourseManifest;
    site.write('sample/offline-manifest.json', JSON.stringify({ ...m, revision: 'e'.repeat(64) }));
    expect(siteInvariantProblems(site.input)).toEqual([
      'sample/offline-manifest.json: revision が files と合いません（SW が保存を止める）',
    ]);
    site.write('sample/offline-manifest.json', JSON.stringify(m));
    site.write('sample/media/S01.jpg', 'another poster');
    expect(siteInvariantProblems(site.input)).toEqual([
      `sample/offline-manifest.json: sample/media/S01.jpg?v=${m.pageVersion} の大きさか SHA-256 が、置いたファイルと違います`,
    ]);
  });
  test('保存の manifest の動画が、動画の一覧（Worker の許可リスト）に無いか、大きさと SHA-256 が違えば止まる', () => {
    const site = makeSite();
    const url = mediaPath(site.video);
    expect(siteInvariantProblems({ ...site.input, media: { schema: 1, entries: [entry('f')] } })).toEqual([
      `sample/offline-manifest.json: ${url} が動画の一覧（Worker の許可リスト。content/<講座>/generated/media.<言語>.json）に無い（Worker が配らない）`,
    ]);
    expect(
      siteInvariantProblems({ ...site.input, media: { schema: 1, entries: [{ ...site.video, bytes: 999 }] } }),
    ).toEqual([`sample/offline-manifest.json: ${url} の大きさか SHA-256 が、動画の一覧と違います`]);
  });
  test('sw.js に入れた講座に、保存の manifest が無ければ止まる', () => {
    const site = makeSite();
    expect(siteInvariantProblems({ ...site.input, courses: ['sample', 'en/sample'] })).toEqual([
      'sw.js に入れた講座 en/sample の offline-manifest.json がありません',
    ]);
  });
  test('_headers で、同じヘッダーを付ける規則が 2 つ当たって値がつながるか、no-transform が無ければ止まる', () => {
    const site = makeSite();
    site.write(
      '_headers',
      '/*\n  Cache-Control: public, max-age=0, must-revalidate, no-transform\n/icons/*\n  Cache-Control: public, max-age=60\n/404.html\n  ! Cache-Control\n',
    );
    expect(siteInvariantProblems(site.input)).toEqual([
      '_headers: /404.html の Cache-Control に no-transform がありません（Cloudflare が書き換えると、CSP と保存の SHA-256 が合わない）',
      '_headers: /icons/icon-180.png に Cache-Control を付ける規則が 2 つ当たり、値がつながります（上書きする規則で、先に「! 名前」で外す）',
    ]);
    site.write(
      '_headers',
      '/*\n  Cache-Control: public, max-age=0, must-revalidate, no-transform\n/icons/*\n  ! Cache-Control\n  Cache-Control: public, max-age=60, no-transform\n',
    );
    expect(siteInvariantProblems(site.input)).toEqual([]);
  });
  test('長くキャッシュさせるパス（immutable）を、ページ・保存の manifest・起動用ファイルが ?v= 無しで指していれば止まる', () => {
    const site = makeSite();
    const version = 'b'.repeat(64);
    site.write('_headers', HEADERS);
    // 決まりを守ったサイトは、ポスターをどれも ?v= 付きで指す
    expect(siteInvariantProblems(site.input)).toEqual([]);
    site.write(
      'index.html',
      page(`<img src="sample/media/S01.jpg"><img src="sample/media/S01.jpg?v=${version}">`, [
        'run("home")',
        'run("www")',
      ]),
    );
    const shell = [
      ...(site.input.shell ?? []).slice(1),
      asset('sample/media/S01.jpg', Buffer.from('poster'), 'image/jpeg'),
    ];
    shell.unshift(asset('./', readFileSync(path.join(site.dir, 'index.html')), 'text/html'));
    const course = readFileSync(path.join(site.dir, 'sample/index.html'), 'utf8').replace(
      '<h1>',
      '<meta property="og:image" content="https://chalkfile.com/sample/media/S01.jpg"><h1>',
    );
    site.write('sample/index.html', course);
    site.editManifest((files) => {
      files[0] = asset('sample/', Buffer.from(course), 'text/html');
    });
    expect(siteInvariantProblems({ ...site.input, shell })).toEqual([
      'index.html: sample/media/S01.jpg は長くキャッシュさせるパス（_headers の immutable）なのに ?v= がありません（描き直したあとも古いまま残る）',
      'sample/index.html: https://chalkfile.com/sample/media/S01.jpg は長くキャッシュさせるパス（_headers の immutable）なのに ?v= がありません（描き直したあとも古いまま残る）',
      '起動用ファイル: sample/media/S01.jpg は長くキャッシュさせるパス（_headers の immutable）なのに ?v= がありません（描き直したあとも古いまま残る）',
    ]);
  });
  test('保存の manifest があるのに、sw.js に入っていない講座があれば止まる（講座を指定して組み立てたときに外れた講座など）', () => {
    const site = makeSite();
    expect(siteInvariantProblems({ ...site.input, courses: [] })).toEqual([
      'sample/offline-manifest.json: sw.js に入っていない講座の保存の manifest です（保存できない。講座を外したなら、講座を指定せずに組み立て直す）',
    ]);
  });

  test('起動用ファイルの型が拡張子と違う・知らない拡張子・無い・中身が違えば止まる（SW の install が止まる）', () => {
    const site = makeSite();
    const shell = site.input.shell ?? [];
    site.write('assets/logo.bmp', 'bmp');
    const cases: [NonNullable<SiteInvariantInput['shell']>, string][] = [
      [
        [...shell, { ...required(shell[2]), type: 'image/jpeg' }],
        '起動用ファイル: icons/icon-180.png の型 image/jpeg が、拡張子の型 image/png と違います（SW が取れない）',
      ],
      [
        [...shell, asset('assets/logo.bmp', Buffer.from('bmp'), 'image/bmp')],
        '起動用ファイル: assets/logo.bmp は知らない拡張子です（site/mime.ts に無い）',
      ],
      [
        [...shell, asset('assets/none.jpg', Buffer.from('x'), 'image/jpeg')],
        '起動用ファイル: assets/none.jpg のファイル（assets/none.jpg）がありません',
      ],
      [
        [...shell, { ...required(shell[0]), sha256: 'a'.repeat(64) }],
        '起動用ファイル: ./ の大きさか SHA-256 が、置いたファイルと違います',
      ],
      [
        [...shell, asset('https://example.com/x.png', Buffer.from('x'), 'image/png')],
        '起動用ファイル: https://example.com/x.png がアプリの外を指しています',
      ],
    ];
    for (const [list, expected] of cases)
      expect(siteInvariantProblems({ ...site.input, shell: list })).toEqual([expected]);
  });

  test('破れがあれば、全部をまとめて 1 つのエラーにする', () => {
    const site = makeSite();
    site.write('a.mp4', 'video');
    site.write('404.html', page('__TITLE__', []));
    expect(() => assertSiteInvariants(site.input)).toThrow(
      '組み立てたサイトが、公開物の決まりを守っていません（scripts/site-invariants.ts）:\n- 公開物に MP4 があります（動画は Releases から /media/ で配る）: a.mp4\n- 404.html: 置き換えの印が残っています: __TITLE__',
    );
  });
});
