import type { CourseL10n } from '../../i18n';

/**
 * 出典の説明の英語。お笑い版は真面目版（nudge-product）の出典をそのまま使うので、その全部（46 本）を訳す。
 * 英語の題名は原題のまま。日本語の題名・発行元・年・説明は、日本語の出典の一覧（../../nudge-product/sources.ts ほか）から訳した（出典の文章からは訳していない）。
 * docsTitles で、レクチャーの出典のリンクの題を作る
 */
export const SOURCES_EN: NonNullable<CourseL10n['sources']> = {
  'thaler-sunstein-2008': {
    title: 'Nudge: Improving Decisions About Health, Wealth, and Happiness',
    publisher: 'Richard H. Thaler, Cass R. Sunstein (Yale University Press)',
    year: '2008 (the link is to the 2021 Final Edition)',
    note: 'The definition of a nudge (an element of choice architecture that steers behavior in a predictable direction without banning options or greatly changing economic incentives; the definition on p. 6 of the 2009 edition, checked through its quotation in Mongin & Cozic 2018), and the idea of choice architecture. Researchers also differ on how far the definition reaches',
  },
  'sunstein-2014-guide': {
    title: 'Nudging: A Very Short Guide',
    publisher: 'Cass R. Sunstein (Journal of Consumer Policy 37)',
    year: '2014',
    note: 'Gives a short definition of nudges as methods that guide people in a certain direction while keeping their freedom, and compares them with mandates, bans and economic incentives. Treats choice architecture as always present (no design is neutral)',
  },
  'thaler-2015-nyt': {
    title: 'The Power of Nudges, for Good and Bad',
    publisher: 'Richard H. Thaler (The New York Times)',
    year: '2015',
    note: "The 3 principles of a good nudge set out in the column (be transparent and do not mislead; make opting out as easy as possible; have good reason to think it improves the person's welfare). A guideline from the idea's originator, not an official standard. The article could not be opened with our tools; its location and date (published 2015-10-31) were checked in a repost on the website of Thaler's company",
  },
  'thaler-2018-sludge': {
    title: 'Nudge, not sludge',
    publisher: 'Richard H. Thaler (Science 361)',
    year: '2018',
    note: 'A one-page editorial that gave the name "sludge" to the reverse kind of design: misusing choice architecture to make good choices harder, or to push people toward behavior that does not serve them (not an empirical study)',
  },
  'ftc-2022-dark-patterns': {
    title: 'Bringing Dark Patterns to Light (Staff Report)',
    publisher: 'U.S. Federal Trade Commission (FTC)',
    year: '2022',
    note: 'A staff report (September 2022; the Commission voted 5-0 to approve its release). Explains dark patterns as design techniques that deceive or manipulate users so that they make choices they otherwise would not, which can cause harm (not a legal definition). Typical tactics listed: disguised ads and fake deadlines, obstructing cancellation, hiding terms and fees, and steering people into handing over personal data',
  },
  'oecd-2022-dark-patterns': {
    title: 'Dark Commercial Patterns (OECD Digital Economy Papers No. 336)',
    publisher: 'OECD',
    year: '2022',
    note: 'Digital Economy Papers No. 336 (2022-10-26). A working definition of dark patterns, 7 categories, evidence of how widespread and harmful they are, options for regulation and enforcement, and self-audits. Says that even mild-looking tactics can work about as well, and that a definitive taxonomy is hard. Checked in the full PDF (the DOI link returns 403; the official PDF is https://www.oecd.org/content/dam/oecd/en/publications/reports/2022/10/dark-commercial-patterns_9f6169cd/44f5e846-en.pdf )',
  },
  'eu-dsa-art25': {
    title: 'Regulation (EU) 2022/2065 (Digital Services Act) Article 25',
    publisher: 'European Union',
    year: '2022',
    note: 'Article 25: providers of online platforms must not build interfaces that deceive or manipulate users and so distort their free and informed decisions. Practices covered by the Unfair Commercial Practices Directive and the GDPR are excluded. Examples on which the Commission may issue guidelines: (a) giving one choice more prominence, (b) repeatedly asking for a choice already made, (c) making cancellation harder than signing up. Platforms of micro and small enterprises are exempt, except very large ones (Article 19). Applies from 2024-02-17. Checked in the authentic Official Journal text from the EU Publications Office',
  },
  'caa-tokushoho-2022': {
    title: 'Guide to the Act on Specified Commercial Transactions: Mail-order sales (what to display when accepting a specified application)',
    publisher: 'Consumer Affairs Agency, Japan',
    year: '2022',
    note: 'With the amendment in force from June 1, 2022 (Act No. 72 of 2021), the items to display on the final confirmation screen of mail-order sales (including paper application forms) became mandatory, and misleading displays were prohibited (Article 12-6). People who applied under a misunderstanding can cancel (Article 15-4)',
  },
  'best-ethics-checklist': {
    title: 'Ethics checklist for using behavioral insights such as nudges, Part 2: Social implementation',
    publisher: 'BEST, the Japanese nudge unit (Ministry of the Environment)',
    year: '2020 (December)',
    note: 'A checklist for the stage of actually using them in policies, products or services (with items such as checking the effect in advance). Things that change economic incentives slightly, such as small point rewards, are not excluded, and it says size alone does not settle the question. States clearly that meeting the checklist is not enough on its own',
  },
  'johnson-goldstein-2003': {
    title: 'Do Defaults Save Lives?',
    publisher: 'Eric J. Johnson, Daniel Goldstein (Science 302)',
    year: '2003',
    note: "A short paper showing that people's stated willingness to donate organs changes greatly with the default. In an online experiment, 82% consented when consent was the default, and 42% when non-consent was the default (checked in a replication study's description of the original; the paper itself was not opened)",
  },
  'madrian-shea-2001': {
    title: 'The Power of Suggestion: Inertia in 401(k) Participation and Savings Behavior',
    publisher: 'Brigitte C. Madrian, Dennis F. Shea (Quarterly Journal of Economics 116)',
    year: '2001',
    note: "When one large U.S. company switched its 401(k) (a defined contribution retirement savings plan) to automatic enrollment, participation rose significantly and substantially, and many people stayed with the default contribution rate and investment (attributed to inertia and to reading the default as the company's advice). Checked in the abstract of the NBER version",
  },
  'mertens-2022': {
    title: 'The effectiveness of nudging: A meta-analysis of choice architecture interventions across behavioral domains',
    publisher: 'Stephanie Mertens et al. (PNAS 119)',
    year: '2022',
    note: 'A meta-analysis of choice architecture interventions. Values after the May 2022 correction (PNAS 119(19) e2204059119): 212 publications, 447 effect sizes, about 2.15 million people, overall effect size d=0.43 [0.38, 0.48] (0.45 before the correction). Decision structure (such as defaults) had the largest effect (0.54). The authors also acknowledge publication bias',
  },
  'maier-2022': {
    title: 'No evidence for nudging after adjusting for publication bias',
    publisher: 'Maximilian Maier et al. (PNAS 119)',
    year: '2022',
    note: 'Correcting the data of Mertens et al. for publication bias leaves an average effect of d≈0.04, with weak evidence (not proof of no effect, but a level where it cannot be decided either way). Supports no effect for interventions that only provide information and for the finance domain; for decision-structure interventions the result is unclear',
  },
  'dellavigna-linos-2022': {
    title: 'RCTs to Scale: Comprehensive Evidence From Two Nudge Units',
    publisher: 'Stefano DellaVigna, Elizabeth Linos (Econometrica 90)',
    year: '2022',
    note: 'The average effect of 126 RCTs by 2 U.S. nudge units (about 23 million people) was +1.4 percentage points (+8.0% relative to the control group, statistically significant). Studies in academic journals: +8.7 points (+33.4%). About 70% of the gap can be explained by selective publication, amplified by low statistical power (rechecked in the abstract on 2026-10-31)',
  },
  'bit-east-2014': {
    title: 'EAST: Four simple ways to apply behavioural insights',
    publisher: 'The Behavioural Insights Team',
    year: '2014 (the PDF now distributed is the December 2024 revision)',
    note: 'Easy (defaults, reducing effort, simple messages), Attractive (drawing attention, designing incentives), Social (showing that many people do it, networks, reciprocity), Timely (good moments, immediate costs and benefits, planning ahead). The revision also covers when the way norms are communicated can backfire, and effort that serves the person. Checked in the PDF (the revision was published 2024-12-16; the PDF file now distributed was created in April 2025)',
  },
  'oecd-basic-2019': {
    title: 'Tools and Ethics for Applied Behavioural Insights: The BASIC Toolkit',
    publisher: 'OECD',
    year: '2019',
    note: 'The 5 stages of using behavioural insights in policy (Behaviour: focus on the behaviour that matters / Analysis: examine it through a behavioural science lens (ABCD) / Strategy: devise solutions / Intervention: set the definition of success, the sample size and the risks, and test with an experiment (ideally an RCT) / Change: implementation, scaling, monitoring, evaluation and sharing), with ethics cautions for each stage. Rechecked on 2026-10-31 in the official PDF on oecd.org (the publications/reports/2019/06 version; the HTML page returns 403)',
  },
  'schultz-2007': {
    title: 'The Constructive, Destructive, and Reconstructive Power of Social Norms',
    publisher: 'P. Wesley Schultz et al. (Psychological Science 18)',
    year: '2007',
    note: 'An experiment with 290 households (287 in the end) in San Marcos, U.S. When told their own usage, the neighborhood average and energy-saving tips, households below the average increased their usage (about +0.89 kWh/day, a boomerang effect). With a smiley or frowny face added (an injunctive norm), usage did not rise, and households above the average cut about 1.72 kWh/day. Checked in the PubMed abstract and the full-text PDF',
  },
  'allcott-2011': {
    title: 'Social norms and energy conservation',
    publisher: 'Hunt Allcott (Journal of Public Economics 95)',
    year: '2011',
    note: "Randomized controlled trials of Opower's Home Energy Reports with about 600,000 households. Usage fell 2.0% on average (equivalent to an 11-20% short-run rise in electricity prices); the top 10% of users cut 6.3%, the bottom 10% cut 0.3%. The role of injunctive norms was not significant. Checked in the abstract and bibliographic data",
  },
  'tversky-kahneman-1981': {
    title: 'The Framing of Decisions and the Psychology of Choice',
    publisher: 'Amos Tversky, Daniel Kahneman (Science 211)',
    year: '1981',
    note: 'In the problem of a disease expected to kill 600 people, 72% chose the sure option when told "200 people will be saved", but 22% when told "400 people will die" (classroom questionnaires given to university students). For the same $5 discount, 68% said they would go to a farther store for a $15 item, but 29% for a $125 item. Says the effects are large and systematic, but do not occur everywhere. Checked in a scanned PDF of the paper',
  },
  'eu-crd-art22': {
    title: 'Directive 2011/83/EU on consumer rights, Article 22',
    publisher: 'European Union',
    year: '2011',
    note: "Article 22: before the consumer is bound by the contract, express consent must be obtained for any extra payment on top of the main contract price. If consent was inferred from a default the consumer has to reject to avoid paying (a pre-ticked box), the consumer is entitled to a refund of that payment. EUR-Lex content could not be retrieved, so this was checked in the copy of the EU directive on legislation.gov.uk. Under Directive (EU) 2023/2673, it also applies to distance contracts for financial services from 2026-06-19 (the wording of Article 22 is unchanged)",
  },
  'fogg-bmap': {
    title: 'Fogg Behavior Model',
    publisher: 'BJ Fogg',
    year: '—',
    note: 'A framework in which behavior happens when motivation, ability and a prompt come together at the same moment (B=MAP). Ability is set by the scarcest resource, and it recommends making the behavior small. Prompts come in 3 types: Facilitator, Signal and Spark. A practical framework from its originator, not peer-reviewed research. Checked on the official site',
  },
  'sunstein-2015-ethics': {
    title: 'The Ethics of Nudging',
    publisher: 'Cass R. Sunstein (Yale Journal on Regulation 32)',
    year: '2015',
    note: 'Argues that since choice architecture cannot be avoided, opposing nudges as such makes little sense, but objecting to a particular nudge can be legitimate (checked in the abstract)',
  },
  'sunstein-2022-sludge-audits': {
    title: 'Sludge Audits',
    publisher: 'Cass R. Sunstein (Behavioural Public Policy 6)',
    year: '2022 (online 2020)',
    note: 'Defines sludge as excessive or unjustified friction. It costs time, money and dignity, and hits people in weaker positions hardest. Proposes regular audits by organizations (checked in the abstract)',
  },
  'chandrashekar-2023': {
    title:
      'Defaults versus framing: Revisiting Default Effect and Framing Effect with replications and extensions of Johnson and Goldstein (2003) and Johnson, Bellman, and Lohse (2002)',
    publisher: 'Subramanya Prasad Chandrashekar et al. (Meta-Psychology 7)',
    year: '2023',
    note: 'A preregistered replication with 1,920 people in the U.S. The effect replicated, with opt-out 73.5% and opt-in 62.5% (no default 69.7%), but the gap of about 11 points was smaller than in the original (these 3 rates are for the 1,446 of the 1,920 who answered this task). The same study also tried to replicate Johnson, Bellman and Lohse (2002): for an invitation to a health survey, no default effect appeared (opt-out 60.5%, opt-in 61.1%; with positive and negative wording, 91.7% and 28.9%). A conceptual replication using an organ donation invitation went the opposite way (24.9% and 64.6%)',
  },
  'arshad-2019': {
    title: 'Comparison of organ donation and transplantation rates between opt-out and opt-in systems',
    publisher: 'Adam Arshad, Benjamin Anderson, Adnan Sharif (Kidney International 95)',
    year: '2019',
    note: "A comparison of 35 OECD countries (2016) found no significant difference in deceased donation numbers between opt-out and opt-in countries (an observational study, mixed with differences such as each country's healthcare system). A correction was issued in 2023 (Kidney Int 103(5):998, doi:10.1016/j.kint.2023.03.010). The text of the correction was not checked because the publisher's page could not be opened (403). The claims used in the course were checked in the abstract of the original paper (Europe PMC)",
  },
  'best-ethics-checklist-study': {
    title: 'Ethics checklist for using behavioral insights such as nudges, Part 1: Surveys and research',
    publisher: 'BEST, the Japanese nudge unit (Ministry of the Environment)',
    year: '2020 (March; revised March 2021)',
    note: 'BEST was launched in April 2017, led by the Ministry of the Environment. A checklist made by the Nudge Ethics Committee for the stage of studying effects. Also includes a Japanese translation of the definition of a nudge, with commentary',
  },
  'jachimowicz-2019': {
    title: 'When and why defaults influence decisions: a meta-analysis of default effects',
    publisher: 'Jon M. Jachimowicz et al. (Behavioural Public Policy 3)',
    year: '2019',
    note: 'A meta-analysis of 58 datasets on default effects (55 studies, 35 papers, 73,675 people in total; checked in the open-access text). The effect size of the opt-out vs opt-in difference was d=0.68 [0.53, 0.83]. 46 showed a clear positive effect, 10 no significant difference, and 2 the opposite direction. Larger in consumer domains, smaller in environmental ones. Defaults seen as a recommendation (endorsement) or as the current state (endowment) had larger effects; effort (ease) made no significant difference (few studies varied effort). The authors advise testing and checking rather than assuming a default will work',
  },
  'carroll-2009': {
    title: 'Optimal Defaults and Active Decisions',
    publisher: 'Gabriel D. Carroll et al. (Quarterly Journal of Economics 124)',
    year: '2009 (NBER Working Paper 11074)',
    note: 'At a U.S. company\'s 401(k) (a defined contribution retirement savings plan), requiring new hires to choose whether to join ("active decision") raised the share who joined at first by 28 points compared with ordinary opt-in. A model in which active decisions suit cases with strong procrastination and widely varying savings preferences, while automatic enrollment (a default) suits people with little financial knowledge. Checked in the abstract on the NBER page (the paper itself was not opened)',
  },
  'gigerenzer-2007': {
    title: 'Helping Doctors and Patients Make Sense of Health Statistics',
    publisher: 'Gerd Gigerenzer et al. (Psychological Science in the Public Interest 8)',
    year: '2007',
    note: 'Argues that confusing ways of presenting numbers (some of them intentional) cause misunderstanding, and recommends showing absolute rather than relative risk, natural frequencies (counts of people) rather than conditional probabilities, mortality rather than survival rates, and so on. Example: "breast cancer screening cuts the risk of dying by 25%" meant 1 fewer death per 1,000 people. Checked in the PubMed abstract',
  },
  'okeefe-jensen-2007': {
    title:
      'The relative persuasiveness of gain-framed and loss-framed messages for encouraging disease prevention behaviors: a meta-analytic review',
    publisher: "Daniel J. O'Keefe, Jakob D. Jensen (Journal of Health Communication 12)",
    year: '2007',
    note: 'A meta-analysis of 93 studies (N=21,656) of messages encouraging disease prevention. Wording that stresses gains was statistically slightly more persuasive than wording that stresses losses, but the difference was very small (r=.03). It came mainly from studies of dental care; there was no significant difference for safer sex, skin cancer prevention or diet. Checked in the PubMed abstract',
  },
  'huber-1982': {
    title: 'Adding Asymmetrically Dominated Alternatives: Violations of Regularity and the Similarity Hypothesis',
    publisher: 'Joel Huber, John W. Payne, Christopher Puto (Journal of Consumer Research 9)',
    year: '1982',
    note: "Showed that adding an \"asymmetrically dominated\" option (a decoy), worse than one option but not worse than another, can raise the chance that the option that beats it is chosen. Checked in the abstract (the paper is paywalled and was not opened). Decoy options are not on the list in the FTC's 2022 report",
  },
  'frederick-2014': {
    title: 'The Limits of Attraction',
    publisher: 'Shane Frederick, Leonard Lee, Ernest Baskin (Journal of Marketing Research 51)',
    year: '2014',
    note: 'Volume 51, issue 4, pages 487-507. Questioned the practical relevance of the decoy effect (attraction effect), reporting that it tends to be limited to simple comparisons where every attribute is shown as a number, and usually did not occur when people tried the real product or when even one attribute was shown with a photo or similar. The original authors (Huber, Payne, Puto) replied in a commentary in the same issue (pages 520-525) that the effect replicates when the conditions are matched. Both checked in the abstracts (OpenAlex) and Crossref bibliographic data (paywalled; full text not opened)',
  },
  'eu-ucpd-annex1': {
    title: 'Directive 2005/29/EC (Unfair Commercial Practices Directive) Annex I',
    publisher: 'European Union (copy of EU law on legislation.gov.uk, UK)',
    year: '2005',
    note: 'Annex I lists commercial practices that are unfair in all circumstances. Point 7: falsely claiming that a product or its terms are available only for a very limited time, to push an immediate decision and take away the time or opportunity to think it over. EUR-Lex content could not be retrieved, so this was checked in the copy on legislation.gov.uk (the version as of December 31, 2020). Article 3 of Directive (EU) 2019/2161 only added points 11a and 23a-23c to Annex I and did not change point 7 (checked in the text of 2019/2161 on the same site). As for changes from 2021 on, Directive (EU) 2024/825 (applying from September 27, 2026) added points 2a, 4a-4c, 10a and 23d-23i (environmental claims, repairs, software updates and more) to Annex I, but did not change point 7 (checked in the authentic Official Journal text from the EU Publications Office)',
  },
  'caa-double-price': {
    title: 'Double pricing (misleading representations under the Act against Unjustifiable Premiums and Misleading Representations)',
    publisher: 'Consumer Affairs Agency, Japan',
    year: '—',
    note: 'Double pricing whose comparison price is not appropriate may be a misleading representation. A price at which the same product was sold over a considerable recent period is not a problem; a past price that does not qualify may be a problem unless the timing and length of the sales period are shown accurately. The approach is set out in the guidelines on misleading price representations under the Act (the Price Representation Guidelines). The requirements for representations misleading as to advantageous terms (Article 5, item 2: representations that make people mistakenly believe the terms are significantly more advantageous than the actual ones or those of competitors) were checked on the Agency\'s page explaining them',
  },
  'allcott-2009-ceepr': {
    title: 'Social Norms and Energy Conservation (MIT CEEPR Working Paper 09-014)',
    publisher: 'Hunt Allcott (MIT Center for Energy and Environmental Policy Research)',
    year: '2009 (October revision)',
    note: 'The working paper version (before peer review) of the later Journal of Public Economics paper (allcott-2011). In a randomized trial with about 80,000 households of a utility in Minnesota, U.S., monthly letters cut usage by 1.9-2.0%. The letters had 2 pillars: a comparison with 100 nearby homes of similar size (the average, and the households in the lowest 20%; low users got "Great" or "Good" with smiley faces), and energy-saving tips tailored to the household. Since everything was sent together, it states that the effect of each part cannot be separated. In the group that got a letter every 3 months, the effect faded before the next letter and grew again when it arrived. Checked by opening the PDF',
  },
  'allcott-2015-site-selection': {
    title: 'Site Selection Bias in Program Evaluation',
    publisher: 'Hunt Allcott (Quarterly Journal of Economics 130)',
    year: '2015',
    note: 'Across 111 Opower randomized controlled trials (about 8.6 million households), predictions from the data of the first 10 sites greatly overestimated the effects at the later 101 sites. Reasons include that utilities in regions with more environmental concern adopted the program earlier and their customers responded more, and that the reports first went only to high-usage households and were widened later. Checked in the abstract of NBER Working Paper 18373 and Crossref bibliographic data (vol. 130, no. 3, pp. 1117-1165)',
  },
  'kluger-denisi-1996': {
    title: 'The effects of feedback interventions on performance: A historical review, a meta-analysis, and a preliminary feedback intervention theory',
    publisher: 'Avraham N. Kluger, Angelo DeNisi (Psychological Bulletin 119)',
    year: '1996',
    note: 'A meta-analysis of feedback interventions (607 effect sizes, 23,663 observations). On average they improved performance (d=0.41), but more than a third lowered it. Argues that the more attention moves away from the task and toward the self, the smaller the effect. Paywalled, so checked in the abstract (the opening sentences listed on OpenAlex) and Crossref bibliographic data',
  },
  'tiefenbeck-2018': {
    title: 'Overcoming Salience Bias: How Real-Time Feedback Fosters Resource Conservation',
    publisher: 'Verena Tiefenbeck et al. (Management Science 64)',
    year: '2018',
    note: "In a large field experiment that showed energy and water use on the spot during showers, resource use in the shower fell by 22%. People who used more to begin with cut more, and the absolute savings were larger than with the usual approach of reporting whole-home usage in aggregate. Checked in the abstract (Crossref, OpenAlex). The setting (about 700 one- or two-person households in Switzerland, for about 2 months) was checked in a ScienceDaily article (February 9, 2017) reposting a University of Bonn release (February 2017); the university's own page was not opened",
  },
  'bettinger-2012': {
    title: 'The Role of Application Assistance and Information in College Decisions: Results from the H&R Block FAFSA Experiment',
    publisher: 'Eric P. Bettinger, Bridget Terry Long, Philip Oreopoulos, Lisa Sanbonmatsu (Quarterly Journal of Economics 127)',
    year: '2012',
    note: 'A randomized trial in which low-income families who came for help with their tax filing were helped on the spot to fill out the federal student aid application (FAFSA), and told how much aid they could expect. Among high school seniors whose parents got the help, the share who completed 2 years of college within 3 years of the experiment rose from 28% to 36%. Families given only the information about expected aid saw no better outcomes. Paywalled, so checked in the abstract (OpenAlex), the abstract of NBER Working Paper 15361 and Crossref bibliographic data',
  },
  'milkman-2011': {
    title: 'Using implementation intentions prompts to enhance influenza vaccination rates',
    publisher: 'Katherine L. Milkman, John Beshears, James J. Choi, David Laibson, Brigitte C. Madrian (PNAS 108)',
    year: '2011',
    note: "A field experiment that sent employees of a large U.S. company a notice with the date, time and place of free on-site vaccination. The control group's vaccination rate was 33.1%. Adding a box to write the date they would go raised it by 1.5 points (not significant); a box for the date and time raised it by 4.2 points (significant). Checked in the PubMed abstract",
  },
  'dai-2014-fresh-start': {
    title: 'The Fresh Start Effect: Temporal Landmarks Motivate Aspirational Behavior',
    publisher: 'Hengchen Dai, Katherine L. Milkman, Jason Riis (Management Science 60)',
    year: '2014',
    note: 'In 3 studies of recorded data (observational studies), searches for "diet", gym visits and commitments to goals increased at the start of a new week, month, year or semester, and after birthdays and holidays. Checked in the abstract (OpenAlex)',
  },
  'klasnja-2019-heartsteps': {
    title: 'Efficacy of Contextually Tailored Suggestions for Physical Activity: A Micro-randomized Optimization Trial of HeartSteps',
    publisher: 'Predrag Klasnja et al. (Annals of Behavioral Medicine 53)',
    year: '2019',
    note: 'A 6-week micro-randomized trial (44 people) of an app that encourages walking. At up to 5 times a day chosen by each person, whether to send a suggestion tailored to the situation was decided at random each time. Steps in the 30 minutes after a suggestion rose by 14% on average (p=0.06). The increase was 66% at first, but the effect shrank as the days went by. Suggestions to break up sitting showed no effect. Checked in the PubMed abstract',
  },
  'ravenscroft-2020': {
    title: 'Video-observed therapy and medication adherence for tuberculosis patients: randomised controlled trial in Moldova',
    publisher: 'Luke Ravenscroft et al. (European Respiratory Journal 56)',
    year: '2020',
    note: "A trial in Moldova that randomly split 197 tuberculosis patients (excluding those with multidrug resistance) into a group that took their medicine in front of a health worker at a clinic (99) and a group that sent videos of themselves taking it (98). The main measure, the number of days in 2 weeks on which taking the medicine could not be confirmed, fell from 5.24 to 1.29 days on average (p<0.01). Patients' time and costs also fell. No significant difference was seen in treatment success. Checked in the Europe PMC abstract and Crossref bibliographic data (full text not opened). The figure in BIT's revised EAST (\"share of days with confirmed medication: 44% → 84%\") is counted differently from the paper's main measure",
  },
  'caa-moushikomi-guideline': {
    title: 'Guidelines on displays at the application stage of mail-order sales (Attachment 9)',
    publisher: 'Consumer Affairs Agency, Japan',
    year: '2023 (April edition)',
    note: 'Commentary on Article 12-6 of the Act on Specified Commercial Transactions. The "matters concerning withdrawal or cancellation of the application" shown on the final confirmation screen include the conditions, method and effect of cancellation (for example, the deadline for asking to cancel a subscription purchase, and penalties). Restrictions such as limiting cancellation to certain means or hours must also be shown clearly on the final confirmation screen, not left to a linked page. It says that stressing "cancel anytime" while conditions actually apply may count as "a display that misleads people". Checked by opening the PDF linked from the mail-order page of the Guide to the Act on Specified Commercial Transactions',
  },
  'johari-2022': {
    title: 'Always Valid Inference: Continuous Monitoring of A/B Tests',
    publisher: 'Ramesh Johari, Pete Koomen, Leonid Pekelis, David Walsh (Operations Research 70)',
    year: '2022',
    note: 'Points out that the p-values and confidence intervals of an A/B test become completely unreliable if you decide whether to keep going or stop (the number of people) while watching the results, that is, if you look many times along the way; proposes p-values and confidence intervals that stay valid whenever you decide. Used in a large commercial A/B testing platform. Checked in the abstract (Crossref bibliographic data) and the abstract of the arXiv version (1512.04922). Full text not opened',
  },
  'kohavi-2020': {
    title: 'Trustworthy Online Controlled Experiments: A Practical Guide to A/B Testing',
    publisher: 'Ron Kohavi, Diane Tang, Ya Xu (Cambridge University Press)',
    year: '2020',
    note: "A practical book on online experiments (A/B tests). The summary of Chapter 21 describes guardrail metrics as important metrics that warn when an experiment's assumptions have broken, in 2 kinds: organizational guardrails (protecting the business; covered in Chapter 7) and trustworthiness guardrails, and says the sample ratio mismatch (SRM) between groups should be checked in every experiment. Full text not opened; checked in the chapter summary on Cambridge Core and Crossref bibliographic data",
  },
};

/** レクチャーの「出典・参考資料」のリンクの題（日本語の docsOf と同じ並び: 発行元 (年) 題名） */
export const docsTitles = (ids: string[]): { title: string }[] =>
  ids.map((id) => {
    const s = SOURCES_EN[id];
    if (!s?.title) throw new Error(`出典が無い: ${id}`);
    return { title: `${s.publisher} (${s.year}) ${s.title}` };
  });
