// 架空のアプリの画面と、端末・窓の枠の色（講座のテーマで変えない「そのものの色」）。
//   MOCK           画面の図（src/scenes/screens.tsx。改善前・改善後のアプリの画面）
//   PHONE_APP      スマホの画面の流れ（src/scenes/phone.tsx。架空のアプリの画面）
//   DEVICE         スマホの本体の枠（どのスマホも同じ。src/components/frame.tsx の DeviceFrame）
//   WINDOW_LIGHTS  窓の左上の信号の 3 色（コードと端末の窓も、画面の図のブラウザの窓も同じ。frame.tsx の WindowLights）
// 部品に色を直接書かない決まり（biome の no-hardcoded-color）の、理由のある例外として、色はここだけに書く

// biome-ignore-start lint/plugin/no-hardcoded-color: 架空のアプリと端末の色（講座のテーマで変えない、そのものの色）

/*
 * 画面の図の、架空のアプリの色。改善後の文字は、白い地に対して WCAG のコントラスト比 4.5:1 以上（プレースホルダーの muted も 4.83:1。1.4.3 の対象）。
 * 入力欄・白地のボタン・チェックボックス・トグルのオフ・まだ進んでいないステップの枠（field）は 3:1 以上（1.4.11。部品と状態の手がかりになるため）。
 * weak を付けた部品は、改善前の悪い例としてわざと薄く描く（コントラスト比 2:1 前後）。
 */
export const MOCK = {
  bg: '#FFFFFF',
  bar: '#EEF1F5',
  ink: '#1F2430',
  sub: '#4A5160',
  /** プレースホルダー（白と 4.83:1） */
  muted: '#6B7280',
  weak: '#BCC2CC',
  /** 入力欄・白地のボタン（secondary）・チェックボックス・トグルのオフ・まだのステップの枠（白と 3.31:1。部品の境目の 3:1 を満たす） */
  field: '#858E9C',
  weakLine: '#E6E9EE',
  primary: '#2459D6',
  primaryWeak: '#C7D3F1',
  /** 主役の色・危ない操作の色の上の文字と印（ボタン・チェック・済んだステップ・トグルのつまみ） */
  onPrimary: '#FFFFFF',
  danger: '#C62D2D',
  /** 小さな札（badge） */
  badge: { bg: '#FFF1CF', fg: '#7A5000' },
  alert: {
    error: { bg: '#FDEEEE', fg: '#A61F1F', icon: 'alert' },
    info: { bg: '#EAF1FE', fg: '#1D4AAE', icon: 'bell' },
    warn: { bg: '#FFF4D6', fg: '#7A5000', icon: 'alert' },
    success: { bg: '#E5F5ED', fg: '#146B43', icon: 'check' },
  },
} as const;

/** スマホの画面の流れの、架空のアプリの色（app はピンクの画面、done は終わりの緑の画面） */
export const PHONE_APP = {
  bg: { app: '#FFF4F8', done: '#F1FFF8' },
  /** アプリの名前と、名前の下の小さな文字 */
  brand: '#E2477F',
  brandSub: '#9A6B7E',
  card: '#FFFFFF',
  cardShadow: '0 12px 30px rgba(226,71,127,0.14)',
  /** 見出しと本文 */
  ink: '#2A2238',
  body: '#4A4058',
  /** 見出しの下の一文・本文の点（app はピンク、done は緑） */
  lead: { app: '#E2477F', done: '#1F9D6E' },
  /** 終わりの画面のチェックの丸 */
  check: { bg: '#D9FBEC', fg: '#1F9D6E' },
  /** 主なボタン（グラデーション）と、その上の文字 */
  primary: { app: 'linear-gradient(90deg, #E2477F, #FF7BA8)', done: 'linear-gradient(90deg, #22B07D, #3FD3A0)' },
  onPrimary: 'white',
  secondary: '#8E8299',
  /** スマホの本体のまわりの光（アプリの色） */
  glow: 'rgba(255,111,163,0.18)',
} as const;

/** スマホの本体の枠。本体（と上の切り欠き）・縁・画面が出るまでの下地 */
export const DEVICE = {
  body: '#05070F',
  rim: 'rgba(255,255,255,0.2)',
  screen: '#1A1F38',
} as const;

/** 窓の左上の信号の 3 色（閉じる・しまう・広げる） */
export const WINDOW_LIGHTS = ['#FF6F7D', '#FFC260', '#4CE2B2'] as const;

// biome-ignore-end lint/plugin/no-hardcoded-color: 架空のアプリと端末の色（講座のテーマで変えない、そのものの色）
