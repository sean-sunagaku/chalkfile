import type { LectureL10n } from '../../i18n';
import { docsTitles } from './sources';

// 英語版の W01。日本語の台本（../W01.ts）に重ねる。ボケは直訳せず、英語で笑えるように作り直した
// （ナッジ → ナッツ入りは nudge → fudge、セイラー → 船乗りは Thaler → tailor、監禁・買収・詐欺は Hostage-taking・Bribery・Fraud の罪名で
// 「Three ideas, three crimes.」、地味でいいんです → Boring is good）。
// 事実・画面の正しい名前・出典は日本語の台本と同じ。台詞の数は場面ごとに日本語と同じにして、画面の要素が出る台詞（at）を合わせた。
// Thaler は経済学者の読み（テイラー）で読ませるため、s では Taylor と書く。v を省いた台詞は先生
const Z = 'zundamon' as const;
const ZC = 'zundamon-cry' as const;
const T = 'tsukkomi' as const;
const TEN = 'tennokoe' as const;

const APP = 'Sample Budget';

export const W01: LectureL10n = {
  source: 'df4fece261f5',
  title: 'What is a nudge?',
  summary:
    "The comedy version of Chapter 1 of the nudge course. As the Teacher gives each of Zundamon's over-the-top ideas a name (coercion, money, dark patterns), learn how they differ from nudges, and the 3 conditions of a good nudge.",
  docs: docsTitles(['thaler-sunstein-2008', 'thaler-2015-nyt', 'dellavigna-linos-2022', 'ftc-2022-dark-patterns', 'caa-tokushoho-2022', 'thaler-2018-sludge']),
  quiz: [
    {
      q: 'Which one fits the definition of a nudge?',
      choices: [
        "You can't go on to the next screen until you turn notifications on",
        'Give 300 points to people who turn notifications on',
        'Say what arrives, when and how often, and show "Don\'t notify me" at the same size',
        'Make "Not now" small and faint, so it is hard to notice',
      ],
      explain:
        '1 forbids an option, so it is coercion. 2 changes the financial gains and losses, so it leans toward a financial incentive (a small amount is borderline by definition). 4 makes the way to say no hard to see, so it is a dark pattern. 3 keeps the freedom to choose while making the choice easier.',
    },
    {
      q: 'What does "no screen is neutral" mean?',
      choices: [
        "Every screen shows the designer's personal taste",
        'The default, order, wording and effort are always set to something, and that affects how people choose',
        'Every screen is deceiving its users',
        "You can't build a screen without running an A/B test",
      ],
      explain:
        'Build a screen, and what happens when nobody chooses (the default), the order of the buttons, the wording and the number of steps are always decided. You cannot bring the influence down to zero, so the starting point is to design it in the direction that helps the user.',
    },
    {
      q: 'What can research tell us about the effect of nudges?',
      choices: [
        'Add a nudge, and any service grows by tens of percent',
        'It has been proven that nudges have no effect at all',
        'Government field trials showed a smaller average effect than studies in academic journals. You need to measure and check in your own service',
        'Nudges that change the default always backfire',
      ],
      explain:
        "126 trials by 2 nudge units averaged 1.4 points; studies in academic journals averaged 8.7 points (DellaVigna & Linos, 2022). The effect changes with the setting, and can even backfire.",
    },
  ],
  takeaways: [
    'Every screen has choice architecture (default, order and prominence, wording, effort). You cannot build a neutral screen',
    'Nudge = making a choice easier without banning options or greatly changing the money at stake. Keep it apart from coercion, financial incentives and dark patterns',
    "3 conditions of a good nudge: transparent and not misleading, easy to refuse, and you can say it is for the person's own good (Thaler, 2015)",
    'The effect is not guaranteed. Field trials averaged 1.4 points (DellaVigna & Linos, 2022). Measure and check in your own service',
  ],
  scenes: [
    {
      kind: 'opening',
      // 札と副題は出さず、天の声も「お笑い版である」と名乗らない（comedy.md の「表示は少なく」。日本語の W01 は決まりの前に作ったまま）
      section: '',
      title: 'What is a nudge?',
      subtitle: '',
      lines: [
        { t: 'Chapter 1. What is a nudge?', s: 'Chapter one. What is a nudge?', v: 'announcer', pause: 0.3 },
        { t: "I'm Zundamon! Nudge? Sounds like fudge! Zunda-mochi fudge!", s: "I'm Zundamon! Nudge? Sounds like fudge! Zunda mochi fudge!", v: Z, pause: -0.15 },
        { t: 'Step away from the food.', v: T, sfx: 'harisen' },
        { t: "I'm your teacher. And starting today, I'm also in charge of the comebacks." },
        {
          t: 'The claims and sources here match the serious nudge course. The only difference: this one has Zundamon.',
          v: TEN,
        },
      ],
    },
    {
      kind: 'goals',
      heading: 'Goals for this chapter',
      items: [
        { text: 'Notice the "choice architecture" in your own screens' },
        { text: 'Tell nudges apart from coercion, money and dark patterns' },
        { text: 'Check your own measures against the 3 conditions of a good nudge' },
      ],
      lines: [
        { t: 'This chapter has three goals.' },
        { t: 'A hundred percent notification opt-in!', v: Z, pause: -0.15 },
        { t: "That's your quota.", v: T, sfx: 'harisen' },
        { t: 'One. Notice the design of choices that is already there in your own screens.', sfx: 'pop' },
        { t: 'Two. Tell nudges apart from coercion, money, and dark patterns.', sfx: 'pop' },
        { t: 'Three. Check your own measures against the three conditions of a good nudge.', sfx: 'pop' },
      ],
    },
    {
      kind: 'phone',
      heading: "The problem: good intentions that don't last",
      screens: [
        {
          brand: APP,
          brandSub: 'A fictional app',
          title: 'Get notifications?',
          lead: 'First-time setup 3 / 3',
          body: ["Once a week, we'll remind you it's time to review"],
          primary: 'Notify me',
          secondary: 'Not now',
          caption: 'Few people turn notifications on during setup',
        },
        {
          brand: APP,
          brandSub: 'A fictional app',
          title: "This week's review",
          lead: 'Sunday',
          body: ['Expenses logged: 3', '¥8,200 left in your budget'],
          primary: 'Start review',
          caption: 'From week 2, fewer and fewer people open the review',
        },
      ],
      lines: [
        { t: `${APP}, a fictional household budgeting app. Zundamon has just been put in charge of it.`, v: TEN },
        { t: 'My job is to get people to turn on the weekly review notification!', v: Z },
        { t: 'But hardly anyone turns it on…', v: ZC },
        { t: 'Some people tap "Don\'t Allow" on every notification prompt, without a second thought. You know the type.', pause: 0.5 },
        { t: "…That's me.", s: "That's me.", sfxAfter: 'zuko' },
        { t: "Teacher, you're the enemy?!", v: Z, pause: 0.2 },
        { t: 'What is more, from week two, fewer and fewer people even open the review screen.', v: TEN },
        { t: "They started because they wanted to rethink their spending, yet they can't keep it up. A very common problem.", pause: -0.1 },
      ],
    },
    {
      kind: 'table',
      heading: "Zundamon's 4 ideas",
      columns: ["Zundamon's idea", 'Comeback', 'Correct name'],
      rows: [
        { cells: ["The app won't open until you turn it on", 'Hostage-taking', 'Coercion'] },
        { cells: ['10,000 points for turning it on', 'Bribery', 'Money (financial incentive)'] },
        { cells: ['"Not now" shrunk to magnifying-glass size', 'Fraud', 'Dark pattern'] },
        { cells: ["(Couldn't think of one)", '—', 'Nudge'] },
      ],
      lines: [
        { t: 'I came up with four ways to get people to turn notifications on!', v: Z },
        { t: "Let's hear them." },
        { t: "One! The app won't open until you turn notifications on!", v: Z, pause: -0.15 },
        { t: 'Hostage-taking.', v: T, sfx: 'harisen' },
        { t: 'Two! Hand out ten thousand points to everyone who turns them on!', v: Z, pause: -0.15 },
        { t: 'Bribery.', v: T, sfx: 'harisen' },
        { t: 'Three! Make the "Not now" button so tiny you need a magnifying glass to see it!', v: Z, pause: -0.15 },
        { t: 'Fraud.', v: T, sfx: 'harisen', pause: 0.2 },
        { t: 'And number four is…', v: Z, sfxAfter: 'drumroll', pause: 1.5 },
        { t: "…I couldn't think of one.", s: "I couldn't think of one.", v: ZC, sfxAfter: 'chin', pause: 0.9 },
        { t: 'Three ideas. Three crimes.', v: T, sfx: 'harisen', pause: 0.4 },
        { t: 'But all three would raise the opt-in rate!', v: Z },
        { t: "They might. The difference is the freedom to choose, and whether it's for the user." },
        { t: 'Indeed. The fourth idea, the one that never came, is the nudge.', v: TEN, sfx: 'deden', bgm: 'cut', pause: 0.3 },
        { t: 'Say what will arrive, and put the decline button beside it, at the same size.', sfx: 'chime' },
        { t: 'Keep the freedom to choose, and make choosing easier. That is a nudge.' },
        { t: "Zundamon's score: nought out of four.", v: TEN, bgm: 'back' },
      ],
    },
    {
      kind: 'big',
      heading: 'What a nudge is',
      cite: 'Summary of the definition in Thaler & Sunstein, "Nudge" (2008)',
      kicker: 'Proposed by behavioral economist Thaler and legal scholar Sunstein',
      text: 'A way to change behavior **without banning** options or **greatly changing** the money at stake',
      sub: 'Anyone who wants to avoid it can do so easily and cheaply',
      lines: [
        {
          t: 'Nudging is an idea made popular by behavioral economist Thaler and legal scholar Sunstein, in a 2008 book.',
          s: 'Nudging is an idea made popular by behavioral economist Taylor and legal scholar Sunstein, in a 2008 book.',
        },
        { t: 'Thaler… so, a tailor? He makes suits?', s: 'Taylor. So, a tailor? He makes suits?', v: Z, pause: -0.15 },
        { t: 'A Nobel Prize-winning economist.', v: T },
        { t: 'So what does nudge mean?', v: Z },
        { t: "It means a light poke with your elbow, to get someone's attention." },
        { t: "So if I poke the users with my elbow, they'll turn notifications on?", v: Z, pause: -0.15 },
        { t: 'No physical poking.', v: T, sfx: 'harisen' },
        {
          t: 'In short, their definition: a way to steer behavior in a predictable direction, without banning options or greatly changing the money at stake.',
          sfx: 'chime',
        },
        { t: "What matters is that anyone who wants to avoid it can do so easily and cheaply. That's how it differs from an order." },
      ],
    },
    {
      kind: 'concepts',
      heading: 'Choice architecture: no screen is neutral',
      cards: [
        { ja: 'Default setting', desc: 'What happens if you choose nothing' },
        { ja: 'Order and prominence', desc: 'Which comes first, and looks biggest' },
        { ja: 'Wording', desc: 'How you say the same fact' },
        { ja: 'Effort', desc: 'How many taps it takes to get there' },
      ],
      lines: [
        { t: 'The foundation of nudging is choice architecture: the design of the moments when people choose.' },
        { t: "Our screens aren't rigged at all, so they're neutral!", v: Z },
        { t: 'Then if no one chooses anything, what happens to notifications?', sfx: 'pop' },
        { t: '…They stay off.', s: 'They stay off.', v: Z },
        { t: "That's the default. It has already been decided." },
        { t: 'Which button comes first, and looks bigger?', sfx: 'pop' },
        { t: 'I made the "Turn on" button fill the whole screen!', v: Z, pause: -0.15 },
        { t: "Then don't call it neutral.", v: T, sfx: 'harisen' },
        { t: 'What words do you use to say the same fact?', sfx: 'pop' },
        { t: 'How many taps does it take to get there?', sfx: 'pop' },
        { t: 'It was all decided already…', v: ZC },
        { t: "Build a screen, and these four will always be set to something. So you can't build a neutral screen.", sfx: 'chime' },
        { t: 'The only one who believed it was neutral, it seems, was Zundamon.', v: TEN },
        { t: "If it's going to have an influence anyway, point it in a direction that helps the user. That's where nudging begins." },
      ],
    },
    {
      kind: 'points',
      heading: '3 conditions of a good nudge',
      items: [
        { title: 'Transparent', body: "Doesn't hide what it does, and can be explained" },
        { title: 'Easy to refuse', body: 'You can opt out as easily as possible (ideally in one action)' },
        { title: 'For their own good', body: "You can say it makes the chooser's life better" },
      ],
      lines: [
        { t: 'How to tell a good nudge. Thaler gives three conditions.', s: 'How to tell a good nudge. Taylor gives three conditions.' },
        { t: "One: it's transparent. You can explain what it's doing, without hiding anything.", sfx: 'pop' },
        { t: "The magnifying-glass button… if I explained that, I'd get in trouble.", v: ZC },
        { t: "Two: it's easy to refuse. If you don't want it, you can get out as easily as possible.", sfx: 'pop' },
        { t: "Without a magnifying glass, you can't even say no.", v: Z },
        { t: "Three: it's for the person's own good. You can say, with reasons, that it makes the chooser's life better.", sfx: 'pop' },
        { t: "It'll make my performance review better!", v: Z, pause: -0.15 },
        { t: "It's for their good, not yours.", v: T, sfx: 'harisen' },
        { t: 'Three conditions. Not one met.', v: TEN, sfxAfter: 'chin', pause: 0.6 },
        { t: 'In this course, if any one of them is missing, we consider it to be moving away from a nudge, toward a dark pattern.', sfx: 'chime' },
      ],
    },
    {
      kind: 'screens',
      heading: 'Bad and good: the notification screen',
      left: {
        label: "Zundamon's masterpiece",
        title: APP,
        blocks: [
          { text: "Turn on notifications, or you'll lose out!" },
          { text: 'Lots of people have already turned them on.' },
          {},
          { text: 'Turn on notifications' },
          { text: "I don't mind losing out" },
        ],
        notes: [
          { text: 'The decline button pushes **guilt** on you' },
          { text: 'The way to decline is **small and faint**' },
          { text: "**Doesn't say** what you'll get" },
          { text: 'A baseless **"everyone does it"**' },
        ],
      },
      right: {
        label: 'Good example',
        title: APP,
        blocks: [
          { text: "We'll let you know once a week when it's time to review" },
          { text: "Only once, Sundays at 8 p.m. You'll get this week's spending." },
          { text: 'You can change this anytime in Settings.' },
          {},
          { items: [{ text: "Don't notify me" }, { text: 'Notify me' }] },
        ],
        notes: [
          { text: '**Specific** about what, when and how often' },
          { text: 'Says you **can change it anytime**' },
          { text: 'Saying no is **the same size**, side by side' },
        ],
      },
      lines: [
        { t: 'I learned the conditions, so I rebuilt the screen. Perfect!', v: Z },
        { t: "…The decline button says \"I don't mind losing out.\"", s: "The decline button says, I don't mind losing out." },
        { t: 'Guilt makes it harder to press. Genius!', v: Z, pause: -0.15 },
        { t: "That's not genius. That's a con.", v: T, sfx: 'harisen' },
        { t: "And the button is small and faint. It doesn't even say what you'll get." },
        { t: 'It says lots of people have already turned it on. Is that true?' },
        { t: "…That's just my feeling.", s: "That's just my feeling.", v: ZC, pause: -0.1 },
        { t: 'Your feelings are not statistics.', v: T, sfx: 'harisen' },
        { t: 'It was not, in fact, perfect.', v: TEN, pause: 0.3 },
        { t: 'The good example says exactly what arrives, when, and how often.', sfx: 'pop' },
        { t: 'It also says you can change it anytime in Settings.', sfx: 'pop' },
        { t: 'And the "Don\'t notify me" button is the same size. The choice is the user\'s.', sfx: 'chime' },
        { t: "It's so… boring.", v: ZC },
        { t: 'Boring is good.' },
      ],
    },
    {
      kind: 'quiz',
      heading: 'Quiz',
      question: 'Making cancellation deliberately long, so fewer people cancel. Is this a nudge?',
      explain: 'Reverse friction that makes saying no harder. It is called sludge, or a dark pattern',
      lines: [
        { t: 'Quiz time. Making cancellation deliberately long, so fewer people cancel. Is this a nudge? True or false?', pause: 3.2 },
        { t: "True! Fewer cancellations, so everyone's happy!", v: Z, pause: -0.15 },
        { t: "The only one who's happy is you.", v: T, sfx: 'harisen' },
        { t: "The answer is false. It isn't for the user. It just makes saying no harder.", sfx: 'reveal' },
        { t: 'Thaler calls this kind of reverse friction sludge, as in thick, dirty mud.', s: 'Taylor calls this kind of reverse friction sludge, as in thick, dirty mud.' },
        { t: 'Reduced to sludge…', v: ZC },
      ],
    },
    {
      kind: 'quiz',
      heading: 'Quiz',
      question: 'Giving 300 points to people who turn notifications on. Is this a nudge?',
      explain:
        'It changes the financial gains and losses, so it leans toward a financial incentive. A small amount sits on the edge of the definition, but this course treats it as a separate tool',
      lines: [
        { t: 'One more. Ten thousand points was bribery. So, three hundred points: is that a nudge?', pause: 3.2 },
        { t: 'Three hundred is just pocket money. True!', v: Z },
        { t: "The answer is false. It changes the financial gains and losses, so it's closer to a financial incentive.", sfx: 'reveal' },
        { t: 'You could call a small amount borderline by definition, but it costs money and draws in point hunters, so this course treats it as a separate tool.' },
        { t: 'Zundamon: two losses in a row.', v: TEN, sfxAfter: 'chin' },
      ],
    },
    {
      kind: 'numbers',
      heading: 'The effect is not guaranteed',
      items: [
        { label: 'Average of 126 trials by nudge units', suffix: ' points' },
        { label: 'Average of studies in academic journals', suffix: ' points' },
      ],
      footnote: { text: 'Points = the difference in percentages (e.g., 20% becomes 21.4%). Varies widely with the type of behavior and the setting' },
      lines: [
        { t: 'With this, a hundred percent opt-in is guaranteed!', v: Z },
        { t: 'Sadly, a nudge is not magic with a guaranteed effect.' },
        {
          t: 'A study pooling 126 trials by two U.S. nudge units, which run trials with governments, found an average effect of 1.4 points.',
          sfx: 'tick',
        },
        { t: 'So… not a hundred?', v: ZC, pause: -0.1 },
        { t: 'Not even close.', v: T },
        {
          t: 'Studies in academic journals averaged 8.7 points. A big reason for the gap is said to be that studies with large effects get published more easily.',
          sfx: 'tick',
        },
        { t: "Their strength is that they're cheap to try. But they may not work, or may even backfire. So measure and check in your own service.", sfx: 'chime' },
        { t: 'A hundred percent remains a long way off.', v: TEN },
      ],
    },
    {
      kind: 'big',
      heading: 'Exercise',
      kicker: 'Pause the video: 5 minutes',
      text: 'Pick **1 screen** in your own service and write down its 4 parts',
      sub: 'Default, order and prominence, wording, effort → check with the 3 conditions',
      lines: [
        { t: 'Now, an exercise. Pause the video and spend just five minutes on it.' },
        { t: 'If you pause it, I get less screen time!', v: Z, pause: -0.15 },
        { t: 'Pause it.', v: T, sfx: 'harisen' },
        { t: 'Pick one screen in your own service, and write down its default, order, wording and effort.', sfx: 'chime' },
        { t: "Then check them against the three conditions. Detailed steps and a sample answer are in the serious version's exercise, in Japanese." },
      ],
    },
    {
      kind: 'recap',
      heading: 'Recap',
      items: [
        { text: 'Every screen has choice architecture. No screen is neutral' },
        { text: 'A nudge keeps the freedom to choose and makes choosing easier. Not coercion, money or dark patterns' },
        { text: "A good nudge is transparent, easy to refuse, and for the person's own good. Measure to check the effect" },
      ],
      lines: [
        { t: "Recap. Every screen has choice architecture. You can't build a neutral screen.", sfx: 'pop' },
        { t: "A nudge keeps the freedom to choose, while making choosing easier. It's not coercion, money, or a dark pattern.", sfx: 'pop' },
        { t: "A good nudge is transparent, easy to refuse, and for the person's own good. And you measure to check the effect.", sfx: 'pop' },
        { t: 'Got it! Boring is good!', v: Z, pause: 0.2 },
        { t: "…That's my line.", s: "That's my line.", v: T, sfx: 'harisen' },
        { t: 'Zundamon has grown. A little.', v: TEN },
      ],
    },
    {
      kind: 'ending',
      next: { title: 'Designing defaults' },
      lines: [
        { t: 'Next time: Zundamon turns everything on. By default.', v: TEN },
        { t: "I haven't done anything yet!", v: Z },
      ],
    },
  ],
};
