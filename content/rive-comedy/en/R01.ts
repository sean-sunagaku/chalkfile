import type { LectureL10n } from '../../i18n';

// 英語版の R01。日本語の台本（../R01.ts）に重ねる。ボケは直訳せず、英語で笑えるように作り直した
// （Rive → alive と韻を踏んで「Alive in Concert」、.riv → riv → rib でスペアリブ、ステートマシン → steak machine など）。
// 事実・画面の正しい名前・出典は日本語の台本と同じ。台詞の数は場面ごとに日本語と同じにして、画面の要素が出る台詞（at）を合わせた。
// オープニングの札と副題（section・subtitle）は空にして出さず、天の声の「お笑い版である」の前置きも言わない（comedy.md の「表示は少なく」）。
// 講座をまたぐ天丼（負ける・コンサート）は pstack の英語版と同じ言い方。v を省いた台詞は先生
// 読み: live は動詞の lɪv と読まれることがあるので使わず、韻は alive（əlˈIv）で踏む。.riv は「dot R I V」と読ませる
const Z = 'zundamon' as const;
const ZC = 'zundamon-cry' as const;
const T = 'tsukkomi' as const;
const TEN = 'tennokoe' as const;

export const R01: LectureL10n = {
  source: '0fdd90b1d6f3',
  title: 'What is Rive?',
  summary:
    'Get the gist of Rive through a back-and-forth between Zundamon and the Teacher: the editor that makes motion and the runtimes that run it, the .riv file, state machines, where it runs, and what to watch out for.',
  docs: [
    { title: 'Rive runtimes (official docs: supported platforms, open source and the MIT license)' },
    { title: 'State Machine (official docs)' },
    { title: 'Pricing plans (official)' },
  ],
  quiz: [
    {
      q: "Which statement about Rive's .riv file is correct?",
      choices: [
        'It is exported from the editor, then loaded and run by the runtime in an app, game or website',
        "It's a video file, so all it can do is play and stop",
        'It is a program file that engineers write by hand',
        'It is an image file that only works on websites',
      ],
      explain: 'The art and motion made in the editor are exported to a .riv file, and the official runtime loads it at run time and makes it move.',
    },
    {
      q: 'What is a state machine in Rive?',
      choices: [
        'A machine that grills zunda-mochi',
        'A system that connects animations to each other and sets the conditions (logic) for switching between them',
        'A settings screen for exporting videos',
        'The name of a pricing plan',
      ],
      explain: 'You build states (the animations that play) and the transitions that connect them, visually, inside the editor.',
    },
    {
      q: "What do Rive's official docs say about the official runtimes?",
      choices: ['Only the web version is open source', 'Only people on a paid plan can use them', 'All of them are open source, under the MIT license', 'They do not support Unity or Unreal'],
      explain:
        'Every official runtime uses the MIT license, so they are all open source. But some runtimes do not support certain features, so check the Feature Support page.',
    },
  ],
  takeaways: [
    'Rive is a set: an editor where you make motion, and runtimes that run it in apps, games and on the web',
    'Export from the editor to a .riv file, and the runtime loads and runs it at run time. No need to rebuild the motion in code',
    'State machine = connects animations and sets the conditions for switching between them. The app passes signals and values',
    'The official runtimes are open source (MIT). Feature support and pricing change, so check the official site before you use it',
  ],
  scenes: [
    {
      kind: 'opening',
      section: '',
      title: 'What is Rive?',
      subtitle: '',
      lines: [
        { t: 'What is Rive?', v: 'announcer', pause: 0.3 },
        { t: 'Rive? That rhymes with alive! Zundamon: Alive in Concert! My solo show!', v: Z, pause: -0.15 },
        { t: 'No singing.', v: T, sfx: 'harisen' },
        { t: 'Rive is a tool for making moving illustrations and buttons, and running them just as they are, in apps and on the web.' },
        { t: 'In the minutes that follow, not one line of sample code will appear.', v: TEN },
      ],
    },
    {
      kind: 'points',
      heading: 'The problem: building motion twice',
      items: [
        { title: 'Make motion as a video', body: 'Zundamon, the designer' },
        { title: 'Rebuild it in code', body: 'Zundamon, the engineer' },
        { title: 'Something feels off', body: 'A common mismatch' },
      ],
      lines: [
        { t: 'Motion in apps. Say, the jiggly little bounce a button makes when you press it.' },
        { t: 'As the designer, I made it as a video. So cute!', v: Z },
        { t: 'Then, as the engineer, I rebuilt it in code!', v: Z },
        { t: '…Something feels off.', s: 'Something feels off.', v: ZC, sfxAfter: 'chin', pause: 0.8 },
        { t: 'A team of one. And somehow, still a miscommunication.', v: TEN },
        { t: 'The motion you made and the motion that runs in the app end up as two different things. That is a common problem.' },
      ],
    },
    {
      kind: 'points',
      heading: 'How Rive works: make → export → run',
      items: [
        { title: 'Make it in the editor', body: 'Art and motion, in the Rive editor' },
        { title: 'Export to .riv', body: 'A file you export from the editor' },
        { title: 'Run it with a runtime', body: 'Apps, games and the web load it at run time' },
      ],
      lines: [
        { t: 'Rive comes as a set: a place to make motion, and the machinery to run it.' },
        { t: 'First, you make the art and the motion in the Rive editor.', sfx: 'pop' },
        { t: 'When it is done, you export it as a file in the .riv format.', s: 'When it is done, you export it as a file in the dot R I V format.', sfx: 'pop' },
        { t: 'R… I… V… riv… rib! Spare ribs!', s: 'R. I. V. Riv. Rib! Spare ribs!', v: Z, pause: -0.15 },
        { t: 'Step away from the food.', v: T, sfx: 'harisen' },
        { t: 'Finally, the runtime inside your app, game or website loads that file and makes it move.', sfx: 'pop' },
        { t: 'The motion that was made is the motion that plays. No one need rebuild it in code.', v: TEN, sfx: 'deden' },
        { t: 'But… I loved playing both parts…', s: 'But. I loved playing both parts.', v: ZC },
        { t: 'One part is plenty now.' },
      ],
    },
    {
      kind: 'states',
      heading: 'State machine: switching goes in the file',
      nodes: [
        { code: 'Normal', ja: 'Idle animation' },
        { code: 'Hungry', ja: 'Sad animation' },
        { code: 'Happy', ja: 'Bouncy animation' },
      ],
      edges: [{ label: 'Time passes' }, { label: 'Mochi arrives' }, { label: 'Done eating' }],
      lines: [
        { t: 'And one of the biggest features of Rive is the state machine.' },
        { t: 'A steak machine? Medium rare, please!', v: Z, pause: -0.15 },
        { t: 'No grilling.', v: T, sfx: 'harisen', pause: 0.3 },
        { t: 'It connects one motion to another with lines, and sets the conditions for switching between them.', bgm: 'cut', sfx: 'chime' },
        { t: "Let's build one out of Zundamon's moods.", bgm: 'back' },
        { t: 'My moods are very complicated, you know.', v: Z },
        { t: 'The normal state.', sfx: 'pop' },
        { t: 'When time passes, it moves to the hungry state.', sfx: 'pop' },
        { t: 'When zunda-mochi arrives, I am happy!', s: 'When zunda mochi arrives, I am happy!', v: Z, sfx: 'pop' },
        { t: 'When it is done eating, it goes back to normal.' },
        { t: 'Complicated, they were not.', v: TEN, pause: 0.3 },
        {
          t: 'The app only sends a signal: zunda-mochi has arrived. Which motion to switch to, and how, is all inside the file.',
          s: 'The app only sends a signal: zunda mochi has arrived. Which motion to switch to, and how, is all inside the file.',
          sfx: 'chime',
        },
        { t: 'For a button: idle, pressed, success. The press itself can be picked up inside the file. The app only has to report success.' },
      ],
    },
    {
      kind: 'quiz',
      heading: 'Quiz',
      question: 'With a state machine, do you have to write all the motion switching in code?',
      explain: 'States and switching conditions are built in the editor and go into the .riv. The app passes signals and values',
      lines: [
        {
          t: 'Quiz time. With a state machine, you have to write all the motion switching in code. True or false?',
          s: 'Quiz time. With a state machine, you have to write all the motion switching in code. True, or false?',
          pause: 3.2,
        },
        { t: 'True! In code we trust!', v: Z, pause: -0.15 },
        { t: 'Were you even listening just now?', v: T, sfx: 'harisen' },
        { t: 'The answer is false. The switching conditions are made in the editor, and they are inside the file.', sfx: 'reveal' },
        { t: 'New course, same Zundamon. Still losing.', v: TEN, sfxAfter: 'chin' },
      ],
    },
    {
      kind: 'table',
      heading: 'Where does it run?',
      cite: 'Rive official docs: "Runtimes" (checked Nov 2026)',
      columns: ['Where it runs', 'Official runtimes'],
      rows: [
        { cells: ['Web', 'Web (JS), React'] },
        { cells: ['Mobile apps', 'Apple, Android, React Native, Flutter'] },
        { cells: ['Game engines', 'Unity, Unreal'] },
        { cells: ['Other', 'C++'] },
      ],
      lines: [
        { t: 'So, where does it run? Look at all these official runtimes.' },
        { t: 'The web.', sfx: 'pop' },
        { t: 'Apps on iPhone and Android. Flutter and React Native, too.', sfx: 'pop' },
        { t: 'Game engines: Unity and Unreal.', sfx: 'pop' },
        { t: 'And also, C++.', s: 'And also, C plus plus.', sfx: 'pop' },
        { t: 'Does it run on zunda-mochi, too?', s: 'Does it run on zunda mochi, too?', v: Z, pause: -0.15 },
        { t: 'Run it on a screen, please.', v: T, sfx: 'harisen' },
        {
          t: 'What is more, the official runtimes are all open source, under the MIT license. You can use them at work, too.',
          s: 'What is more, the official runtimes are all open source, under the M I T license. You can use them at work, too.',
          sfx: 'chime',
        },
      ],
    },
    {
      kind: 'big',
      heading: 'Before you use it',
      kicker: 'Check the official docs and website',
      text: 'Feature support and pricing: **check the official site before use**',
      sub: 'Some runtimes do not support every feature',
      lines: [
        { t: 'One last note. Check feature support and pricing on the official site before you use it.', sfx: 'chime' },
        { t: 'Some runtimes do not support certain features. And pricing plans can change, too.' },
        { t: "Zundamon's concert is free, by the way!", v: Z, pause: -0.15 },
        { t: 'There is no concert.', v: T, sfx: 'harisen' },
      ],
    },
    {
      kind: 'recap',
      heading: 'Recap',
      items: [
        { text: 'Rive is a set: an editor that makes motion, and runtimes that run it in apps, games and on the web' },
        { text: 'With a state machine, even the conditions for switching motion go into the .riv. The app just sends signals' },
        { text: 'The official runtimes are open source (MIT). Check feature support and pricing on the official site' },
      ],
      lines: [
        { t: 'Recap. Rive is a set: an editor that makes motion, and runtimes that make it move.', sfx: 'pop' },
        { t: 'With a state machine, even the conditions for switching go into the file. The app just sends signals.', sfx: 'pop' },
        { t: 'The official runtimes are open source. Check feature support and pricing on the official site.', sfx: 'pop' },
        { t: 'Got it! Rive runs on zunda-mochi!', s: 'Got it! Rive runs on zunda mochi!', v: Z, pause: -0.15 },
        { t: 'It does not.', v: T, sfx: 'harisen' },
        { t: 'Zundamon is still, ever so slightly, off.', v: TEN },
      ],
    },
    {
      kind: 'ending',
      closing: "For step-by-step details on making motion, see Rive's official docs",
      lines: [
        { t: "Next time, I'll bring Zundamon to life with Rive!", v: Z },
        { t: 'There are, it should be noted, no such plans.', v: TEN },
      ],
    },
  ],
};
