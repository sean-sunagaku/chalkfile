import type { CourseL10n } from '../../i18n';

/**
 * 出典の説明の中国語（簡体字）。お笑い版は真面目版（nudge-product）の出典をそのまま使うので、その全部（46 本）を訳す。
 * 英語の題名は原題のまま。日本語の題名・発行元・年・説明は、日本語の出典の一覧（../../nudge-product/sources.ts ほか）から訳した（出典の文章からは訳していない）。
 * docsTitles で、レクチャーの出典のリンクの題を作る
 */
export const SOURCES_ZH: NonNullable<CourseL10n['sources']> = {
  'thaler-sunstein-2008': {
    title: 'Nudge: Improving Decisions About Health, Wealth, and Happiness',
    publisher: 'Richard H. Thaler、Cass R. Sunstein（Yale University Press）',
    year: '2008（链接为 2021 年的 Final Edition）',
    note: '助推的定义（不禁止选项、也不大幅改变经济激励，就能把行为引向可预测方向的选择架构要素。2009 年版第 6 页的定义，通过 Mongin & Cozic 2018 的引用确认），以及选择架构的思路。研究者之间对定义的范围也有分歧',
  },
  'sunstein-2014-guide': {
    title: 'Nudging: A Very Short Guide',
    publisher: 'Cass R. Sunstein（Journal of Consumer Policy 37）',
    year: '2014',
    note: '把助推简短地定义为：在保留自由的前提下，把人引向特定方向的方法，并与义务、禁令以及经济激励作比较。观点是：选择架构始终存在（没有中立的设计）',
  },
  'thaler-2015-nyt': {
    title: 'The Power of Nudges, for Good and Bad',
    publisher: 'Richard H. Thaler（The New York Times）',
    year: '2015',
    note: '专栏中提出的好助推 3 原则（透明、不误导；尽可能容易退出；有充分理由认为能提高本人的福祉）。这是倡导者的指南，不是官方标准。文章无法用工具打开，出处和日期（2015-10-31 发表）通过 Thaler 公司网站上的转载确认',
  },
  'thaler-2018-sludge': {
    title: 'Nudge, not sludge',
    publisher: 'Richard H. Thaler（Science 361）',
    year: '2018',
    note: '一页的评论文章，把滥用选择架构、让好的选择变难，或诱导人做出对自己无益的行为的反向设计，称为“sludge（淤泥）”（不是实证研究）',
  },
  'ftc-2022-dark-patterns': {
    title: 'Bringing Dark Patterns to Light（Staff Report）',
    publisher: '美国联邦贸易委员会（FTC）',
    year: '2022',
    note: '工作人员报告（2022 年 9 月，委员会以 5 比 0 批准发布）。把暗黑模式说明为：欺骗或操纵用户，让其做出本来不会做的选择，并可能造成伤害的设计手法（不是法律上的定义）。列举的典型手法有：伪装广告与虚假期限、阻挠解约、隐瞒条件和费用、诱导提供个人数据',
  },
  'oecd-2022-dark-patterns': {
    title: 'Dark Commercial Patterns（OECD Digital Economy Papers No. 336）',
    publisher: 'OECD',
    year: '2022',
    note: 'Digital Economy Papers No. 336（2022-10-26）。暗黑模式的工作定义、7 个分类、普及程度与危害的证据、监管与执法的选项、自我审查。认为看起来温和的手法有时也同样有效，很难给出定论性的分类。通过正文 PDF 确认（DOI 链接返回 403。官方 PDF 为 https://www.oecd.org/content/dam/oecd/en/publications/reports/2022/10/dark-commercial-patterns_9f6169cd/44f5e846-en.pdf ）',
  },
  'eu-dsa-art25': {
    title: 'Regulation (EU) 2022/2065（Digital Services Act）Article 25',
    publisher: '欧盟',
    year: '2022',
    note: '第 25 条：在线平台的提供者，不得制作欺骗或操纵用户、扭曲其自由且知情的决定的界面。不公平商业行为指令和 GDPR 所涵盖的行为除外。欧盟委员会可就以下例子发布指南：(a) 让某个选项更醒目；(b) 反复要求对已作出的选择再作选择；(c) 让解约比申请更难。微型和小型企业的平台不适用，超大型平台除外（第 19 条）。自 2024-02-17 起适用。通过欧盟出版局官方公报的正式文本确认',
  },
  'caa-tokushoho-2022': {
    title: '特定商业交易法指南 邮购（接受特定申请时的标示）',
    publisher: '日本消费者厅',
    year: '2022',
    note: '根据 2022 年 6 月 1 日施行的修订（2021 年第 72 号法律），邮购最终确认画面（包括纸质申请书）上的标示事项成为义务，并禁止令人误解的标示（第 12 条之 6）。因误解而申请的人可以撤销（第 15 条之 4）',
  },
  'best-ethics-checklist': {
    title: '关于运用助推等行为洞察的伦理检查清单 ②社会实施篇',
    publisher: '日本版助推小组 BEST（日本环境省）',
    year: '2020（12 月）',
    note: '面向作为政策、产品或服务实际使用阶段的检查清单（包括事先确认效果等项目）。像小额积分这样小幅改变经济激励的做法，也没有被排除在外，认为不能只凭大小一概而论。并明确写着：满足清单并不代表就足够了',
  },
  'johnson-goldstein-2003': {
    title: 'Do Defaults Save Lives?',
    publisher: 'Eric J. Johnson、Daniel Goldstein（Science 302）',
    year: '2003',
    note: '一篇短论文，表明器官捐献的意愿表示会因默认设置而大幅改变。在线实验中，默认同意时有 82% 同意，默认不同意时有 42% 同意（通过重复研究对原研究的说明确认，原文未打开）',
  },
  'madrian-shea-2001': {
    title: 'The Power of Suggestion: Inertia in 401(k) Participation and Savings Behavior',
    publisher: 'Brigitte C. Madrian、Dennis F. Shea（Quarterly Journal of Economics 116）',
    year: '2001',
    note: '美国一家大企业把 401(k)（确定缴费型退休储蓄制度）改为自动加入后，加入率显著大幅上升，很多人一直维持默认的缴费率和投资去向（原因被认为是惯性，以及把默认设置当作公司的建议）。通过 NBER 版的摘要确认',
  },
  'mertens-2022': {
    title: 'The effectiveness of nudging: A meta-analysis of choice architecture interventions across behavioral domains',
    publisher: 'Stephanie Mertens 等（PNAS 119）',
    year: '2022',
    note: '选择架构干预的元分析。按 2022 年 5 月更正（PNAS 119(19) e2204059119）后的数值：212 篇、447 个效应量、约 215 万人，总体效应量 d=0.43［0.38, 0.48］（更正前为 0.45）。决策结构（默认设置等）的效应最大（0.54）。作者也承认存在发表偏倚',
  },
  'maier-2022': {
    title: 'No evidence for nudging after adjusting for publication bias',
    publisher: 'Maximilian Maier 等（PNAS 119）',
    year: '2022',
    note: '用发表偏倚校正 Mertens 等人的数据后，平均效应为 d≈0.04，证据很弱（不是证明没有效果，而是哪边都无法确定的水平）。支持“只提供信息的干预”和“金融领域”没有效果，决策结构的干预则不明确',
  },
  'dellavigna-linos-2022': {
    title: 'RCTs to Scale: Comprehensive Evidence From Two Nudge Units',
    publisher: 'Stefano DellaVigna、Elizabeth Linos（Econometrica 90）',
    year: '2022',
    note: '美国 2 个助推小组的 126 项 RCT（约 2,300 万人）的平均效果为 +1.4 个百分点（相对对照组 +8.0%，统计上显著）。学术期刊的研究为 +8.7 个百分点（+33.4%）。差距的约 7 成，可以用因检验效能低而被放大的选择性发表来解释（2026-10-31 通过摘要重新确认）',
  },
  'bit-east-2014': {
    title: 'EAST: Four simple ways to apply behavioural insights',
    publisher: 'The Behavioural Insights Team',
    year: '2014（目前发布的 PDF 是 2024 年 12 月的修订版）',
    note: 'Easy（默认设置、减少麻烦、简单传达）、Attractive（吸引注意、激励的设计）、Social（表明很多人都在做、人际关系、互惠）、Timely（好的时机、眼前的得失、事先计划）。修订版也谈到规范的传达方式会起反作用的条件，以及对本人有益的麻烦。通过 PDF 确认（修订版发布于 2024-12-16，目前发布的 PDF 文件制作于 2025 年 4 月）',
  },
  'oecd-basic-2019': {
    title: 'Tools and Ethics for Applied Behavioural Insights: The BASIC Toolkit',
    publisher: 'OECD',
    year: '2019',
    note: '把行为洞察用于政策的 5 个阶段（Behaviour：聚焦重要的行为／Analysis：用行为科学的视角调查（ABCD）／Strategy：思考解决方案／Intervention：确定成功的定义、样本量和风险，用实验验证（最好是 RCT）／Change：实施、推广、监测、评估、共享），以及每个阶段的伦理注意事项。2026-10-31 通过 oecd.org 的官方 PDF（publications/reports/2019/06 的版本）重新确认（HTML 页面返回 403）',
  },
  'schultz-2007': {
    title: 'The Constructive, Destructive, and Reconstructive Power of Social Norms',
    publisher: 'P. Wesley Schultz 等（Psychological Science 18）',
    year: '2007',
    note: '在美国圣马科斯 290 户家庭（最终 287 户）中进行的实验。告知自家用电量、邻居平均值和节电提示后，低于平均的家庭用电量反而增加（约 +0.89 kWh/天，回旋镖效应）。加上笑脸、苦脸标记（指令性规范）后没有增加，高于平均的家庭约减少 1.72 kWh/天。通过 PubMed 摘要和正文 PDF 确认',
  },
  'allcott-2011': {
    title: 'Social norms and energy conservation',
    publisher: 'Hunt Allcott（Journal of Public Economics 95）',
    year: '2011',
    note: 'Opower 家庭能源报告约 60 万户家庭的随机对照试验。平均减少 2.0%（相当于短期电价上涨 11% 至 20%），用电量最高的 1 成减少 6.3%，最低的 1 成减少 0.3%。指令性规范的作用不显著。通过摘要和书目信息确认',
  },
  'tversky-kahneman-1981': {
    title: 'The Framing of Decisions and the Psychology of Choice',
    publisher: 'Amos Tversky、Daniel Kahneman（Science 211）',
    year: '1981',
    note: '在“一种疾病预计会导致 600 人死亡”的问题中，表述为“200 人会获救”时有 72% 选择稳妥的方案，表述为“400 人会死亡”时只有 22%（在课堂上对大学生进行的问卷）。同样是 5 美元的折扣，商品为 15 美元时有 68%、为 125 美元时只有 29% 回答会去更远的店。认为效果大且有系统性，但并非处处都会发生。通过正文的扫描 PDF 确认',
  },
  'eu-crd-art22': {
    title: 'Directive 2011/83/EU on consumer rights, Article 22',
    publisher: '欧盟',
    year: '2011',
    note: '第 22 条：在主合同价款之外要求额外付款时，必须在消费者受合同约束之前取得明确同意。如果通过“不拒绝就要付款”的默认设置（事先勾选）推定同意，消费者有权获得该笔付款的退款。无法从 EUR-Lex 获取内容，通过 legislation.gov.uk 上的欧盟指令副本确认。根据指令 (EU) 2023/2673，自 2026-06-19 起也适用于金融服务的远程合同（第 22 条的措辞不变）',
  },
  'fogg-bmap': {
    title: 'Fogg Behavior Model',
    publisher: 'BJ Fogg',
    year: '—',
    note: '一个框架：动机、能力、提示在同一时刻齐备时，行为就会发生（B=MAP）。能力取决于最缺的那项资源，建议把行为变小。提示分为 Facilitator、Signal、Spark 3 种。这是倡导者的实务框架，不是经过同行评审的研究。通过官方网站确认',
  },
  'sunstein-2015-ethics': {
    title: 'The Ethics of Nudging',
    publisher: 'Cass R. Sunstein（Yale Journal on Regulation 32）',
    year: '2015',
    note: '观点是：选择架构无法避免，所以反对助推本身没有意义，但反对某个具体的助推可能是正当的（通过摘要确认）',
  },
  'sunstein-2022-sludge-audits': {
    title: 'Sludge Audits',
    publisher: 'Cass R. Sunstein（Behavioural Public Policy 6）',
    year: '2022（2020 年在线发表）',
    note: '把 sludge 定义为过度的或无法正当化的麻烦。它会夺走时间、金钱和尊严，处境越弱势的人受影响越大。建议组织定期进行检查（通过摘要确认）',
  },
  'chandrashekar-2023': {
    title:
      'Defaults versus framing: Revisiting Default Effect and Framing Effect with replications and extensions of Johnson and Goldstein (2003) and Johnson, Bellman, and Lohse (2002)',
    publisher: 'Subramanya Prasad Chandrashekar 等（Meta-Psychology 7）',
    year: '2023',
    note: '在美国对 1,920 人进行的预注册重复实验。退出制 73.5%、加入制 62.5%（无默认 69.7%），效果得到重复，但差距约 11 个百分点，比原研究小（这 3 个比例是 1,920 人中回答了此题的 1,446 人的数值）。同一研究还尝试重复 Johnson、Bellman、Lohse（2002），在健康调查的邀请中没有出现默认效果（退出制 60.5%、加入制 61.1%；用肯定和否定的说法时为 91.7%、28.9%）。用器官捐献邀请进行的概念性重复，方向相反（24.9%、64.6%）',
  },
  'arshad-2019': {
    title: 'Comparison of organ donation and transplantation rates between opt-out and opt-in systems',
    publisher: 'Adam Arshad、Benjamin Anderson、Adnan Sharif（Kidney International 95）',
    year: '2019',
    note: '对 OECD 35 国（2016 年）的比较显示，退出制与加入制国家之间，逝者捐献数量没有显著差异（观察性研究，混杂了各国医疗体制等差异）。2023 年发布了更正（Kidney Int 103(5):998，doi:10.1016/j.kint.2023.03.010）。由于出版社页面打不开（403），未确认更正的正文。课程中使用的主张，通过原论文摘要（Europe PMC）确认',
  },
  'best-ethics-checklist-study': {
    title: '关于运用助推等行为洞察的伦理检查清单 ①调查与研究篇',
    publisher: '日本版助推小组 BEST（日本环境省）',
    year: '2020（3 月；2021 年 3 月修订）',
    note: 'BEST 于 2017 年 4 月在日本环境省主导下成立。这是由助推伦理委员会制定、面向调查效果阶段的检查清单。也收录了助推定义的日文翻译与解说',
  },
  'jachimowicz-2019': {
    title: 'When and why defaults influence decisions: a meta-analysis of default effects',
    publisher: 'Jon M. Jachimowicz 等（Behavioural Public Policy 3）',
    year: '2019',
    note: '对默认效果的 58 组数据（55 项研究、35 篇论文，共 73,675 人）的元分析（通过开放获取的正文确认）。退出制与加入制之差的效应量为 d=0.68［0.53, 0.83］。46 组有明确的正效应，10 组无显著差异，2 组方向相反。消费领域较大，环境领域偏小。被理解为推荐（endorsement）或现状（endowment）的默认设置，效果越大；麻烦程度（ease）没有显著差异（改变麻烦程度的研究很少）。作者建议不要认定一定有效，而要试验确认',
  },
  'carroll-2009': {
    title: 'Optimal Defaults and Active Decisions',
    publisher: 'Gabriel D. Carroll 等（Quarterly Journal of Economics 124）',
    year: '2009（NBER Working Paper 11074）',
    note: '在美国一家公司的 401(k)（确定缴费型退休储蓄制度）中，要求新员工必须选择是否加入的“主动选择”，比普通的加入制，最初加入的比例高 28 个百分点。模型认为：拖延倾向强、每个人想存的金额偏好差别大时，适合主动选择；金融知识少时，适合自动加入（默认）。通过 NBER 页面的摘要确认（正文未打开）',
  },
  'gigerenzer-2007': {
    title: 'Helping Doctors and Patients Make Sense of Health Statistics',
    publisher: 'Gerd Gigerenzer 等（Psychological Science in the Public Interest 8）',
    year: '2007',
    note: '认为难懂的数字呈现方式（包括故意的）会造成误解，建议用绝对风险代替相对风险、用自然频数（人数）代替条件概率、用死亡率代替生存率等。例：“乳腺癌筛查使死亡风险降低 25%”，其实是每 1,000 人中少 1 人死亡。通过 PubMed 摘要确认',
  },
  'okeefe-jensen-2007': {
    title:
      'The relative persuasiveness of gain-framed and loss-framed messages for encouraging disease prevention behaviors: a meta-analytic review',
    publisher: "Daniel J. O'Keefe、Jakob D. Jensen（Journal of Health Communication 12）",
    year: '2007',
    note: '对 93 项促进疾病预防行为的信息研究（N=21,656）的元分析。强调“得”的说法，在统计上比强调“失”的说法略有说服力，但差异非常小（r=.03）。差异主要来自牙齿护理的研究，在安全性行为、皮肤癌预防、饮食方面没有显著差异。通过 PubMed 摘要确认',
  },
  'huber-1982': {
    title: 'Adding Asymmetrically Dominated Alternatives: Violations of Regularity and the Similarity Hypothesis',
    publisher: 'Joel Huber、John W. Payne、Christopher Puto（Journal of Consumer Research 9）',
    year: '1982',
    note: '表明：加入一个比某个选项差、却不比另一个选项差的“非对称劣势选项”（诱饵），会提高优于它的那个选项被选中的概率。通过摘要确认（正文收费，未打开）。FTC 2022 年报告的列表中，没有诱饵选项',
  },
  'frederick-2014': {
    title: 'The Limits of Attraction',
    publisher: 'Shane Frederick、Leonard Lee、Ernest Baskin（Journal of Marketing Research 51）',
    year: '2014',
    note: '第 51 卷第 4 期 487 至 507 页。认为诱饵选项的效果（吸引效应）往往只限于所有特征都用数字表示的简单比较；试用实物，或哪怕只有一个特征用照片等表示时，通常不会出现，因此对其实务意义提出疑问。原研究的作者（Huber、Payne、Puto）在同一期的评论（520 至 525 页）中反驳说，只要条件一致，效果就能重复。两者都通过摘要（OpenAlex）和 Crossref 的书目信息确认（正文收费，未打开）',
  },
  'eu-ucpd-annex1': {
    title: 'Directive 2005/29/EC（Unfair Commercial Practices Directive）Annex I',
    publisher: '欧盟（英国 legislation.gov.uk 上的欧盟法副本）',
    year: '2005',
    note: '附件 I 是在任何情况下都被视为不公平的商业行为清单。第 7 项：为了让消费者马上决定、剥夺其充分考虑的时间或机会，谎称商品或条件只在极短时间内才能获得。无法从 EUR-Lex 获取内容，通过 legislation.gov.uk 的副本（截至 2020 年 12 月 31 日的版本）确认。指令 (EU) 2019/2161 第 3 条只在附件 I 中增加了 11a、23a 至 23c，没有修改第 7 项（通过同一网站上 2019/2161 的条文确认）。至于 2021 年以后的变化，指令 (EU) 2024/825（自 2026 年 9 月 27 日起适用）在附件 I 中增加了 2a、4a 至 4c、10a、23d 至 23i（环境声明、维修、软件更新等），但没有修改第 7 项（通过欧盟出版局官方公报的正式文本确认）',
  },
  'caa-double-price': {
    title: '双重价格标示（《不当赠品类及不当表示防止法》中的不当表示）',
    publisher: '日本消费者厅',
    year: '—',
    note: '比较对照价格的内容不恰当的双重价格标示，有构成不当表示的可能。如果是同一商品最近相当一段时期内一直在卖的价格，就没有问题；不符合这一点的过去价格，如果不准确标明销售的时期和期间，就有可能构成问题。思路见关于不当价格表示的指南（价格表示指南）。有利误认表示（第 5 条第 2 项：让人误以为比实际或比竞争对手显著有利的表示）的要件，通过该厅解释“有利误认”的页面确认',
  },
  'allcott-2009-ceepr': {
    title: 'Social Norms and Energy Conservation（MIT CEEPR Working Paper 09-014）',
    publisher: 'Hunt Allcott（MIT Center for Energy and Environmental Policy Research）',
    year: '2009（10 月修订版）',
    note: '后来发表在 Journal of Public Economics 的论文（allcott-2011）的工作论文版（同行评审前）。在美国明尼苏达州一家电力公司约 8 万户家庭的随机试验中，每月的信让用电量减少了 1.9% 至 2.0%。信的两大支柱是：与附近 100 户面积相近的家庭比较（平均值，以及用电最少的 20% 的家庭；用电少的家庭会看到“Great”“Good”和笑脸标记），以及因户而异的节电建议。由于所有内容一起寄出，文中明确说明无法区分哪一部分起了作用。每 3 个月寄一次的组，效果在下一封信到来前减弱，信一到又增强。打开 PDF 确认',
  },
  'allcott-2015-site-selection': {
    title: 'Site Selection Bias in Program Evaluation',
    publisher: 'Hunt Allcott（Quarterly Journal of Economics 130）',
    year: '2015',
    note: '在 Opower 的 111 项随机对照试验（约 860 万户）中，根据最初 10 个地点的数据所做的预测，大大高估了之后 101 个地点的效果。原因包括：环保意识高的地区的电力公司更早引入，客户反应也更大；起初只寄给用电量大的家庭，后来才扩大等。通过 NBER Working Paper 18373 的摘要和 Crossref 的书目信息（第 130 卷第 3 期 1117 至 1165 页）确认',
  },
  'kluger-denisi-1996': {
    title: 'The effects of feedback interventions on performance: A historical review, a meta-analysis, and a preliminary feedback intervention theory',
    publisher: 'Avraham N. Kluger、Angelo DeNisi（Psychological Bulletin 119）',
    year: '1996',
    note: '对反馈干预的元分析（607 个效应量、23,663 个观察）。平均而言提高了成绩（d=0.41），但三分之一以上降低了成绩。认为注意力越是离开任务、转向自身，效果就越小。因收费，通过摘要（OpenAlex 上的开头部分）和 Crossref 的书目信息确认',
  },
  'tiefenbeck-2018': {
    title: 'Overcoming Salience Bias: How Real-Time Feedback Fosters Resource Conservation',
    publisher: 'Verena Tiefenbeck 等（Management Science 64）',
    year: '2018',
    note: '在洗澡时当场显示所用能源和水量的大规模现场实验中，淋浴的资源消耗减少了 22%。原本用得越多的人减得越多，与汇总反馈全屋用量的传统方法相比，绝对节约量更大。通过摘要（Crossref、OpenAlex）确认。瑞士约 700 户 1 至 2 人家庭、约 2 个月的条件，通过转载波恩大学发布内容（2017 年 2 月）的 ScienceDaily 文章（2017 年 2 月 9 日）确认（未打开大学的页面本身）',
  },
  'bettinger-2012': {
    title: 'The Role of Application Assistance and Information in College Decisions: Results from the H&R Block FAFSA Experiment',
    publisher: 'Eric P. Bettinger、Bridget Terry Long、Philip Oreopoulos、Lisa Sanbonmatsu（Quarterly Journal of Economics 127）',
    year: '2012',
    note: '一项随机试验：为前来接受报税帮助的低收入家庭，当场协助填写联邦学生资助申请表（FAFSA），并告知预计的资助额。父母接受了帮助的高三学生，在实验后 3 年内完成大学 2 年课程的比例从 28% 升至 36%。只拿到资助预估信息的家庭，结果没有改善。因收费，通过摘要（OpenAlex）、NBER Working Paper 15361 的摘要以及 Crossref 的书目信息确认',
  },
  'milkman-2011': {
    title: 'Using implementation intentions prompts to enhance influenza vaccination rates',
    publisher: 'Katherine L. Milkman、John Beshears、James J. Choi、David Laibson、Brigitte C. Madrian（PNAS 108）',
    year: '2011',
    note: '向美国一家大企业的员工寄送写有公司内免费接种日期、时间和地点的通知的现场实验。对照组的接种率为 33.1%。加上填写接种日期的栏，提高 1.5 个百分点（无显著差异）；加上填写日期和时间的栏，提高 4.2 个百分点（显著）。通过 PubMed 摘要确认',
  },
  'dai-2014-fresh-start': {
    title: 'The Fresh Start Effect: Temporal Landmarks Motivate Aspirational Behavior',
    publisher: 'Hengchen Dai、Katherine L. Milkman、Jason Riis（Management Science 60）',
    year: '2014',
    note: '在 3 项基于记录数据的研究（观察性研究）中，“减肥”的搜索、去健身房的次数、对目标的承诺，在新的一周、一个月、一年、一个学期开始时，以及生日、节假日之后都会增加。通过摘要（OpenAlex）确认',
  },
  'klasnja-2019-heartsteps': {
    title: 'Efficacy of Contextually Tailored Suggestions for Physical Activity: A Micro-randomized Optimization Trial of HeartSteps',
    publisher: 'Predrag Klasnja 等（Annals of Behavioral Medicine 53）',
    year: '2019',
    note: '一款鼓励步行的应用的 6 周微随机试验（44 人）。在本人选择的每天最多 5 个时间点，每次随机决定是否发出贴合当时情境的建议。建议之后 30 分钟的步数平均增加 14%（p=0.06）。起初增加 66%，但随着时间推移效果变小。防止久坐的建议没有看到效果。通过 PubMed 摘要确认',
  },
  'ravenscroft-2020': {
    title: 'Video-observed therapy and medication adherence for tuberculosis patients: randomised controlled trial in Moldova',
    publisher: 'Luke Ravenscroft 等（European Respiratory Journal 56）',
    year: '2020',
    note: '在摩尔多瓦，把 197 名结核病患者（不含多重耐药者）随机分为在诊所当着医护人员的面服药的组（99 人）和发送服药视频的组（98 人）的试验。主要指标是 2 周内无法确认服药的天数，平均从 5.24 天减少到 1.29 天（p<0.01）。患者的时间和费用也减少了。治疗成功率没有显著差异。通过 Europe PMC 的摘要和 Crossref 的书目信息确认（正文未打开）。BIT 的 EAST 修订版图中的“确认服药的天数比例 44% → 84%”，与论文主要指标的计算方式不同',
  },
  'caa-moushikomi-guideline': {
    title: '关于邮购申请阶段标示的指南（附件 9）',
    publisher: '日本消费者厅',
    year: '2023（4 月版）',
    note: '对《特定商业交易法》第 12 条之 6 的解说。最终确认画面上显示的“关于撤回或解除申请的事项”，包括解约的条件、方法和效果（例：定期购买解约申请的期限、违约金）。把解约方法限于特定手段或时段等限制，不能只放在链接页面，也必须在最终确认画面上明确标示。指南认为，一边强调“随时可以解约”、实际上却附有条件的标示，有可能属于“令人误解的标示”。打开特定商业交易法指南邮购页面所链接的 PDF 确认',
  },
  'johari-2022': {
    title: 'Always Valid Inference: Continuous Monitoring of A/B Tests',
    publisher: 'Ramesh Johari、Pete Koomen、Leonid Pekelis、David Walsh（Operations Research 70）',
    year: '2022',
    note: '指出：如果一边看结果一边决定是继续还是停止（人数），也就是中途反复查看，A/B 测试的 p 值和置信区间就会完全不可靠；并提出了随时判断都有效的 p 值和置信区间。已用于大规模商用 A/B 测试平台。通过摘要（Crossref 的书目信息）和 arXiv 版（1512.04922）的摘要确认。正文未打开',
  },
  'kohavi-2020': {
    title: 'Trustworthy Online Controlled Experiments: A Practical Guide to A/B Testing',
    publisher: 'Ron Kohavi、Diane Tang、Ya Xu（Cambridge University Press）',
    year: '2020',
    note: '关于在线实验（A/B 测试）的实务书。第 21 章的概要把护栏指标定位为提示实验前提已被破坏的重要指标，分为组织护栏（保护业务，第 7 章讨论）和可信度护栏两类，并认为每个实验都应检查各组人数比例的偏差（SRM）。正文未打开，通过 Cambridge Core 的章节概要和 Crossref 的书目信息确认',
  },
};

/** レクチャーの「出典・参考資料」のリンクの題（日本語の docsOf と同じ並び: 発行元（年）題名） */
export const docsTitles = (ids: string[]): { title: string }[] =>
  ids.map((id) => {
    const s = SOURCES_ZH[id];
    if (!s?.title) throw new Error(`出典が無い: ${id}`);
    return { title: `${s.publisher}（${s.year}）${s.title}` };
  });
