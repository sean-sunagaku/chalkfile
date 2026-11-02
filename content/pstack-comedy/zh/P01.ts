import type { LectureL10n } from '../../i18n';

// 中国語（簡体字）版の P01。日本語の台本（../P01.ts）に重ねる。ボケは直訳せず、中国語で笑えるように作り直した
// （slop＝泔水、TDD＝「挺大胆的」の頭文字、「先挖得深」→ 土豆を掘る など）。事実・画面の正しい名前・出典は日本語の台本と同じ。
// 俊达萌はずんだもんの中国語での呼び名、毛豆麻糬はずんだ餅。v を省いた台詞は先生
const Z = 'zundamon' as const;
const ZC = 'zundamon-cry' as const;
const T = 'tsukkomi' as const;
const TEN = 'tennokoe' as const;

export const P01: LectureL10n = {
  source: 'f82fd84b77a0',
  title: 'pstack 是什么？',
  summary: '作者与思路，上手方法（/add-plugin、/setup-pstack、/poteto-mode），23 本流程手册，主要技能（/tdd、/interrogate、/arena、/unslop），以及使用前的注意。',
  docs: [
    { title: 'pstack 的 README（GitHub 上的 cursor/plugins：安装、技能、流程手册、原则一览）' },
    { title: '/poteto-mode 的说明（GitHub）' },
    { title: '/poteto-mode 的 23 本流程手册（GitHub）' },
    { title: '/setup-pstack 的说明（GitHub）' },
    { title: '/interrogate 的说明（GitHub）' },
    { title: '/arena 的说明（GitHub）' },
  ],
  quiz: [
    {
      q: '关于 pstack 的 /poteto-mode，下面哪一项是正确的？',
      choices: ['根据请求选出合适的流程手册，变成待办清单，并调用需要的技能', '教你怎么炸薯条', '给每个角色决定用哪个模型，并写进设置规则', '把插件装进 Cursor'],
      explain: '/poteto-mode 从 23 本流程手册里选一本，把步骤变成待办清单，并调用需要的技能。分配模型的是 /setup-pstack，安装用的是 /add-plugin pstack。',
    },
    {
      q: '关于 /interrogate，下面哪一项是正确的？',
      choices: ['审讯之前，先请一位律师', '几种不同的模型轮番想把改动搞坏，只留下实际运行能证明的问题', '一发现问题，就当场改代码', '由一个人单独审查'],
      explain: '不同的模型想办法搞坏改动，只有能用运行结果证明的问题会留下。/interrogate 本身不改代码，只报告问题。',
    },
    {
      q: 'pstack 的 README 里写了什么？',
      choices: ['专门做计划的技能最多', '只能装进 Cursor', '也能装进 Claude Code，不过需要 Cursor 专属功能的步骤会被跳过', '许可证是付费的'],
      explain: '它也能作为插件装进 Claude Code。需要 bugbot、automations 这类 Cursor 专属功能的步骤，会给出简短说明后跳过。许可证是 MIT。',
    },
  ],
  takeaways: [
    'pstack 是 Cursor 的工程师 poteto（Lauren Tan）公开的、关于 AI 智能体怎么干活的技能合集（MIT）',
    '上手：/add-plugin pstack → /setup-pstack（每个角色的模型）→ /poteto-mode',
    '/poteto-mode 从 23 本流程手册里选一本，变成待办清单，调用需要的技能',
    '/tdd、/interrogate、/arena、/unslop 是为了不把没检查过的东西直接交出去',
    '技能的数量、名称和默认模型会变。使用前请看 README 确认',
  ],
  scenes: [
    {
      kind: 'opening',
      title: 'pstack 是什么？',
      lines: [
        { t: 'pstack 是什么？', v: 'announcer', pause: 0.3 },
        { t: 'P-stack……就是把毛豆麻糬叠成一座小山！', s: 'P stack……就是把毛豆麻糬叠成一座小山！', v: Z, pause: -0.15 },
        { t: '不叠。', v: T, sfx: 'harisen' },
        { t: 'pstack 是一套技能合集，让 AI 智能体先深入调查，再写更少、更好的代码。' },
      ],
    },
    {
      kind: 'points',
      heading: '问题：快，但没检查',
      items: [
        { title: '3 分钟，1,000 行', body: '交给 AI 写的' },
        { title: '能不能跑？不知道', body: '没检查过' },
        { title: '修的是人', body: '事后花了 3 天' },
      ],
      lines: [
        { t: '交给 AI 智能体，代码一下子就写好了。' },
        { t: '我也让它写了！三分钟，一千行！', v: Z },
        { t: '能不能跑？不知道。完美的说！', v: Z, pause: -0.15 },
        { t: '请检查一下。', v: T, sfx: 'harisen' },
        { t: '花了三天修好那一千行的，正是俊达萌本人。', v: TEN, sfxAfter: 'chin' },
        { t: '没检查过的代码，最后还是人来修。这种粗糙的输出，英文叫 slop，本义是泔水。' },
        { t: '泔水……能喝吗？我饿了。', v: Z, pause: -0.15 },
        { t: '不能喝。', v: T, sfx: 'harisen' },
      ],
    },
    {
      kind: 'points',
      heading: 'pstack 是什么',
      items: [
        { title: '作者', body: 'Cursor 的工程师 poteto（Lauren Tan），React 核心团队成员之一' },
        { title: '内容', body: '技能 34 个、流程手册 23 本、原则 24 条（2026 年 11 月）' },
        { title: '在哪里', body: 'Cursor 的官方插件合集（GitHub 上的 cursor/plugins），MIT 许可证' },
      ],
      lines: [
        { t: 'pstack 的作者，是 Cursor 的工程师 Lauren Tan，网名叫 poteto。' },
        { t: 'poteto……土豆！是炸薯条的技能合集！', v: Z, pause: -0.15 },
        { t: '不炸。', v: T, sfx: 'harisen' },
        { t: '俊达萌，今天也是从吃的开始。', v: TEN },
        { t: '里面是作者每天工作都在用的技能。它放在 Cursor 的官方插件合集里，许可证是 MIT。', sfx: 'pop' },
      ],
    },
    {
      kind: 'big',
      heading: '作者的口号',
      cite: 'pstack README「if you want to go fast, go deep first」（2026 年 11 月确认）',
      kicker: 'README 的口号',
      text: '想走得快，**先挖得深**',
      sub: '深入调查，少写，再验证。所以才能同时跑好几个',
      lines: [
        { t: '作者的口号是：想走得快，就先挖得深。', bgm: 'cut', sfx: 'chime' },
        { t: '深入调查，少写，再验证。正因为这样，才能同时并行跑好几个。', bgm: 'back' },
        { t: '我是又浅、又快、又多！', v: Z, pause: -0.15 },
        { t: '全反了。', v: T, sfx: 'harisen' },
        { t: '俊达萌的一千行，就是这么来的。', v: TEN },
      ],
    },
    {
      kind: 'points',
      heading: '上手：只要 3 个命令',
      items: [
        { title: '/add-plugin pstack', body: '安装插件' },
        { title: '/setup-pstack', body: '给每个角色选模型' },
        { title: '/poteto-mode', body: '交代工作（平时只用这个）' },
      ],
      lines: [
        { t: '上手很简单，在 Cursor 的聊天框里输入命令就行。' },
        { t: '先用 /add-plugin pstack 安装。', s: '先输入 add plugin pstack，进行安装。', sfx: 'pop' },
        { t: '再用 /setup-pstack，给写代码、做判断、做审查的角色，分别指定模型。', s: '再用 setup pstack，给写代码、做判断、做审查的角色，分别指定模型。', sfx: 'pop' },
        { t: '之后只要用 /poteto-mode 交代工作就行。', s: '之后只要用 poteto mode 交代工作就行。', sfx: 'pop' },
        { t: '土豆模式！果然还是要炸！', v: Z, pause: -0.15 },
        { t: '不炸。', v: T, sfx: 'harisen' },
      ],
    },
    {
      kind: 'flow',
      heading: '/poteto-mode 的内部',
      nodes: [
        { label: '你的请求', sub: '比如：修好这个 bug' },
        { label: '选 1 本流程手册', sub: '从 23 本里选（调查、修 bug 等）' },
        { label: '变成待办清单', sub: '照着步骤原样写下' },
        { label: '调用需要的技能', sub: '/tdd、/arena、/unslop 等' },
        { label: '最后开一个 PR', sub: '如果是改代码的工作' },
      ],
      lines: [
        { t: '/poteto-mode 先读你的请求。', s: 'poteto mode 先读你的请求。' },
        { t: '从二十三本流程手册里，选出最合适的一本。', sfx: 'pop' },
        { t: '把那些步骤变成待办清单，一项一项做下去。', sfx: 'pop' },
        { t: '调用需要的技能。如果是改代码的工作，最后会开一个 PR。', s: '调用需要的技能。如果是改代码的工作，最后会开一个 P R。', sfx: 'pop' },
        { t: '也就是说，人类不用记住该用哪个技能。', v: TEN, sfx: 'deden' },
        { t: '可我把二十三本全背下来了……', v: ZC, pause: 0.5 },
        { t: '第一本是？', v: T },
        { t: '……毛豆麻糬。', s: '毛豆麻糬。', v: ZC, sfxAfter: 'zuko' },
      ],
    },
    {
      kind: 'table',
      heading: '主要技能',
      cite: 'pstack README 与各技能的说明（2026 年 11 月确认，版本 0.15.36）',
      columns: ['技能', '做什么'],
      rows: [
        { cells: ['/tdd', '测试驱动开发。先写一个会因这个 bug 失败的测试，再修'] },
        { cells: ['/interrogate', '拷问式审查。多个模型轮番攻击，只留下能复现的问题'] },
        { cells: ['/arena', '让方案比赛。同一任务解好几遍，把别的好地方并进最佳方案'] },
        { cells: ['/unslop', '清除 slop（粗糙输出）。去掉文章里的 AI 腔'] },
      ],
      lines: [
        { t: '接下来，看看主要技能。' },
        { t: '首先是 /tdd。修之前，先写一个会因为这个 bug 而失败的测试。', s: '首先是 T D D。修之前，先写一个会因为这个 bug 而失败的测试。', sfx: 'pop' },
        { t: 'TDD，就是“挺大胆的”！不测试，直接上线！', s: 'T D D，就是挺大胆的！不测试，直接上线！', v: Z, pause: -0.15 },
        { t: '最要不得的那种。', v: T, sfx: 'harisen' },
        {
          t: '然后是 /interrogate。几种不同的模型轮番想把改动搞坏，只留下实际运行能证明的问题。',
          s: '然后是 interrogate。几种不同的模型轮番想把改动搞坏，只留下实际运行能证明的问题。',
          sfx: 'pop',
        },
        { t: '审讯！那我要先请个律师！', v: Z, pause: -0.15 },
        { t: '不用请。', v: T, sfx: 'harisen' },
        { t: '再来是 /arena。同一个任务并排解好几遍，把好的地方合成一个。', s: '再来是 arena。同一个任务并排解好几遍，把好的地方合成一个。', sfx: 'pop' },
        { t: 'Arena！终于要开俊达萌的体育馆演唱会了！', v: Z, pause: -0.15 },
        { t: '不开。', v: T, sfx: 'harisen' },
        { t: '俊达萌，换了课程，也不放弃演唱会。', v: TEN },
        { t: '最后是 /unslop。把文章里 AI 味的说法去掉。', s: '最后是 unslop。把文章里 AI 味的说法去掉。', sfx: 'pop' },
        { t: 'Unslop……Un……', s: 'Unslop……Un……', v: Z, sfxAfter: 'drumroll', pause: 1.5 },
        { t: '……想不出来。', s: '想不出来。', v: ZC, sfxAfter: 'chin', pause: 0.6 },
        { t: '这是你今天最老实的一句。', v: T, sfx: 'harisen' },
        { t: '这四个技能，都是为了不把没检查过的东西直接交出去。', bgm: 'cut', sfx: 'chime' },
      ],
    },
    {
      kind: 'quiz',
      heading: '小测验',
      question: '用 /poteto-mode 时，每次都由人来选用哪个技能？',
      explain: '流程手册和技能，都由 /poteto-mode 来选',
      lines: [
        {
          t: '小测验。用 /poteto-mode 时，每次都由人来选用哪个技能。对，还是错？',
          s: '小测验。用 poteto mode 时，每次都由人来选用哪个技能。对，还是错？',
          pause: 3.2,
        },
        { t: '对！我从二十三本里挑！', v: Z, pause: -0.15 },
        { t: '你刚才只说得出毛豆麻糬。', s: '你刚才只说的出毛豆麻糬。', v: T, sfx: 'harisen' },
        { t: '答案是：错。流程手册和技能，都由 /poteto-mode 来选。', s: '答案是：错。流程手册和技能，都由 poteto mode 来选。', sfx: 'reveal' },
        { t: '俊达萌，换了课程，照样输。', v: TEN, sfxAfter: 'chin' },
      ],
    },
    {
      kind: 'points',
      heading: '使用前的注意',
      items: [
        { title: '用量容易变大', body: '并行的技能，一次会跑好几个模型' },
        { title: 'Cursor 专属的部分', body: '在 Claude Code 里，需要 Cursor 专属功能的步骤会被跳过' },
        { title: '作者风格很强', body: '没有专门做计划的技能。不合适就用 /automate-me 自己做一个' },
      ],
      lines: [
        { t: '最后，说说使用前的注意事项。', sfx: 'chime' },
        { t: '并行的技能，一次会让好几个模型同时工作。', sfx: 'pop' },
        { t: '它也能装进 Claude Code，但需要 Cursor 专属功能的步骤会被跳过。', sfx: 'pop' },
        { t: '还有，作者的做事风格很强烈。没有专门做计划的技能。', sfx: 'pop' },
        { t: '不做计划……跟我一样！', v: Z, pause: -0.15 },
        { t: '请别把自己算进去。', v: T, sfx: 'harisen' },
        { t: '作者更喜欢用代码说话，而不是先写计划。要做计划时，就配合 Cursor 的计划模式。' },
        { t: '如果不合适，可以用 /automate-me，根据你最近的对话，做一个自己的模式。', s: '如果不合适，可以用 automate me，根据你最近的对话，做一个自己的模式。' },
      ],
    },
    {
      kind: 'recap',
      heading: '复习',
      items: [
        { text: 'pstack：Cursor 的工程师公开的、关于 AI 智能体怎么干活的技能合集（MIT）' },
        { text: '平时只用 /poteto-mode。它会选流程手册，调用需要的技能' },
        { text: '用 /tdd、/interrogate、/arena、/unslop 不交出没检查的东西。注意用量和 Cursor 专属的部分' },
      ],
      lines: [
        { t: '复习一下。pstack 是一套技能合集，让智能体先挖得深，再写少而好的代码。', sfx: 'pop' },
        { t: '平时只用 /poteto-mode。它会选流程手册，调用需要的技能。', s: '平时只用 poteto mode。它会选流程手册，调用需要的技能。', sfx: 'pop' },
        { t: '主要技能，都是为了不交出没检查过的东西。注意用量，以及 Cursor 专属的部分。', sfx: 'pop' },
        { t: '懂了！先挖得深……我这就去地里挖土豆！', v: Z, pause: -0.15 },
        { t: '不是挖土豆。', v: T, sfx: 'harisen' },
        { t: '“挖”这个字，倒是用对了。', v: TEN },
      ],
    },
    {
      kind: 'ending',
      closing: '详细用法，请看 pstack 的 README（GitHub 上的 cursor/plugins）',
      lines: [
        { t: '下次，我要用 /automate-me 做一个俊达萌模式！', s: '下次，我要用 automate me 做一个俊达萌模式！', v: Z },
        { t: '当然，每次都会做过头。', v: TEN },
      ],
    },
  ],
};
