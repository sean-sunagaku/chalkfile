import type { LectureL10n } from '../../i18n';
import { docsTitles } from './sources';

// 中国語（簡体字）版の S03。日本語の台本（../S03.ts）に重ねる。ボケは直訳せず、中国語で笑えるように作り直した
// （トリガー → 鶏ガラスープ は Trigger＝扳机（bānjī）→ 扒鸡（pájī。鶏の煮込み）、ふるいゲームの「全部、返事」はメールの「全部回复」、
//  スレッドは中国語でも「线」なので、糸で毛豆麻糬を串にする）。事実・数字・画面の正しい名前・出典は日本語の台本と同じ。
// 台詞の数は場面ごとに日本語と同じ（要素の at は日本語のまま）。俊达萌はずんだもん、毛豆麻糬はずんだ餅。v を省いた台詞は先生
// 読み: 台詞では「为（wéi）」「交还（huán）」「琢磨（zuó）」「用不着（zháo）」「看得到・用得（de）」を使わない（pypinyin が違う音を選ぶ）。
// 「切」も pypinyin が qiè と読むので、糸で「切る」ボケは「串」にした
const Z = 'zundamon' as const;
const T = 'tsukkomi' as const;
const TEN = 'tennokoe' as const;

export const S03: LectureL10n = {
  source: '8d4573cd2134',
  title: '跟着事件动起来（事件驱动）',
  summary:
    '驱动 Super-agent 的 Trigger（身边发生的事件），以及把嘈杂的事件流筛掉的两段筛子（代码的 Fast Path 与模型的 Slow Path）。负责的 Worker 订阅同一个 PR 或话题的一连串事件（Thread），后续事件通过直通（pass-through）原样交给它，减轻前台的负担。',
  docs: docsTitles(['dsh-superagent-article', 'dsh-superagent-prototype']),
  quiz: [
    {
      q: '文章中“两段筛子”的第 1 段（Fast Path）做的是什么？',
      choices: ['模型读取上下文，判断要不要行动', '代码根据来源、群组、许可名单等，快速做出决定', '对所有事件都回复', '由人手动逐个决定'],
      explain: '第 1 段由代码按能明确判断的条件快速筛掉（在调用模型之前就筛掉大部分）。只有需要读懂含义的候选，才在第 2 段交给模型判断。',
    },
    {
      q: '关于同一个 PR 的后续事件（Thread 的后续），文章的设计中哪一项是正确的？',
      choices: ['每次都由 Router 重新读一遍，决定交给谁', '由代码原样交给订阅了它的 Worker（直通）', 'Worker 之间一对一地互相通知', '后续事件直接丢掉'],
      explain:
        '第一个事件到来时，Router 创建 Worker，这个 Worker 订阅该 Thread。后续事件由代码直接交给订阅者。Router 虽然看得到所有事件，但需要它判断并分派的，只有没有订阅者的新事件。',
    },
    {
      q: '在文章的初步实验中，去掉直通之后，大幅增加的是什么？',
      choices: ['完成工作所需的时间', 'Router 的判断次数，以及从缓存读取的 token', 'Worker 的数量', '毛豆麻糬的消耗量'],
      explain: '完成所需的时间几乎相同（p50 12.4 → 12.6 分钟）。Router 的判断增加了约 3 成，从缓存读取的 token 从 2,320 万增加到 3,180 万，增加了约 37%。',
    },
  ],
  takeaways: [
    'Trigger = 身边发生的事件（聊天消息、邮件、日程通知、评审评论、CI 结果）。智能体不用等人一步一步下指示，就能行动',
    '大部分事件都不需要行动。两段筛子：第 1 段是代码（Fast Path：来源、群组、许可名单），第 2 段是模型（Slow Path：上下文和用文字写的方针）',
    '第 2 段是人可以用文字增加或删除方针的地方',
    'Thread = 同一个 PR、话题或邮件往来的一连串事件。第一个事件到来时由 Router 创建 Worker，后续事件直接交给订阅的 Worker（直通）',
    '订阅是多对多的。看着同一个 Thread 的 Worker 之间，即使不一对一联系，也有机会察觉冲突并自行解决。直通减少的主要不是时间，而是前台的负担和 token（文章的初步实验）',
  ],
  scenes: [
    {
      kind: 'opening',
      title: '跟着事件动起来',
      lines: [
        { t: '第3章。跟着事件动起来。', s: '第三章。跟着事件动起来。', v: 'announcer', pause: 0.3 },
        { t: '早上好！早上好！早上好！群里每一个人，我都回复了！', v: Z, pause: -0.15 },
        { t: '早上好不用回。', v: T, sfx: 'harisen' },
        { t: '正如上回预告，回复了四十八个人。', v: TEN },
        { t: '这一章，我们来看事件驱动：不是靠人下指示，而是跟着身边发生的事件动起来的机制。' },
      ],
    },
    {
      kind: 'goals',
      heading: '本章目标',
      items: [
        { text: '理解跟着事件（Trigger）行动的思路' },
        { text: '能说出两段筛子（Fast Path 与 Slow Path）' },
        { text: '理解 Thread 的订阅和直通（pass-through）为什么能让前台腾出手来' },
      ],
      lines: [
        { t: '本章的目标有三个。' },
        { t: '我要成为打招呼大师的说！', v: Z, pause: -0.15 },
        { t: '目标里没有这条。', v: T, sfx: 'harisen' },
        { t: '第一，理解跟着事件、也就是 Trigger 行动的思路。', sfx: 'pop' },
        { t: '第二，能说出两段筛子。', sfx: 'pop' },
        { t: '第三，理解为什么用 Thread 的订阅和直通，能让前台腾出手来。', sfx: 'pop' },
      ],
    },
    {
      kind: 'concepts',
      heading: 'Trigger：驱动智能体的事件',
      cite: 'DeepSeek Harness 团队《Exploring Super-agent Design》（2026）',
      cards: [
        { ja: '聊天消息', desc: '群里的发言和回复' },
        { ja: '邮件', desc: '收到的邮件和后续往来' },
        { ja: '日程通知', desc: '会议邀请和提醒' },
        { ja: '代码事件', desc: '评审评论和 CI 结果' },
      ],
      lines: [
        { t: '驱动 Super-agent 的，不是人一条一条输入的指示，而是身边发生的事件。', s: '驱动 Super agent 的，不是人一条一条输入的指示，而是身边发生的事件。' },
        { t: '聊天消息。', sfx: 'pop' },
        { t: '邮件。', sfx: 'pop' },
        { t: '日程通知。', sfx: 'pop' },
        { t: '代码评审的评论，还有 CI 的结果。', s: '代码评审的评论，还有 C I 的结果。', sfx: 'pop' },
        { t: '文章把这些事件叫作 Trigger。', sfx: 'chime' },
        { t: 'Trigger……就是扳机……扒鸡！香喷喷的扒鸡！', v: Z, pause: -0.15 },
        { t: '不炖。', v: T, sfx: 'harisen' },
        { t: '它听着 Trigger 行动，所以不必每一次都等人下指示。' },
      ],
    },
    {
      kind: 'big',
      heading: '难题：事件大多是噪声',
      kicker: '一旦接上真实的聊天和代码平台',
      text: '事件流里，**大部分都不需要行动**',
      sub: '全部交给大模型从头判断，又慢又太费算力',
      lines: [
        { t: '可是，一旦接上真实的聊天和代码平台，麻烦就来了。' },
        { t: '事件流很嘈杂，真正该行动的却很少。每天的消息，大部分都不需要智能体做任何事。' },
        { t: '所以，每一条发言，我都要用最聪明的模型，好好想一想！', v: Z, pause: -0.15 },
        { t: '回早上好，不需要最聪明的模型。', v: T, sfx: 'harisen' },
        { t: '俊达萌把“早上好”的含义，认真思考了三十秒。', v: TEN, sfxAfter: 'chin' },
        { t: '全部交给大模型从头判断，不但慢，还太费算力。' },
      ],
    },
    {
      kind: 'flow',
      heading: '两段筛子：Fast Path、Slow Path',
      cite: 'DeepSeek Harness 团队《Exploring Super-agent Design》（2026）',
      nodes: [
        { label: '事件', sub: '嘈杂的事件流' },
        { label: '第 1 段：代码', sub: 'Fast Path：来源、群组、许可名单' },
        { label: '筛掉', sub: '大部分在这里' },
        { label: '第 2 段：模型', sub: 'Slow Path：只看候选，按上下文和方针' },
        { label: '行动', sub: '只做需要的' },
        { label: '不出声', sub: '不需要的话' },
      ],
      lines: [
        { t: '于是，文章借用了计算机里 Fast Path 和 Slow Path 的思路。' },
        { t: '经常发生、能明确判断的，交给又快又便宜的代码。只有必须读懂含义才能决定的，才交给模型。' },
        { t: '第一段，是代码的筛子。根据事件的来源、群组，以及人和机器人的许可名单，快速决定。', sfx: 'pop' },
        { t: '大部分无关的消息，在调用模型之前，就在这里被筛掉了。', sfx: 'pop' },
        { t: '还可以按来源事先定好：只在被请求时回应、列入候选，或者忽略。' },
        { t: '第二段，是模型的筛子。只有剩下的候选，才由模型根据上下文和用文字写的方针来判断。', sfx: 'pop' },
        { t: 'Slow……慢慢来……这可是我的拿手好戏的说！', v: Z, pause: -0.15 },
        { t: '请别得意。', v: T, sfx: 'harisen' },
        { t: '只有判断出需要的，才会行动。', sfx: 'pop' },
        { t: '不需要的话，就不出声。', sfx: 'pop' },
      ],
    },
    {
      kind: 'big',
      heading: '第 2 段可以用文字扩展',
      kicker: '方针用文字来写',
      text: '人可以**随时增加或删除**方针',
      sub: '不改代码，就能试新规则',
      lines: [
        { t: '第二段还有一个好处。方针是用文字写的，所以人随时都可以增加或删除。' },
        { t: '那我加一条：只要聊到毛豆麻糬，一定要回复！', v: Z, pause: -0.15 },
        { t: '请别加。', v: T, sfx: 'harisen' },
        { t: '这条方针，三秒后就被删掉了。', v: TEN },
        { t: '有了能用文字扩展的地方，新规则马上就能试。', sfx: 'chime' },
      ],
    },
    {
      kind: 'points',
      heading: '筛子游戏：如果你是前台？',
      items: [
        { title: '“早上好”', body: '群聊' },
        { title: '“CI 挂了，谁来看看”', body: '群聊' },
        { title: '“给大家带了毛豆麻糬”', body: '群聊' },
        { title: 'PR 上的“把这个函数改个名”', body: '有负责 Worker 的 PR' },
      ],
      lines: [
        { t: '来玩个游戏。如果你是示例应用团队的前台，这四件事，你会怎么处理？' },
        { t: '第一，早上好。', sfx: 'pop' },
        { t: '第二，CI 挂了，谁来看看。', s: '第二，C I 挂了，谁来看看。', sfx: 'pop' },
        { t: '第三，给大家带了毛豆麻糬。', sfx: 'pop' },
        { t: '第四，在已有负责 Worker 的 PR 上，有人评论：把这个函数改个名。', s: '第四，在已有负责 Worker 的 P R 上，有人评论：把这个函数改个名。', sfx: 'pop' },
        { t: '简单！每一条都点“全部回复”！', v: Z, pause: -0.15 },
        { t: '这题不是问你的。', v: T, sfx: 'harisen' },
        { t: '请暂停视频，自己判断一下。', sfx: 'chime' },
      ],
    },
    {
      kind: 'table',
      heading: '筛子游戏：参考答案',
      columns: ['事件', '参考答案', '在哪一步'],
      rows: [
        { cells: ['早上好', '什么都不做', '第 1 段筛掉'] },
        { cells: ['CI 挂了，谁来看看', '列为工作候选', '第 2 段判断'] },
        { cells: ['给大家带了毛豆麻糬', '什么都不做', '第 2 段判断“不需要”'] },
        { cells: ['PR 上的“改个名”', '原样交给负责的 Worker', '直通（接下来讲）'] },
      ],
      lines: [
        { t: '参考答案来了。会随设置而变，不过大致是这样。' },
        { t: '早上好，在第一段的代码筛子就被筛掉。', sfx: 'pop' },
        { t: 'CI 挂了的通知，是工作候选。在第二段，由模型决定要不要行动。', s: 'C I 挂了的通知，是工作候选。在第二段，由模型决定要不要行动。', sfx: 'pop' },
        { t: '毛豆麻糬就交给我，我全都……', v: Z, pause: -0.15 },
        { t: '带来的点心，第二段判断不需要，就不出声。', sfx: 'pop' },
        { t: '毛豆麻糬，被人类吃掉了。', v: TEN, sfxAfter: 'chin' },
        {
          t: '有负责 Worker 的 PR 上的评论，过了筛子后不经前台，直接交给那个 Worker。这就是接下来要讲的直通。',
          s: '有负责 Worker 的 P R 上的评论，过了筛子后不经前台，直接交给那个 Worker。这就是接下来要讲的直通。',
          sfx: 'pop',
        },
      ],
    },
    {
      kind: 'sequence',
      heading: 'Thread 订阅与直通',
      cite: 'DeepSeek Harness 团队《Exploring Super-agent Design》（2026）',
      actors: [
        { label: '人', sub: 'PR、聊天' },
        { label: '分发员', sub: '代码（Fast Path）' },
        { label: 'Router', sub: 'Slow Path' },
        { label: 'Worker', sub: '负责人' },
      ],
      steps: [
        { label: 'Thread 的第一个事件' },
        { label: '还没有订阅者' },
        { label: '创建 Worker → 订阅 Thread' },
        { label: '同一个 Thread 的后续' },
        { label: '原样交过去（直通）' },
        { label: '只汇报重要结论' },
      ],
      lines: [
        { t: '接下来，看看事件是怎么分派的。' },
        {
          t: '同一个 PR、同一个话题、同一串邮件往来。这样一连串的事件，文章叫作 Thread。',
          s: '同一个 P R、同一个话题、同一串邮件往来。这样一连串的事件，文章叫作 Thread。',
        },
        { t: 'Thread……线！用线把毛豆麻糬串成一串的说！', v: Z, pause: -0.15 },
        { t: '不串。', v: T, sfx: 'harisen' },
        { t: 'Thread 的第一个事件，还没有负责的 Worker，所以交给 Router。' },
        { t: 'Router 创建一个 Worker，由这个 Worker 订阅这个 Thread。' },
        { t: '接下来是捷径。同一个 Thread 的后续，由代码原样交给订阅它的 Worker。这就是直通。', sfx: 'chime' },
        { t: 'Router 就不必再判断一次该交给谁了。' },
        { t: 'Router 确实能看到所有事件。但需要它判断并分派的，只有没有订阅者的新事件。' },
        { t: 'Worker 只把重要的结论汇报给 Router。' },
        { t: '如果后续和当前的工作无关，Worker 可以取消订阅，或者交回给 Router。' },
      ],
    },
    {
      kind: 'points',
      heading: '订阅是多对多的',
      items: [
        { title: '1 个 Worker，订阅多个 Thread', body: '把相关的 PR 和聊天一起订阅' },
        { title: '1 个 Thread，由多个 Worker 订阅', body: '新事件同时送达所有订阅者' },
        { title: '有机会察觉冲突', body: '无需一对一联系。少数协调才靠 Router' },
      ],
      lines: [
        { t: '订阅是多对多的。' },
        { t: '一个 Worker，可以订阅多个相关的 Thread。', sfx: 'pop' },
        { t: '一个 Thread，也可以由多个 Worker 订阅。新事件会同时送到所有订阅者那里。', sfx: 'pop' },
        {
          t: '改同一个 PR 的 Worker 们，看到的是同样的事件，所以有机会察觉彼此的动作，自己解决冲突。',
          s: '改同一个 P R 的 Worker 们，看到的是同样的事件，所以有机会察觉彼此的动作，自己解决冲突。',
          sfx: 'pop',
        },
        { t: '那 Worker 之间，每次都互相打电话！', v: Z, pause: -0.15 },
        { t: '不打电话。', v: T, sfx: 'harisen' },
        { t: '即使不一对一联系，只要看着同样的东西，就有察觉的契机。只有少数需要跨工作协调的时候，才由 Router 牵线。', sfx: 'chime' },
      ],
    },
    {
      kind: 'table',
      heading: '初步实验：直通的效果',
      cite: '文章 7.1 节（每种设计 5 次、合成负载。消息间隔和工作时长缩短为 1/4。参考值）',
      columns: ['设计', '完成用时（p50 / p95）', '缓存读取（每次）'],
      rows: [
        { cells: ['Super-agent', '12.4 分钟 / 15.7 分钟', '2,320 万 token'] },
        { cells: ['Super-agent（无直通）', '12.6 分钟 / 15.5 分钟', '3,180 万 token（约增加 37%）'] },
      ],
      lines: [
        { t: '直通到底有多大用？上一章的实验里，也比较了去掉直通的设计。' },
        { t: '有直通时，p50 是 12.4 分钟，p95 是 15.7 分钟。', s: '有直通时，P 五十是十二点四分钟，P 九十五是十五点七分钟。', sfx: 'pop' },
        { t: '去掉直通，也是 12.6 分钟和 15.5 分钟。完成的时间几乎一样。', s: '去掉直通，也是十二点六分钟和十五点五分钟。完成的时间几乎一样。', sfx: 'pop' },
        { t: '既然没变快，那直通就不需要了的说。', v: Z, pause: -0.15 },
        { t: '需要。', v: T, sfx: 'harisen' },
        {
          t: 'Router 的判断增加了约三成，从缓存读取的 token，从 2,320 万增加到 3,180 万，约增加了 37%。',
          s: 'Router 的判断增加了约三成，从缓存读取的 token，从两千三百二十万增加到三千一百八十万，约增加了百分之三十七。',
          sfx: 'tick',
        },
        { t: '在这个实验的负载下，直通大幅减少的不是时间，而是前台的负担和 token。', sfx: 'chime' },
        { t: '而且，即使没有直通，多亏了批处理，Router 也还没有达到极限。' },
      ],
    },
    {
      kind: 'quiz',
      heading: '小测验',
      question: '同一个 PR 的后续评论，也每次都由 Router 读过，再决定交给谁？',
      explain: '由代码原样交给订阅的 Worker（直通）。Router 只判断没有订阅者的新事件',
      lines: [
        {
          t: '小测验。同一个 PR 的后续评论，也每次都由 Router 读过，再决定交给谁。对，还是错？',
          s: '小测验。同一个 P R 的后续评论，也每次都由 Router 读过，再决定交给谁。对，还是错？',
          pause: 3.2,
        },
        { t: '对！前台全都自己读！', v: Z, pause: -0.15 },
        { t: '前台又全都自己干了。', v: T, sfx: 'harisen' },
        { t: '答案是：错。由代码原样交给订阅的 Worker。Router 需要判断的，只有没有订阅者的新事件。', sfx: 'reveal' },
        { t: '俊达萌，三连败。', v: TEN, sfxAfter: 'chin' },
      ],
    },
    {
      kind: 'recap',
      heading: '复习',
      items: [
        { text: '跟着身边的事件（Trigger）行动，不等人一步一步下指示' },
        { text: '两段筛子：代码快速筛掉，剩下的才由模型判断。方针可以用文字增加' },
        { text: 'Thread 的后续直接交给订阅的 Worker（直通），减少前台的负担和 token' },
      ],
      lines: [
        { t: '复习一下。Super-agent 跟着身边的事件，也就是 Trigger 行动。', s: '复习一下。Super agent 跟着身边的事件，也就是 Trigger 行动。', sfx: 'pop' },
        { t: '通过两段筛子，代码快速筛掉，只有剩下的才由模型判断。方针可以用文字增加。', sfx: 'pop' },
        { t: '同一个 Thread 的后续，直接交给订阅的 Worker。前台的负担和 token 都减少了。', sfx: 'pop' },
        { t: '懂了！以后再也不回早上好了！', v: Z, pause: -0.15 },
        { t: '做人还是要回的。', v: T, sfx: 'harisen' },
        { t: '俊达萌稍微学会了一点筛选。标签页还开着三十七个。', v: TEN },
      ],
    },
    {
      kind: 'ending',
      next: { title: '上下文怎么装，以及抢先一步' },
      lines: [
        { t: '下回：俊达萌贴上一万行日志。', v: TEN },
        { t: '每一行都很重要的说！', v: Z },
      ],
    },
  ],
};
