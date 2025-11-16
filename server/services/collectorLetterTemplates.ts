/**
 * Collection Agency Validation Letter Templates per FDCPA/PRD Specifications
 * 
 * These letters are sent to collection agencies/debt buyers requesting validation
 * under FDCPA § 809(b) before disputing with the bureaus.
 */

import { LetterUserInfo } from './roundLetterTemplates';

export interface CollectorInfo {
  collectorName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface CollectionDebtInfo {
  accountNumber?: string | null;
  claimedAmount?: number;
  originalCreditorName?: string | null;
  dateOfChargeOff?: string | null;
  bureausReportedTo?: string[];  // e.g., ["EQUIFAX", "TRANSUNION"]
}

export interface CollectorLetterParams {
  userInfo: LetterUserInfo;
  collectorInfo: CollectorInfo;
  debtInfo: CollectionDebtInfo;
}

/**
 * Generate FDCPA validation letter for debt collectors
 * 
 * Per FDCPA § 809(b), requires:
 * 1. Original contract/promissory note
 * 2. Chain of title (assignments from OC to collector)
 * 3. Complete payment history
 * 4. DOFD verification
 * 5. Credit reporting compliance
 */
export function generateCollectorValidationLetter(params: CollectorLetterParams): string {
  const { userInfo, collectorInfo, debtInfo } = params;
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  
  const header = `${userInfo.name}
${userInfo.addressLine1}
${userInfo.addressLine2 ? userInfo.addressLine2 + '\n' : ''}${userInfo.city}, ${userInfo.state} ${userInfo.zip}
${userInfo.phone ? 'Phone: ' + userInfo.phone + '\n' : ''}${userInfo.email ? 'Email: ' + userInfo.email + '\n' : ''}
${today}

${collectorInfo.collectorName}
${collectorInfo.addressLine1}
${collectorInfo.addressLine2 ? collectorInfo.addressLine2 + '\n' : ''}${collectorInfo.city}, ${collectorInfo.state} ${collectorInfo.zip}

Re: Debt Validation Request under FDCPA § 809(b)${debtInfo.accountNumber ? ' – Account # ' + debtInfo.accountNumber : ''}`;

  const opening = `
To Whom It May Concern:

I am writing in response to collection attempts regarding an alleged debt${debtInfo.originalCreditorName ? ' originally owed to ' + debtInfo.originalCreditorName : ''}${debtInfo.claimedAmount ? ' in the amount of approximately $' + debtInfo.claimedAmount.toLocaleString() : ''}.

Under the Fair Debt Collection Practices Act (FDCPA), 15 U.S.C. § 1692g(b), I dispute the validity of this alleged debt and request that you provide full validation before engaging in any further collection activity or credit reporting.

I do NOT acknowledge that I owe this debt, nor am I waiving any rights under the FDCPA or other applicable consumer protection laws.`;

  const validationRequests = `

Validation Required

Please provide the following information and documentation to validate this alleged debt:

1. Original Contract and Account Opening
   - A complete copy of the original contract, promissory note, or cardmember agreement bearing my signature that created this alleged obligation.
   - The date this account was originally opened.
   - Documentation showing that I applied for and agreed to the terms under which you are attempting to collect.

2. Chain of Title and Assignment
   - A complete chain-of-title showing how this alleged debt passed from the original creditor to you, including:
     * All bills of sale, assignments, or purchase agreements between the original creditor and any subsequent purchasers (including you).
     * Proof that you have the legal right to collect on this alleged debt.
   - If the original creditor transferred or sold this account, documentation showing the transfer/sale occurred and that you properly acquired the account.

3. Payment History and Accounting
   - A complete itemized accounting of the alleged debt, including:
     * All charges, payments, credits, interest, fees, and adjustments from the date the account was opened to the present.
     * Explanation of how you calculated the current balance being claimed.
     * If you added any collection fees, interest, or other charges, justification and calculation for those additions.
   - The date of the last payment made on this account (if any).${debtInfo.dateOfChargeOff ? '\n   - The date of the charge-off (if applicable): ' + debtInfo.dateOfChargeOff + '.' : ''}
   - The date of first delinquency (DOFD) that led to the charge-off.
   - The date of last payment on this account.
   - Confirmation whether the alleged debt is within or beyond the statute of limitations in my state.

4. Credit Reporting and Balances${debtInfo.bureausReportedTo && debtInfo.bureausReportedTo.length > 0 ? `
   - The specific tradeline(s) you currently furnish to any credit reporting agencies (${debtInfo.bureausReportedTo.join(', ')}) regarding this account.` : `
   - The specific tradeline(s) you currently furnish to any credit reporting agencies regarding this account (if any).`}
   - Confirmation that you are not reporting (and will not report) misleading balances or statuses, especially if the original creditor already reports a charge-off with a $0 balance due to sale or transfer.`;

  const demands = `

Required Actions

Unless and until you provide full, adequate validation as requested above, please:

- Cease all collection activity, including phone calls, letters, and credit reporting; and
- Ensure that any existing credit reporting related to this account clearly reflects "disputed by consumer".

If you are not in fact collecting on this obligation or if you determine that you cannot validate it, please:

- Confirm in writing that you have no claim against me regarding this account;
- Refrain from any future collection activity on this alleged debt; and
- Notify any credit reporting agencies to delete or correct any tradeline related to this account as appropriate.

Any attempt to continue collection efforts on an unvalidated debt, or any false/misleading credit reporting, may violate the FDCPA and other applicable consumer protection statutes. I am documenting all communications for potential complaints and legal remedies.

You may respond in writing to the address above.

Sincerely,

${userInfo.name}`;

  return header + opening + validationRequests + demands;
}

/**
 * Helper to format collection agency letter for specific debt buyers
 * (LVNV, Jefferson Capital, Midland, Portfolio Recovery, etc.)
 */
export function generateDebtBuyerValidationLetter(params: CollectorLetterParams): string {
  // For debt buyers, emphasize chain of title requirements more heavily
  return generateCollectorValidationLetter(params);
}

/**
 * Helper for medical collection agencies
 */
export function generateMedicalCollectionLetter(params: CollectorLetterParams): string {
  const baseLetter = generateCollectorValidationLetter(params);
  
  // Add medical-specific language about HIPAA compliance and medical debt reporting rules
  const medicalNote = `\n\nAdditional Note: As this appears to be a medical collection account, please be advised that I expect full compliance with HIPAA privacy regulations and recent guidance regarding medical debt reporting by credit bureaus. If you cannot provide proper HIPAA-compliant authorization for this collection, this may constitute an additional violation.`;
  
  return baseLetter + medicalNote;
}
