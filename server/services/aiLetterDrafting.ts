import OpenAI from "openai";
import type { IssueFlag, StatuteRef } from "../models/issues";
import type { AiIssueExplanation } from "../ai/disputeLetterGenerator";
import type { BureauName } from "../models/creditReport";

const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.OPEN_AI_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

export interface ConsumerInfo {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  dob?: string;
  ssnLast4?: string;
}

export interface ViolationSummary {
  issueId: string;
  ruleId: string;
  accountLabel: string;
  description: string;
  fcraSection: string;
  severity: string;
  category: string;
}

const FCRA_STATUTE_CITATIONS: Record<string, { section: string; title: string; description: string }> = {
  // FCRA Sections
  'FCRA_604': {
    section: '15 U.S.C. § 1681b',
    title: 'Permissible purposes of consumer reports',
    description: 'Restricts who may obtain consumer reports and for what purposes.'
  },
  'FCRA_605': {
    section: '15 U.S.C. § 1681c',
    title: 'Limitations on information contained in consumer reports',
    description: 'Prohibits reporting of obsolete information, including negative items older than 7 years (10 years for bankruptcies).'
  },
  'FCRA_605a': {
    section: '15 U.S.C. § 1681c(a)',
    title: 'Information excluded from consumer reports',
    description: 'Specific time limitations for reporting various types of adverse information.'
  },
  'FCRA_605b': {
    section: '15 U.S.C. § 1681c-1',
    title: 'Identity theft prevention',
    description: 'Requirements for blocking information resulting from identity theft.'
  },
  'FCRA_605c': {
    section: '15 U.S.C. § 1681c(c)',
    title: 'Medical debt and bankruptcy information',
    description: 'Requirements for accurate reporting of medical debts and debts discharged in bankruptcy.'
  },
  'FCRA_607b': {
    section: '15 U.S.C. § 1681e(b)',
    title: 'Accuracy of report',
    description: 'Requires consumer reporting agencies to follow reasonable procedures to assure maximum possible accuracy.'
  },
  'FCRA_609': {
    section: '15 U.S.C. § 1681g',
    title: 'Disclosures to consumers',
    description: 'Requires credit bureaus to disclose all information in consumer file upon request.'
  },
  'FCRA_611': {
    section: '15 U.S.C. § 1681i',
    title: 'Procedure in case of disputed accuracy',
    description: 'Requires reinvestigation of disputed items within 30 days and deletion of unverifiable information.'
  },
  'FCRA_623': {
    section: '15 U.S.C. § 1681s-2',
    title: 'Responsibilities of furnishers of information',
    description: 'Requires furnishers to report accurate and complete information and investigate disputes.'
  },
  'FCRA_623a1': {
    section: '15 U.S.C. § 1681s-2(a)(1)',
    title: 'Duty to provide accurate information',
    description: 'Prohibits furnishers from reporting information known to be inaccurate.'
  },
  'FCRA_623a3': {
    section: '15 U.S.C. § 1681s-2(a)(3)',
    title: 'Duty to provide notice of dispute',
    description: 'Requires furnishers to note when information is disputed by the consumer.'
  },
  'FCRA_623a5': {
    section: '15 U.S.C. § 1681s-2(a)(5)',
    title: 'Duty to provide notice of delinquency',
    description: 'Requires notice to consumer before reporting delinquent account information.'
  },
  
  // FDCPA Sections
  'FDCPA_805': {
    section: '15 U.S.C. § 1692c',
    title: 'Communication in connection with debt collection',
    description: 'Restricts communications with consumer and third parties during debt collection.'
  },
  'FDCPA_806': {
    section: '15 U.S.C. § 1692d',
    title: 'Harassment or abuse',
    description: 'Prohibits conduct intended to harass, oppress, or abuse in connection with debt collection.'
  },
  'FDCPA_807': {
    section: '15 U.S.C. § 1692e',
    title: 'False or misleading representations',
    description: 'Prohibits debt collectors from using false, deceptive, or misleading representations.'
  },
  'FDCPA_808': {
    section: '15 U.S.C. § 1692f',
    title: 'Unfair practices',
    description: 'Prohibits unfair or unconscionable means to collect debts, including unauthorized fees.'
  },
  'FDCPA_809': {
    section: '15 U.S.C. § 1692g',
    title: 'Validation of debts',
    description: 'Requires debt collectors to provide debt validation upon request within 30 days.'
  },
  'FDCPA_810': {
    section: '15 U.S.C. § 1692h',
    title: 'Multiple debts',
    description: 'Requires proper application of payments when consumer owes multiple debts.'
  },
  'FDCPA_811': {
    section: '15 U.S.C. § 1692i',
    title: 'Legal actions by debt collectors',
    description: 'Restricts venue for legal actions to proper jurisdictions.'
  },
  
  // Metro 2 Sections
  'METRO2': {
    section: 'Metro 2 Format',
    title: 'Consumer Data Industry Association standards',
    description: 'Industry standard for credit reporting data accuracy and formatting requirements.'
  },
  'METRO2_BASE_SEGMENT': {
    section: 'Metro 2 Base Segment',
    title: 'Base Segment Record Standards',
    description: 'Core record format requirements including account status codes, payment ratings, dates, and balances.'
  },
  'METRO2_K1_SEGMENT': {
    section: 'Metro 2 K1 Segment',
    title: 'Original Creditor Information',
    description: 'Required K1 segment for collection accounts identifying the original creditor name and account.'
  },
  'METRO2_K2_SEGMENT': {
    section: 'Metro 2 K2 Segment',
    title: 'Purchased Portfolio Information',
    description: 'Required K2 segment for debt buyers documenting chain of ownership and purchase date.'
  },
  
  // Other Statutes
  'CARES_FORBEARANCE': {
    section: 'CARES Act § 4021',
    title: 'Credit protection during COVID-19',
    description: 'Requires accounts in forbearance to be reported as current if previously current.'
  },
  '15_USC_1681b': {
    section: '15 U.S.C. § 1681b',
    title: 'Permissible purposes of consumer reports',
    description: 'Defines who may access consumer credit reports and for what purposes.'
  },
  '15_USC_1681c': {
    section: '15 U.S.C. § 1681c',
    title: 'Requirements relating to information in consumer reports',
    description: 'Sets time limits and restrictions on reporting adverse information.'
  },
  '15_USC_1681c_a_6': {
    section: '15 U.S.C. § 1681c(a)(6)',
    title: 'Paid medical debt exclusion',
    description: 'Prohibits reporting of paid medical debt and medical debts under $500.'
  },
  '15_USC_1681e_b': {
    section: '15 U.S.C. § 1681e(b)',
    title: 'Maximum possible accuracy',
    description: 'Requires CRAs to maintain reasonable procedures to ensure accuracy of consumer reports.'
  },
  '15_USC_1681g': {
    section: '15 U.S.C. § 1681g',
    title: 'Disclosures to consumers',
    description: 'Consumer right to know all information in their credit file.'
  },
  '15_USC_1681i': {
    section: '15 U.S.C. § 1681i',
    title: 'Disputed information procedures',
    description: 'Requires investigation and deletion of inaccurate or unverifiable information.'
  },
  '15_USC_1681s_2': {
    section: '15 U.S.C. § 1681s-2',
    title: 'Responsibilities of furnishers',
    description: 'Comprehensive furnisher duties for accurate reporting and dispute handling.'
  },
  'STATE_LAW_OTHER': {
    section: 'State Consumer Protection Laws',
    title: 'State-specific credit reporting requirements',
    description: 'Additional protections under state consumer protection and credit reporting statutes.'
  },
};

