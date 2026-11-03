import type { LectureL10n } from '../../i18n';
import { docsTitles } from './sources';

// 英語版の S01。日本語の台本（../S01.ts）に重ねる。ボケは直訳せず、英語で笑えるように作り直した
// （スーパーで買い物 → 極秘任務のスーパースパイの使い走り、リアクション芸 → reaction videos など）。
// 事実・画面の正しい名前・出典は日本語の台本と同じ。台詞の数は場面ごとに日本語と同じにして、画面の要素が出る台詞（at）を合わせた。
// 天丼（タブ 37 個・先生は 52 個・連敗・天の声は外から見ている・次回予告）の言い方はシリーズの台本ノートどおり。v を省いた台詞は先生
const Z = 'zundamon' as const;
const ZC = 'zundamon-cry' as const;
const T = 'tsukkomi' as const;
const TEN = 'tennokoe' as const;

const CITE = 'DeepSeek Harness team, "Exploring Super-agent Design" (2026)';

export const S01: LectureL10n = {
  source: '0e2909ca6d9b',
  title: 'What is a Super-agent?',
  summary:
    "The limits of today's way, where a person watches over AI agents one conversation (session) at a time, and the Super-agent idea that goes beyond it. Through Zundamon's back-and-forth, meet the 4 properties and a map of the 5 components behind them.",
  docs: docsTitles(['dsh-superagent-article', 'dsh-superagent-prototype', 'deepseek-harness-readme']),
  quiz: [
    {
      q: 'What did the article name as the limit when running many tasks at once?',
      choices: ['How smart the model is', 'Human attention', 'How fast the computer is', 'The number of zunda-mochi'],
      explain:
        "For one task, the limit is the model's ability. For many tasks at once, it is human attention. In the article team's experience, a person can follow about 3 to 5 sessions at once.",
    },
    {
      q: 'Which is NOT one of the 4 properties of a Super-agent?',
      choices: ['Continuous (ongoing)', 'Productive (fast and high quality)', 'Proactive (acts ahead)', 'Does every job by itself'],
      explain:
        'The four are Continuous, Productive, Proactive and Persistent (never stops). The Router at the front desk does not do the jobs itself; it hands them to the Workers (the two layers, Chapter 2).',
    },
    {
      q: 'Which statement describes this article correctly?',
      choices: [
        'A manual for the current features of DeepSeek Harness',
        'A proposal of design ideas, with part of it released as a research prototype',
        'An introduction to features already shipped as an official product',
        'A peer-reviewed paper',
      ],
      explain:
        'It opens by saying it is an article about design ideas, not an introduction to current features. The README of the prototype (dsh-superagent-prototype) says it is not an official product.',
    },
  ],
  takeaways: [
    "For one task, the limit is the model's ability. For many tasks at once, it is human attention (in the article team's experience, a person can follow 3 to 5 sessions)",
    'Super-agent = one ongoing agent, cut loose from any single session. It keeps context across sessions and moves many jobs forward without mixing them',
    '4 properties: Continuous, Productive, Proactive, Persistent. Built with the system around the agent, not with a single ReAct loop',
    '5 components: two layers, event-driven, full-duplex and multi-channel, separating compute, state and environment, Watchdog',
    'The article is a proposal of design ideas (as of Nov 2026), not an introduction to current product features',
  ],
  scenes: [
    {
      kind: 'opening',
      title: 'What is a Super-agent?',
      lines: [
        { t: 'Chapter 1. What is a Super-agent?', s: 'Chapter one. What is a Super-agent?', v: 'announcer', pause: 0.3 },
        {
          t: 'Super-agent! A super spy, on a top-secret mission to fetch my zunda-mochi rice cakes!',
          s: 'Super agent! A super spy, on a top secret mission to fetch my zunda mochi rice cakes!',
          v: Z,
          pause: -0.15,
        },
        { t: 'No errands.', v: T, sfx: 'harisen' },
        { t: "A Super-agent is a design for an agent that isn't tied to one conversation, and keeps many jobs running, all the time." },
        { t: 'In this course, we unpack a design article published by the DeepSeek Harness team, over six chapters.' },
        { t: 'Note: the Narrator is watching from outside. Always.', v: TEN },
      ],
    },
    {
      kind: 'goals',
      heading: 'Goals for this chapter',
      items: [
        { text: 'Know the limits of running work in one session (conversation)' },
        { text: 'Name the 4 properties of a Super-agent' },
        { text: 'See the map of the 5 components behind those 4' },
      ],
      lines: [
        { t: 'This chapter has three goals.' },
        { t: "I'm going super too! Super Zundamon!", v: Z, pause: -0.15 },
        { t: 'Only the agent goes super.', v: T, sfx: 'harisen' },
        { t: "One: understand the limits of today's way, where work runs inside one conversation.", sfx: 'pop' },
        { t: 'Two: be able to name the four properties of a Super-agent.', sfx: 'pop' },
        { t: 'Three: see the map of the five components that hold them up.', sfx: 'pop' },
      ],
    },
    {
      kind: 'points',
      heading: 'The problem: not enough human attention',
      items: [
        { title: 'Lots of AI sessions open', body: 'One session, one job' },
        { title: 'Which one got which job?', body: 'Sessions are cut off from each other' },
        { title: 'A person can follow 3–5', body: "The article team's experience" },
      ],
      lines: [
        // AI は空けずに読ませる（「A I agents」と空けると、文頭の A が冠詞の a と読まれた。2026-11-02 に Kokoro の音素で確かめた）
        { t: 'AI agents can now push one task forward without a human watching them the whole time.' },
        { t: 'So I opened thirty-seven AI chat tabs! All of them running at once!', s: 'So I opened thirty-seven A I chat tabs! All of them running at once!', v: Z, sfx: 'pop' },
        { t: 'Way too many tabs.', v: T, sfx: 'harisen' },
        { t: '…I forgot which tab I asked to do what.', s: 'I forgot which tab I asked to do what.', v: ZC, pause: 0.5 },
        { t: 'Of the thirty-seven, Zundamon remembered exactly zero.', v: TEN, sfxAfter: 'chin' },
        { t: 'The Teacher, as it happens, has fifty-two tabs open.', v: TEN, sfx: 'deden' },
        { t: "…Please don't say that out loud.", s: "Please don't say that out loud.", v: T, pause: 0.3 },
        { t: 'You too, Teacher!', v: Z },
        { t: "Today's agents treat one conversation, a session, as the unit of work. Sessions are cut off from each other." },
        { t: "In the article team's experience, a person can follow about three to five sessions at once.", sfx: 'pop' },
        { t: "For one task, the limit is the model's ability. But for many tasks at once, the limit is human attention.", bgm: 'cut', sfx: 'chime' },
        { t: 'All my attention goes to zunda-mochi.', s: 'All my attention goes to zunda mochi.', v: Z, bgm: 'back', pause: -0.15 },
        { t: 'Spend it on work.', v: T, sfx: 'harisen' },
      ],
    },
    {
      kind: 'points',
      heading: 'Add connections, and 3 walls remain',
      items: [
        { title: 'Stuck during long work', body: 'Waits until the one session is done' },
        { title: 'Job contexts get mixed', body: 'Separate jobs land in the same session' },
        { title: 'Your machine stops, it all stops', body: 'Sleep, lost signal, a closed lid' },
      ],
      lines: [
        { t: "Then I'll hook the chat, email and GitHub all into my one tab!", v: Z, pause: -0.15 },
        { t: "That tab's overstuffed.", v: T, sfx: 'harisen' },
        {
          t: 'In fact, even a single-session agent on your own machine can get outside notices, if you add a CLI, MCP, or links to outside services.',
          s: 'In fact, even a single session agent on your own machine can get outside notices, if you add a C L I, M C P, or links to outside services.',
        },
        { t: 'But three walls remain. One: during long work, the session stops and waits.', sfx: 'pop' },
        { t: 'Two: talk from separate jobs gets mixed into one session.', sfx: 'pop' },
        { t: 'Three: if your machine sleeps or drops offline, everything stops.', sfx: 'pop' },
        { t: 'So when I closed my laptop for lunch…', v: Z, pause: 0.4 },
        { t: '…the agent, too, went on its lunch break.', s: 'The agent, too, went on its lunch break.', v: TEN, sfxAfter: 'chin' },
        { t: 'On top of that, keeping this setup running takes a lot of human effort.' },
      ],
    },
    {
      kind: 'big',
      heading: 'What a Super-agent is',
      cite: CITE,
      kicker: "The article's answer: cut the agent loose from the one session a human runs by hand",
      text: 'Not one session, but **one individual who keeps going**',
      sub: 'Keeps context across sessions, and runs many jobs at once without mixing them',
      lines: [
        { t: "The article's answer: cut the agent loose from the one session that a human runs by hand." },
        { t: 'Make the agent one individual who keeps going.', sfx: 'chime' },
        { t: 'Talk to it from any conversation, and it remembers what came before. It runs many hard jobs in parallel, without mixing them up.' },
        { t: 'The article calls this agent, together with the system that runs it, a Super-agent.' },
        { t: "One individual who keeps going… that's me!", v: Z, pause: -0.15 },
        { t: "You're the one with thirty-seven tabs open.", v: T, sfx: 'harisen' },
      ],
    },
    {
      kind: 'concepts',
      heading: 'The 4 properties of a Super-agent',
      cite: CITE,
      cards: [
        { ja: 'Ongoing', desc: 'The same one wherever you talk. No need to track which session has what' },
        { ja: 'Fast and high quality', desc: 'Many jobs at once. Takes the next request even mid-task' },
        { ja: 'Acts ahead', desc: 'Watches events and moves only when needed. Otherwise, stays quiet' },
        { ja: 'Never stops', desc: 'Always online. Gets back up by itself when things go wrong' },
      ],
      lines: [
        { t: 'The article lists four properties of a Super-agent.' },
        { t: 'One: Continuous. Whether in the chat or in a GitHub comment, it feels like talking to the same one every time.', sfx: 'pop' },
        {
          t: 'Say you ask for plan A in the chat, then later write “actually, plan B” in a GitHub comment. It notices the change and switches its approach.',
          s: 'Say you ask for plan A in the chat, then later write, actually, plan B, in a GitHub comment. It notices the change, and switches its approach.',
        },
        { t: "I'd make plan A and plan B, and hand in both!", v: Z, pause: -0.15 },
        { t: 'Nobody asked for both.', v: T, sfx: 'harisen' },
        { t: 'Two: Productive. It moves many hard jobs forward at once, and takes the next request even before the last one is done.', sfx: 'pop' },
        { t: "Three: Proactive. It doesn't wait for step-by-step orders. It watches what goes on around it, and moves only where it should.", sfx: 'pop' },
        {
          t: "The article's team says their Super-agent watches the group chat, and sometimes, without being asked, finds a bug's cause and opens a PR to fix it.",
          s: "The article's team says their Super-agent watches the group chat, and sometimes, without being asked, finds a bug's cause and opens a P R to fix it.",
        },
        { t: "Acting ahead? That's my specialty! I'll do everything before anyone even asks!", v: Z, pause: -0.15 },
        { t: "Only when it's needed.", v: T, sfx: 'harisen' },
        { t: 'Four: Persistent. Always online, connected to the real workplace, and if something goes wrong, it gets itself back up.', sfx: 'pop' },
        { t: "I'm always online too! I never sleep!", v: Z, pause: -0.15 },
        { t: 'Please sleep.', v: T, sfx: 'harisen' },
      ],
    },
    {
      kind: 'quiz',
      heading: 'Quiz',
      question: 'With a Super-agent, does the user need to remember which session they asked for what?',
      explain: 'The system takes over managing sessions. The user always talks to the same one',
      lines: [
        {
          t: 'Quiz time. With a Super-agent, the user has to remember which session they asked for what. True or false?',
          s: 'Quiz time. With a Super-agent, the user has to remember which session they asked for what. True, or false?',
          pause: 3.2,
        },
        { t: "True! I'll remember all thirty-seven!", v: Z, pause: -0.15 },
        { t: 'A minute ago, you remembered zero.', v: T, sfx: 'harisen' },
        { t: 'The answer is false. The system takes over managing sessions. The user just talks to the same one, every time.', sfx: 'reveal' },
        { t: 'New course, same Zundamon. Still losing.', v: TEN, sfxAfter: 'chin' },
      ],
    },
    {
      kind: 'table',
      heading: '5 components behind the 4 properties',
      cite: CITE,
      columns: ['Component (chapter)', 'What it does', 'Supports'],
      rows: [
        { cells: ['Two layers (Ch. 2)', 'Splits the front desk from the work', 'Continuous, Productive'] },
        { cells: ['Event-driven (Ch. 3–4)', 'Moves on events and acts ahead', 'Proactive'] },
        { cells: ['Full-duplex, multi-channel (Ch. 5)', 'No waiting; talks to fit the place', 'Continuous, Productive'] },
        { cells: ['Separating compute, state and environment (Ch. 6)', 'Keeps going even if a machine stops', 'Persistent'] },
        { cells: ['Watchdog (Ch. 6)', 'Watches from outside, gets it back up', 'Persistent'] },
      ],
      lines: [
        {
          t: "The article says that just tuning one ReAct loop can't give you all four properties at once.",
          s: "The article says that just tuning one React loop can't give you all four properties at once.",
        },
        { t: "ReAct… reaction videos! I'll film myself gasping at everything!", s: "React. Reaction videos! I'll film myself gasping at everything!", v: Z, pause: -0.15 },
        { t: 'No reaction videos.', v: T, sfx: 'harisen' },
        {
          t: "ReAct is an agent's basic way of working: think, use a tool, look at the result, repeat. The four properties come from the system around it.",
          s: "React is an agent's basic way of working: think, use a tool, look at the result, repeat. The four properties come from the system around it.",
        },
        {
          t: "Component one: two layers. Split the front desk from the work, and get both continuity and speed. That's Chapter 2.",
          s: "Component one: two layers. Split the front desk from the work, and get both continuity and speed. That's chapter two.",
          sfx: 'pop',
        },
        { t: 'Two: event-driven. It moves on events, and acts ahead. Chapters 3 and 4.', s: 'Two: event-driven. It moves on events, and acts ahead. Chapters three and four.', sfx: 'pop' },
        {
          t: 'Three: full-duplex and multi-channel. No one is kept waiting, and it talks to fit each place. Chapter 5.',
          s: 'Three: full duplex and multi channel. No one is kept waiting, and it talks to fit each place. Chapter five.',
          sfx: 'pop',
        },
        { t: 'Four: separating compute, state and environment. It keeps going even when your machine stops.', sfx: 'pop' },
        {
          t: 'Five: the Watchdog, watching from outside. When things go wrong, it gets the agent back up. Those two are Chapter 6.',
          s: 'Five: the Watchdog, watching from outside. When things go wrong, it gets the agent back up. Those two are chapter six.',
          sfx: 'pop',
        },
        { t: "Five? I can't remember five…", v: ZC },
        { t: 'One per chapter.', v: T },
        { t: 'And many of them are borrowed from design ideas that computing has had for a long time.' },
      ],
    },
    {
      kind: 'points',
      heading: 'Notes for reading the article',
      items: [
        { title: 'An article on design ideas', body: 'It says up front it is not about current DeepSeek Harness features' },
        { title: 'Experiments: reference values', body: 'Measured with synthetic loads in a simplified setup' },
        { title: 'The prototype is partial', body: 'A research prototype on GitHub. Not an official DeepSeek product' },
      ],
      lines: [
        {
          t: "One last thing: notes for reading this article. It says at the start that it's about design ideas, not current DeepSeek Harness features.",
          sfx: 'chime',
        },
        { t: 'So I can use all of it, starting tomorrow!', v: Z, pause: -0.15 },
        { t: "You can't.", v: T, sfx: 'harisen' },
        { t: "The article's experiments, too, give reference values, measured with synthetic workloads in a simplified environment.", sfx: 'pop' },
        { t: "A prototype that tries part of the design is public on GitHub. But it says it's a research prototype, not an official DeepSeek product.", sfx: 'pop' },
        { t: "This course is for learning the article's ideas. If you copy them, check first that they fit your own work." },
      ],
    },
    {
      kind: 'recap',
      heading: 'Recap',
      items: [
        { text: 'One task is limited by the model. Many tasks at once are limited by human attention' },
        { text: 'A Super-agent is one ongoing agent, cut loose from any single session' },
        { text: '5 components hold up the 4 properties (Continuous, Productive, Proactive, Persistent)' },
      ],
      lines: [
        { t: "Recap. For one task, the limit is the model's ability. For many tasks at once, the limit is human attention.", sfx: 'pop' },
        { t: 'A Super-agent is one ongoing agent, cut loose from any single session.', sfx: 'pop' },
        { t: 'Continuous, Productive, Proactive, Persistent. Five components hold up those four.', sfx: 'pop' },
        { t: "Got it! I'll never open a thirty-eighth tab!", v: Z, pause: -0.15 },
        { t: 'Close the thirty-seven, too.', v: T, sfx: 'harisen' },
        { t: "Zundamon's thirty-seven tabs are still open.", v: TEN },
      ],
    },
    {
      kind: 'ending',
      next: { title: 'Split the front desk from the work (two layers)' },
      lines: [
        { t: 'Next time: Zundamon works the front desk, and does every job alone.', v: TEN },
        { t: "I haven't even started at the desk yet!", v: Z },
      ],
    },
  ],
};
