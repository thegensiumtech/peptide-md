/**
 * "The honest peptide guide", the lead magnet.
 *
 * Written from scratch for Peptides MD. It covers the compounds people
 * actually ask about, because a guide that avoids them is not useful, but it
 * deliberately publishes no dosing protocols. A GMC-registered doctor's brand
 * printing dose instructions for unlicensed compounds would contradict its own
 * medical disclaimer, and "here is how much to inject" is the one thing a
 * consultation exists to replace.
 *
 * Each compound gets an evidence tier, what it is claimed to do, what the
 * research actually supports, its UK regulatory status, and the specific risk
 * worth knowing. Rendered by scripts/build-guide.mjs.
 */

export type Tier = 'licensed' | 'emerging' | 'experimental';

export interface Compound {
  name: string;
  aka?: string;
  tier: Tier;
  claim: string;
  evidence: string;
  ukStatus: string;
  risk: string;
}

export interface CompoundGroup {
  title: string;
  intro: string;
  compounds: Compound[];
}

export interface GuideSection {
  heading: string;
  standfirst?: string;
  body: string[];
  list?: string[];
  callout?: { title: string; body: string };
}

export const GUIDE_TITLE = 'The honest peptide guide';
export const GUIDE_SUBTITLE =
  'What the evidence actually shows, what you are really buying, and the questions worth asking, from a doctor with nothing to sell you.';

export const TIER_LABEL: Record<Tier, string> = {
  licensed: 'Licensed medicine',
  emerging: 'Human evidence, unlicensed use',
  experimental: 'Experimental',
};

export const OPENING: GuideSection[] = [
  {
    heading: 'Why this guide exists',
    body: [
      'Almost everything written about peptides is written by someone selling them. That is not a conspiracy, it is economics: the guides are marketing, the forums are seeded by suppliers, and the influencers have affiliate links.',
      'This one is written for a clinic that sells twenty minutes of a physician’s time and nothing else. No products, no supplier relationships, no affiliate income. That is the only reason it can afford to tell you when the honest answer is to do nothing.',
      'You will notice one thing missing: doses. Every other guide prints protocols. We do not, and the reason matters, a dose that is right for a 34-year-old man with no other medication may be actively dangerous for someone on a GLP-1, an SSRI, or with undiagnosed thyroid disease. A printed protocol cannot know which you are.',
    ],
    callout: {
      title: 'What you get instead',
      body: 'For each compound: what it is claimed to do, what the human evidence actually supports, whether it is legal to sell in the UK, and the specific risk worth knowing before you go further.',
    },
  },
  {
    heading: 'What a peptide actually is',
    body: [
      'A peptide is a short chain of amino acids, the same building blocks as protein, just fewer of them. Your body makes thousands. Insulin is a peptide. So is oxytocin.',
      'That matters because "peptide" is not a class of drug the way "antibiotic" is. It describes a molecule’s size, not what it does. A peptide can be a licensed medicine, an unlicensed research chemical, or something that does nothing measurable at all.',
      'So "do peptides work?" is roughly as useful a question as "do chemicals work?". The only question worth asking is which specific compound, for what outcome, on what evidence, in people like you.',
    ],
  },
  {
    heading: 'The three tiers of evidence',
    standfirst: 'Every compound in this guide sits in one of these. Knowing which tells you most of what you need.',
    body: [
      'A licensed medicine has been through clinical trials in humans, has an established dose, a known side-effect profile, and a regulator who can withdraw it. If something goes wrong, there is a system.',
      'The middle tier has genuine human research behind it, but is not licensed for the use being marketed, the trials may be small, short, or in a population that does not resemble you.',
      'The experimental tier is where most of the market lives: animal studies, cell studies, or anecdote. Sold as "research chemicals" precisely because that label sidesteps the rules that apply to medicines.',
      'None of this means experimental compounds do nothing. It means nobody has established what they do, at what dose, in whom, or what happens after two years of use.',
    ],
  },
  {
    heading: 'What you are actually buying',
    body: [
      'A vial bought online is not a medicine. It has not been through a pharmacy, carries no marketing authorisation, and nobody independent has verified its contents.',
      'Independent testing of grey-market peptides repeatedly finds three problems: the compound is not what the label says, the quantity is wrong, or the vial carries contaminants from manufacture. Any one of them makes a carefully calculated dose meaningless.',
      'This is the part people underestimate. You can research a compound properly, conclude the evidence supports it, work out a sensible dose, and then inject something else entirely, because nobody in that supply chain is accountable to anyone.',
    ],
    callout: {
      title: 'Reading a certificate of analysis',
      body: 'Ask for one from an independent laboratory, batch-matched to the vial you are being sold, dated, and naming the testing method. A COA for a different batch, or one produced by the seller, tells you nothing. Most suppliers cannot produce a real one, and that answer is itself useful.',
    },
  },
  {
    heading: 'How they are taken, and why it matters',
    body: [
      'Most peptides are injected subcutaneously, because the digestive system breaks down amino acid chains before they reach the bloodstream. That is why oral versions of most compounds are either reformulated at considerable expense or simply do not work.',
      'Some are delivered nasally, some topically. The route changes how much actually reaches circulation, so a dose that means something by injection may mean nothing as a spray.',
      'Injecting brings its own risks that have nothing to do with the compound: technique, sterility, storage temperature, and correct reconstitution. These are boring right up to the point they cause an abscess.',
    ],
    list: [
      'Subcutaneous injection, most common; requires sterile technique and correct storage.',
      'Nasal spray, absorption varies widely between people and products.',
      'Topical, mostly cosmetic claims; systemic absorption is usually minimal.',
      'Oral, generally destroyed by digestion unless specifically reformulated.',
    ],
  },
  {
    heading: 'Where the real risks are',
    standfirst: 'Rarely where people expect.',
    body: [
      'The risk that gets discussed is side effects. The risks that actually cause harm in clinic are more mundane.',
      'Interactions come first. If you take anything else, prescribed, over the counter, or another peptide, the combination has almost certainly never been studied. Your GP cannot warn you about something you have not told them about.',
      'Masking comes second. Fatigue, poor recovery, low mood and weight change are symptoms, not diagnoses. If something improves them without anyone establishing why they were there, a treatable condition can go unexamined for a year.',
      'And stopping matters. Several compounds act on hormonal axes that adapt to their presence. Coming off abruptly is not always neutral.',
    ],
    list: [
      'Interactions with what you already take, least studied, most likely to matter.',
      'Symptoms improving while the actual cause goes uninvestigated.',
      'Non-sterile injection, wrong reconstitution, or storage at the wrong temperature.',
      'Stopping abruptly after affecting a hormonal axis.',
      'Buying from a supply chain with nobody accountable in it.',
    ],
  },
];

