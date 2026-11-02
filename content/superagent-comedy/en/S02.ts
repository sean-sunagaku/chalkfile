import type { LectureL10n } from '../../i18n';
import { docsTitles } from './sources';

// 英語版の S02。日本語の台本（../S02.ts）に重ねる。ボケは直訳せず、英語で笑えるように作り直した
// （Router → Wi-Fi の router、バッチ → batch baking、砂糖のレシピは "calls for"、実況は "mute yourself" など）。
// 事実・数字・画面の正しい名前・出典は日本語の台本と同じ。v を省いた台詞は先生
const Z = 'zundamon' as const;
const ZC = 'zundamon-cry' as const;
const T = 'tsukkomi' as const;
const TEN = 'tennokoe' as const;

export const S02: LectureL10n = {
  source: '0f2266c3b253',
  title: 'Split the front desk from the work (two layers)',
  summary:
    "Starting from the weak points of putting every event in one session and of starting a new session for every event, learn the two-layer structure: a Router layer (the front desk) and a Worker layer (the work). Why the Router does no work itself, how it differs from an Agent Team, why batching keeps one front desk from jamming easily, and the article's preliminary experiments.",
  docs: docsTitles(['dsh-superagent-article', 'dsh-superagent-prototype']),
  quiz: [
    {
      q: "In the article's two-layer structure, which part handles the back-and-forth with people?",
      choices: ['The Router layer', 'The Worker layer', 'Each Worker replies on its own', 'The Wi-Fi router'],
      explain:
        'The Router layer takes in messages from every entry point, and also pulls together the replies to people. Workers do not talk to people directly; they report to the Router.',
    },
    {
      q: "In the article's experiment, what mainly slowed down the design that gave one session a subagent tool?",
      choices: [
        'The model was too small',
        'The model decided on the spot whether to delegate, did the work itself, and got held up by new messages',
        'The network was slow',
        'It created too many subagents',
      ],
      explain:
        'With the plain prompt, it delegated in none of the 5 runs. Even with the delegation prompt, in 1 of 5 runs it did a "small job" itself, which made a long tail. In the two-layer structure, the system itself rules that the front desk does no work.',
    },
    {
      q: "What does the article say about the Router layer's batching?",
      choices: [
        'The more events come in, the longer each decision always takes',
        'Events that arrive while it is thinking are handed over together in its next turn. A turn grows more slowly than the event count',
        'Workers batch up events and reply to people together',
        'There is no limit to how many events one turn can handle',
      ],
      explain:
        'In the preliminary experiment, going from about 1 to about 40 events a minute, one turn went from 2.5 to 3.9 seconds, and the time per decision fell from 6.4 to 1.6 seconds. But context length, and how many events one turn can handle correctly, both have limits.',
    },
  ],
  takeaways: [
    'Put everything in one session and it is slow and things get mixed up. Split it up by event and nothing connects, and many sessions reply separately. Continuity and speed pull against each other',
    "Router layer = a front desk that keeps running. It talks to people, hands out work and remembers the whole picture. It does no work itself (it runs even without Bash). A light model is often enough (the article team's experience)",
    'Worker layer = sessions with separate context for each job. Usually the smartest model. Each focuses on one job, does not talk to people directly, and reports to the Router',
    'Sessions belong inside the system. Do not make users manage them by hand',
    'Even with one front desk, batching keeps it from jamming easily. When that is not enough, add stages to the filter or split the Router (the more you split, the less memory can be shared)',
  ],
  scenes: [
    {
      kind: 'opening',
      title: 'Split the front desk from the work',
      lines: [
        { t: 'Chapter 2. Split the front desk from the work.', s: 'Chapter two. Split the front desk from the work.', v: 'announcer', pause: 0.3 },
        { t: 'Front desk Zundamon, reporting! I take the order, cook it, deliver it, and do the dishes. All me!', v: Z, pause: -0.15 },
        { t: 'Front desk only, please.', v: T, sfx: 'harisen' },
        { t: 'As promised last time: does it all.', v: TEN },
        {
          t: 'This chapter covers the foundation of a Super-agent: two layers. We split taking in the work from doing the work.',
          s: 'This chapter covers the foundation of a Super agent: two layers. We split taking in the work from doing the work.',
        },
      ],
    },
    {
      kind: 'goals',
      heading: 'Goals for this chapter',
      items: [
        { text: 'Know the weak points of "all in one session" and "split it all up"' },
        { text: 'Say what the Router layer and the Worker layer each do' },
        { text: 'Know why one front desk does not jam easily' },
      ],
      lines: [
        { t: 'This chapter has three goals.' },
        { t: "I'm going to learn to do everything!", v: Z, pause: -0.15 },
        { t: "This is the don't-do-everything chapter.", v: T, sfx: 'harisen' },
        { t: 'One: know the weak points of both putting everything in one session and splitting everything apart.', sfx: 'pop' },
        { t: 'Two: say what the Router layer and the Worker layer each do.', sfx: 'pop' },
        { t: 'Three: know why one front desk does not jam easily.', sfx: 'pop' },
      ],
    },
    {
      kind: 'compare',
      heading: 'Splitting sessions: two extremes',
      left: {
        title: 'All in one session',
        sub: 'Context carries over best',
        items: [{ text: 'One step at a time, so it is slow' }, { text: 'Half-done talk from separate jobs gets mixed' }],
      },
      right: {
        title: 'A new session per event',
        sub: 'Lots of work moves at once',
        items: [{ text: 'Context between jobs does not connect' }, { text: 'Many sessions each reply on their own' }],
      },
      verdict: { text: 'Continuity and speed pull against each other' },
      lines: [
        { t: "First, how to split sessions. Let's have Zundamon try both extremes." },
        { t: 'Step one: every single event goes into my one session!', v: Z },
        {
          t: 'It sees everything, so context carries over best. But a ReAct loop goes one step at a time, so one session can only go so fast.',
          s: 'It sees everything, so context carries over best. But a React loop goes one step at a time, so one session can only go so fast.',
          sfx: 'pop',
        },
        { t: 'On top of that, small details from separate jobs in progress mix in one context, and the results get worse.', sfx: 'pop' },
        { t: 'My bug fix got mixed up with my zunda-mochi recipe…', s: 'My bug fix got mixed up with my zunda mochi recipe.', v: ZC, pause: 0.4 },
        { t: 'The code now calls for two tablespoons of sugar.', v: TEN, sfxAfter: 'chin' },
        { t: 'Then the opposite! A brand-new session for every single event!', v: Z },
        { t: "Now lots of work moves at once. But when jobs are related, there's no overall context, so the results don't fit together.", sfx: 'pop' },
        { t: 'And many sessions each reply to people on their own.', sfx: 'pop' },
        { t: 'In the group chat, thirty-seven Zundamons are all replying!', v: Z, pause: -0.15 },
        { t: 'Way too noisy.', v: T, sfx: 'harisen' },
        { t: 'Each of the thirty-seven, naturally, says something slightly different.', v: TEN, sfxAfter: 'chin' },
        { t: 'Continuity and speed. When you split sessions, those two pull against each other.', sfx: 'chime' },
      ],
    },
    {
      kind: 'flow',
      heading: 'Two layers: the Router and Worker layers',
      cite: 'DeepSeek Harness team, "Exploring Super-agent Design" (2026)',
      groups: [{ label: 'Worker layer (one session per job)' }],
      nodes: [
        { label: 'People', sub: 'Chat, PRs, email' },
        { label: 'Router layer', sub: 'Always-on front desk and coordinator' },
        { label: 'Worker 1', sub: 'Fixes a bug' },
        { label: 'Worker 2', sub: 'Reviews a PR' },
        { label: 'Worker 3', sub: 'Builds a new feature' },
      ],
      edges: [{ label: 'Only here' }, { label: 'Hands out' }, {}, {}, { label: 'Reports results' }],
      lines: [
        { t: 'So the article splits the work into two layers.' },
        {
          t: 'First, the always-on Router layer. Messages from every entry point gather here, and it handles talking with people and coordinating the whole.',
          sfx: 'pop',
        },
        { t: 'Second, the Worker layer. Sessions with separate context for each job run at the same time.', sfx: 'pop' },
        { t: 'The Router hands out work to the Workers.', sfx: 'pop' },
        { t: 'A router? Like my Wi-Fi router! It beams the jobs out over the air!', v: Z, pause: -0.15 },
        { t: 'No beaming.', v: T, sfx: 'harisen' },
        { t: 'When a Worker finishes, it reports to the Router. The Router pulls the replies to people together.', sfx: 'pop' },
        {
          t: 'This way, the system takes care of managing sessions. Users barely need to think about them, and always talk to the same Super-agent.',
          s: 'This way, the system takes care of managing sessions. Users barely need to think about them, and always talk to the same Super agent.',
          sfx: 'chime',
        },
        // APIs は空けずに読ませる（「A P Is」と空けると「a pee is」と読まれた。2026-11-02 に Kokoro の音素で確かめた）
        { t: 'Making people manage sessions by hand is mostly a habit inherited from how model APIs are built. The article says sessions belong inside the system.' },
      ],
    },
    {
      kind: 'points',
      heading: 'Rules for the Router layer',
      items: [
        { title: 'The only one who talks to people', body: 'Every entry point leads here. It holds the overall memory and coordinates', at: 1 },
        { title: 'Does no work itself', body: "The article's Router runs even without the Bash tool", at: 2 },
        { title: 'A light model is often enough', body: "It doesn't split up a job. It hands out work and tracks how jobs relate", at: 9 },
      ],
      lines: [
        { t: "Let's look a little closer at the rules for the Router layer." },
        { t: 'Only the Router talks to people. Every message gathers there, so it is also where the overall memory and coordination live.', sfx: 'pop' },
        { t: 'And the most important rule: the Router does no work itself. Apparently it runs even without the Bash tool.', sfx: 'pop' },
        { t: "But for small jobs, it's faster if I just do them myself at the desk!", v: Z, pause: -0.15 },
        { t: 'Meanwhile, the desk stops.', v: T, sfx: 'harisen' },
        { t: 'When the desk stops, everyone waits.', v: TEN },
        { t: "Incidentally, this course's Teacher does all the explaining and all the comebacks. Single-handedly.", v: TEN },
        { t: 'So the Teacher is the one doing the most work at the front desk!', v: Z, pause: -0.15 },
        { t: '…I am not the front desk.', s: 'I am not the front desk.', v: T },
        { t: 'The Router only hands out work and roughly tracks how jobs relate.', sfx: 'pop' },
        { t: "In the article team's experience, that's often simpler than you'd think, and a light model is usually enough for both speed and quality." },
      ],
    },
    {
      kind: 'points',
      heading: 'Rules for the Worker layer',
      items: [
        { title: 'Focus on one job', body: 'Separate context per job. Has every tool it needs' },
        { title: 'Usually the smartest model', body: 'Directly decides the quality of the work and the code' },
        { title: "Doesn't talk to people directly", body: 'Half-formed thoughts and tool logs stay inside' },
      ],
      lines: [
        { t: 'Next, the rules for the Worker layer.' },
        { t: 'A Worker focuses on one job. Its context is separate for each job, and it has every tool the job needs.', sfx: 'pop' },
        { t: 'The Worker is what directly decides the quality of the work and the code. So it usually gets the smartest model.', sfx: 'pop' },
        { t: 'And Workers do not talk to people directly.', sfx: 'pop' },
        { t: "I'll stream every half-formed thought into the group chat as I go! Live commentary!", v: Z, pause: -0.15 },
        { t: 'Please mute yourself.', v: T, sfx: 'harisen' },
        { t: "The entire group was made to read two hundred lines of Zundamon's tool logs.", v: TEN, sfxAfter: 'chin' },
        {
          t: 'Workers report to the Router, and the Router pulls the replies to people together. You get both: speed, and replies from a single voice.',
          sfx: 'chime',
        },
      ],
    },
    {
      kind: 'compare',
      heading: 'How it differs from a typical Agent Team',
      left: {
        title: 'A typical Agent Team',
        sub: 'Divides up one big job',
        items: [{ text: 'The leader understands it deeply, splits it, and coordinates again and again (heavy)' }],
      },
      right: {
        title: "The Super-agent's Router",
        sub: 'Just hands out separate jobs',
        items: [{ text: "Doesn't split a job's contents; roughly tracks how jobs relate" }],
      },
      verdict: { text: "What's inside a layer is up to you. A Worker can be an Agent Team" },
      lines: [
        { t: 'One center with many around it. This shape looks like a typical Agent Team.' },
        { t: "A team! Eleven Zundamons! Let's play soccer!", v: Z, pause: -0.15 },
        { t: 'No kicking.', v: T, sfx: 'harisen' },
        { t: 'An Agent Team usually splits one big job and works on it together.', sfx: 'pop' },
        {
          t: 'The steps tend to be tightly linked, so the leader often digs deep into the job, splits it, and coordinates again and again. A heavy role.',
          sfx: 'pop',
        },
        { t: "The Super-agent's Router just hands out separate jobs.", s: "The Super agent's Router just hands out separate jobs.", sfx: 'pop' },
        { t: "It doesn't split up what's inside a job. It roughly tracks how the jobs relate.", sfx: 'pop' },
        {
          t: "Also, how each layer is built inside is up to you. If a Worker uses subagents or an Agent Team, the Router can't see it.",
          sfx: 'chime',
        },
      ],
    },
    {
      kind: 'table',
      heading: 'Preliminary experiment: time to finish',
      cite: 'Section 7.1 of the article (5 runs per design, synthetic workload; message gaps and task lengths cut to 1/4; reference values)',
      columns: ['Design', 'To finish (p50 / p95)', 'Cache reads (per run)'],
      rows: [
        { cells: ['Super-agent (two layers)', '12.4 min / 15.7 min', '23.2M tokens'] },
        { cells: ['One session + subagents (plain prompt)', '20.4 min / 29.5 min', '6.1M tokens'] },
        { cells: ['One session + subagents (delegation prompt)', '13.8 min / 29.0 min', '10.8M tokens'] },
      ],
      lines: [
        { t: "Is it really faster? The article's team ran preliminary experiments." },
        {
          t: 'About 300 chat and CI notifications went in, about 20 of them work requests. Work was replaced by a tool that just burns time. Five runs per design.',
          s: 'About three hundred chat and C I notifications went in, about twenty of them work requests. Work was replaced by a tool that just burns time. Five runs per design.',
        },
        {
          t: 'In the table, p50 is the middle value, and p95 is the time by which 95 out of 100 are done.',
          s: 'In the table, P fifty is the middle value, and P ninety-five is the time by which ninety-five out of a hundred are done.',
        },
        {
          t: "The Super-agent's p50 was 12.4 minutes, and its p95 was 15.7 minutes.",
          s: "The Super agent's P fifty was twelve point four minutes, and its P ninety-five was fifteen point seven minutes.",
          sfx: 'pop',
        },
        {
          t: 'With the plain prompt, the single session never delegated in any of the five runs. It did everything itself, with a p95 of 29.5 minutes.',
          s: 'With the plain prompt, the single session never delegated in any of the five runs. It did everything itself, with a P ninety-five of twenty-nine point five minutes.',
          sfx: 'pop',
        },
        { t: 'With the delegation prompt, it delegated in four of five runs. But once, it judged the job small, did it itself, and made a long tail.', sfx: 'pop' },
        { t: 'It was a small job, so I did it myself!', v: Z, pause: -0.15 },
        { t: "That's the long tail.", v: T, sfx: 'harisen' },
        { t: 'And so, the long tail was born.', v: TEN },
        {
          t: 'In one session, whether to delegate is up to the model in the moment. With two layers, the system itself rules that the front desk does no work.',
          bgm: 'cut',
          sfx: 'chime',
        },
        { t: "The catch: more sessions mean more tokens. It's a trade: tokens buy speed and stability.", bgm: 'back' },
      ],
    },
    {
      kind: 'big',
      heading: 'Why the desk does not jam easily: batching',
      cite: 'DeepSeek Harness team, "Exploring Super-agent Design" (2026)',
      kicker: 'A Router turn tends to read a lot and answer briefly',
      text: 'Events that arrive while it thinks are handed over **together in the next turn**',
      sub: 'Reading can be computed in one batch, so a turn grows more slowly than the event count',
      lines: [
        { t: "With one front desk, won't it jam? This is where batching helps: a way to process things together." },
        { t: 'Batching! Like baking zunda-mochi in big batches!', s: 'Batching! Like baking zunda mochi in big batches!', v: Z, pause: -0.15 },
        { t: "…That's actually correct.", s: "That's actually correct.", v: T, pause: 0.4 },
        { t: 'Wait, I was right?!', v: Z },
        { t: 'For the first time in this course, Zundamon was correct.', v: TEN, sfx: 'deden' },
        { t: 'Events that arrive while the Router is thinking wait in line, and are handed over together in its next turn.' },
        {
          t: 'A Router turn usually reads a lot and answers briefly. Reading can be computed in one batch, so a turn grows more slowly than the event count.',
          sfx: 'chime',
        },
      ],
    },
    {
      kind: 'numbers',
      heading: 'Preliminary experiment: front desk speed',
      cite: 'Section 7.2 of the article (only the Router used a real model; reference values)',
      items: [
        { label: 'Per decision (about 1 a minute)', suffix: ' s' },
        { label: 'Per decision (about 40 a minute)', suffix: ' s' },
      ],
      footnote: { text: 'About 1 → about 40 a minute: events per turn averaged 1.0 → 2.8, and one turn took 2.5 → 3.9 s' },
      lines: [
        {
          t: 'When about one event a minute needed a decision, each decision took 6.4 seconds.',
          s: 'When about one event a minute needed a decision, each decision took six point four seconds.',
          sfx: 'tick',
        },
        {
          t: 'At about forty a minute, a turn batched 2.8 events on average, and a turn only grew from 2.5 to 3.9 seconds.',
          s: 'At about forty a minute, a turn batched two point eight events on average, and a turn only grew from two point five to three point nine seconds.',
        },
        { t: 'As a result, the time per decision dropped to 1.6 seconds.', s: 'As a result, the time per decision dropped to one point six seconds.', sfx: 'tick' },
        { t: "But one turn can only take so many. If that's not enough, add filter stages or split the Router. The more you split, the less memory can be shared." },
      ],
    },
    {
      kind: 'quiz',
      heading: 'Quiz',
      question: 'For small jobs, should the Router layer just do them itself?',
      explain: 'The Router only talks to people and hands out work. If it does a job itself, the front desk stops meanwhile',
      lines: [
        {
          t: 'Quiz time. For small jobs, the Router layer should just do them itself. True or false?',
          s: 'Quiz time. For small jobs, the Router layer should just do them itself. True, or false?',
          pause: 3.2,
        },
        { t: "True! For small jobs, I'll just whip them up at the desk…", v: Z, pause: -0.15 },
        { t: 'Forgotten the long tail already?', v: T, sfx: 'harisen' },
        { t: 'The answer is false. The Router only talks to people and hands out work. If it does the work itself, the front desk stops.', sfx: 'reveal' },
        { t: 'Zundamon: two losses in a row.', v: TEN, sfxAfter: 'chin' },
      ],
    },
    {
      kind: 'recap',
      heading: 'Recap',
      items: [
        { text: 'All in one session: slow and mixed up. All split up: unconnected and noisy' },
        { text: 'Router layer: talks to people and hands out work. Worker layer: one job each, no direct talk with people' },
        { text: 'One front desk still does not jam easily, thanks to batching. Experiment numbers are reference values' },
      ],
      lines: [
        { t: 'Recap. Put everything in one session, and it is slow and mixed up. Split it all apart, and nothing connects, and it is noisy.', sfx: 'pop' },
        {
          t: 'So we split into two layers. The Router just talks to people and hands out work. Workers focus on one job and do not talk to people directly.',
          sfx: 'pop',
        },
        { t: 'Even with one front desk, batching keeps it from jamming easily. The experiment numbers are reference values.', sfx: 'pop' },
        { t: "Got it! As the front desk, I won't make a single thing ever again!", v: Z, pause: -0.15 },
        { t: "That's all we ask.", v: T },
        { t: 'Zundamon is now slightly more like a front desk. The thirty-seven tabs are still open.', v: TEN },
      ],
    },
    {
      kind: 'ending',
      next: { title: 'Moved by events (event-driven)' },
      lines: [
        { t: 'Next time: Zundamon replies to every good morning in the group chat.', v: TEN },
        { t: 'Greetings matter!', v: Z },
      ],
    },
  ],
};