function getStatuteCitation(statuteRef: StatuteRef): string {
  const citation = FCRA_STATUTE_CITATIONS[statuteRef];
  if (citation) {
    return `${citation.section} (${citation.title})`;
  }
  return statuteRef;
}

function formatViolationsForPrompt(
  violations: ViolationSummary[],
  explanations: AiIssueExplanation[]
): string {
  const explanationMap = new Map<string, AiIssueExplanation>();
  for (const ex of explanations) {
    explanationMap.set(ex.issueId, ex);
  }
  
  return violations.map((v, idx) => {
    const ex = explanationMap.get(v.issueId);
    const statutes = FCRA_STATUTE_CITATIONS[v.fcraSection];
    
    let text = `${idx + 1}. Account: ${v.accountLabel}\n`;
    text += `   Violation Code: ${v.ruleId}\n`;
    text += `   Category: ${v.category}\n`;
    text += `   Severity: ${v.severity}\n`;
    text += `   Issue: ${v.description}\n`;
    
    if (statutes) {
      text += `   Legal Citation: ${statutes.section} - ${statutes.title}\n`;
      text += `   Legal Basis: ${statutes.description}\n`;
    }
    
    if (ex) {
      text += `   Analysis: ${ex.humanSummary}\n`;
      text += `   Dispute Angle: ${ex.disputeAngle}\n`;
      text += `   Recommended Action: ${ex.recommendedAction}\n`;
    }
    
    return text;
  }).join('\n');
}

