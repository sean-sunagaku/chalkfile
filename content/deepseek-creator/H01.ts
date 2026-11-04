import { T, TEN, Z } from '../_shared/comedy';
import { goals } from '../_shared/scenes';
import type { Lecture } from '../types';
import { docsOf } from './sources';

export const H01: Lecture = {
  id: 'H01', no: 1, section: { no: 1, title: 'Creator mode とメニュー案内' },
  title: 'Creator mode は何を作れる？',
  summary: '会話でプラグインや独自のモードを作る考え方、4 つのモード、Creator の入口、Plugins と Settings の使い分け、依頼と確認の手順。',
  docs: docsOf(['h-doc-001', 'h-doc-002', 'h-doc-003', 'h-doc-004', 'h-doc-005', 'h-doc-006']),
  takeaways: [
    'Creator は機能や画面を足すプラグインと、道具の組み合わせを決める独自のモードを作るためのモード',
    'Plugins → Add plugin の矢印 → Let the agent create a plugin が入口の一つ',
    'Agent presets の View configuration は閲覧用。作成は Creator で進め、新しいモードは新しいタスクで選ぶ',
    '目的・置き場所・入力と出力・確認方法を伝え、設置後の表示と操作まで確かめる',
    '2026-11-04 確認。開発プレビューで、表示と仕様は変わる。公式資料を使う前に読み直す',
  ],
  quiz: [
    { q: 'プラグインとモードの関係として正しいものは？', choices: ['プラグインは機能を足し、モードは道具と振る舞いを組み合わせる', 'どちらも AI モデルそのもの', 'モードを選ぶと権限の確認が不要になる'], answer: 0, explain: 'プラグインは道具や画面などの機能。モードはエージェントのプリセット。権限設定は別に適用される。' },
    { q: 'View configuration の用途は？', choices: ['その場で YAML を書き換える', 'プリセットの構成を見る', '新しいプラグインを自動公開する'], answer: 1, explain: '公式の説明では閲覧専用。作成や変更は Creator によるバンドルの作成・設置で行う。' },
  ],
  scenes: [
    { kind: 'opening', title: 'Creator mode は何を作れる？', lines: [
      { t: 'DeepSeek Harness。Creator mode は、何を作れる？', v: 'announcer' },
      { t: 'クリエイタースタジオ！　ぼくの、ずんだ餅工場を開くのだ！', v: Z, pause: -0.15 },
      { t: '工場ではありません。', v: T, sfx: 'harisen' },
      { t: '公式の呼び方は、Creator mode。会話から、自分が使う道具や画面を作るモードです。' },
      { t: '今回は、公式の資料と公開ソースで確認した、機能とメニューを説明します。操作の実演ではありません。' },
    ] },
    goals({ kind: 'goals', heading: '今日わかること', items: ['何を作るモードか', 'どのメニューから入るか', 'どう頼み、どう確かめるか'], lines: [
      { t: '今日のゴールは、三つです。' }, { t: '何を作るモードなのか、説明できること。' }, { t: 'メニューの役割を見分けられること。' }, { t: '小さな道具を頼み、完成を確かめる手順がわかること。' },
    ] }),
    { kind: 'points', heading: 'Harness とモデルの役割', columns: 3, items: [
      { title: 'モデル', body: '考えて、次の行動を選ぶ', at: 0, icon: 'brain', tone: 'violet' },
      { title: 'Harness', body: '道具・会話・実行をつなぐ仕組み', at: 1, icon: 'layers', tone: 'cyan' },
      { title: 'プラグイン', body: '道具や画面を、部品として足す', at: 2, icon: 'box', tone: 'mint' },
    ], lines: [
      { t: 'まず、モデルは考える部分です。' },
      { t: 'Harness は、道具を呼び、作業を進めるための仕組み。DeepSeek Harness は、Cordis を土台にした、オープンソースの製品です。' },
      { t: '道具や画面を、プラグインとして組み合わせます。' },
      { t: 'じゃあ、モデルを、ずんだ味にするのだ！', v: Z, pause: -0.15 },
      { t: '味付けはできません。', v: T },
      { t: 'ずんだもん、設定画面より先に、調味料を探す。', v: TEN },
    ] },
    { kind: 'points', heading: 'Creator が作るもの', columns: 3, items: [
      { title: '画面の機能', body: 'メモの入口や、内容のプレビュー', at: 0, icon: 'layout', tone: 'cyan' },
      { title: '使える道具', body: 'レポートを読み、失敗をまとめる道具', at: 1, icon: 'code', tone: 'amber' },
      { title: '自分用のモード', body: '作業に合わせた道具と指示の組み合わせ', at: 2, icon: 'sliders', tone: 'violet' },
    ], lines: [
      { t: 'Creator では、サイドバーに入口やプレビュー画面を足すプラグインを作れます。' },
      { t: 'テストのレポートを読み、失敗をまとめる道具も、作成例に挙がっています。' },
      { t: 'さらに、使う道具と仕事の進め方をまとめた、自分用のモードも作れます。' },
      { t: 'プラグインは機能。モードは、道具と振る舞いの組み合わせ。この二つを分けて考えます。', bgm: 'cut' },
      { t: 'ずんだ餅を作る道具と、食べる順番なのだ。', v: Z, bgm: 'back' },
      { t: '今日は、たとえだけ合っています。', v: T },
    ] },
    { kind: 'table', heading: '4 つのモードを使い分ける', columns: ['モード', '主な役割'], widths: [0.25, 0.75], fontSize: 32,
      rows: [
        { cells: ['Standard', '普段の調査・ファイル作業・コーディング'], at: 0, tone: 'cyan' },
        { cells: ['PTC', 'TypeScript のプログラムで、道具の呼び出しを組み立てる'], at: 1, tone: 'amber' },
        { cells: ['Minimal', '永続シェルと画像読み取りを軸に、比較実験をする'], at: 2, tone: 'slate' },
        { cells: ['Creator', 'プラグインや独自のプリセットを作る'], at: 3, tone: 'violet' },
      ], lines: [
        { t: '普段の仕事は、Standard が出発点です。' },
        { t: 'PTC は、道具の呼び出しをプログラムにまとめる方式です。必ず速くなる、とは限りません。' },
        { t: 'Minimal は、小さな道具の構成で比較実験をするためのもの。道具が少ないから、初心者向け、という意味ではありません。' },
        { t: '機能やモードを作るときに、Creator を選びます。' },
        { t: '全部入りを選べば、ぼくも全部できるのだ！', v: Z, pause: -0.15 },
        { t: '目的から選んでください。', v: T, sfx: 'harisen' },
        { t: 'なお、PTC と Minimal は、一般設定の Coding Tools がオンのときに、選択肢に出ます。', s: 'なお、ピーティーシーとミニマルは、一般設定のコーディングツールズがオンのときに、選択肢に出ます。' },
      ] },
    { kind: 'points', heading: 'Creator への入口', columns: 3, numbered: true, items: [
      { title: '新しいタスク', body: 'モードの選択から Creator を選ぶ', at: 0, icon: 'message', tone: 'violet' },
      { title: 'Settings', body: 'Agent presets の Creator の入口', at: 1, icon: 'sliders', tone: 'cyan' },
      { title: 'Plugins', body: 'Add plugin の矢印 → 作成を頼む項目', at: 2, icon: 'box', tone: 'mint' },
    ], lines: [
      { t: '入口は、新しいタスクで、Creator を選ぶこと。' },
      { t: 'Settings の Agent presets にも、Creator で作るための入口があります。', s: 'セッティングズの、エージェントプリセッツにも、クリエイターで作るための入口があります。' },
      { t: 'もう一つは、Plugins の Add plugin の横の矢印。Let the agent create a plugin、という項目です。', s: 'もう一つは、プラグインズの、アドプラグインの横の矢印。レット、ジ、エージェント、クリエイト、ア、プラグイン、という項目です。' },
      { t: '選ぶだけでは、依頼文は送信されません。作りたいものを、会話に書いてから進めます。' },
      { t: '矢印を押したら、工場が完成するのだ？', v: Z, pause: -0.15 },
      { t: '入口です。完成ではありません。', v: T, sfx: 'harisen' },
    ] },
    { kind: 'table', heading: 'Plugins のメニュー早見表', columns: ['表示名', 'すること'], widths: [0.35, 0.65], fontSize: 31,
      rows: [
        { cells: ['Add plugin', 'インストール画面を開き、パッケージなどを指定する'], at: 0, tone: 'cyan' },
        { cells: ['Let the agent create a plugin', 'Creator に入り、作りたい機能を頼む'], at: 1, tone: 'violet' },
        { cells: ['Refresh', '一覧を読み直し、更新できるものを確かめる'], at: 2, tone: 'mint' },
        { cells: ['On / Off・Remove', '有効化・停止と、削除を使い分ける'], at: 3, tone: 'amber' },
      ], lines: [
        { t: 'Add plugin の本体は、インストール画面を開きます。すでにある道具を入れる入口です。', s: 'アドプラグインの本体は、インストール画面を開きます。すでにある道具を入れる入口です。' },
        { t: 'その横のメニューから、Creator に入ることもできます。作るか、既存のものを入れるかを選びます。' },
        { t: 'Refresh は、一覧と更新の確認。', s: 'リフレッシュは、一覧と更新の確認。' },
        { t: 'オフは停止で、削除とは別です。削除できるプラグインは、Remove の確認を経て取り除きます。', s: 'オフは停止で、削除とは別です。削除できるプラグインは、リムーブの確認を経て取り除きます。' },
        { t: 'オフにしたのに、まだいるのだ。おかわりなのだ？', v: Z, pause: -0.15 },
        { t: '残して、止めています。', v: T },
      ] },
    { kind: 'points', heading: 'Settings と Plugins の使い分け', columns: 3, items: [
      { title: 'Agent presets', body: '既定のモードを選び、構成を読む', at: 0, icon: 'list', tone: 'violet' },
      { title: 'View configuration', body: '構成を YAML で見る。閲覧専用', at: 1, icon: 'eye', tone: 'cyan' },
      { title: 'プラグインの設定', body: '設定画面を持つものは Plugins で編集', at: 3, icon: 'sliders', tone: 'mint' },
    ], lines: [
      { t: 'Settings の Agent presets は、既定のモードを選んだり、構成を見たりする場所です。', s: 'セッティングズのエージェントプリセッツは、既定のモードを選んだり、構成を見たりする場所です。' },
      { t: 'View configuration で表示される構成は、閲覧専用です。ここを直接書き換えるわけではありません。', s: 'ビューコンフィギュレーションで表示される構成は、閲覧専用です。ここを直接書き換えるわけではありません。' },
      { t: '読むだけ！　ぼくの読書感想文モードなのだ。', v: Z, pause: -0.15 },
      { t: '設定を読んでください。', v: T },
      { t: '設定ページを持つプラグインの編集は、Plugins から開きます。Settings の Built-in plugins は、組み込みの一覧や稼働状態を見る場所です。', s: '設定ページを持つプラグインの編集は、プラグインズから開きます。セッティングズのビルトインプラグインズは、組み込みの一覧や稼働状態を見る場所です。' },
    ] },
    { kind: 'points', heading: '依頼は、小さく、具体的に', columns: 3, numbered: true, items: [
      { title: '目的と置き場所', body: '例: サイドバーに作業メモの入口', at: 0, icon: 'target', tone: 'violet' },
      { title: '入力と出力', body: '例: サンプルのメモを選び、本文を表示', at: 1, icon: 'file', tone: 'cyan' },
      { title: '完成の確認', body: '例: 設置し、表示と切り替えを確かめる', at: 2, icon: 'check', tone: 'mint' },
    ], lines: [
      { t: '依頼では、まず目的と、どこから使うかを伝えます。たとえば、サイドバーから開く、作業メモです。' },
      { t: '次に入力と出力。最初はサンプルのメモだけを選び、本文を見られる形にします。' },
      { t: '最後に、設置し、入口が開き、メモを切り替えられることまで確かめて、と頼みます。' },
      { t: 'すごいやつを、いい感じに、全部なのだ！', v: Z, pause: -0.15 },
      { t: '仕様が、ゼロです。', v: T, sfx: 'harisen' },
      { t: 'まず一つ動かし、結果を見ながら足す。これは、この動画で提案する進め方です。' },
    ] },
    { kind: 'points', heading: '生成から、完成まで', columns: 3, items: [
      { title: '作る', body: '機能と画面、必要な設定を作る', at: 0, icon: 'code', tone: 'violet' },
      { title: '設置する', body: '即時に反映する場合と、再起動が要る場合', at: 1, icon: 'box', tone: 'cyan' },
      { title: '動作を確かめる', body: '入口・表示・操作。独自モードは新規タスクで選ぶ', at: 2, icon: 'check', tone: 'mint' },
    ], lines: [
      { t: 'コードが書けたら、次は設置です。' },
      { t: '変更内容によって、すぐ読み込まれる場合と、再起動が必要な場合があります。' },
      { t: '新しいプリセットは、新しいタスクで選びます。すでに始めたタスクのモードが、途中で置き換わるわけではありません。' },
      { t: 'コードが完成したのだ。動くかは、知らないのだ！', v: Z, pause: -0.15 },
      { t: '一番、大事なところです。', v: T, sfx: 'harisen' },
      { t: '完成の判定だけ、未完成だった。', v: TEN, sfxAfter: 'chin' },
    ] },
    { kind: 'points', heading: '使う前に知っておくこと', columns: 3, items: [
      { title: '開発プレビュー', body: '互換性を壊す変更があり得る', at: 0, icon: 'alert', tone: 'amber' },
      { title: '実行する権限', body: '生成コード・外部プラグイン・ファイルの扱いを確認', at: 1, icon: 'lock', tone: 'coral' },
      { title: '利用先の条件', body: 'モデルやサービスの料金・データの扱いを別に確認', at: 2, icon: 'list', tone: 'cyan' },
    ], lines: [
      { t: 'DeepSeek Harness は、開発プレビューです。使う前に、公式の変更と、手元の版を確かめてください。' },
      { t: '公式の Safety は、セキュリティ監査を受けていないと説明しています。動かすコードやプラグイン、アクセスできるファイルを確認します。', s: '公式のセーフティーは、セキュリティ監査を受けていないと説明しています。動かすコードやプラグイン、アクセスできるファイルを確認します。' },
      { t: 'ソースコードのライセンスは MIT ですが、接続するモデルや外部サービスの利用条件は、別に確認が必要です。', s: 'ソースコードのライセンスはエムアイティーですが、接続するモデルや外部サービスの利用条件は、別に確認が必要です。' },
      { t: 'ぼくは、食べ放題モードを作るのだ！', v: Z, pause: -0.15 },
      { t: '請求も、食べ放題です。', v: T, sfx: 'harisen' },
      { t: 'モードを変えても、権限や料金を確認する責任は残ります。', bgm: 'cut' },
    ] },
    { kind: 'quiz', heading: 'ここでクイズ', no: 1, question: 'View configuration を開けば、その場でプリセットを編集できる？', answer: false, explain: '構成は閲覧専用。作成は Creator で進める', revealAt: 2, lines: [
      { t: 'クイズです。構成の表示を開けば、その場でプリセットを編集できる。マルか、バツか。', pause: 2.5 },
      { t: 'マルなのだ！　読むだけでは、お腹が減るのだ！', v: Z, pause: -0.15 },
      { t: '答えは、バツ。構成の表示は閲覧専用です。作成は Creator で進めます。', sfx: 'reveal' },
      { t: '正解より、空腹を優先した。', v: TEN },
    ] },
    { kind: 'recap', heading: '振り返り', items: [
      { text: 'Creator は、プラグインと自分用のモードを作る', at: 0 },
      { text: 'Plugins は追加と管理、Agent presets は選択と構成の閲覧', at: 1 },
      { text: '目的・置き場所・確認方法を伝え、設置後まで確かめる', at: 2 },
    ], lines: [
      { t: 'Creator は、自分に必要なプラグインや、モードを作るためのもの。' },
      { t: 'Plugins は追加と管理。Agent presets は、モードの選択と構成の閲覧。', s: 'プラグインズは追加と管理。エージェントプリセッツは、モードの選択と構成の閲覧。' },
      { t: '目的、置き場所、確認方法を伝えて、設置したあとまで確かめます。' },
      { t: 'わかったのだ。まず、ずんだ餅を数える、小さな道具からなのだ。', v: Z },
      { t: '食べる前に、数えてください。', v: T },
      { t: '入力データは、すでにゼロであった。', v: TEN, sfxAfter: 'chin' },
    ] },
    { kind: 'ending', closing: 'メニュー名と仕様は、リンク先の公式資料で確かめてください', lines: [
      { t: '詳しいメニューと出典は、この動画の公式資料から確認できます。' },
      { t: '次は、おかわりボタンなのだ！', v: Z }, { t: 'なお、在庫はない。', v: TEN },
    ] },
  ],
};
