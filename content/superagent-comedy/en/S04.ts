import type { LectureL10n } from '../../i18n';
import { docsTitles } from './sources';

// 英語版の S04。日本語の台本（../S04.ts）に重ねる。ボケは直訳せず、英語で笑えるように作り直した
// （窓 → 家の窓、キャッシュ → cash、リコール → product recall、名探偵 → great detective。先生の昔話は "as I recall" で切られる）。
// 事実・数字・画面の正しい名前・出典は日本語の台本と同じ。v を省いた台詞は先生。
// 局所性の場面（日本語 7・英語 8）と先回りの例の場面（日本語 9・英語 10）は、長い台詞を 2 つに分けたので、画面の要素の at を全部書いた
// 読み: 複数の IDs は空けずに書く（「I Ds」と空けると「I・D・S」と読まれた。2026-11-02 に Kokoro の音素で確かめた）。単数は「I D」のまま
const Z = 'zundamon' as const;
const T = 'tsukkomi' as const;
const TEN = 'tennokoe' as const;

const CITE = 'DeepSeek Harness team, "Exploring Super-agent Design" (2026)';

export const S04: LectureL10n = {
  source: 'e2cadc88fb8e',
  title: 'Packing context, and acting ahead',
  summary:
    "Treating the model's context window as a cache. Inline puts in what is likely needed soon, Spill keeps what won't fit outside, and Chain of Recall follows IDs to bring old context back. Acting ahead (speculative execution) starts work in the background before knowing whether it will be used, and shares results only when sure.",
  docs: docsTitles(['dsh-superagent-article']),
  quiz: [
    {
      q: "How does the article recommend handling the model's context window?",
      choices: [
        'Always put in all the information available',
        'Treat it as a cache, and pack it with Inline and Spill',
        'Put in only IDs, and make the model go and read the rest every time',
        "Don't use the window",
      ],
      explain:
        'Too much thins out attention; too little means calling tools again and again. Treat the window as a cache: add the nearest things first (Inline), and keep what won\'t fit outside (Spill).',
    },
    {
      q: 'Which statement describes Spill correctly?',
      choices: [
        "Keep information that won't fit outside, leaving only a summary or the location of the rest in the window",
        'Throw the information away and never read it again',
        'Spill zunda-mochi all over the floor',
        'Put information that will likely be needed soon into the window first',
      ],
      explain: 'Putting likely-needed information in first is Inline. Spill keeps things outside, so the rest can be read with a tool when needed.',
    },
    {
      q: 'Under the article team\'s "quietly reproduce and fix" policy, when are results shared with the group?',
      choices: [
        'Right away, as soon as a problem is reported',
        'Only when the problem is confirmed and a simple fix has been found',
        'Every morning, at a set time',
        'Only when it could not fix it',
      ],
      explain:
        "It tries reproducing and fixing in the background, and shares only once the problem is confirmed and an easy fix is ready. Otherwise it says nothing. Even on a miss, no one's attention is used up.",
    },
  ],
  takeaways: [
    "Too much in the window thins out attention; too little means calling tools again and again. Wasting the window wastes the model's smarts",
    "The window is a cache. Inline = put in what is likely needed soon, ahead of time. Spill = keep what won't fit outside, leaving only a summary or the location of the rest",
    'A little at a time, by locality: first the ID and a summary → add the nearest things (related IDs, messages before and after, the reply target, nearby comments, the first 50 characters of the text) → cut long things short and leave the location of the rest',
    'Chain of Recall: give IDs to events, Threads and Worker sessions, then follow summaries and next IDs to bring back as much old context as needed',
    'Acting ahead (speculative execution): start in the background before knowing whether it will be used, and show only the results that helped. Under the article team\'s "quietly reproduce and fix" policy, results are shared only when the problem is confirmed and a simple fix has been found',
  ],
  scenes: [
    {
      kind: 'opening',
      title: 'Packing context, and acting ahead',
      lines: [
        { t: 'Chapter 4. Packing context, and acting ahead.', s: 'Chapter four. Packing context, and acting ahead.', v: 'announcer', pause: 0.3 },
        { t: 'I pasted ten thousand lines of logs! Every line matters!', v: Z, pause: -0.15 },
        { t: 'That overflows the window.', v: T, sfx: 'harisen' },
        { t: 'As promised: ten thousand lines, pasted.', v: TEN },
        { t: "In this chapter: what to put in the model's context window, and how much. And acting ahead: moving before anyone asks." },
      ],
    },
    {
      kind: 'goals',
      heading: 'Goals for this chapter',
      items: [
        { text: 'Think of the context window as a cache' },
        { text: 'Explain Inline and Spill, and Chain of Recall' },
        { text: 'Know how to act ahead (speculative execution), and how to deliver results' },
      ],
      lines: [
        { t: 'This chapter has three goals.' },
        { t: "A window? I've got plenty of those at home!", v: Z, pause: -0.15 },
        { t: 'Not that kind of window.', v: T, sfx: 'harisen' },
        { t: 'One. Thinking of the context window as a cache.', sfx: 'pop' },
        { t: 'Two. Being able to explain Inline and Spill, and Chain of Recall.', sfx: 'pop' },
        { t: 'Three. Knowing how to act ahead, and how to deliver the results.', sfx: 'pop' },
      ],
    },
    {
      kind: 'compare',
      heading: 'The problem: too much, and too little',
      left: {
        title: 'Too much',
        sub: 'Put in all 10,000 lines',
        items: [{ text: 'The window fills up' }, { text: "The model's attention thins out" }],
      },
      right: {
        title: 'Too little',
        sub: 'Pass only the ID',
        items: [{ text: 'It keeps calling tools to go and read' }, { text: 'More steps, so it gets slower' }],
      },
      verdict: { text: "Wasting the window wastes the model's smarts" },
      lines: [
        { t: "Events have made it through the filter and reached the right session. Next: how much goes into the model's context window." },
        { t: 'So I put in all ten thousand lines!', v: Z },
        { t: 'Put in too much, and the window fills up.', sfx: 'pop' },
        { t: "And the model's attention thins out, so it's easier to miss the important parts.", sfx: 'pop' },
        {
          t: "Zundamon's model, as it happens, remembered only line ten thousand. The one about zunda-mochi.",
          s: "Zundamon's model, as it happens, remembered only line ten thousand. The one about zunda mochi.",
          v: TEN,
          sfxAfter: 'chin',
        },
        { t: "Fine, the opposite! I'll pass just the ID!", s: "Fine, the opposite! I'll pass just the I D!", v: Z },
        { t: 'Put in too little, and the model keeps calling tools to go and read.', sfx: 'pop' },
        { t: 'More steps, and it gets slower.', sfx: 'pop' },
        { t: "Zundamon's model opened the same file fifty times.", v: TEN, sfxAfter: 'chin' },
        { t: "As the article puts it: wasting the window means wasting the model's smarts.", sfx: 'chime' },
      ],
    },
    {
      kind: 'big',
      heading: 'The window is a cache: Inline and Spill',
      cite: CITE,
      kicker: 'Borrowing words from compilers and computers',
      text: 'Treat the limited window as a **cache**',
      sub: "Inline: put what's needed soon in the window / Spill: keep what won't fit outside, leaving a summary or its location",
      lines: [
        { t: 'So the article treats the limited context window as a cache.' },
        { t: "Cache! That's cash! I can buy zunda-mochi!", s: "Cache! That's cash! I can buy zunda mochi!", v: Z, pause: -0.15 },
        { t: 'It buys nothing.', v: T, sfx: 'harisen' },
        { t: 'A cache is a limited, fast place to keep things. We use two operations on it.' },
        { t: "Inline means putting what you'll likely need soon into the window ahead of time. Fewer round trips to call tools.", sfx: 'pop' },
        { t: "Spill means moving what won't fit, or what's rarely used, outside, and leaving only a summary or its location in the window.", sfx: 'pop' },
        {
          t: 'Ah, memories. In my student days, compiler class covered moving values out to memory when registers ran out. That day, as I recall, it was raining…',
          s: 'Ah, memories. In my student days, compiler class covered moving values out to memory when registers ran out. That day, as I recall, it was raining.',
        },
        { t: "The Teacher's long story was cut here. Only the location of the rest has been kept.", v: TEN, sfx: 'deden' },
        { t: "That's Spill!", v: Z, pause: -0.15 },
        { t: '…Exactly right.', s: 'Exactly right.', v: T },
        { t: 'No one ever went to read the rest.', v: TEN, sfxAfter: 'chin' },
      ],
    },
    {
      kind: 'points',
      heading: 'Add a little at a time, nearest first',
      items: [
        { title: 'First, just the ID and a summary', body: 'For the event at hand', at: 2 },
        { title: 'Add the nearest things', body: "Related IDs, messages before and after, reply target, nearby comments, the text's first 50 characters", at: 3 },
        { title: 'Cut long things, leave the location', body: 'Read the rest with a tool when needed', at: 6 },
      ],
      lines: [
        { t: 'So how do we pack it? With a classic idea from computing: locality.' },
        { t: 'Things that are nearby or recent are the most likely to be needed soon. So we add a little at a time.' },
        { t: 'At first, just the ID and a summary of the event at hand.', s: 'At first, just the I D and a summary of the event at hand.', sfx: 'pop' },
        { t: "Next, add what's likely needed soon, nearest first.", sfx: 'pop' },
        { t: 'Related IDs, the messages before and after, what it replies to, nearby comments in the same review, and the first fifty characters of the text.' },
        { t: "Zundamon's ten thousand lines have been reduced to the first fifty characters.", v: TEN },
        { t: 'Anything too long to fit is cut short, leaving the location of the rest. The model reads the rest with a tool when it needs to.', sfx: 'pop' },
        { t: 'That is Inline and Spill.', sfx: 'chime' },
      ],
    },
    {
      kind: 'flow',
      heading: 'Chain of Recall: remember by following IDs',
      cite: `${CITE}. IDs and contents are illustrative examples`,
      nodes: [
        { label: 'Current chat', sub: '"What happened with last week\'s login issue?"' },
        { label: 'Thread T-12', sub: 'Summary: discussing a login bug · Next: W-7' },
        { label: 'Worker W-7', sub: 'Summary: built a fix · Next: R-31' },
        { label: 'Review Thread R-31', sub: 'Summary: fixed with plan B, awaiting a check' },
      ],
      edges: [{ label: 'Follow the ID' }, {}, {}],
      lines: [
        { t: "One more problem. As the Router runs for a long time, it can't keep the records of all its past work in the window." },
        { t: 'But people bring up old topics out of the blue, somewhere else entirely.' },
        { t: 'A case! The great detective Zundamon will crack it!', v: Z },
        { t: "For example, someone asks in chat: what happened with last week's login issue?", sfx: 'pop' },
        {
          t: "First, I check this message's Thread… It has a summary, and the next ID!",
          s: "First, I check this message's Thread. It has a summary, and the next I D!",
          v: Z,
          sfx: 'pop',
        },
        {
          t: "Follow that ID, and there's the Worker on the job. It has a next ID too!",
          s: "Follow that I D, and there's the Worker on the job. It has a next I D too!",
          v: Z,
          sfx: 'pop',
        },
        { t: 'That leads to the review Thread. Fixed with plan B, waiting to be checked! Case closed!', v: Z, sfx: 'pop' },
        { t: "…Today, you're right.", s: "Today, you're right.", v: T, pause: 0.3 },
        { t: 'For the second time in this course, Zundamon was right.', v: TEN, sfx: 'deden' },
        { t: 'Events, Threads and Worker sessions all get IDs. And the IDs of nearby things go in alongside. That makes a map linked by IDs.', sfx: 'chime' },
        {
          t: 'Each call returns a summary and the next ID too, so you can follow step by step, as far as you need. The article calls this Chain of Recall.',
          s: 'Each call returns a summary and the next I D too, so you can follow step by step, as far as you need. The article calls this Chain of Recall.',
        },
        {
          t: 'Recall… like a product recall? Are they recalling zunda-mochi?!',
          s: 'Recall. Like a product recall? Are they recalling zunda mochi?!',
          v: Z,
          pause: -0.15,
        },
        { t: 'Not that recall. It means remembering.', v: T, sfx: 'harisen' },
      ],
    },
    {
      kind: 'quiz',
      heading: 'Quiz',
      question: 'In Chain of Recall, do all past work records go in the window from the start?',
      explain: 'Only a summary and the next ID go in the window. Follow the IDs to read more when needed',
      lines: [
        {
          t: 'Quiz time. In Chain of Recall, all past work records go in the window from the start. True or false?',
          s: 'Quiz time. In Chain of Recall, all past work records go in the window from the start. True, or false?',
          pause: 3.2,
        },
        { t: 'True! All ten thousand lines go in!', v: Z, pause: -0.15 },
        { t: 'Where did the great detective go?', v: T, sfx: 'harisen' },
        {
          t: 'The answer is false. Only a summary and the next ID go in the window. When needed, you follow the IDs and read.',
          s: 'The answer is false. Only a summary and the next I D go in the window. When needed, you follow the IDs and read.',
          sfx: 'reveal',
        },
        { t: 'Zundamon: four losses in a row. The great detective was a one-time act.', v: TEN, sfxAfter: 'chin' },
      ],
    },
    {
      kind: 'big',
      heading: 'Acting ahead: speculative execution',
      cite: CITE,
      kicker: 'Borrowing speculative execution from computers',
      text: "Before you know if it's needed, **start it in the background**",
      sub: "Show only the results that helped, and throw the rest away. Extra compute cuts people's waiting and effort",
      lines: [
        { t: 'Last up: acting ahead. The article also borrows a computing idea called speculative execution.' },
        {
          t: 'Acting ahead? My specialty! I made a hundred zunda-mochi before a single order came in!',
          s: 'Acting ahead? My specialty! I made a hundred zunda mochi before a single order came in!',
          v: Z,
          pause: -0.15,
        },
        { t: 'They ordered one.', v: T, sfx: 'harisen' },
        { t: 'Ninety-nine were thrown away.', v: TEN, sfxAfter: 'chin' },
        { t: '…But actually, the idea is close to that.', s: 'But actually, the idea is close to that.' },
        { t: 'Huh?', v: Z, pause: 0.3 },
        {
          t: "Watch the signals around you, and start work in the background before you know whether it'll be used. If it helps, show it. If not, toss it.",
          sfx: 'chime',
        },
        { t: 'It spends extra compute to cut how long people wait and how often they have to step in. The compute wasted on misses is the price.' },
      ],
    },
    {
      kind: 'points',
      heading: 'Acting ahead: examples, and when to speak',
      items: [
        { title: 'When a meeting invite arrives', body: 'Check for clashes, gather materials, even draft the reply', at: 1 },
        { title: 'When a problem is reported', body: 'Reproduce it in the background and look for a fix', at: 2 },
        { title: 'Speak only when sure', body: 'Only when confirmed and easily fixed. Otherwise, stay quiet', at: 4 },
      ],
      lines: [
        { t: "Let's look at some examples." },
        {
          t: 'A personal agent, once a meeting invite arrives, checks for clashes, gathers materials and even drafts the reply. You just look it over and send.',
          sfx: 'pop',
        },
        { t: "In development, the article's team has a policy: quietly reproduce and fix.", sfx: 'pop' },
        { t: 'When someone reports a problem or discusses a fix, the agent tries reproducing it and fixing it in the background.' },
        { t: 'It speaks up only once the problem is confirmed and an easy fix is in hand. Until then, it says nothing at all.', sfx: 'pop' },
        { t: "Me? I'd tell the whole group the second I spot it! It might be a bug!", v: Z, pause: -0.15 },
        { t: 'Check first, please.', v: T, sfx: 'harisen' },
        { t: 'Zundamon has made three such announcements. Not one was a bug.', v: TEN, sfxAfter: 'chin' },
        { t: "Try quietly, and speak only when sure. Even on a miss, no one's attention gets used up.", bgm: 'cut', sfx: 'chime' },
        {
          t: 'The article has an example: while the group was still discussing a fix, the Super-agent had already opened a PR, fixed in the background.',
          s: 'The article has an example: while the group was still discussing a fix, the Super agent had already opened a P R, fixed in the background.',
          bgm: 'back',
        },
      ],
    },
    {
      kind: 'recap',
      heading: 'Recap',
      items: [
        { text: 'The context window is a cache. Too much and too little both waste smarts' },
        { text: 'Inline adds the nearest first; Spill moves long things out. Chain of Recall follows IDs to bring old context back' },
        { text: 'Acting ahead: start in the background, show only sure results. On a miss, toss it and stay quiet' },
      ],
      lines: [
        { t: "Recap. The context window is a cache. Too much or too little, both waste the model's smarts.", sfx: 'pop' },
        { t: 'Inline adds the nearest things first, and Spill moves long things outside. Chain of Recall follows IDs to bring old topics back.', sfx: 'pop' },
        { t: 'Acting ahead means starting in the background and showing only sure results. On a miss, toss it and stay quiet.', sfx: 'pop' },
        {
          t: "Got it! I'll make zunda-mochi properly too: just the one that was ordered!",
          s: "Got it! I'll make zunda mochi properly too. Just the one that was ordered!",
          v: Z,
          pause: -0.15,
        },
        { t: "…That isn't acting ahead.", s: "That isn't acting ahead.", v: T },
        { t: 'Zundamon is now slightly more window-savvy. The thirty-seven tabs are still open.', v: TEN },
      ],
    },
    {
      kind: 'ending',
      next: { title: 'No waiting, and talking to fit the place' },
      lines: [
        { t: 'Next time: Zundamon will not reply until the tests finish.', v: TEN },
        { t: "I'm focusing!", v: Z },
      ],
    },
  ],
};