export const GROUPS: CompoundGroup[] = [
  {
    title: 'Metabolic and weight',
    intro:
      'The most researched category by a wide margin, and the only one where several compounds are properly licensed medicines. That distinction is worth holding on to: the licensed ones have trial data in tens of thousands of people; the others do not.',
    compounds: [
      {
        name: 'Semaglutide',
        aka: 'Ozempic, Wegovy',
        tier: 'licensed',
        claim: 'Appetite suppression and substantial weight loss; glycaemic control in type 2 diabetes.',
        evidence: 'Large randomised trials with tens of thousands of participants. Among the best-evidenced compounds in this guide.',
        ukStatus: 'Licensed prescription medicine. Legal only with a prescription and pharmacy supply.',
        risk: 'Nausea and gastrointestinal effects are common. Muscle loss alongside fat loss if protein and resistance training are neglected. Not for use in personal or family history of medullary thyroid carcinoma.',
      },
      {
        name: 'Tirzepatide',
        aka: 'Mounjaro, Zepbound',
        tier: 'licensed',
        claim: 'Greater weight loss than semaglutide; dual mechanism.',
        evidence: 'Large randomised trials; head-to-head data suggests greater average weight loss than semaglutide.',
        ukStatus: 'Licensed prescription medicine.',
        risk: 'Similar gastrointestinal profile. The same muscle-loss caution applies. Grey-market versions of both are widespread and are the single most commonly counterfeited peptides.',
      },
      {
        name: 'Retatrutide',
        tier: 'emerging',
        claim: 'Triple-mechanism weight loss, exceeding current licensed options.',
        evidence: 'Phase 2 trial results are genuinely striking, but it is not through full trials and is not approved anywhere.',
        ukStatus: 'Not licensed. Anything sold as retatrutide is unapproved and unverified.',
        risk: 'An unapproved compound at trial-level doses without trial-level monitoring. Long-term safety is simply unknown.',
      },
      {
        name: 'Cagrilintide',
        tier: 'emerging',
        claim: 'Appetite regulation, often discussed alongside semaglutide.',
        evidence: 'In active clinical development with published trial data; not yet approved.',
        ukStatus: 'Not licensed.',
        risk: 'Usually discussed in combination, which compounds the unknowns rather than halving them.',
      },
      {
        name: 'AOD-9604',
        tier: 'experimental',
        claim: 'Fat loss without the other effects of growth hormone.',
        evidence: 'Human trials exist and were largely disappointing, it did not outperform placebo for weight loss at the doses studied.',
        ukStatus: 'Not licensed as a medicine.',
        risk: 'The main risk is spending money and delaying something that would work.',
      },
      {
        name: 'Tesamorelin',
        tier: 'licensed',
        claim: 'Reduction of visceral abdominal fat.',
        evidence: 'Trial evidence in a specific population. HIV-associated lipodystrophy, where it is genuinely effective.',
        ukStatus: 'Licensed in some territories for that narrow indication; not a general weight-loss agent.',
        risk: 'Evidence outside that population is thin. Raises IGF-1, which carries the usual growth-axis considerations.',
      },
    ],
  },
  {
    title: 'Repair, tendon and injury',
    intro:
      'The category with the loudest anecdotal reputation and the thinnest human data. Almost everything below rests on animal studies. That does not make it worthless, but it does mean nobody can tell you the dose, the duration, or what happens long term.',
    compounds: [
      {
        name: 'BPC-157',
        tier: 'experimental',
        claim: 'Accelerated healing of tendon, ligament and gut tissue.',
        evidence: 'Extensive and genuinely interesting animal research. Essentially no published controlled human trials.',
        ukStatus: 'Not licensed. Sold as a research chemical. Prohibited in sport by WADA.',
        risk: 'The most popular peptide with the widest gap between reputation and human evidence. Effects on healing tissue are, by definition, effects on cell growth, an area where long-term data would matter and does not exist.',
      },
      {
        name: 'TB-500',
        aka: 'Thymosin beta-4 fragment',
        tier: 'experimental',
        claim: 'Tissue repair, reduced inflammation, improved flexibility.',
        evidence: 'Animal and cell studies. No controlled human trials of consequence.',
        ukStatus: 'Not licensed. Prohibited in sport.',
        risk: 'Promotes angiogenesis, new blood vessel growth. That is the mechanism, and it is also why anyone with a cancer history should not be experimenting unsupervised.',
      },
      {
        name: 'GHK-Cu',
        tier: 'experimental',
        claim: 'Skin repair, collagen synthesis, wound healing, hair.',
        evidence: 'Reasonable cosmetic and topical research; systemic injected use is far less studied.',
        ukStatus: 'Widely sold in cosmetics. Injectable forms are unlicensed.',
        risk: 'A copper peptide. Topical use is comparatively low risk; injecting copper-containing compounds without monitoring is a different proposition.',
      },
      {
        name: 'PEG-MGF',
        tier: 'experimental',
        claim: 'Muscle repair and growth following training.',
        evidence: 'Preclinical only.',
        ukStatus: 'Not licensed. Prohibited in sport.',
        risk: 'No human dosing data at all. Marketed almost exclusively to bodybuilders.',
      },
      {
        name: 'Follistatin (344 and recombinant forms)',
        tier: 'experimental',
        claim: 'Muscle growth by inhibiting myostatin.',
        evidence: 'Animal work and gene-therapy research; nothing supporting the injectable products sold online.',
        ukStatus: 'Not licensed.',
        risk: 'Among the least characterised compounds commonly sold. Interfering with myostatin regulation has systemic consequences that are not understood in humans.',
      },
    ],
  },
  {
    title: 'Growth hormone secretagogues',
    intro:
      'These do not supply growth hormone; they prompt your own pituitary to release more. That distinction is often used in marketing to suggest they are inherently safer. It is not that simple, the downstream effect is still raised IGF-1.',
    compounds: [
      {
        name: 'CJC-1295',
        tier: 'experimental',
        claim: 'Sustained increase in growth hormone release.',
        evidence: 'Some early human pharmacokinetic work; no meaningful outcome trials.',
        ukStatus: 'Not licensed. Prohibited in sport.',
        risk: 'Commonly stacked with ipamorelin, which multiplies the unknowns. Raised IGF-1 over time is not a neutral state.',
      },
      {
        name: 'Ipamorelin',
        tier: 'experimental',
        claim: 'Growth hormone release with fewer side effects than older secretagogues.',
        evidence: 'Limited human data; better tolerated than some predecessors in the studies that exist.',
        ukStatus: 'Not licensed.',
        risk: 'Water retention, joint discomfort, blood sugar effects. Anyone with a cancer history should not be raising IGF-1 without oversight.',
      },
      {
        name: 'Sermorelin',
        tier: 'emerging',
        claim: 'Stimulates natural growth hormone production.',
        evidence: 'Was historically a licensed medicine for paediatric growth hormone deficiency; more clinical history than most of this category.',
        ukStatus: 'Withdrawn from many markets; not generally available as a licensed product.',
        risk: 'Diagnosing yourself with growth hormone deficiency is the actual risk here, it is a specific clinical condition with specific tests.',
      },
      {
        name: 'Hexarelin',
        tier: 'experimental',
        claim: 'Strong growth hormone release.',
        evidence: 'Limited human study; potency comes with more pronounced effects on prolactin and cortisol.',
        ukStatus: 'Not licensed.',
        risk: 'Tolerance develops. Effects on other hormones are more marked than the gentler agents in this group.',
      },
    ],
  },
  {
    title: 'Cognitive and mood',
    intro:
      'The category where the gap between marketing and evidence is widest, and where self-treating is least advisable, because the symptoms being targeted are frequently signs of something a doctor should be looking at.',
    compounds: [
      {
        name: 'Semax',
        tier: 'experimental',
        claim: 'Focus, memory, recovery after stroke.',
        evidence: 'Russian clinical use and literature; very little that meets Western trial standards.',
        ukStatus: 'Not licensed in the UK or EU.',
        risk: 'Cognitive complaints have many treatable causes, sleep apnoea, thyroid disease, depression, anaemia. Masking them is the real harm.',
      },
      {
        name: 'Selank',
        tier: 'experimental',
        claim: 'Anxiety reduction without sedation.',
        evidence: 'Same picture as Semax: regional clinical use, thin international evidence.',
        ukStatus: 'Not licensed.',
        risk: 'Self-treating anxiety with an unlicensed compound instead of an assessment is the concern, not the molecule.',
      },
      {
        name: 'Dihexa',
        tier: 'experimental',
        claim: 'Powerful cognitive enhancement; synapse formation.',
        evidence: 'Preclinical only. Marketing claims are dramatically ahead of the data.',
        ukStatus: 'Not licensed.',
        risk: 'A compound that promotes synaptic growth is a compound affecting brain structure. Long-term human safety is entirely unknown.',
      },
      {
        name: 'Cerebrolysin',
        tier: 'emerging',
        claim: 'Neurological recovery, dementia, stroke.',
        evidence: 'Considerable clinical use in parts of Europe and Asia with mixed trial results; not a fringe compound, but not established either.',
        ukStatus: 'Not licensed in the UK.',
        risk: 'Derived from porcine brain tissue. Source and manufacture matter enormously.',
      },
      {
        name: 'Pinealon',
        tier: 'experimental',
        claim: 'Neuroprotection and cognitive support.',
        evidence: 'Almost entirely Russian-language preclinical work.',
        ukStatus: 'Not licensed.',
        risk: 'Very little independent verification of what these products contain.',
      },
    ],
  },
  {
    title: 'Sleep, longevity and hormonal',
    intro:
      'A mixed group. Some have plausible mechanisms and real research; others are sold on animal lifespan data that has never translated to humans.',
    compounds: [
      {
        name: 'DSIP',
        aka: 'Delta sleep-inducing peptide',
        tier: 'experimental',
        claim: 'Improved sleep quality and depth.',
        evidence: 'Old and inconsistent human studies. Results have not been reliably reproduced.',
        ukStatus: 'Not licensed.',
        risk: 'Persistent poor sleep is a symptom. Sleep apnoea in particular is common, serious and treatable, and frequently missed.',
      },
      {
        name: 'Epitalon',
        tier: 'experimental',
        claim: 'Telomere lengthening and life extension.',
        evidence: 'Animal work and small Russian studies. The longevity claims are not supported by anything that would satisfy a regulator.',
        ukStatus: 'Not licensed.',
        risk: 'Compounds that influence cellular ageing mechanisms are not obviously benign; the same pathways matter in cancer biology.',
      },
      {
        name: 'MOTS-c',
        tier: 'experimental',
        claim: 'Metabolic and mitochondrial benefits, exercise capacity.',
        evidence: 'Genuinely interesting mitochondrial biology; human outcome data is minimal.',
        ukStatus: 'Not licensed.',
        risk: 'An area of legitimate research being sold years ahead of the evidence.',
      },
      {
        name: 'SS-31',
        aka: 'Elamipretide',
        tier: 'emerging',
        claim: 'Mitochondrial function in disease and ageing.',
        evidence: 'Has been through genuine clinical trials for specific mitochondrial diseases, with mixed results.',
        ukStatus: 'Not licensed.',
        risk: 'Trial evidence is in specific disease populations, not healthy people seeking more energy.',
      },
      {
        name: 'PT-141',
        aka: 'Bremelanotide',
        tier: 'licensed',
        claim: 'Sexual desire and arousal.',
        evidence: 'Approved in the US for hypoactive sexual desire disorder in premenopausal women, on trial evidence.',
        ukStatus: 'Not licensed in the UK.',
        risk: 'Raises blood pressure. Nausea is common. Not for anyone with uncontrolled hypertension or cardiovascular disease.',
      },
      {
        name: 'Melanotan II',
        tier: 'experimental',
        claim: 'Tanning without sun exposure.',
        evidence: 'Effects are real; the safety profile is the problem.',
        ukStatus: 'Illegal to sell in the UK. The MHRA has warned about it specifically.',
        risk: 'Changes in moles, nausea, blood pressure effects. Anything altering pigmentation while obscuring moles is a genuine melanoma concern.',
      },
      {
        name: 'Kisspeptin',
        tier: 'experimental',
        claim: 'Reproductive hormone regulation, libido.',
        evidence: 'Real academic research into reproductive endocrinology; not a consumer product.',
        ukStatus: 'Not licensed.',
        risk: 'Acts on the reproductive hormonal axis. Not somewhere to experiment without endocrine oversight.',
      },
    ],
  },
  {
    title: 'Immune and gut',
    intro:
      'Frequently marketed for chronic conditions where patients have been failed elsewhere, which makes this the category where careful thinking matters most.',
    compounds: [
      {
        name: 'Thymosin alpha-1',
        tier: 'emerging',
        claim: 'Immune modulation.',
        evidence: 'Licensed in several countries for hepatitis B and used as an adjunct in sepsis; a real clinical history.',
        ukStatus: 'Not licensed in the UK.',
        risk: 'Modulating immune function is exactly what you do not want to do unsupervised if you have an autoimmune condition.',
      },
      {
        name: 'LL-37',
        tier: 'experimental',
        claim: 'Antimicrobial and immune effects.',
        evidence: 'Legitimate research into antimicrobial peptides; no established therapeutic use.',
        ukStatus: 'Not licensed.',
        risk: 'Pro-inflammatory in some contexts. Marketed for chronic infection claims that are frequently themselves unverified.',
      },
      {
        name: 'KPV',
        tier: 'experimental',
        claim: 'Anti-inflammatory effects, particularly in the gut.',
        evidence: 'Preclinical.',
        ukStatus: 'Not licensed.',
        risk: 'Gut symptoms need a diagnosis first. Inflammatory bowel disease and coeliac disease are treatable and are missed when symptoms are suppressed.',
      },
    ],
  },
];