export async function draftAiDisputeLetter(
  violations: ViolationSummary[],
  explanations: AiIssueExplanation[],
  consumer: ConsumerInfo,
  bureau: BureauName,
  round: 1 | 2 | 3 = 1
): Promise<string> {
  if (!openai) {
    console.warn('[aiLetterDrafting] OpenAI not configured - using template letter');
    return generateTemplateDisputeLetter(violations, consumer, bureau, round);
  }
  
  const violationsSummary = formatViolationsForPrompt(violations, explanations);
  
  const roundInstructions = getRoundInstructions(round);
  
  const prompt = `You are an expert credit repair specialist tasked with generating a professional, legally compliant dispute letter for a ${bureau} credit report.

CONSUMER INFORMATION:
Name: ${consumer.name}
Address: ${consumer.address}
City: ${consumer.city}, ${consumer.state} ${consumer.zip}
${consumer.dob ? `Date of Birth: ${consumer.dob}` : ''}
${consumer.ssnLast4 ? `SSN Last 4: ${consumer.ssnLast4}` : ''}

DISPUTE ROUND: ${round}
${roundInstructions}

VIOLATIONS IDENTIFIED:
${violationsSummary}

INSTRUCTIONS:
Draft a formal dispute letter that:

1. Uses proper business letter format with today's date
2. Addresses the ${bureau} credit bureau at their dispute address
3. Clearly identifies each disputed item with specific account details
4. Cites the applicable Fair Credit Reporting Act sections for each violation
5. Explains why each item is inaccurate, incomplete, misleading, or unverifiable
6. Makes specific demands for investigation, correction, or deletion
7. References the consumer's rights under FCRA § 1681i for reinvestigation within 30 days
8. Requests written confirmation of results and updated credit report
9. Maintains a professional, firm, and legally forceful tone
10. Does NOT include any advice disclaimers or template language

For each violation, explicitly cite:
- The specific FCRA section being violated
- Why the information fails to meet FCRA accuracy standards
- The specific remedy requested (deletion, correction, or verification)

The letter should be aggressive but compliant, emphasizing the consumer's legal rights and the bureau's obligations under federal law.`;

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: "You are an expert credit repair specialist who drafts legally compliant, effective dispute letters. Your letters are professional, cite relevant statutes, and make clear demands for correction or deletion of inaccurate information."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.4,
      max_tokens: 3000,
    });
    
    const letter = response.choices[0]?.message?.content?.trim() || '';
    
    if (!letter) {
      console.warn('[aiLetterDrafting] Empty response from AI, using template');
      return generateTemplateDisputeLetter(violations, consumer, bureau, round);
    }
    
    return letter;
  } catch (error) {
    console.error('[aiLetterDrafting] OpenAI error:', error);
    return generateTemplateDisputeLetter(violations, consumer, bureau, round);
  }
}

