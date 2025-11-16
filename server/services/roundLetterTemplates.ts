/**
 * Round-Based Letter Templates per PRD Specifications
 * 
 * Round 1: Initial FCRA § 611 reinvestigation request
 * Round 2: Follow-up after inadequate response
 * Round 3: Final notice before CFPB complaint
 */

export interface LetterUserInfo {
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
  email?: string;
  ssnLast4?: string;
  dob?: string;
}

export interface BureauAddress {
  bureau: 'EQUIFAX' | 'TRANSUNION' | 'EXPERIAN';
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface ViolationItem {
  creditorName: string;
  accountNumber?: string;
  issue: string;
  requestedAction: string;
}

export interface LetterGenerationParams {
  round: 1 | 2 | 3;
  userInfo: LetterUserInfo;
  bureauAddress: BureauAddress;
  violations: ViolationItem[];
  priorDisputeDate?: string;  // For Round 2+
  craResponseDate?: string;   // For Round 2+
  reportDate?: string;         // Date of credit report
}

export const BUREAU_ADDRESSES: BureauAddress[] = [
  {
    bureau: 'EQUIFAX',
    name: 'Equifax Information Services LLC',
    addressLine1: 'P.O. Box 740256',
    city: 'Atlanta',
    state: 'GA',
    zip: '30374'
  },
  {
    bureau: 'TRANSUNION',
    name: 'TransUnion Consumer Solutions',
    addressLine1: 'P.O. Box 2000',
    city: 'Chester',
    state: 'PA',
    zip: '19016'
  },
  {
    bureau: 'EXPERIAN',
    name: 'Experian',
    addressLine1: 'P.O. Box 4500',
    city: 'Allen',
    state: 'TX',
    zip: '75013'
  }
];

/**
 * Generate Round 1 dispute letter - Initial FCRA § 611 reinvestigation request
 */
function generateRound1Letter(params: LetterGenerationParams): string {
  const { userInfo, bureauAddress, violations, reportDate } = params;
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const reportDateFormatted = reportDate || today;
  
  const header = `${userInfo.name}
${userInfo.addressLine1}
${userInfo.addressLine2 ? userInfo.addressLine2 + '\n' : ''}${userInfo.city}, ${userInfo.state} ${userInfo.zip}
${userInfo.phone ? 'Phone: ' + userInfo.phone + '\n' : ''}${userInfo.email ? 'Email: ' + userInfo.email + '\n' : ''}${userInfo.ssnLast4 ? 'SSN (last 4): ' + userInfo.ssnLast4 + '\n' : ''}${userInfo.dob ? 'DOB: ' + userInfo.dob + '\n' : ''}
${today}

${bureauAddress.name}
${bureauAddress.addressLine1}
${bureauAddress.addressLine2 ? bureauAddress.addressLine2 + '\n' : ''}${bureauAddress.city}, ${bureauAddress.state} ${bureauAddress.zip}

Re: Request for Reinvestigation under FCRA § 611 – Credit Report dated ${reportDateFormatted}`;

  const opening = `
To Whom It May Concern:

I am writing to dispute the completeness and accuracy of several items appearing on my credit file with your agency, as shown on my credit report dated ${reportDateFormatted}. Under the Fair Credit Reporting Act (FCRA), 15 U.S.C. § 1681e(b) and § 1681i, you are required to follow reasonable procedures to assure maximum possible accuracy and to conduct a reasonable reinvestigation of disputed information.

Please investigate each item below and either 1) correct the tradeline to full accuracy and compliance with FCRA and Metro 2® reporting standards, or 2) delete the tradeline entirely if the furnisher cannot properly verify it.`;

  const disputedItems = `

Disputed Tradelines

Please treat each item below as formally disputed:

${violations.map((v, idx) => `${idx + 1}. ${v.creditorName}${v.accountNumber ? ` – Account # ${v.accountNumber}` : ''}
   Issue: ${v.issue}
   Requested Action:
   ${v.requestedAction}
`).join('\n')}`;

  const legalDuties = `

FCRA / Metro 2 Duties

During reinvestigation:

1. Mark each disputed tradeline as "in dispute by consumer" on my file while you investigate, as required by FCRA.

2. Conduct a reasonable reinvestigation, not just an automated verification, including:
   - Forwarding my dispute details to each furnisher;
   - Requiring documentary validation (not just a yes/no code); and
   - Confirming that Metro 2 status, DOFD, balance, and past-due fields are consistent and accurate.

3. If any furnisher cannot adequately verify the disputed information, you must delete the tradeline or the inaccurate portions.

At the conclusion of your reinvestigation, please:
- Send me written results,
- Provide a free updated copy of my credit report showing all changes, and
- Provide a description of the method of verification, including the name, address, and phone number of each furnisher you contacted.

Thank you for your prompt attention.

Sincerely,

${userInfo.name}`;

  return header + opening + disputedItems + legalDuties;
}

/**
 * Generate Round 2 dispute letter - Follow-up after inadequate response
 */
function generateRound2Letter(params: LetterGenerationParams): string {
  const { userInfo, bureauAddress, violations, priorDisputeDate, craResponseDate } = params;
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  
  const header = `${userInfo.name}
${userInfo.addressLine1}
${userInfo.addressLine2 ? userInfo.addressLine2 + '\n' : ''}${userInfo.city}, ${userInfo.state} ${userInfo.zip}
${userInfo.phone ? 'Phone: ' + userInfo.phone + '\n' : ''}${userInfo.email ? 'Email: ' + userInfo.email + '\n' : ''}
${today}

${bureauAddress.name}
${bureauAddress.addressLine1}
${bureauAddress.addressLine2 ? bureauAddress.addressLine2 + '\n' : ''}${bureauAddress.city}, ${bureauAddress.state} ${bureauAddress.zip}

Re: Second Request for Reinvestigation – Prior Dispute Dated ${priorDisputeDate || '[DATE]'}`;

  const opening = `
To Whom It May Concern:

On ${priorDisputeDate || '[DATE]'}, I sent you a written dispute regarding multiple tradelines on my credit file. You responded on or about ${craResponseDate || '[DATE]'}, but your response did not provide adequate documentation or correction. In many cases, the accounts remain reported as severely delinquent, charged-off, or in foreclosure without any supporting evidence being provided to me, and in some cases your reporting still conflicts with other bureaus.

Under FCRA § 611(a) you must conduct a reasonable reinvestigation. Simply accepting a furnisher's automated "verified" code, without reviewing underlying records, is not sufficient. I am therefore renewing and refining my dispute and requesting that you:

1. Reopen your investigation,
2. Require actual documentation from each furnisher (contracts, payment histories, internal notes, charge-off and deficiency calculations, foreclosure records, forbearance agreements, etc.), and
3. Correct or delete any information that cannot be conclusively verified.`;

  const specificIssues = `

Specific Issues Requiring Documentation

${violations.map((v, idx) => `${idx + 1}. ${v.creditorName}${v.accountNumber ? ` – Account # ${v.accountNumber}` : ''}
   ${v.issue}
   I request that you: ${v.requestedAction}
`).join('\n')}`;

  const escalatedRequests = `

Required Actions

I request that you:

1. Provide me with a detailed description of your reinvestigation, including which documents you reviewed and which furnisher personnel you contacted;

2. Correct or delete any tradeline where the furnisher fails to provide complete records supporting your current reporting; and

3. Ensure all disputed tradelines remain clearly marked as "disputed by consumer" until fully resolved.

If you cannot demonstrate a reasonable reinvestigation and accurate reporting, this may constitute violations of the FCRA and related consumer protection laws, and I will consider filing complaints with the CFPB, my state Attorney General, and other regulators.

Please send me written results and an updated report when your reinvestigation is complete.

Sincerely,

${userInfo.name}`;

  return header + opening + specificIssues + escalatedRequests;
}

/**
 * Generate Round 3 dispute letter - Final notice before CFPB complaint
 */
function generateRound3Letter(params: LetterGenerationParams): string {
  const { userInfo, bureauAddress, violations, priorDisputeDate } = params;
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  
  const header = `${userInfo.name}
${userInfo.addressLine1}
${userInfo.addressLine2 ? userInfo.addressLine2 + '\n' : ''}${userInfo.city}, ${userInfo.state} ${userInfo.zip}
${userInfo.phone ? 'Phone: ' + userInfo.phone + '\n' : ''}${userInfo.email ? 'Email: ' + userInfo.email + '\n' : ''}
${today}

${bureauAddress.name}
${bureauAddress.addressLine1}
${bureauAddress.addressLine2 ? bureauAddress.addressLine2 + '\n' : ''}${bureauAddress.city}, ${bureauAddress.state} ${bureauAddress.zip}

Re: Final Notice – Failure to Conduct Reasonable Reinvestigation under FCRA`;

  const opening = `
To Whom It May Concern:

This is my third written dispute regarding multiple tradelines on my credit file, originally raised on ${priorDisputeDate || '[FIRST DISPUTE DATE]'}. You have either:
- Failed to respond with adequate detail;
- Simply repeated "verified as accurate" without explanation; or
- Left clearly disputed and inconsistent information on my file.

Under FCRA §§ 607(b), 611, 615, you are required to:

1. Maintain reasonable procedures to assure maximum possible accuracy of information;
2. Conduct a reasonable reinvestigation when I dispute an item; and
3. Provide me with a meaningful explanation of adverse information used in credit decisions.

You have been informed of the following violations that remain unresolved:

${violations.map((v, idx) => `- ${v.creditorName}${v.accountNumber ? ' – Account # ' + v.accountNumber : ''}: ${v.issue}`).join('\n')}

Because you have not demonstrated a reasonable reinvestigation or provided substantiating documentation, I now demand that you delete the disputed tradelines rather than continue to report information that may be inaccurate or unverifiable.`;

  const deletionDemand = `

Deletion Demanded

I request deletion of the following tradelines on my ${bureauAddress.bureau} file:

${violations.map((v, idx) => `${idx + 1}. ${v.creditorName}${v.accountNumber ? ' – Account # ' + v.accountNumber : ''}`).join('\n')}

If you refuse to delete these tradelines, please provide within 15 days:

1. A detailed written explanation of your reinvestigation steps;
2. Copies or a description of all documents you relied upon; and
3. The names and contact information of the furnishers who certified the accuracy of each tradeline.

Absent adequate proof of a reasonable investigation and accurate reporting, I will proceed with formal complaints to the Consumer Financial Protection Bureau (CFPB), the Federal Trade Commission (FTC), my state Attorney General, and may explore civil remedies where appropriate.

Please send written confirmation of deletion or a fully documented explanation.

Sincerely,

${userInfo.name}`;

  return header + opening + deletionDemand;
}

/**
 * Main letter generation function - routes to appropriate round template
 */
export function generateRoundBasedLetter(params: LetterGenerationParams): string {
  switch (params.round) {
    case 1:
      return generateRound1Letter(params);
    case 2:
      return generateRound2Letter(params);
    case 3:
      return generateRound3Letter(params);
    default:
      throw new Error(`Invalid round number: ${params.round}. Must be 1, 2, or 3.`);
  }
}

/**
 * Helper to get bureau address by bureau name
 */
export function getBureauAddress(bureau: 'EQUIFAX' | 'TRANSUNION' | 'EXPERIAN'): BureauAddress {
  const addr = BUREAU_ADDRESSES.find(b => b.bureau === bureau);
  if (!addr) {
    throw new Error(`Unknown bureau: ${bureau}`);
  }
  return addr;
}
