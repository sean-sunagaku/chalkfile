import type { LectureL10n } from '../../i18n';
import { docsTitles } from './sources';

// 英語版の S05。日本語の台本（../S05.ts）に重ねる。ボケは直訳せず、英語で笑えるように作り直した
// （半二重・全二重の「二重跳び」→ duplex＝二世帯の家「上の階はぼくのもの」、ツッコむ → straight man）。
// 事実・数字・画面の正しい名前・出典は日本語の台本と同じ。v を省いた台詞は先生。
// グループのチャットの場面は、百語のきまりの台詞を 2 つに分けたので（日本語 14・英語 15）、画面の要素の at を全部書いた
const Z = 'zundamon' as const;
const ZC = 'zundamon-cry' as const;
const T = 'tsukkomi' as const;
const TEN = 'tennokoe' as const;

const CITE = 'DeepSeek Harness team, "Exploring Super-agent Design" (2026)';

export const S05: LectureL10n = {
  source: '0f769585c229',
  title: 'No waiting, and talking to fit the place',
  summary:
    'A plain ReAct loop stops while it waits for a tool (half-duplex). In an async ReAct loop, start() returns at once and the result comes back as a new event (full-duplex). And talking to fit each channel: short in a group chat, packed and tidy on GitHub and in email.',
  docs: docsTitles(['dsh-superagent-article', 'deepseek-harness-readme']),
  quiz: [
    {
      q: 'In a plain ReAct loop, what happens when a slow tool is called with run()?',
      choices: [
        '"Started" comes back right away',
        'The loop stops until the tool finishes, and cannot answer new messages',
        'The tool stops by itself',
        'It listens to people first, then runs the tool',
      ],
      explain: 'With a synchronous call, the loop stops until the tool finishes and returns its result. Talk can only take turns (half-duplex).',
    },
    {
      q: "In the article's async ReAct loop, how does a slow tool's result arrive?",
      choices: [
        'As the return value of start(), after waiting until it finishes',
        'When the tool finishes, it arrives in the conversation as a new event',
        'A person pastes it in by hand',
        'It never arrives',
      ],
      explain:
        'start() returns "Started" at once, and the loop does not wait. When the tool finishes, the result arrives as a new event message. If it runs too long, stop() can halt it.',
    },
    {
      q: 'How does the article recommend replying in a group chat?',
      choices: [
        'Post all the in-progress thinking and every tool log',
        "Notify only when a decision is needed, ask directly, keep conclusions short (the article's example: up to 100 words per reply)",
        'Write as much as a PR description',
        'Never reply',
      ],
      explain:
        "Keep chat light and break into people's work as rarely as you can. In places read later, like GitHub and email, do the opposite: pack in the information and format it well.",
    },
  ],
  takeaways: [
    'A plain ReAct loop that calls a tool with run() stops until the tool finishes, and cannot answer new messages (half-duplex)',
    'Async ReAct loop: start() returns "Started" at once, and the result arrives as a new event. If it runs too long, stop(). New messages can be handled at the end of the current thinking step (full-duplex)',
    'According to the article, DeepSeek Harness has this async mechanism, but it is still off by default (as of the article, 2026-11-01)',
    "Chat: light and short, and notify only when a decision is needed (an example of the article team's firm rule: up to 100 words per reply, as written in the English version of the article)",
    "GitHub, email and documents: pack in the information and format it well (a PR gives the background, what changed and what was verified, following the project's rules)",
  ],
  scenes: [
    {
      kind: 'opening',
      title: 'No waiting, and talking to fit the place',
      lines: [
        { t: 'Chapter 5. No waiting, and talking to fit the place.', s: 'Chapter five. No waiting, and talking to fit the place.', v: 'announcer', pause: 0.3 },
        { t: "I'm running the tests right now. Please don't talk to me until they're done!", v: Z, pause: -0.15 },
        { t: 'Twenty minutes. Not one reply.', v: T, sfx: 'harisen' },
        { t: 'As promised: no reply.', v: TEN },
        { t: 'This chapter looks at how to keep answering people even while slow work runs, and how to talk differently in each place.' },
      ],
    },
    {
      kind: 'goals',
      heading: 'Goals for this chapter',
      items: [
        { text: 'Know why a plain ReAct loop stops' },
        { text: 'Explain an async loop run by start and stop' },
        { text: 'Change reply length and shape per channel' },
      ],
      lines: [
        { t: 'This chapter has three goals.' },
        { t: 'Eighteen more minutes on the tests.', v: Z, pause: -0.15 },
        { t: "…Nobody's waiting.", v: T, sfx: 'harisen' },
        { t: 'One: know why a plain ReAct loop stops.', s: 'One: know why a plain React loop stops.', sfx: 'pop' },
        { t: 'Two: explain an async loop that runs on start and stop.', s: 'Two: explain an asynchronous loop that runs on start and stop.', sfx: 'pop' },
        { t: 'Three: change the length and shape of replies for each channel.', sfx: 'pop' },
      ],
    },
    {
      kind: 'sequence',
      heading: 'A plain ReAct loop: half-duplex',
      cite: CITE,
      actors: [
        { label: 'People', sub: 'Chat' },
        { label: 'Agent', sub: 'ReAct loop' },
        { label: 'Tool', sub: 'Tests, commands' },
      ],
      steps: [
        { label: 'Asks' },
        { label: 'run(), waits until done' },
        { label: "How's it going?" },
        { label: 'Done (20 min later)' },
        { label: 'Finally replies' },
      ],
      lines: [
        { t: 'First, a plain ReAct loop.', s: 'First, a plain React loop.' },
        { t: 'When someone asks, the agent uses a tool.', sfx: 'pop' },
        { t: 'If it calls the tool with run, the loop stops and waits until the tool is done.', sfx: 'pop' },
        { t: 'And if someone talks to it in the meantime…', sfx: 'pop', pause: 0.6 },
        { t: 'No reply. The agent, it seems, is waiting.', v: TEN, sfxAfter: 'chin' },
        { t: 'Only once the tool is done can it finally reply. Talk can only take turns. This is called half-duplex.', sfx: 'pop' },
        { t: 'Half-duplex? Half a house! Dibs on the upstairs!', v: Z, pause: -0.15 },
        { t: 'No moving in.', v: T, sfx: 'harisen' },
        { t: 'Like a walkie-talkie: while one side talks, the other can only wait.' },
      ],
    },
    {
      kind: 'sequence',
      heading: 'An async ReAct loop: full-duplex',
      cite: CITE,
      actors: [
        { label: 'People', sub: 'Chat' },
        { label: 'Agent', sub: 'Async ReAct loop' },
        { label: 'Tool', sub: 'Runs in the background' },
      ],
      steps: [
        { label: 'start()' },
        { label: '"Started" (returns at once)' },
        { label: "How's it going?" },
        { label: '"Testing now. Almost there"' },
        { label: 'Done (arrives as a new event)' },
        { label: 'stop() (if it runs too long)' },
      ],
      lines: [
        { t: 'The article changes how slow tools get called: start and stop.' },
        { t: 'Call start, and right away it answers "Started." The loop keeps going instead of waiting on the tool.', sfx: 'pop' },
        { t: 'Even while the tool runs, it can answer people.', sfx: 'pop' },
        { t: 'When the tool finishes, the result arrives in the conversation as a new event.', sfx: 'pop' },
        { t: 'If it runs too long, the model can also halt it with stop.', sfx: 'pop' },
        { t: "New messages don't wait for the tool. They are handled as soon as the current step of thinking ends. This is full-duplex.", sfx: 'chime' },
        { t: 'Full-duplex? The whole house! Both floors are mine!', v: Z, pause: -0.15 },
        { t: 'Still no moving in.', v: T, sfx: 'harisen' },
        { t: 'Like a phone call: both sides can talk at any time.' },
        {
          t: "According to the article, DeepSeek Harness already has this async mechanism. It just isn't switched on by default yet.",
          s: "According to the article, Deep Seek Harness already has this asynchronous mechanism. It just isn't switched on by default yet.",
        },
      ],
    },
    {
      kind: 'quiz',
      heading: 'Quiz',
      question: "In an async ReAct loop, once start is called, it can't answer anything else until the tool finishes.",
      explain: 'start returns "Started" right away. It can answer people while the tool runs',
      lines: [
        {
          t: "Quiz time. In an async ReAct loop, once start is called, it can't answer anything else until the tool finishes. True or false?",
          s: "Quiz time. In an asynchronous React loop, once start is called, it can't answer anything else until the tool finishes. True, or false?",
          pause: 3.2,
        },
        { t: 'True! Focus is everything!', v: Z, pause: -0.15 },
        { t: 'Spoken like someone who went silent for twenty minutes.', v: T, sfx: 'harisen' },
        { t: 'The answer is false. The start call returns right away. It can answer people while the tool runs.', sfx: 'reveal' },
        { t: 'Zundamon: five losses in a row.', v: TEN, sfxAfter: 'chin' },
      ],
    },
    {
      kind: 'screens',
      heading: 'Talking per channel: the group chat',
      left: {
        label: "Teacher's reply",
        title: 'Sample App dev',
        at: 1,
        blocks: [
          { text: 'Group chat' },
          { text: "Thanks for your question. First, the background: this bug came from last week's change, which swapped the order of the login steps…" },
          { text: 'Tool log 1/48: read a file' },
          { text: 'Tool log 2/48: run the tests' },
          { text: '(continues for 300 words)' },
        ],
        notes: [
          { text: 'Thinking and tool logs, posted **as is**', at: 5 },
          { text: '**Unclear** what needs deciding', at: 6 },
        ],
      },
      right: {
        label: "Zundamon's reply",
        title: 'Sample App dev',
        at: 7,
        blocks: [
          { text: 'Group chat' },
          { text: "I've got 2 ways to fix it." },
          { text: 'A (fast) or B (safe): which one?' },
          { text: 'Details are in the PR.' },
        ],
        notes: [
          { text: 'Asks only what needs deciding, **briefly**', at: 8 },
          { text: 'Details go in the **PR**', at: 8 },
        ],
      },
      lines: [
        { t: 'The other part is where you talk. People talk differently in a group chat, in email, and on GitHub.' },
        { t: 'I tried writing a group chat reply myself.', sfx: 'pop' },
        { t: "Teacher, that's way too long! The scrolling never ends!", v: Z, sfx: 'harisen' },
        { t: '…Sorry.', v: T, pause: 0.3 },
        { t: 'For the first time in this course, Zundamon played the straight man.', v: TEN, sfx: 'deden' },
        { t: 'In a solo terminal, in-progress thinking and tool logs are sometimes useful. Posted to a group as is, they tend to bury everyone in information.', sfx: 'pop' },
        { t: "And nobody can tell what they're being asked to decide.", sfx: 'pop' },
        { t: "Here's what I wrote.", v: Z, sfx: 'pop' },
        {
          t: 'Ask only what needs deciding, directly and briefly. Leave the details in the PR.',
          s: 'Ask only what needs deciding, directly and briefly. Leave the details in the P R.',
          sfx: 'pop',
        },
        { t: "…That's better than mine.", v: T },
        { t: 'The Teacher has lost to Zundamon.', v: TEN, sfxAfter: 'chin' },
        {
          t: "In chat, keep it light and break into people's work as rarely as you can. Notify only when a decision is needed. Ask directly; keep conclusions short.",
          bgm: 'cut',
          sfx: 'chime',
        },
        {
          t: "The article's team had one firm rule: no more than 100 words per reply. They say it was simple, and it worked well.",
          s: "The article's team had one firm rule: no more than one hundred words per reply. They say it was simple, and it worked well.",
        },
        { t: 'So how many words was your reply, Teacher?', v: Z, bgm: 'back' },
        { t: 'Three hundred.', v: TEN, sfxAfter: 'chin' },
      ],
    },
    {
      kind: 'points',
      heading: 'Places read later: pack it in, tidy it up',
      items: [
        { title: 'Chat', body: 'Light and short. Notify only when a decision is needed' },
        { title: 'GitHub, email, docs', body: 'Pack in the information, and format it well' },
        { title: 'PR descriptions', body: "Background, what changed and what was verified, per the project's rules" },
      ],
      lines: [
        { t: 'So what about other places?' },
        { t: 'Chat: light and short.', sfx: 'pop' },
        { t: "In places people read later, like GitHub, email and documents, it's the opposite: pack in the information and format it well.", sfx: 'pop' },
        {
          t: "For a PR, say, you properly write the background of the problem, what you changed, and what you verified, following the project's rules.",
          s: "For a P R, say, you properly write the background of the problem, what you changed, and what you verified, following the project's rules.",
          sfx: 'pop',
        },
        { t: 'My PR description is one word long: "Fixed!"', s: 'My P R description is one word long: Fixed!', v: Z, pause: -0.15 },
        { t: "That's where you go long.", v: T, sfx: 'harisen' },
        { t: 'Zundamon, as it happens, had the short places and the long places exactly backwards.', v: TEN, sfxAfter: 'chin' },
        {
          t: 'With two layers, in-progress thinking and tool logs stay in the Worker, while the Router talks to the outside. Prompts set how to talk per channel.',
          sfx: 'chime',
        },
        { t: 'A personal agent writes polished email drafts and document summaries, ready to use.' },
      ],
    },
    {
      kind: 'recap',
      heading: 'Recap',
      items: [
        { text: 'A plain ReAct loop stops while it waits for a tool (half-duplex)' },
        { text: 'start returns at once, and the result comes as a new event. Too long? stop (full-duplex)' },
        { text: 'Chat: short, only what needs deciding. GitHub and email: packed and tidy' },
      ],
      lines: [
        { t: 'Recap. A plain ReAct loop stops while it waits for a tool.', s: 'Recap. A plain React loop stops while it waits for a tool.', sfx: 'pop' },
        { t: 'Calling start returns at once, and the result arrives as a new event. Too long? Call stop. That way, it can talk without making anyone wait.', sfx: 'pop' },
        { t: 'In chat, keep it short and ask only what needs deciding. GitHub and email get packed in and tidied up.', sfx: 'pop' },
        { t: "Got it! Now I can run my tests and play straight man to the Teacher's long replies, both at once!", v: Z, pause: -0.15 },
        { t: '…Straight man is my job.', v: T },
        { t: 'Zundamon is now slightly more full-duplex. The thirty-seven tabs are still open.', v: TEN },
      ],
    },
    {
      kind: 'ending',
      next: { title: 'Never stopping, and what is left to solve' },
      lines: [
        { t: 'Next time, the final chapter: Zundamon closes the laptop, and everything stops.', v: TEN },
        { t: "It's lunchtime!", v: Z },
      ],
    },
  ],
};
