import type { LectureL10n } from '../../i18n';
import { docsTitles } from './sources';

// 英語版の S06（最終章）。日本語の台本（../S06.ts）に重ねる。ボケは直訳せず、英語で笑えるように作り直した
// （daemon と demon、BYOM → Bring Your Own Mochi、A2A → Z2Z、running gag と止まったままの agents など）。
// 事実・数字・画面の正しい名前・出典は日本語の台本と同じ。v を省いた台詞は先生
// 2 段目の図の場面は、長い台詞を分けた（日本語 13・英語 16）ので、図の要素の at を全部書いた（要素が出る台詞は日本語と同じ）
const Z = 'zundamon' as const;
const T = 'tsukkomi' as const;
const TEN = 'tennokoe' as const;

const CITE = 'DeepSeek Harness team, "Exploring Super-agent Design" (2026)';

export const S06: LectureL10n = {
  source: 'e34a842c17b8',
  title: 'Never stopping, and what is left to solve',
  summary:
    'Split compute, state and environment in two steps: the loop runs in the cloud, state lives in a database, and daemons connect environments where they are. A Watchdog watches from outside, checking not only for failures but for real progress. Then the four problems the article leaves open (scaling, use without sessions, context boundaries and A2A, security), and a wrap-up of the course.',
  docs: docsTitles(['dsh-superagent-article', 'anthropic-managed-agents', 'dsh-superagent-prototype']),
  quiz: [
    {
      q: 'In the article\'s "separating compute, state and environment", what is step 1?',
      choices: [
        "Run the loop's compute in stateless cloud containers, and keep state in a database",
        'Keep your own computer awake at all times',
        'Rebuild the whole execution environment in the cloud',
        'Delete the conversation record every time',
      ],
      explain:
        'Containers can be added, restarted or swapped, and the database remembers where things left off. In step 2, environments stay where they are, connected through daemons.',
    },
    {
      q: "Which is correct about what the article's Watchdog checks?",
      choices: [
        'Only whether the process is alive',
        'Failures such as API errors, plus whether each Worker is really progressing and has not drifted from the goal',
        "People's working hours",
        'The zunda-mochi stock',
      ],
      explain: 'Most trouble is not a stop. The process keeps running, yet it circles in place or drifts from the goal. So a model judges the progress.',
    },
    {
      q: 'What does the article raise as the "security and privacy" problem?',
      choices: [
        'If the cloud loop is hijacked, every connected machine is at risk. Keys must be usable without being seen',
        'Models are not smart enough',
        'The screen colors are hard to read',
        'Too many tabs are open',
      ],
      explain:
        'Event-driven means more untrusted input. If a breach or prompt injection hijacks the loop, the connected machines are at risk. Even without a hijack, a key that enters the window can leak.',
    },
  ],
  takeaways: [
    'A local agent ties compute, state and environment to one machine, so when the machine sleeps everything stops, and it cannot reach environments on other machines',
    'Step 1: run the loop in stateless cloud containers and put state in a database (separating compute from storage)',
    'Step 2: leave environments where they are and connect them with daemons that just run commands and return results. Your own machine (BYOM), cloud machines and on-demand environments alike',
    'Watchdog: a separate conversation outside, woken by scheduled messages. It fixes failures and judges whether each Worker is really progressing and has not drifted from the goal',
    'Open problems: scaling (splitting the Router, long memory), use without sessions, context boundaries and A2A (agent-to-agent communication in general, not the name of a specific protocol), security and privacy (using keys without seeing them)',
  ],
  scenes: [
    {
      kind: 'opening',
      title: 'Never stopping, and what is left to solve',
      lines: [
        { t: 'Chapter 6. Never stopping, and what is left to solve.', s: 'Chapter six. Never stopping, and what is left to solve.', v: 'announcer', pause: 0.3 },
        { t: 'I closed my laptop for lunch, and every one of my agents stopped too.', v: Z, pause: -0.15 },
        { t: 'They stopped in Chapter 1, too.', s: 'They stopped in chapter one, too.', v: T, sfx: 'harisen' },
        { t: 'As promised last time, and just like Chapter 1: everything stopped.', s: 'As promised last time, and just like chapter one: everything stopped.', v: TEN },
        { t: 'In this final chapter: how to split things up and keep watch so the agent keeps running. And the problems the article leaves open.' },
      ],
    },
    {
      kind: 'goals',
      heading: 'Goals for this chapter',
      items: [
        { text: 'Know why we split compute, state and environment' },
        { text: 'Say what the Watchdog watches' },
        { text: 'Understand the open problems, especially security' },
      ],
      lines: [
        { t: 'This chapter has three goals.' },
        { t: 'The final chapter! At last, I will never stop either!', v: Z, pause: -0.15 },
        { t: '…You may still stop for lunch.', s: 'You may still stop for lunch.', v: T, sfx: 'harisen' },
        { t: 'One: know why we split compute, state and environment.', sfx: 'pop' },
        { t: 'Two: be able to say what the Watchdog watches.', sfx: 'pop' },
        { t: 'Three: understand the problems the article leaves open, especially security.', sfx: 'pop' },
      ],
    },
    {
      kind: 'compare',
      heading: 'Separating compute, state and environment',
      cite: CITE,
      left: {
        title: 'A typical local agent',
        sub: 'All 3 tied to one machine',
        items: [{ text: 'Compute: runs the agent loop' }, { text: 'State: the conversation record to keep' }, { text: 'Environment: code, tools, local settings' }],
      },
      right: {
        title: 'Step 1: split compute from state',
        sub: "Computing's separation of compute and storage",
        items: [{ text: 'The loop runs in stateless cloud containers. State goes to a database' }],
      },
      verdict: { text: 'Even when your machine sleeps, the agent keeps running in the cloud' },
      lines: [
        { t: 'Normally, an agent running on your own machine ties three things to that one machine.' },
        { t: 'Compute, which runs the loop.', sfx: 'pop' },
        { t: 'State: the conversation it has to keep.', sfx: 'pop' },
        { t: 'And the environment, where the code and tools are.', sfx: 'pop' },
        { t: "So when the machine sleeps or drops offline, everything stops. And it can't reach environments on other machines either." },
        { t: "My lunch break is my agents' lunch break!", v: Z },
        { t: 'This gag has been running since Chapter 1. The agents have not.', s: 'This gag has been running since chapter one. The agents have not.', v: TEN, sfxAfter: 'chin' },
        { t: 'So the article borrows a classic computer idea, separating compute from storage, and splits things in two steps.', sfx: 'pop' },
        {
          t: 'Step one: the compute that runs the loop goes into stateless cloud containers, and state, like conversations, goes into a database.',
          sfx: 'pop',
        },
        { t: 'Containers can be added, restarted or swapped out. The database remembers where things left off.', sfx: 'chime' },
      ],
    },
    {
      kind: 'flow',
      heading: 'Step 2: connect environments in place',
      cite: CITE,
      groups: [{ label: 'Cloud', at: 0 }],
      nodes: [
        { label: 'Agent loop', sub: 'A stateless container', at: 0 },
        { label: 'Database', sub: 'Conversations and state', at: 0 },
        { label: 'Your own computer', sub: 'Daemon: just runs commands, returns results', at: 4 },
        { label: 'Cloud & on-demand environments', sub: 'Daemon', at: 8 },
      ],
      edges: [{ label: 'Read and write state', at: 0 }, { label: 'Commands', at: 4 }, { at: 8 }],
      lines: [
        { t: 'Now, step two. The loop and the state are already in the cloud.' },
        { t: 'But real workplaces often have uncommitted changes, local keys, internal services and special machines.' },
        { t: 'Rebuilding all of that in the cloud is hard, and things tend to get missed.' },
        { t: "So the environment doesn't move. It stays right where it is, and gets connected." },
        { t: 'Each machine gets just one small resident program: a daemon.', sfx: 'pop' },
        { t: "A daemon? You're moving a demon into my computer?!", v: Z, pause: -0.15 },
        { t: 'It moves in, yes. A demon, no.', v: T, sfx: 'harisen' },
        { t: 'A daemon holds no conversation state. It just runs commands and returns results.' },
        { t: 'Your own computer, cloud machines, on-demand environments: they all connect the same way.', sfx: 'pop' },
        { t: 'Connecting your own machine is what the article calls BYOM: Bring Your Own Machine.', s: 'Connecting your own machine is what the article calls B Y O M: Bring Your Own Machine.' },
        { t: 'Bring Your Own Mochi! A rice-cake potluck!', s: 'Bring Your Own Mochi! A rice cake potluck!', v: Z, pause: -0.15 },
        { t: 'Machine.', v: T, sfx: 'harisen' },
        { t: 'The mochi can stay at home.', v: TEN },
        {
          t: "Even a machine that connects only now and then works: once it does, the cloud agent starts and finishes that machine's jobs on its own.",
          sfx: 'chime',
        },
        { t: 'Anthropic\'s article "Decoupling the brain from the hands" is cited as heading in the same direction.' },
        { t: 'The difference: this team first wants to connect the personal computers people use every day.' },
      ],
    },
    {
      kind: 'points',
      heading: 'Watchdog: watching from outside',
      cite: CITE,
      items: [
        { title: 'A separate conversation, outside', body: 'Woken by messages that arrive on a schedule' },
        { title: 'Fixes infrastructure failures', body: 'API errors, failed state restores. Rechecks temporary ones until fixed' },
        { title: 'Ask and fix, in plain words', body: 'Why did it fail? Fix prompts and event rules while it runs' },
      ],
      lines: [
        { t: 'Running forever takes one more thing: a way to recover on its own from the strange things that happen over a long run.' },
        { t: 'An always-on system that relies only on its own insides rarely stays stable for long. It needs a second, independent review loop outside.' },
        { t: 'The team put that outside, as a separate conversation: the Watchdog. It is woken by messages that arrive on a schedule.', sfx: 'pop' },
        // API と、台詞の頭の A2A は空けずに読ませる（「like A P I」や文頭の「A to A」は、A が冠詞の a と読まれた。2026-11-02 に Kokoro の音素で確かめた）
        {
          t: 'The Watchdog fixes infrastructure failures like API errors or failed state restores, rechecking temporary outside failures until they clear.',
          sfx: 'pop',
        },
        { t: "A watchdog? It's going to bite me, isn't it!", v: Z, pause: -0.15 },
        { t: 'It does not bite.', v: T, sfx: 'harisen' },
        {
          t: 'The Watchdog is a conversation with every tool, so you can ask it why something failed, and add or drop prompts or fix event rules while it runs.',
          sfx: 'pop',
        },
      ],
    },
    {
      kind: 'big',
      heading: 'What the Watchdog really looks for',
      kicker: 'Most trouble is not a stop',
      text: 'Running is **not the same as progressing**',
      sub: 'The process lives, yet circles in place or drifts off the goal. So a model judges progress',
      lines: [
        { t: "But an agent going wrong isn't only about it stopping." },
        { t: "I've been running the whole time! I never stopped!", v: Z, pause: -0.15 },
        { t: 'In circles. For three hours.', v: T, sfx: 'harisen' },
        { t: "Zundamon's Worker had run the same test four hundred times.", v: TEN, sfxAfter: 'chin' },
        { t: 'Running is not the same as progressing.', bgm: 'cut', sfx: 'chime' },
        { t: "So the Watchdog uses a model to judge whether each Worker is really making progress, and hasn't drifted from the overall goal.", bgm: 'back' },
        {
          t: '…Someone who has been watching from outside all along, counting every one of my failures…',
          s: 'Someone who has been watching from outside all along, counting every one of my failures.',
          v: Z,
          pause: 0.4,
        },
        { t: "That's the Narrator!", v: Z, sfx: 'deden' },
        { t: '…Yes. The Narrator was watching from outside all along.', s: 'Yes. The Narrator was watching from outside all along.', v: TEN, pause: 0.4 },
        {
          t: 'The losing streak, the tab count, the Teacher’s long stories. The Narrator is this course’s Watchdog.',
          s: "The losing streak, the tab count, the Teacher's long stories. The Narrator is this course's Watchdog.",
          v: TEN,
        },
        { t: '…So even my old stories were being watched.', s: 'So even my old stories were being watched.', v: T },
      ],
    },
    {
      kind: 'quiz',
      heading: 'Quiz',
      question: 'Is it enough for the Watchdog to check only whether the process is alive?',
      explain: 'Besides failures, it checks whether Workers are really progressing and staying on the goal',
      lines: [
        {
          t: 'Quiz time. The Watchdog only needs to check whether the process is alive. True or false?',
          s: 'Quiz time. The Watchdog only needs to check whether the process is alive. True, or false?',
          pause: 3.2,
        },
        { t: '…False. Something can be running and still not be getting anywhere.', s: 'False. Something can be running and still not be getting anywhere.', v: Z, pause: 0.3 },
        { t: "The answer is false. It also checks whether the work is really progressing, and hasn't drifted from the goal.", sfx: 'reveal' },
        { t: '…Correct.', s: 'Correct.', v: T, sfx: 'correct' },
        { t: 'Wait… I got it right?!', s: 'Wait. I got it right?!', v: Z },
        { t: 'For the first time in any course, Zundamon won a quiz. The losing streak stopped at five.', v: TEN, sfx: 'deden' },
      ],
    },
    {
      kind: 'points',
      heading: 'Problems the article leaves open',
      cite: CITE,
      items: [
        { title: 'Scaling', body: 'When to split the Router, how Workers talk, memory over months' },
        { title: 'Use without sessions', body: 'How to show the work, how people step in midway' },
        { title: 'Context boundaries and A2A', body: 'How much to share, how separate agents talk' },
        { title: 'Security and privacy', body: 'Untrusted input, connected machines, keys' },
      ],
      lines: [
        { t: 'Finally, the problems the article leaves open. There are four.' },
        { t: 'One: scaling. When and how far to split the Router, when Workers should talk directly, and long memory after months of running.', sfx: 'pop' },
        {
          t: 'Two: use without sessions. How to show work, how people step in midway. Chat windows are central partly by historical accident, the article thinks.',
          sfx: 'pop',
        },
        { t: 'No sessions… so no tabs either…?', s: 'No sessions. So, no tabs either?', v: Z },
        {
          t: 'Three: context boundaries and A2A. Big organizations must decide what context to share or keep apart, and separate agents need a safe way to talk.',
          s: 'Three: context boundaries and A to A. Big organizations must decide what context to share or keep apart, and separate agents need a safe way to talk.',
          sfx: 'pop',
        },
        { t: 'A2A… so, Z2Z! Me, talking to me!', v: Z, pause: -0.15 },
        { t: 'Thirty-seven of you? No, thank you.', v: T, sfx: 'harisen' },
        { t: 'Four: security and privacy.', sfx: 'pop' },
      ],
    },
    {
      kind: 'big',
      heading: 'Security: use keys without seeing them',
      cite: CITE,
      kicker: 'Security and privacy',
      text: 'We need a way to **use keys without seeing them**',
      sub: 'A hijacked loop puts every connected machine at risk. Even a key just entering the window can leak',
      lines: [
        { t: 'Going event-driven lets text from all sorts of places move the agent. Untrusted input grows too.' },
        { t: 'The cloud loop and local daemons connect on the assumption of mutual trust. But local machines hold private code, important data and keys.' },
        { t: 'If a server breach or prompt injection hijacks the loop, every connected machine is in danger.' },
        { t: "Keys? Just paste them into the chat. Then they're always handy!", v: Z, pause: -0.15 },
        { t: 'Absolutely not.', v: T, sfx: 'harisen' },
        { t: 'Of all the jokes in this course, that was the most dangerous.', v: TEN, sfxAfter: 'chin' },
        {
          t: "Even without a hijack, a local key in the model's context window can leak in normal use. So the article calls for using keys without seeing them.",
          bgm: 'cut',
          sfx: 'chime',
        },
        {
          t: "This course thinks you can take a first step today: don't follow instructions inside text read from outside, and keep secrets out of the window.",
          bgm: 'back',
        },
      ],
    },
    {
      kind: 'recap',
      heading: 'Recap',
      items: [
        { text: 'Split compute, state, environment: loop in the cloud, state in a database, daemons link environments in place' },
        { text: 'The Watchdog watches from outside: not just running, but making progress' },
        { text: 'Open problems: scaling, use without sessions, context boundaries and A2A, security (use keys unseen)' },
      ],
      lines: [
        {
          t: 'Recap. Split compute, state and environment: the loop in the cloud, state in a database, and environments connected in place by daemons.',
          sfx: 'pop',
        },
        { t: 'The Watchdog watches from outside, checking not just whether things run, but whether they make progress.', sfx: 'pop' },
        {
          t: 'The open problems: scaling, use without sessions, context boundaries and A2A, and security.',
          s: 'The open problems: scaling, use without sessions, context boundaries and A to A, and security.',
          sfx: 'pop',
        },
      ],
    },
    {
      kind: 'big',
      heading: 'Wrapping up the course',
      cite: CITE,
      kicker: 'Not a new theory, but classic computer design applied to agents',
      text: 'People move up from execution details **to judgment and approval**',
      sub: '5 components take on session management and context syncing',
      lines: [
        { t: "The article's summary: this is no new theory, but classic computer design ideas applied to agents." },
        { t: 'As models need us less on single tasks, the bottleneck shifts to human attention. Five components take on session management and context syncing.' },
        { t: 'Then people can move up from the details of execution to judgment and approval.', sfx: 'chime' },
        { t: "No longer a chat window waiting for orders, the agent becomes a collaborator who stays in your workplace. That's how the article ends." },
        { t: "Got it. That's why I closed all my tabs!", v: Z, pause: 0.3 },
        { t: "…Yes. That's the way.", s: "Yes. That's the way.", v: T },
        { t: 'Zundamon has become, ever so slightly, super.', v: TEN, sfx: 'deden' },
      ],
    },
    {
      kind: 'ending',
      closing: "Read the original: the DeepSeek Harness team's article on X",
      lines: [
        { t: "For the record, Zundamon's own Super-agent does not exist yet.", s: "For the record, Zundamon's own Super agent does not exist yet.", v: TEN },
        { t: "Then I'll build one! First, I'll open a tab…", s: "Then I'll build one! First, I'll open a tab.", v: Z },
        { t: 'One more tab.', v: TEN, sfxAfter: 'chin' },
      ],
    },
  ],
};
