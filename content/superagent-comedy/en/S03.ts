import type { LectureL10n } from '../../i18n';
import { docsTitles } from './sources';

// 英語版の S03。日本語の台本（../S03.ts）に重ねる。ボケは直訳せず、英語で笑えるように作り直した
// （トリガー → 鶏ガラスープ は Trigger → trifle（英語で「取るに足りないもの」の意味もあるデザート）、
//  ふるいゲームの「全部、返事」は Reply All、スレッドは英語でも「糸」なので、そのまま糸で切る）。
// 事実・数字・画面の正しい名前・出典は日本語の台本と同じ。台詞の数は場面ごとに日本語と同じ（要素の at は日本語のまま）。
// v を省いた台詞は先生
const Z = 'zundamon' as const;
const ZC = 'zundamon-cry' as const; // この章では涙声を使わない（日本語の台本と同じ）
const T = 'tsukkomi' as const;
const TEN = 'tennokoe' as const;

export const S03: LectureL10n = {
  source: 'abaf8e88fb47',
  title: 'Moved by events (event-driven)',
  summary:
    "The Triggers that move a Super-agent (the events around it), and the two-stage filter that sifts a noisy stream of events (a code Fast Path and a model Slow Path). The Worker in charge subscribes to a Thread (one running PR or topic), and pass-through hands it the follow-ups directly, easing the front desk's load.",
  docs: docsTitles(['dsh-superagent-article', 'dsh-superagent-prototype']),
  quiz: [
    {
      q: "In the article's two-stage filter, what happens in stage 1 (the Fast Path)?",
      choices: [
        'A model reads the context and decides whether to act',
        'Code decides quickly, using the source, the group, allowlists and so on',
        'It replies to every event',
        'A human decides each one by hand',
      ],
      explain:
        'Stage 1 is code that quickly drops events by clear-cut rules (most are dropped before any model is called). Only candidates whose meaning has to be read go on to stage 2, where a model decides.',
    },
    {
      q: "For follow-up events on the same PR (the rest of a Thread), which is right in the article's design?",
      choices: [
        'The Router rereads each one and decides who gets it',
        'Code hands it straight to the subscribed Worker (pass-through)',
        'Workers contact each other one-to-one to pass it along',
        'Follow-up events are thrown away',
      ],
      explain:
        'On the first event, the Router creates a Worker, and that Worker subscribes to the Thread. Code hands the follow-ups straight to the subscribers. The Router does see everything, but it only judges and routes new events that have no subscriber.',
    },
    {
      q: "In the article's preliminary experiments, what went up a lot when pass-through was removed?",
      choices: ['The time until the work was done', 'The number of Router decisions, and the tokens read from cache', 'The number of Workers', 'Zunda-mochi consumption'],
      explain:
        'The time to finish stayed about the same (p50 12.4 → 12.6 min). Router decisions rose by about 30%, and cache-read tokens rose by about 37% (23.2M → 31.8M).',
    },
  ],
  takeaways: [
    'Trigger = an event around the agent (a chat message, an email, a calendar notice, a review comment, a CI result). The agent acts without waiting for step-by-step instructions',
    'Most events need no action. The two-stage filter: stage 1 is code (Fast Path: source, group, allowlists), stage 2 is a model (Slow Path: context and a policy written in words)',
    'Stage 2 is where people can add or remove policies in plain words',
    'Thread = one running PR, topic or email exchange. On the first event, the Router creates a Worker; follow-ups go straight to the subscribed Worker (pass-through)',
    "Subscriptions are many-to-many. Workers watching the same Thread get a chance to notice conflicts and fix them themselves, without one-to-one messages. Pass-through cut the front desk's load and tokens rather than time (the article's preliminary experiments)",
  ],
  scenes: [
    {
      kind: 'opening',
      title: 'Moved by events',
      lines: [
        { t: 'Chapter 3. Moved by events.', s: 'Chapter three. Moved by events.', v: 'announcer', pause: 0.3 },
        { t: 'Good morning! Good morning! Good morning! I replied to every single person in the group chat!', v: Z, pause: -0.15 },
        { t: 'Good mornings need no reply.', v: T, sfx: 'harisen' },
        { t: 'As promised: replied to forty-eight people.', v: TEN },
        { t: 'In this chapter: event-driven design, where the agent is moved by the events around it, not by human instructions.' },
      ],
    },
    {
      kind: 'goals',
      heading: 'Goals for this chapter',
      items: [
        { text: 'Understand acting on events (Triggers)' },
        { text: 'Explain the two-stage filter (Fast Path and Slow Path)' },
        { text: 'See why Thread subscriptions and pass-through free up the front desk' },
      ],
      lines: [
        { t: 'This chapter has three goals.' },
        { t: "I'm going to become a master of greetings!", v: Z, pause: -0.15 },
        { t: 'Not on the list.', v: T, sfx: 'harisen' },
        { t: 'One: understand the idea of acting on events, called Triggers.', sfx: 'pop' },
        { t: 'Two: be able to explain the two-stage filter.', sfx: 'pop' },
        { t: 'Three: understand why Thread subscriptions and pass-through free up the front desk.', sfx: 'pop' },
      ],
    },
    {
      kind: 'concepts',
      heading: 'Trigger: events that move the agent',
      cite: 'DeepSeek Harness team, "Exploring Super-agent Design" (2026)',
      cards: [
        { ja: 'Chat messages', desc: 'Group posts and replies' },
        { ja: 'Email', desc: 'New mail and ongoing replies' },
        { ja: 'Calendar notices', desc: 'Meeting invites and reminders' },
        { ja: 'Code events', desc: 'Review comments and CI results' },
      ],
      lines: [
        {
          t: "What moves a Super-agent isn't instructions a human types in one by one. It's the events happening around it.",
          s: "What moves a Super agent isn't instructions a human types in one by one. It's the events happening around it.",
        },
        { t: 'Chat messages.', sfx: 'pop' },
        { t: 'Emails.', sfx: 'pop' },
        { t: 'Calendar notices.', sfx: 'pop' },
        { t: 'Code review comments, and CI results.', s: 'Code review comments, and C I results.', sfx: 'pop' },
        { t: 'The article calls events like these Triggers.', sfx: 'chime' },
        { t: 'Trigger… trig… trifle! A giant zunda-mochi trifle!', s: 'Trigger. Trig. Trifle! A giant zunda mochi trifle!', v: Z, pause: -0.15 },
        { t: 'No dessert.', v: T, sfx: 'harisen' },
        { t: "It listens for Triggers and acts on them, so a person doesn't have to tell it what to do each time." },
      ],
    },
    {
      kind: 'big',
      heading: 'The problem: most events are noise',
      kicker: 'Connected to real chat and code platforms',
      text: 'In the event stream, **most events need no action**',
      sub: 'Judging it all from scratch with a big model is slow and uses too much compute',
      lines: [
        { t: "But once you hook it up to real chat and code platforms, there's a problem." },
        { t: 'The event stream is noisy, yet few events need action. Most messages each day need nothing from the agent at all.' },
        { t: "So I'll think through every single message with the smartest model there is!", v: Z, pause: -0.15 },
        { t: 'Not for good morning.', v: T, sfx: 'harisen' },
        { t: 'Zundamon spent thirty seconds pondering the meaning of good morning.', v: TEN, sfxAfter: 'chin' },
        { t: 'Judging everything from scratch with a big model is slow, and it uses too much compute.' },
      ],
    },
    {
      kind: 'flow',
      heading: 'Two-stage filter: Fast Path and Slow Path',
      cite: 'DeepSeek Harness team, "Exploring Super-agent Design" (2026)',
      nodes: [
        { label: 'Events', sub: 'A noisy stream' },
        { label: 'Stage 1: code', sub: 'Fast Path: source, group, allowlists' },
        { label: 'Drop', sub: 'Most stop here' },
        { label: 'Stage 2: model', sub: 'Slow Path: candidates only, by context and policy' },
        { label: 'Act', sub: 'Only when needed' },
        { label: 'Quiet', sub: 'If not needed' },
      ],
      lines: [
        { t: 'So the article borrows an idea from computer systems: the Fast Path and the Slow Path.' },
        { t: "Frequent, clear-cut decisions go to fast, cheap code. Only what can't be decided without reading its meaning goes to a model." },
        { t: "Stage one is a code filter. It decides in a flash, using the event's source, the group, and allowlists of people and bots.", sfx: 'pop' },
        { t: 'This drops most irrelevant messages before a model is ever called.', sfx: 'pop' },
        { t: 'For each source, you can set it in advance: respond only when asked, make it a candidate, or ignore it.' },
        { t: 'Stage two is a model filter. A model judges only the remaining candidates, by the context and a policy written in plain words.', sfx: 'pop' },
        { t: "Slow Path? Nice and slow… that's my specialty!", s: "Slow Path? Nice and slow. That's my specialty!", v: Z, pause: -0.15 },
        { t: 'Nothing to brag about.', v: T, sfx: 'harisen' },
        { t: 'Only what it judges to be needed gets acted on.', sfx: 'pop' },
        { t: 'If nothing is needed, it stays quiet.', sfx: 'pop' },
      ],
    },
    {
      kind: 'big',
      heading: 'Stage 2 can be extended in words',
      kicker: 'Policies are written in plain words',
      text: 'People can **add or remove policies anytime**',
      sub: 'Try new rules without rewriting code',
      lines: [
        { t: 'Stage two has one more upside. The policy is written in plain words, so people can add to it or take things out anytime.' },
        { t: "Then I'll add one: always reply to anything about zunda-mochi!", s: "Then I'll add one: always reply to anything about zunda mochi!", v: Z, pause: -0.15 },
        { t: "Please don't add that.", v: T, sfx: 'harisen' },
        { t: 'The policy was removed within three seconds.', v: TEN },
        { t: 'With a place you can extend in words, you can try new rules right away.', sfx: 'chime' },
      ],
    },
    {
      kind: 'points',
      heading: 'Sieve game: if YOU were the front desk?',
      items: [
        { title: '"Good morning!"', body: 'Group chat' },
        { title: '"CI is failing. Can someone look?"', body: 'Group chat' },
        { title: '"Brought zunda-mochi for everyone!"', body: 'Group chat' },
        { title: 'On a PR: "Rename this function"', body: 'A PR with a Worker in charge' },
      ],
      lines: [
        { t: 'Now, a game. If you were the front desk for the Sample App team, how would you handle these four?' },
        { t: 'One: Good morning!', sfx: 'pop' },
        { t: 'Two: CI is failing, can someone look?', s: 'Two: C I is failing, can someone look?', sfx: 'pop' },
        { t: 'Three: Brought zunda-mochi for everyone!', s: 'Three: Brought zunda mochi for everyone!', sfx: 'pop' },
        {
          t: 'Four: a comment saying rename this function, on a PR that has a Worker in charge.',
          s: 'Four: a comment saying rename this function, on a P R that has a Worker in charge.',
          sfx: 'pop',
        },
        { t: 'Easy! Hit Reply All on every one of them!', v: Z, pause: -0.15 },
        { t: "I wasn't asking you.", v: T, sfx: 'harisen' },
        { t: 'Pause the video and make your call.', sfx: 'chime' },
      ],
    },
    {
      kind: 'table',
      heading: 'Sieve game: sample answers',
      columns: ['Event', 'Sample answer', 'Where'],
      rows: [
        { cells: ['Good morning!', 'Do nothing', 'Dropped in stage 1'] },
        { cells: ['CI is failing. Can someone look?', 'Make it a work candidate', 'Judged in stage 2'] },
        { cells: ['Brought zunda-mochi for everyone!', 'Do nothing', 'Stage 2: "not needed"'] },
        { cells: ['"Rename" on the PR', 'Hand it straight to the Worker', 'Pass-through (up next)'] },
      ],
      lines: [
        { t: "Here's one possible answer. It depends on the settings, but it could go like this." },
        { t: 'Good morning gets dropped by the code filter in stage one.', sfx: 'pop' },
        {
          t: 'The CI failure notice is a work candidate. In stage two, a model decides whether to act.',
          s: 'The C I failure notice is a work candidate. In stage two, a model decides whether to act.',
          sfx: 'pop',
        },
        { t: "And the zunda-mochi? Leave it to me, I'll eat every last…", s: "And the zunda mochi? Leave it to me, I'll eat every last", v: Z, pause: -0.15 },
        { t: 'The snack gift is judged not needed in stage two, so the agent stays quiet.', sfx: 'pop' },
        { t: 'The humans ate the zunda-mochi.', s: 'The humans ate the zunda mochi.', v: TEN, sfxAfter: 'chin' },
        {
          t: "And the PR comment with a Worker in charge? After the filter, it skips the front desk and goes straight to that Worker. That's pass-through, up next.",
          s: "And the P R comment with a Worker in charge? After the filter, it skips the front desk and goes straight to that Worker. That's pass through, up next.",
          sfx: 'pop',
        },
      ],
    },
    {
      kind: 'sequence',
      heading: 'Thread subscriptions and pass-through',
      cite: 'DeepSeek Harness team, "Exploring Super-agent Design" (2026)',
      actors: [
        { label: 'People', sub: 'PRs, chat' },
        { label: 'Dispatcher', sub: 'Code (Fast Path)' },
        { label: 'Router', sub: 'Slow Path' },
        { label: 'Worker', sub: 'In charge' },
      ],
      steps: [
        { label: 'First event in a Thread' },
        { label: 'No one subscribed yet' },
        { label: 'Creates a Worker → it subscribes' },
        { label: 'Follow-up in the same Thread' },
        { label: 'Handed straight over (pass-through)' },
        { label: 'Reports key conclusions only' },
      ],
      lines: [
        { t: 'Next: how events get handed out.' },
        {
          t: 'The same PR, the same topic, the same email exchange. The article calls a run of related events like this a Thread.',
          s: 'The same P R, the same topic, the same email exchange. The article calls a run of related events like this a Thread.',
        },
        { t: 'Thread? Like sewing thread? Perfect for slicing zunda-mochi!', s: 'Thread? Like sewing thread? Perfect for slicing zunda mochi!', v: Z, pause: -0.15 },
        { t: 'No slicing.', v: T, sfx: 'harisen' },
        { t: 'The first event in a Thread has no Worker in charge yet, so it goes to the Router.' },
        { t: 'The Router creates a Worker, and that Worker subscribes to the Thread.' },
        { t: "Now the shortcut. Code hands each follow-up in that Thread straight to the subscribed Worker. That's pass-through.", sfx: 'chime' },
        { t: "The Router doesn't have to make the routing call all over again." },
        { t: 'The Router does see every event. But the only ones it judges and routes are new events with no subscriber.' },
        { t: 'The Worker reports only key conclusions back to the Router.' },
        { t: 'If a follow-up has nothing to do with its current work, the Worker can unsubscribe, or hand it back to the Router.' },
      ],
    },
    {
      kind: 'points',
      heading: 'Subscriptions are many-to-many',
      items: [
        { title: 'One Worker, many Threads', body: 'Subscribes to its related PRs and chats together' },
        { title: 'One Thread, many Workers', body: 'New events reach all of them at once' },
        { title: 'A chance to spot conflicts', body: 'No one-to-one messages. The Router only for rare coordination' },
      ],
      lines: [
        { t: 'Subscriptions are many-to-many.' },
        { t: 'One Worker can subscribe to many related Threads.', sfx: 'pop' },
        { t: 'And one Thread can have many Workers subscribed. A new event reaches all of them at the same time.', sfx: 'pop' },
        {
          t: "Workers touching the same PR see the same events, so they get a chance to notice each other's moves and fix conflicts themselves.",
          s: "Workers touching the same P R see the same events, so they get a chance to notice each other's moves and fix conflicts themselves.",
          sfx: 'pop',
        },
        { t: 'Then the Workers should phone each other, every single time!', v: Z, pause: -0.15 },
        { t: 'No phone calls.', v: T, sfx: 'harisen' },
        {
          t: 'No one-to-one messages needed: watching the same things gives them a chance to notice. The Router steps in only for rare cross-task coordination.',
          sfx: 'chime',
        },
      ],
    },
    {
      kind: 'table',
      heading: 'Preliminary experiment: pass-through effect',
      cite: 'Section 7.1 of the article (5 runs per design, synthetic workload; message gaps and task lengths cut to 1/4; reference values)',
      columns: ['Design', 'Time to finish (p50 / p95)', 'Cache reads (per run)'],
      rows: [
        { cells: ['Super-agent', '12.4 min / 15.7 min', '23.2M tokens'] },
        { cells: ['Super-agent (no pass-through)', '12.6 min / 15.5 min', '31.8M tokens (about 37% more)'] },
      ],
      lines: [
        { t: 'How much does pass-through actually help? The experiments in the last chapter also compared a design with pass-through removed.' },
        {
          t: 'With pass-through, p50 was 12.4 minutes, and p95 was 15.7.',
          s: 'With pass through, P fifty was twelve point four minutes, and P ninety-five was fifteen point seven.',
          sfx: 'pop',
        },
        {
          t: 'Without it: 12.6 and 15.5 minutes. The time to finish was almost the same.',
          s: 'Without it: twelve point six, and fifteen point five minutes. The time to finish was almost the same.',
          sfx: 'pop',
        },
        { t: "If it's not any faster, we don't need pass-through.", v: Z, pause: -0.15 },
        { t: 'Yes, we do.', v: T, sfx: 'harisen' },
        {
          t: 'Router decisions rose by about 30%, and tokens read from cache went from 23.2 million to 31.8 million. About 37% more.',
          s: 'Router decisions rose by about thirty percent, and tokens read from cache went from twenty-three point two million to thirty-one point eight million. About thirty-seven percent more.',
          sfx: 'tick',
        },
        { t: "Under this experiment's load, pass-through didn't make things faster. What it cut, by a lot, was the front desk's load and tokens.", sfx: 'chime' },
        { t: "And even without pass-through, thanks to batching, the Router still hadn't hit its limit." },
      ],
    },
    {
      kind: 'quiz',
      heading: 'Quiz',
      question: 'Does the Router read every follow-up comment on the same PR and decide who gets it?',
      explain: 'Code hands it straight to the subscribed Worker (pass-through). The Router only judges new events with no subscriber',
      lines: [
        {
          t: 'Quiz time. Even for follow-up comments on the same PR, does the Router read each one and decide who gets it? True or false?',
          s: 'Quiz time. Even for follow-up comments on the same P R, does the Router read each one and decide who gets it? True, or false?',
          pause: 3.2,
        },
        { t: 'True! The front desk reads everything itself!', v: Z, pause: -0.15 },
        { t: 'Doing it all again.', v: T, sfx: 'harisen' },
        {
          t: 'The answer is false. Code hands it straight to the subscribed Worker. The Router only judges new events that nobody has subscribed to.',
          sfx: 'reveal',
        },
        { t: 'Zundamon: three losses in a row.', v: TEN, sfxAfter: 'chin' },
      ],
    },
    {
      kind: 'recap',
      heading: 'Recap',
      items: [
        { text: 'Moved by the events around it (Triggers), with no waiting for step-by-step instructions' },
        { text: 'Two-stage filter: code drops events fast, a model judges the rest. Policies can be added in words' },
        { text: 'Thread follow-ups go straight to the subscribed Worker (pass-through). Less front-desk load, fewer tokens' },
      ],
      lines: [
        { t: 'Recap. A Super-agent is moved by the events around it: Triggers.', s: 'Recap. A Super agent is moved by the events around it: Triggers.', sfx: 'pop' },
        { t: "With the two-stage filter, code drops events fast, and a model judges only what's left. Policies can be added in plain words.", sfx: 'pop' },
        { t: 'Follow-ups in the same Thread go straight to the subscribed Worker. Less load on the front desk, and fewer tokens.', sfx: 'pop' },
        { t: "Got it! I'll never answer a good morning again!", v: Z, pause: -0.15 },
        { t: 'As a human, please do.', v: T, sfx: 'harisen' },
        { t: 'Zundamon is now slightly better at sieving. The thirty-seven tabs are still open.', v: TEN },
      ],
    },
    {
      kind: 'ending',
      next: { title: 'Packing context, and acting ahead' },
      lines: [
        { t: 'Next time: Zundamon pastes ten thousand lines of logs.', v: TEN },
        { t: 'Every line matters!', v: Z },
      ],
    },
  ],
};
