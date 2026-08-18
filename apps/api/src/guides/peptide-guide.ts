/**
 * "What a doctor would tell you about peptides" — the lead magnet.
 *
 * Written from scratch for Peptides MD. It is deliberately not modelled on any
 * existing commercial guide: those are copyrighted, and a derivative would be
 * both a legal risk and off-brand. The whole positioning is a doctor with
 * nothing to sell, so the guide's value is candour — including the parts that
 * tell a reader not to buy anything.
 *
 * Rendered to PDF by scripts/build-guide.mjs.
 */
export interface GuideSection {
  heading: string;
  standfirst?: string;
  body: string[];
  list?: string[];
  callout?: { title: string; body: string };
}

export const GUIDE_TITLE = 'What a doctor would actually tell you about peptides';
export const GUIDE_SUBTITLE =
  'An honest briefing for anyone considering peptide therapy — including when the answer is no.';

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    heading: 'Why this guide exists',
    body: [
      'Almost everything written about peptides is written by someone selling them. That is not a conspiracy, it is just economics: the guides are marketing, the forums are seeded by suppliers, and the influencers have affiliate links.',
      'This one is written by a doctor who has no products, no supplier relationships and no affiliate income. Peptides MD sells twenty minutes of a physician’s time and nothing else. That is the only reason this guide can afford to tell you when the honest answer is to do nothing.',
      'It will not tell you what to take. It will tell you what to ask, what to check, and where the genuine risks are.',
    ],
  },
  {
    heading: 'What a peptide actually is',
    body: [
      'A peptide is a short chain of amino acids — the same building blocks as protein, just fewer of them. Your body makes thousands of them. Insulin is a peptide. So is oxytocin.',
      'That matters because "peptide" is not a category of drug the way "antibiotic" is. It describes a molecule’s size, not what it does. A peptide can be a licensed medicine, an unlicensed research chemical, or something that does nothing at all.',
      'When someone says "peptides work", they have said roughly as much as "chemicals work". The only useful question is which specific compound, at what dose, for what, and on what evidence.',
    ],
    callout: {
      title: 'The first question worth asking',
      body: 'Not "do peptides work?" but "what is the evidence for this specific compound, in people, for the thing I actually want to change?"',
    },
  },
  {
    heading: 'The three tiers of evidence',
    standfirst: 'Almost every peptide falls into one of these. Knowing which one you are dealing with tells you most of what you need.',
    body: [
      'Compounds in the first tier are licensed medicines. They have been through clinical trials, they have known doses, known side effects and a regulator who can withdraw them. Semaglutide and tirzepatide sit here.',
      'The second tier has real human research behind it, but is not licensed for the use being marketed. There may be genuine trials, often small, often in a narrow population that may not resemble you.',
      'The third tier is where most of the market lives. Animal studies, cell studies, or nothing but anecdote. Sold as "research chemicals" precisely because that label sidesteps the rules that apply to medicines.',
      'None of this means tier three compounds do nothing. It means nobody has established what they do, at what dose, or what happens after two years.',
    ],
    list: [
      'Tier one — licensed, trialled, regulated. Prescribed and monitored.',
      'Tier two — human evidence exists, but not for this use, or not at this dose.',
      'Tier three — preclinical or anecdotal. Unknown dose, unknown risk, unknown interactions.',
    ],
  },
  {
    heading: 'What you are actually buying',
    body: [
      'A vial bought online is not a medicine. It has not been through a pharmacy, it carries no marketing authorisation, and nobody has verified what is in it.',
      'Independent testing of grey-market peptides repeatedly finds three problems: the compound is not what the label says, the quantity is wrong, or the vial contains contaminants from the manufacturing process. Any of the three makes a dose meaningless.',
      'This is the part patients underestimate. You can research a compound carefully, decide the evidence supports it, calculate a sensible dose — and then inject something else entirely, because the supply chain has no one accountable in it.',
    ],
    callout: {
      title: 'A practical test',
      body: 'Ask a supplier for a certificate of analysis from an independent laboratory, batch-matched to the vial you are being sold. Most cannot produce one. That answer tells you a great deal.',
    },
  },
  {
    heading: 'Where the real risks are',
    standfirst: 'Not usually where people expect.',
    body: [
      'The risk that gets discussed is side effects from the compound. The risks that actually cause harm are more mundane.',
      'Interactions come first. If you take anything else — prescribed, over the counter, or another peptide — the combination has almost never been studied. Your GP cannot warn you about a compound you have not told them about.',
      'Masking comes second. Fatigue, poor recovery, low mood and weight change are symptoms, not diagnoses. If something makes them better without anyone establishing why they were there, an underlying condition can go unexamined for a year.',
      'Injection technique comes third and is boring right up until it causes an abscess. Sterile technique, correct storage and correct reconstitution are not optional details.',
    ],
    list: [
      'Interactions with what you already take — the least studied and most likely problem.',
      'Symptoms improving without the cause ever being investigated.',
      'Non-sterile injection, incorrect reconstitution, or storage at the wrong temperature.',
      'Stopping abruptly, when a compound has affected a hormonal axis.',
    ],
  },
  {
    heading: 'Questions worth asking before you start anything',
    standfirst: 'If you cannot answer these, you are not ready to take it.',
    body: [
      'These are the questions a doctor would work through with you. Working through them alone is better than not working through them at all.',
    ],
    list: [
      'What specifically am I trying to change, and how would I know if it worked?',
      'What is the human evidence for this compound, for that outcome?',
      'What else am I taking, and has anyone studied the combination?',
      'Have the ordinary causes been ruled out — bloods, thyroid, iron, sleep, mental health?',
      'What is the exit plan, and what happens when I stop?',
      'Who is monitoring me, and what would make me stop early?',
    ],
  },
  {
    heading: 'The boring answer that usually wins',
    body: [
      'In clinic, a large share of people who arrive asking about peptides turn out to have something simpler going on. Untreated sleep apnoea. Iron deficiency. Subclinical thyroid disease. Chronic under-recovery from training. Depression presenting as fatigue.',
      'None of that is satisfying advice. It is, however, what actually resolves the symptom — and it is what an honest consultation will look for first.',
      'A good doctor is not trying to talk you out of peptides. They are trying to make sure you are not treating a fixable problem with an unlicensed compound bought from a stranger.',
    ],
  },
  {
    heading: 'What we do',
    body: [
      'Peptides MD is a twenty-minute private consultation with a GMC-registered doctor experienced in this area. You describe what you are taking or considering, and what you are trying to fix. He tells you what he thinks.',
      'We do not sell, supply or prescribe any peptide. We have no relationship with any supplier. If the honest answer is that you should not be taking anything, that is the answer you get — and it is worth the same as any other.',
      'If you have already started something and want a second opinion, that is a perfectly good reason to book.',
    ],
    callout: {
      title: 'Important',
      body: 'This guide is general information, not medical advice. It is not tailored to you and should not be acted on as though it were. If you are unwell, or reacting to something you have taken, contact NHS 111, your GP, or 999 in an emergency.',
    },
  },
];
