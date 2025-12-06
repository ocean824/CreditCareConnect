export type BureauName = 'Experian' | 'Equifax' | 'TransUnion' | 'Other';

export interface CreditReport {
  pulledAt: string; // ISO date
  provider: string; // IdentityIQ, SmartCredit, etc.
  consumer: ConsumerIdentity;
  bureaus: BureauReport[];
}

export interface ConsumerIdentity {
  fullName: string;
  otherNames?: string[];
  ssnLast4?: string;
  dob?: string;
  addresses: Address[];
  phones?: string[];
  employers?: string[];
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  fromDate?: string;
  toDate?: string;
}

export interface BureauReport {
  bureau: BureauName;
  reportId?: string;
  tradelines: Tradeline[];
  collections: CollectionAccount[];
  publicRecords: PublicRecord[];
  inquiries: Inquiry[];
}

export type TradelineType =
  | 'Mortgage'
  | 'Auto'
  | 'CreditCard'
  | 'StudentLoan'
  | 'PersonalLoan'
  | 'LineOfCredit'
  | 'Other';

export type TradelineStatus =
  | 'Open'
  | 'Closed'
  | 'Paid'
  | 'Transferred'
  | 'Sold'
  | 'ChargeOff'
  | 'Collection'
  | 'Repossession'
  | 'Foreclosure'
  | 'Late30'
  | 'Late60'
  | 'Late90'
  | 'Late120'
  | 'Late150Plus'
  | 'Delinquent'
  | 'Unknown';

export interface Metro2Snapshot {
  accountStatusCode?: string;
  paymentRatingCode?: string;
  specialCommentCode?: string;
  complianceConditionCode?: string;
  consumerInformationIndicator?: string;
}

export interface PaymentHistoryEntry {
  month: string; // 'YYYY-MM'
  status: 'OK' | '30' | '60' | '90' | '120' | '150' | 'CO' | 'Unknown';
}

export interface Tradeline {
  internalId: string;
  creditorName: string;
  furnisherId?: string;
  accountNumberMasked?: string;
  type: TradelineType;
  status: TradelineStatus;
  isOriginalCreditor?: boolean;
  openedDate?: string;
  closedDate?: string;
  highCreditLimit?: number;
  creditLimit?: number;
  balance?: number;
  pastDueAmount?: number;
  lastPaymentDate?: string;
  lastUpdatedDate?: string;
  dateOfFirstDelinquency?: string;
  paymentHistory?: PaymentHistoryEntry[];
  hardshipFlag?: boolean;
  hardshipDescription?: string;
  forbearanceFlag?: boolean;
  forbearanceStart?: string;
  forbearanceEnd?: string;
  metro2?: Metro2Snapshot;
}

export interface CollectionAccount {
  internalId: string;
  collectorName: string;
  originalCreditorName?: string;
  accountNumberMasked?: string;
  bureauAccountId?: string;
  balance?: number;
  status?: 'Open' | 'Closed' | 'Paid' | 'Settled' | 'Disputed';
  openedDate?: string;
  lastUpdatedDate?: string;
  dateOfFirstDelinquency?: string;
  isMedical?: boolean;
  metro2?: Metro2Snapshot;
}

export interface PublicRecord {
  internalId: string;
  type: 'Bankruptcy' | 'TaxLien' | 'Judgment' | 'Other';
  filedDate?: string;
  resolvedDate?: string;
  status?: 'Open' | 'Satisfied' | 'Released' | 'Discharged';
  courtName?: string;
  docketNumber?: string;
}

export interface Inquiry {
  internalId: string;
  inquirerName: string;
  date: string;
  type: 'Hard' | 'Soft';
  purpose?: string;
}