export const CLOSING: GuideSection[] = [
  {
    heading: 'Questions worth answering before you start anything',
    standfirst: 'If you cannot answer these, you are not ready to take it, whatever it is.',
    body: [
      'These are the questions a doctor would work through with you. Working through them alone is better than not working through them at all.',
    ],
    list: [
      'What specifically am I trying to change, and how would I know if it worked?',
      'What is the human evidence for this compound, for that outcome, in people like me?',
      'What else am I taking, and has anyone studied the combination?',
      'Have the ordinary causes been ruled out, bloods, thyroid, iron, B12, sleep, mood?',
      'Can the seller produce a batch-matched certificate of analysis?',
      'Who is monitoring me, and what would make me stop early?',
      'What is the exit plan, and what happens when I stop?',
    ],
  },
  {
    heading: 'The boring answer that usually wins',
    body: [
      'A large share of people who arrive asking about peptides turn out to have something simpler going on. Untreated sleep apnoea. Iron deficiency. Subclinical thyroid disease. Chronic under-recovery from training. Depression presenting as fatigue. Perimenopause.',
      'None of that is exciting advice. It is, however, what actually resolves the symptom, and it costs a fraction of a year of unlicensed compounds bought from a stranger.',
      'A good doctor is not trying to talk you out of peptides. They are trying to make sure you are not treating a fixable problem with something unlicensed, unverified and unmonitored.',
    ],
  },
  {
    heading: 'What we do',
    body: [
      'Peptides MD is a twenty-minute private consultation with a GMC-registered doctor experienced in this area. You describe what you are taking or considering, and what you are trying to fix. He tells you what he thinks.',
      'We do not sell, supply or prescribe any peptide, and we have no relationship with any supplier. If the honest answer is that you should not be taking anything, that is the answer you get.',
      'If you have already started something and want a second opinion, that is a perfectly good reason to book.',
    ],
    callout: {
      title: 'Important',
      body: 'This guide is general information, not medical advice. It is not tailored to you and should not be acted on as though it were. Nothing here is a recommendation to take any compound. If you are unwell, or reacting to something you have taken, contact NHS 111, your GP, or 999 in an emergency.',
    },
  },
];
