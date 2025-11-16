import type { CreditReport, BureauName } from '../models/creditReport';
import type { IssueFlag } from '../models/issues';
import { getRuleForIssue } from '../config/rules_catalog';

export type DisputeAngle =
  | 'INACCURATE'
  | 'UNVERIFIABLE'
  | 'OBSOLETE'
  | 'MISLEADING'
  | 'HARDSHIP_MISREPORTING';

export interface AiIssueExplanation {
  issueId: string;
  accountLabel: string;
  humanSummary: string;
  statutes: string[];
  disputeAngle: DisputeAngle;
  recommendedAction: string;
  priority: 1 | 2 | 3 | 4 | 5;
}

export interface ConsumerContact {
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface BureauContact {
  bureau: BureauName;
  name: string;
  addressLines: string[];
}

export interface CollectorContact {
  collectorName: string;
  addressLines: string[];
}

export interface DisputeLetter {
  recipientName: string;
  recipientAddressLines: string[];
  subject: string;
  body: string;
  relatedIssueIds: string[];
  bureau?: BureauName;
  collectorName?: string;
}

export function buildBureauDisputeLetters(params: {
  report: CreditReport;
  issues: IssueFlag[];
  explanations: AiIssueExplanation[];
  consumer: ConsumerContact;
  bureaus: BureauContact[];
  today?: string;
}): DisputeLetter[] {
  const { issues, explanations, consumer, bureaus } = params;
  const today = params.today ?? new Date().toISOString().substring(0, 10);

  const explanationById = new Map<string, AiIssueExplanation>();
  for (const ex of explanations) explanationById.set(ex.issueId, ex);

  const issuesByBureau = new Map<BureauName, IssueFlag[]>();
  for (const issue of issues) {
    if (!issue.affectedBureaus || issue.affectedBureaus.length === 0) continue;
    for (const bureau of issue.affectedBureaus) {
      if (!issuesByBureau.has(bureau)) issuesByBureau.set(bureau, []);
      issuesByBureau.get(bureau)!.push(issue);
    }
  }

  const letters: DisputeLetter[] = [];

  for (const bureauContact of bureaus) {
    const bureau = bureauContact.bureau;
    const bureauIssues = issuesByBureau.get(bureau);
    if (!bureauIssues || bureauIssues.length === 0) continue;

    const enriched = bureauIssues
      .map(issue => ({ issue, explanation: explanationById.get(issue.id) }))
      .filter(x => x.explanation)
      .sort((a, b) => (a.explanation!.priority || 3) - (b.explanation!.priority || 3));

    if (enriched.length === 0) continue;

    const lines: string[] = [];

    lines.push(consumer.name);
    lines.push(consumer.addressLine1);
    if (consumer.addressLine2) lines.push(consumer.addressLine2);
    lines.push(`${consumer.city}, ${consumer.state} ${consumer.postalCode}`);
    lines.push('');
    lines.push(today);
    lines.push('');
    lines.push(bureauContact.name);
    for (const addr of bureauContact.addressLines) lines.push(addr);
    lines.push('');
    lines.push('Re: Dispute of Inaccurate Information in My Credit File');
    lines.push('');
    lines.push('To Whom It May Concern,');
    lines.push('');
    lines.push(
      `I am writing to dispute the accuracy and completeness of certain items appearing in my credit file with ${bureauContact.name}.`
    );
    lines.push(
      'Below I have identified specific accounts and issues that I believe are being reported inaccurately, incompletely, or in a misleading manner.'
    );
    lines.push('');

    enriched.forEach((entry, idx) => {
      const ex = entry.explanation!;
      const issue = entry.issue;
      const ruleMeta = getRuleForIssue(issue);
      const statutes =
        ex.statutes && ex.statutes.length > 0
          ? ex.statutes.join(', ')
          : 'FCRA/FDCPA/Metro 2 as applicable';

      lines.push(`${idx + 1}. ${ex.accountLabel}`);
      lines.push(`   - Issue: ${ex.humanSummary}`);
      if (ruleMeta) {
        lines.push(`   - Rule: ${ruleMeta.name} (${ruleMeta.rule_id})`);
      }
      lines.push(`   - Possible legal basis: ${statutes}`);
      lines.push(`   - Requested action: ${ex.recommendedAction}`);
      lines.push('');
    });

    lines.push(
      'Under the Fair Credit Reporting Act, I request that you conduct a reasonable reinvestigation of these items, verify all information with the furnisher(s), and promptly delete or correct any information that cannot be verified as accurate and complete.'
    );
    lines.push(
      'Please provide me with the results of your reinvestigation in writing, including an updated copy of my credit report and the names and addresses of any furnishers you contacted.'
    );
    lines.push('');
    lines.push('This draft letter is provided for informational purposes only and is not legal advice.');
    lines.push('');
    lines.push('Sincerely,');
    lines.push('');
    lines.push(consumer.name);

    letters.push({
      recipientName: bureauContact.name,
      recipientAddressLines: bureauContact.addressLines,
      subject: 'Dispute of Inaccurate Information in My Credit File',
      body: lines.join('\n'),
      relatedIssueIds: enriched.map(e => e.issue.id),
      bureau,
    });
  }

  return letters;
}

export function buildCollectorDisputeLetters(params: {
  report: CreditReport;
  issues: IssueFlag[];
  explanations: AiIssueExplanation[];
  consumer: ConsumerContact;
  collectors: CollectorContact[];
  today?: string;
}): DisputeLetter[] {
  const { report, issues, explanations, consumer, collectors } = params;
  const today = params.today ?? new Date().toISOString().substring(0, 10);

  const explanationById = new Map<string, AiIssueExplanation>();
  for (const ex of explanations) explanationById.set(ex.issueId, ex);

  const collectionMeta = new Map<
    string,
    { collectorName: string; bureau: BureauName; originalCreditorName?: string }
  >();

  for (const b of report.bureaus) {
    for (const col of b.collections) {
      collectionMeta.set(col.internalId, {
        collectorName: col.collectorName,
        bureau: b.bureau,
        originalCreditorName: col.originalCreditorName,
      });
    }
  }

  const issuesByCollectorName = new Map<string, IssueFlag[]>();

  for (const issue of issues) {
    if (issue.affectedEntityType !== 'Collection') continue;
    for (const id of issue.affectedIds) {
      const meta = collectionMeta.get(id);
      if (!meta) continue;
      const key = meta.collectorName.trim().toLowerCase();
      if (!issuesByCollectorName.has(key)) issuesByCollectorName.set(key, []);
      issuesByCollectorName.get(key)!.push(issue);
    }
  }

  const letters: DisputeLetter[] = [];

  for (const contact of collectors) {
    const key = contact.collectorName.trim().toLowerCase();
    const collectorIssues = issuesByCollectorName.get(key);
    if (!collectorIssues || collectorIssues.length === 0) continue;

    const enriched = collectorIssues
      .map(issue => ({ issue, explanation: explanationById.get(issue.id) }))
      .filter(x => x.explanation)
      .sort((a, b) => (a.explanation!.priority || 3) - (b.explanation!.priority || 3));

    if (enriched.length === 0) continue;

    const lines: string[] = [];

    lines.push(consumer.name);
    lines.push(consumer.addressLine1);
    if (consumer.addressLine2) lines.push(consumer.addressLine2);
    lines.push(`${consumer.city}, ${consumer.state} ${consumer.postalCode}`);
    lines.push('');
    lines.push(today);
    lines.push('');
    lines.push(contact.collectorName);
    for (const addr of contact.addressLines) lines.push(addr);
    lines.push('');
    lines.push('Re: Dispute and Validation Request Regarding Reported Collection Account(s)');
    lines.push('');
    lines.push('To Whom It May Concern,');
    lines.push('');
    lines.push(
      'I am writing regarding one or more collection accounts that you are reporting and/or attempting to collect in my name. '
      + 'Based on my records and a recent copy of my credit report, I believe there are inaccuracies or missing information regarding these accounts.'
    );
    lines.push('');
    lines.push('Below are specific issues I have identified:');
    lines.push('');

    enriched.forEach((entry, idx) => {
      const ex = entry.explanation!;
      const issue = entry.issue;
      const ruleMeta = getRuleForIssue(issue);
      const statutes =
        ex.statutes && ex.statutes.length > 0
          ? ex.statutes.join(', ')
          : 'FCRA/FDCPA/Metro 2 as applicable';

      lines.push(`${idx + 1}. ${ex.accountLabel}`);
      lines.push(`   - Issue: ${ex.humanSummary}`);
      if (ruleMeta) {
        lines.push(`   - Rule: ${ruleMeta.name} (${ruleMeta.rule_id})`);
      }
      lines.push(`   - Possible legal basis: ${statutes}`);
      lines.push(`   - Requested action: ${ex.recommendedAction}`);
      lines.push('');
    });

    lines.push(
      'Pursuant to the Fair Debt Collection Practices Act, I request that you provide full validation of each alleged debt, '
      + 'including the name of the original creditor, itemized accounting of the amount you claim is owed, and copies of any agreements bearing my signature.'
    );
    lines.push(
      'If you cannot fully validate these debts as accurate and legally collectible, please cease collection efforts and request that any related credit reporting be deleted.'
    );
    lines.push('');
    lines.push('This draft letter is provided for informational purposes only and is not legal advice.');
    lines.push('');
    lines.push('Sincerely,');
    lines.push('');
    lines.push(consumer.name);

    letters.push({
      recipientName: contact.collectorName,
      recipientAddressLines: contact.addressLines,
      subject: 'Dispute and Validation Request Regarding Reported Collection Account(s)',
      body: lines.join('\n'),
      relatedIssueIds: enriched.map(e => e.issue.id),
      collectorName: contact.collectorName,
    });
  }

  return letters;
}
