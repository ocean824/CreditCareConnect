// Enhanced credit report types supporting tri-merge parsing
export type BureauCode = 'TRI' | 'EXPERIAN' | 'EQUIFAX' | 'TRANSUNION';

export interface CreditReportMeta {
  id: string;
  provider: string; // e.g. 'IDENTITYIQ'
  reportDate: string; // ISO-8601
  bureausIncluded: Exclude<BureauCode, 'TRI'>[]; // e.g. ['EXPERIAN','EQUIFAX','TRANSUNION']
}

export type AccountStatus =
  | 'OPEN'
  | 'CLOSED'
  | 'CURRENT'
  | 'LATE_30'
  | 'LATE_60'
  | 'LATE_90'
  | 'LATE_120'
  | 'LATE_150_PLUS'
  | 'COLLECTION'
  | 'CHARGE_OFF'
  | 'FORECLOSURE'
  | 'REPOSSESSION'
  | 'UNKNOWN';

export type TradelineType =
  | 'MORTGAGE'
  | 'AUTO'
  | 'CREDIT_CARD'
  | 'PERSONAL_LOAN'
  | 'HELOC'
  | 'STUDENT_LOAN'
  | 'OTHER';

export type CollectionStatus = 'OPEN_COLLECTION' | 'PAID_COLLECTION' | 'SETTLED' | 'UNKNOWN';

export interface BureauSnapshot {
  bureau: Exclude<BureauCode, 'TRI'>;
  status: AccountStatus;
  balance: number | null;
  pastDue: number | null;
  lastUpdatedDate?: string;
}

export interface Tradeline {
  id: string;
  creditorName: string;
  accountNumberLast4?: string;
  type: TradelineType;
  status: AccountStatus;
  statusRaw?: string;
  balance: number | null;
  pastDue: number | null;
  bureaus: Exclude<BureauCode, 'TRI'>[];
  bureauSnapshots: BureauSnapshot[];
  remarks?: string[];
  dateOfFirstDelinquency?: string;
  lastPaymentDate?: string;
  openedDate?: string;
  closedDate?: string;
  highCreditLimit?: number;
  creditLimit?: number;
}

export interface CollectionAccount {
  id: string;
  collectorName: string;
  originalCreditorName?: string;
  accountNumberLast4?: string;
  bureauAccountId?: string;
  status: CollectionStatus;
  balance: number | null;
  bureaus: Exclude<BureauCode, 'TRI'>[];
  bureauSnapshots: BureauSnapshot[];
  remarks?: string[];
  dateOfFirstDelinquency?: string;
  openedDate?: string;
  lastUpdatedDate?: string;
}

export interface PublicRecord {
  id: string;
  type: string;
  courtName?: string;
  amount?: number | null;
  filedDate?: string;
  resolvedDate?: string;
  status?: string;
  docketNumber?: string;
  bureaus: Exclude<BureauCode, 'TRI'>[];
}

export interface Inquiry {
  id: string;
  bureau: Exclude<BureauCode, 'TRI'>;
  inquirerName: string;
  date: string; // ISO
  type?: string;
}

export interface ConsumerInfo {
  fullName?: string;
  ssnLast4?: string;
  dob?: string;
  addresses?: Array<{
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  }>;
  phones?: string[];
  employers?: string[];
}

export interface TriMergeCreditReport {
  id: string;
  userId: string;
  meta: CreditReportMeta;
  consumer?: ConsumerInfo;
  tradelines: Tradeline[];
  collections: CollectionAccount[];
  publicRecords: PublicRecord[];
  inquiries: Inquiry[];
}
