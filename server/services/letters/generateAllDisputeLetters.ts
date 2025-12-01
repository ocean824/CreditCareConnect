import type { CreditReport } from "../../models/creditReport";
import type { IssueFlag } from "../../models/issues";

export interface ConsumerProfile {
  fullName: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface DisputeLetterParams {
  report: CreditReport;
  consumer: ConsumerProfile;
  issues: IssueFlag[];
  bureau: string;
}

export function generateBureauDispute(params: DisputeLetterParams): string {
  const { report, consumer, issues, bureau } = params;

  const header = `${consumer.fullName}
${consumer.addressLine1}
${consumer.city}, ${consumer.state} ${consumer.postalCode}

[DATE]

Re: Request for Investigation and Correction of Credit Report Errors - ${bureau}

Dear ${bureau} Credit Bureau:`;

  const intro = `I am writing to formally dispute inaccurate, incomplete, misleading, and unverifiable information on my credit report. This letter constitutes a formal request for reinvestigation under the Fair Credit Reporting Act (FCRA), 15 U.S.C. § 1681i, and related regulations.

I have discovered the following problematic items requiring immediate investigation and correction:`;

  const issueDetails = issues
    .map(
      (issue) =>
        `• ${issue.descriptionMachine}
  Rule: ${issue.ruleId}
  Severity: ${issue.severity}
  Applicable Law: ${issue.statutes.join(", ")}`
    )
    .join("\n\n");

  const closing = `Please conduct a thorough reinvestigation of these items, including contacting all furnishers. For any item that cannot be verified as completely accurate and properly coded in accordance with industry standards and legal requirements, it must be deleted from my credit file.

I request that you provide me with:
1. The results of your reinvestigation within 30 days
2. A corrected copy of my credit report
3. Notification of corrections to other bureaus

Sincerely,
${consumer.fullName}`;

  return [header, intro, issueDetails, closing].join("\n\n");
}