function getRoundInstructions(round: 1 | 2 | 3): string {
  switch (round) {
    case 1:
      return `This is the INITIAL dispute (Round 1). The letter should:
- Introduce the consumer and their dispute
- Request investigation of each disputed item under FCRA § 1681i
- Demand verification or deletion within 30 days
- Be firm but professional`;
    
    case 2:
      return `This is a FOLLOW-UP dispute (Round 2). The previous dispute was not resolved. The letter should:
- Reference the previous dispute and date
- Note that the bureau failed to properly investigate or correct items
- Cite FCRA § 1681i(a)(5) regarding frivolous disputes
- Demand immediate investigation and correction
- Warn of potential CFPB complaint if not resolved
- Be more assertive in tone`;
    
    case 3:
      return `This is a FINAL NOTICE dispute (Round 3). Multiple previous disputes have failed. The letter should:
- Reference all previous disputes and dates
- Strongly assert willful non-compliance under FCRA § 1681n
- Cite potential statutory damages of $100-$1,000 per violation
- Mention potential punitive damages for willful violations
- State intention to file CFPB complaint and consider legal action
- Be very firm and assertive while remaining professional`;
  }
}

function generateTemplateDisputeLetter(
  violations: ViolationSummary[],
  consumer: ConsumerInfo,
  bureau: BureauName,
  round: 1 | 2 | 3
): string {
  const today = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const bureauAddresses: Record<string, { name: string; address: string }> = {
    'Equifax': { 
      name: 'Equifax Information Services LLC',
      address: 'P.O. Box 740256\nAtlanta, GA 30374'
    },
    'TransUnion': {
      name: 'TransUnion Consumer Solutions',
      address: 'P.O. Box 2000\nChester, PA 19016'
    },
    'Experian': {
      name: 'Experian',
      address: 'P.O. Box 4500\nAllen, TX 75013'
    },
    'Other': {
      name: 'Credit Bureau',
      address: '[Bureau Address]'
    }
  };
  
  const bureauInfo = bureauAddresses[bureau] || bureauAddresses['Other'];
  
  const roundPrefix = round === 1 ? '' : round === 2 ? 'SECOND REQUEST - ' : 'FINAL NOTICE - ';
  
  let letter = `${consumer.name}
${consumer.address}
${consumer.city}, ${consumer.state} ${consumer.zip}

${today}

${bureauInfo.name}
${bureauInfo.address}

Re: ${roundPrefix}Formal Dispute of Inaccurate Credit Information

To Whom It May Concern:

I am writing pursuant to my rights under the Fair Credit Reporting Act, 15 U.S.C. § 1681 et seq., to formally dispute the accuracy of the following information currently appearing on my credit report with ${bureauInfo.name}.

${consumer.dob ? `Date of Birth: ${consumer.dob}` : ''}
${consumer.ssnLast4 ? `Social Security Number (Last 4): XXX-XX-${consumer.ssnLast4}` : ''}

DISPUTED ITEMS:

`;

  violations.forEach((v, idx) => {
    const citation = FCRA_STATUTE_CITATIONS[v.fcraSection];
    letter += `${idx + 1}. ${v.accountLabel}
   Dispute Reason: ${v.description}
   Legal Basis: ${citation ? `${citation.section} - ${citation.title}` : v.fcraSection}
   Requested Action: Delete or correct this inaccurate information

`;
  });

  letter += `LEGAL DEMAND:

Under the Fair Credit Reporting Act, specifically 15 U.S.C. § 1681i, I demand that you:

1. Conduct a reasonable reinvestigation of each disputed item within 30 days
2. Forward all relevant information I provide to the furnisher(s)
3. Delete any information that cannot be verified as accurate and complete
4. Provide me with written notice of the results of your reinvestigation
5. Send me a free updated copy of my credit report showing any corrections

You are hereby notified that failure to comply with the Fair Credit Reporting Act may result in civil liability under 15 U.S.C. § 1681n for willful non-compliance or 15 U.S.C. § 1681o for negligent non-compliance.

Please confirm receipt of this dispute and provide updates within the timeframes required by law.

Sincerely,


${consumer.name}`;

  return letter;
}

export function convertIssuesToViolationSummaries(
  issues: IssueFlag[]
): ViolationSummary[] {
  return issues.map(issue => ({
    issueId: issue.id,
    ruleId: issue.ruleId,
    accountLabel: issue.details?.creditorName as string || 
                  issue.details?.collectorName as string || 
                  `Account ${issue.affectedIds[0]}`,
    description: issue.descriptionMachine,
    fcraSection: issue.statutes[0] || 'FCRA_623',
    severity: issue.severity,
    category: issue.category,
  }));
}
