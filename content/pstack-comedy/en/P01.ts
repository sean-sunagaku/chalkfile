import type { LectureL10n } from '../../i18n';

// 英語版の P01。日本語の台本（../P01.ts）に重ねる。ボケは直訳せず、英語で笑えるように作り直した（slop・deep-fry・TDD の頭文字など）。
// 事実・画面の正しい名前・出典は日本語の台本と同じ。v を省いた台詞は先生
const Z = 'zundamon' as const;
const ZC = 'zundamon-cry' as const;
const T = 'tsukkomi' as const;
const TEN = 'tennokoe' as const;

export const P01: LectureL10n = {
  source: '1dd22a9b4536',
  title: 'What is pstack?',
  summary:
    'Who made it and the idea behind it, how to start (/add-plugin, /setup-pstack, /poteto-mode), the 23 playbooks, the main skills (/tdd, /interrogate, /arena, /unslop), and what to watch out for.',
  docs: [
    { title: 'pstack README (cursor/plugins on GitHub: install, skills, playbooks and principles)' },
    { title: '/poteto-mode description (GitHub)' },
    { title: 'The 23 playbooks of /poteto-mode (GitHub)' },
    { title: '/setup-pstack description (GitHub)' },
    { title: '/interrogate description (GitHub)' },
    { title: '/arena description (GitHub)' },
  ],
  quiz: [
    {
      q: 'What does /poteto-mode in pstack do?',
      choices: [
        'Picks a playbook that fits the request, turns it into a to-do list, and calls the skills it needs',
        'Teaches you how to fry French fries',
        'Decides which model each role uses and writes it into the settings',
        'Installs the plugin into Cursor',
      ],
      explain:
        '/poteto-mode picks one of 23 playbooks, turns its steps into a to-do list, and calls the skills it needs. Assigning models is /setup-pstack; installing is /add-plugin pstack.',
    },
    {
      q: 'Which statement about /interrogate is correct?',
      choices: [
        'You get a free donut before the questioning',
        'Several models try to break the change, and only findings shown by actually running it remain',
        'It fixes the code on the spot as soon as it finds a problem',
        'A single human reviews the change alone',
      ],
      explain: 'Different models try to break the change, and only findings proven by running it remain. /interrogate itself does not fix the code; it reports the findings.',
    },
    {
      q: "What does pstack's README say?",
      choices: [
        'Planning skills make up the largest group',
        'It can only be installed in Cursor',
        'It can also be installed in Claude Code, but steps that need Cursor-only features are skipped',
        'It has a paid license',
      ],
      explain: 'It also installs as a plugin in Claude Code. Steps that need Cursor-only features such as bugbot or automations show a short note and are skipped. The license is MIT.',
    },
  ],
  takeaways: [
    'pstack is a skill set for how AI agents should work, published by poteto (Lauren Tan), an engineer at Cursor (MIT)',
    'To start: /add-plugin pstack → /setup-pstack (a model for each role) → /poteto-mode',
    '/poteto-mode picks one of 23 playbooks, turns it into a to-do list, and calls the skills it needs',
    '/tdd, /interrogate, /arena and /unslop are there so nothing ships without being checked',
    'Skill counts, names and default models change. Check the README before you use it',
  ],
  scenes: [
    {
      kind: 'opening',
      title: 'What is pstack?',
      lines: [
        { t: 'What is pstack?', s: 'What is P stack?', v: 'announcer', pause: 0.3 },
        { t: 'P-stack! A stack of zunda-mochi rice cakes, piled sky-high!', s: 'P stack! A stack of zunda mochi rice cakes, piled sky high!', v: Z, pause: -0.15 },
        { t: 'No stacking.', v: T, sfx: 'harisen' },
        { t: 'pstack is a bundle of skills that makes AI agents dig deep first, then write less code, and better code.', s: 'P stack is a bundle of skills that makes AI agents dig deep first, then write less code, and better code.' },
      ],
    },
    {
      kind: 'points',
      heading: 'The problem: fast, but unchecked',
      items: [
        { title: '1,000 lines in 3 min', body: 'Asked an AI' },
        { title: 'Does it run? No idea', body: 'Never checked' },
        { title: 'A human fixes it', body: '3 days, later' },
      ],
      lines: [
        { t: 'With an AI agent, code gets written in no time.' },
        { t: 'I asked one too! A thousand lines in three minutes!', v: Z },
        { t: "Does it run? No idea. It's perfect!", v: Z, pause: -0.15 },
        { t: 'Check it.', v: T, sfx: 'harisen' },
        { t: 'The one who spent three days fixing those thousand lines… was Zundamon.', v: TEN, sfxAfter: 'chin' },
        { t: 'Unchecked code ends up being fixed by a human. Sloppy output like this has a name: slop.' },
        { t: 'Slop? That sounds like soup. Yum!', v: Z, pause: -0.15 },
        { t: "You can't drink it.", v: T, sfx: 'harisen' },
      ],
    },
    {
      kind: 'points',
      heading: 'What is pstack?',
      items: [
        { title: 'Who made it', body: 'poteto (Lauren Tan), an engineer at Cursor and a member of the React core team' },
        { title: "What's inside", body: '34 skills, 23 playbooks, 24 principles (as of Nov 2026)' },
        { title: 'Where it lives', body: "Cursor's official plugin collection (cursor/plugins on GitHub). MIT license" },
      ],
      lines: [
        { t: 'pstack was made by Lauren Tan, an engineer at Cursor, known online as poteto.', s: 'P stack was made by Lauren Tan, an engineer at Cursor, known online as potato.' },
        { t: 'Poteto? Potato! A skill set for French fries!', s: 'Potato? Potato! A skill set for French fries!', v: Z, pause: -0.15 },
        { t: 'No frying.', v: T, sfx: 'harisen' },
        { t: 'Zundamon, as always, starts with food.', v: TEN },
        { t: "Inside are the skills the author uses every day. It lives in Cursor's official plugin collection, under the MIT license.", s: "Inside are the skills the author uses every day. It lives in Cursor's official plugin collection, under the M I T license.", sfx: 'pop' },
      ],
    },
    {
      kind: 'big',
      heading: "The author's motto",
      cite: 'pstack README: "if you want to go fast, go deep first" (checked Nov 2026)',
      kicker: "The README's motto",
      text: 'To go fast, **go deep first**',
      sub: 'Dig deep, write less, verify. That is what lets you run many at once',
      lines: [
        { t: "The author's motto: if you want to go fast, go deep first.", bgm: 'cut', sfx: 'chime' },
        { t: 'Dig deep, write less, and verify. That is what lets you run many agents side by side.', bgm: 'back' },
        { t: 'I go shallow, fast, and lots!', v: Z, pause: -0.15 },
        { t: "That's all backwards.", v: T, sfx: 'harisen' },
        { t: 'And that is how the thousand lines were born.', v: TEN },
      ],
    },
    {
      kind: 'points',
      heading: 'Getting started: 3 commands',
      items: [
        { title: '/add-plugin pstack', body: 'Install the plugin' },
        { title: '/setup-pstack', body: 'Pick a model for each role' },
        { title: '/poteto-mode', body: "Hand it work (usually all you'll type)" },
      ],
      lines: [
        { t: 'Getting started is just typing commands in the Cursor chat.' },
        { t: 'First, /add-plugin pstack installs it.', s: 'First, slash add plugin, P stack, installs it.', sfx: 'pop' },
        {
          t: 'Next, /setup-pstack gives each role a model: one writes code, one makes the calls, one reviews.',
          s: 'Next, setup P stack gives each role a model: one writes code, one makes the calls, one reviews.',
          sfx: 'pop',
        },
        { t: 'Then just hand it work with /poteto-mode.', s: 'Then just hand it work with potato mode.', sfx: 'pop' },
        { t: 'Poteto mode! So we ARE frying!', s: 'Potato mode! So we are frying!', v: Z, pause: -0.15 },
        { t: 'Still no frying.', v: T, sfx: 'harisen' },
      ],
    },
    {
      kind: 'flow',
      heading: 'Inside /poteto-mode',
      nodes: [
        { label: 'Your request', sub: 'Like: fix this bug' },
        { label: 'Pick 1 playbook', sub: 'Out of 23 (investigate, fix a bug…)' },
        { label: 'Make a to-do list', sub: 'Copy the steps as they are' },
        { label: 'Call the skills it needs', sub: '/tdd, /arena, /unslop…' },
        { label: 'Open a PR at the end', sub: 'When the work changes code' },
      ],
      lines: [
        { t: '/poteto-mode starts by reading your request.', s: 'Potato mode starts by reading your request.' },
        { t: 'It picks the best fit out of twenty-three playbooks.', sfx: 'pop' },
        { t: 'It turns those steps into a to-do list and works through it.', sfx: 'pop' },
        { t: 'It calls the skills it needs, and if the work changes code, it opens a PR at the end.', s: 'It calls the skills it needs, and if the work changes code, it opens a P R at the end.', sfx: 'pop' },
        { t: 'In other words, humans need not memorize which skill to use.', v: TEN, sfx: 'deden' },
        { t: 'But I memorized all twenty-three…', v: ZC, pause: 0.5 },
        { t: 'Number one?', v: T },
        { t: '…Zunda-mochi.', s: 'Zunda mochi.', v: ZC, sfxAfter: 'zuko' },
      ],
    },
    {
      kind: 'table',
      heading: 'The main skills',
      cite: 'pstack README and each skill description (checked Nov 2026, v0.15.36)',
      columns: ['Skill', 'What it does'],
      rows: [
        { cells: ['/tdd', 'Test-driven development. First write a test that fails on the bug, then fix it'] },
        { cells: ['/interrogate', 'A grilling review. Several models try to break it; only reproduced findings stay'] },
        { cells: ['/arena', 'A contest. Many tries at one task; the best one borrows good parts from the rest'] },
        { cells: ['/unslop', 'Removes slop (sloppy output). Strips AI-sounding phrases from writing'] },
      ],
      lines: [
        { t: 'Now, the main skills.' },
        { t: 'First, /tdd. Before you fix anything, write a test that fails because of the bug.', s: 'First, T D D. Before you fix anything, write a test that fails because of the bug.', sfx: 'pop' },
        { t: 'TDD! Totally Definitely Done!', s: 'T D D! Totally, definitely, done!', v: Z, pause: -0.15 },
        { t: 'The worst kind there is.', v: T, sfx: 'harisen' },
        {
          t: 'Next, /interrogate. Different models try to break the change, and only findings proven by running it survive.',
          s: 'Next, interrogate. Different models try to break the change, and only findings proven by running it survive.',
          sfx: 'pop',
        },
        { t: 'Interrogate? Like a cop show! Do I get a free donut?', v: Z, pause: -0.15 },
        { t: 'No donuts.', v: T, sfx: 'harisen' },
        { t: 'Then /arena. Many runs take on the same task side by side, and the best parts get merged into one.', s: 'Then, arena. Many runs take on the same task side by side, and the best parts get merged into one.', sfx: 'pop' },
        { t: 'Arena! At last, my first arena concert!', v: Z, pause: -0.15 },
        { t: 'No concert.', v: T, sfx: 'harisen' },
        { t: 'New course, same Zundamon. Still dreaming of that concert.', v: TEN },
        { t: 'Finally, /unslop. It strips AI-sounding phrases out of your writing.', s: 'Finally, unslop. It strips AI sounding phrases out of your writing.', sfx: 'pop' },
        { t: 'Unslop… un…', s: 'Unslop. Un.', v: Z, sfxAfter: 'drumroll', pause: 1.5 },
        { t: '…I got nothing.', s: 'I got nothing.', v: ZC, sfxAfter: 'chin', pause: 0.6 },
        { t: "The most honest thing you've said all day.", v: T, sfx: 'harisen' },
        { t: 'All four exist so that nothing ships without being checked.', bgm: 'cut', sfx: 'chime' },
      ],
    },
    {
      kind: 'quiz',
      heading: 'Quiz',
      question: 'With /poteto-mode, does a human pick which skill to use every time?',
      explain: '/poteto-mode picks the playbook and calls the skills it needs',
      lines: [
        {
          t: 'Quiz time. With /poteto-mode, does a human pick which skill to use every time? True or false?',
          s: 'Quiz time. With potato mode, does a human pick which skill to use every time? True, or false?',
          pause: 3.2,
        },
        { t: "True! I'll pick from all twenty-three!", v: Z, pause: -0.15 },
        { t: 'A minute ago, the only one you could name was zunda-mochi.', s: 'A minute ago, the only one you could name was zunda mochi.', v: T, sfx: 'harisen' },
        { t: 'The answer is false. /poteto-mode picks both the playbook and the skills.', s: 'The answer is false. Potato mode picks both the playbook and the skills.', sfx: 'reveal' },
        { t: 'New course, same Zundamon. Still losing.', v: TEN, sfxAfter: 'chin' },
      ],
    },
    {
      kind: 'points',
      heading: 'Before you use it',
      items: [
        { title: 'Usage adds up fast', body: 'Skills that run in parallel use several models at once' },
        { title: 'Cursor-only parts', body: 'In Claude Code, steps that need Cursor-only features are skipped' },
        { title: "The author's style is strong", body: "No planning skill. If it doesn't fit, build your own with /automate-me" },
      ],
      lines: [
        { t: 'One last thing: what to watch out for before you use it.', sfx: 'chime' },
        { t: 'Skills that run in parallel keep several models busy at once.', sfx: 'pop' },
        { t: 'It installs in Claude Code too, but steps that need Cursor-only features get skipped.', sfx: 'pop' },
        { t: "And the author's way of working is baked in. There's no skill just for planning.", sfx: 'pop' },
        { t: 'No planning… just like me!', v: Z, pause: -0.15 },
        { t: 'Do not lump yourself in with that.', v: T, sfx: 'harisen' },
        { t: "The author would rather show it in code than plan it. For planning, it pairs with Cursor's plan mode." },
        { t: "If it doesn't fit, /automate-me builds a mode of your own from your recent chats.", s: "If it doesn't fit, automate me builds a mode of your own from your recent chats." },
      ],
    },
    {
      kind: 'recap',
      heading: 'Recap',
      items: [
        { text: "pstack: a Cursor engineer's skill set for how AI agents should work (MIT)" },
        { text: 'Day to day, just /poteto-mode. It picks a playbook and calls the skills' },
        { text: '/tdd, /interrogate, /arena and /unslop stop unchecked work. Watch usage and the Cursor-only parts' },
      ],
      lines: [
        { t: 'Recap. pstack is a skill set that makes agents dig deep, then write less, better code.', s: 'Recap. P stack is a skill set that makes agents dig deep, then write less, better code.', sfx: 'pop' },
        { t: 'Day to day, just /poteto-mode. It picks a playbook and calls the skills it needs.', s: 'Day to day, just potato mode. It picks a playbook and calls the skills it needs.', sfx: 'pop' },
        { t: 'The main skills keep unchecked work from shipping. Watch your usage, and the Cursor-only parts.', sfx: 'pop' },
        { t: 'Got it! Go deep first… so: deep-fry the potatoes!', s: 'Got it! Go deep first. So, deep fry the potatoes!', v: Z, pause: -0.15 },
        { t: 'No frying.', v: T, sfx: 'harisen' },
        { t: 'Well. The "deep" part was right.', v: TEN },
      ],
    },
    {
      kind: 'ending',
      closing: "For details, see pstack's README (cursor/plugins on GitHub)",
      lines: [
        { t: "Next, I'll use /automate-me to build Zundamon Mode!", s: "Next, I'll use automate me to build Zundamon mode!", v: Z },
        { t: 'It will, naturally, overdo everything.', v: TEN },
      ],
    },
  ],
};
