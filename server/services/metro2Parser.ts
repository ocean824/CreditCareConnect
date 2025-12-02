import fs from 'fs';
import path from 'path';
import type { CreditReport, Tradeline, CollectionAccount, BureauReport } from '../models/creditReport';
import { nanoid } from 'nanoid';

export interface Metro2BaseSegment {
  recordIdentifier: string;
  processingIndicator: string;
  accountNumber: string;
  consumerAccountNumber?: string;
  portfolioType: string;
  accountType: string;
  dateOpened?: string;
  creditLimit?: number;
  highestCredit?: number;
  termsFrequency?: string;
  currentBalance?: number;
  amountPastDue?: number;
  dateOfAccountInformation?: string;
  dateOfFirstDelinquency?: string;
  dateClosed?: string;
  dateOfLastPayment?: string;
  accountStatus: string;
  paymentRating?: string;
  paymentHistoryProfile?: string;
  specialCommentCode?: string;
  complianceConditionCode?: string;
  consumerInformationIndicator?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  generationCode?: string;
  socialSecurityNumber?: string;
  dateOfBirth?: string;
  telephoneNumber?: string;
  ecoa?: string;
  consumerTransactionType?: string;
  countryCode?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface Metro2Header {
  recordIdentifier: string;
  recordSize: number;
  blockingFactor: number;
  activityDate?: string;
  dateCreated?: string;
  programDate?: string;
  programRevisionDate?: string;
  reporterName?: string;
  reporterAddress?: string;
  reporterCity?: string;
  reporterState?: string;
  reporterPostalCode?: string;
  reporterPhone?: string;
}

export interface Metro2Trailer {
  recordIdentifier: string;
  totalBaseRecords: number;
  totalJ1Records?: number;
  totalJ2Records?: number;
  totalK1Records?: number;
  totalK2Records?: number;
  totalK3Records?: number;
  totalK4Records?: number;
  totalL1Records?: number;
  totalN1Records?: number;
}

export interface Metro2ParsedFile {
  header: Metro2Header;
  baseSegments: Metro2BaseSegment[];
  trailer: Metro2Trailer;
}

const ACCOUNT_STATUS_MAP: Record<string, string> = {
  '00': 'Unknown',
  '05': 'Transferred',
  '11': 'Current',
  '13': 'Paid',
  '61': 'Paid',
  '62': 'Paid',
  '63': 'Paid',
  '64': 'Paid',
  '65': 'Paid',
  '71': 'Late30',
  '78': 'Late60',
  '80': 'Late90',
  '82': 'Late120',
  '83': 'Late150',
  '84': 'Late180',
  '93': 'Collection',
  '94': 'Foreclosure',
  '95': 'ChargeOff',
  '96': 'Repossession',
  '97': 'Bankruptcy',
};

const PORTFOLIO_TYPE_MAP: Record<string, string> = {
  'C': 'LineOfCredit',
  'I': 'Other',
  'M': 'Mortgage',
  'O': 'Other',
  'R': 'CreditCard',
};

export function parseMetro2Line(line: string): Metro2BaseSegment | null {
  if (line.length < 426) {
    return null;
  }

  const recordIdentifier = line.substring(0, 4).trim();
  
  if (recordIdentifier !== '0200' && recordIdentifier !== '0300') {
    return null;
  }

  try {
    return {
      recordIdentifier,
      processingIndicator: line.substring(4, 5).trim(),
      accountNumber: line.substring(10, 40).trim(),
      portfolioType: line.substring(5, 6).trim(),
      accountType: line.substring(6, 8).trim(),
      dateOpened: parseMetro2Date(line.substring(40, 48)),
      creditLimit: parseMetro2Amount(line.substring(56, 65)),
      highestCredit: parseMetro2Amount(line.substring(65, 74)),
      currentBalance: parseMetro2Amount(line.substring(102, 111)),
      amountPastDue: parseMetro2Amount(line.substring(111, 120)),
      dateOfAccountInformation: parseMetro2Date(line.substring(120, 128)),
      dateOfFirstDelinquency: parseMetro2Date(line.substring(128, 136)),
      dateClosed: parseMetro2Date(line.substring(136, 144)),
      dateOfLastPayment: parseMetro2Date(line.substring(144, 152)),
      accountStatus: line.substring(152, 154).trim(),
      paymentRating: line.substring(154, 155).trim(),
      paymentHistoryProfile: line.substring(155, 179).trim(),
      specialCommentCode: line.substring(179, 181).trim(),
      complianceConditionCode: line.substring(181, 183).trim(),
      consumerInformationIndicator: line.substring(183, 185).trim(),
      firstName: line.substring(185, 210).trim(),
      lastName: line.substring(210, 260).trim(),
      middleName: line.substring(260, 280).trim(),
      generationCode: line.substring(280, 281).trim(),
      socialSecurityNumber: line.substring(281, 290).trim(),
      dateOfBirth: parseMetro2Date(line.substring(290, 298)),
      telephoneNumber: line.substring(298, 308).trim(),
      ecoa: line.substring(308, 309).trim(),
      addressLine1: line.substring(309, 341).trim(),
      addressLine2: line.substring(341, 373).trim(),
      city: line.substring(373, 393).trim(),
      state: line.substring(393, 395).trim(),
      postalCode: line.substring(395, 404).trim(),
      countryCode: line.substring(404, 406).trim(),
    };
  } catch (error) {
    console.error('Error parsing Metro 2 line:', error);
    return null;
  }
}

export function parseMetro2Header(line: string): Metro2Header | null {
  if (line.length < 426) return null;
  
  const recordIdentifier = line.substring(0, 4).trim();
  if (recordIdentifier !== '0100') return null;

  return {
    recordIdentifier,
    recordSize: parseInt(line.substring(4, 8), 10) || 426,
    blockingFactor: parseInt(line.substring(8, 10), 10) || 1,
    activityDate: parseMetro2Date(line.substring(10, 18)),
    dateCreated: parseMetro2Date(line.substring(18, 26)),
    programDate: parseMetro2Date(line.substring(26, 34)),
    programRevisionDate: parseMetro2Date(line.substring(34, 42)),
    reporterName: line.substring(42, 82).trim(),
    reporterAddress: line.substring(82, 178).trim(),
    reporterCity: line.substring(178, 198).trim(),
    reporterState: line.substring(198, 200).trim(),
    reporterPostalCode: line.substring(200, 209).trim(),
    reporterPhone: line.substring(209, 219).trim(),
  };
}

export function parseMetro2Trailer(line: string): Metro2Trailer | null {
  if (line.length < 426) return null;
  
  const recordIdentifier = line.substring(0, 4).trim();
  if (recordIdentifier !== '0500') return null;

  return {
    recordIdentifier,
    totalBaseRecords: parseInt(line.substring(4, 13), 10) || 0,
    totalJ1Records: parseInt(line.substring(13, 22), 10) || 0,
    totalJ2Records: parseInt(line.substring(22, 31), 10) || 0,
    totalK1Records: parseInt(line.substring(31, 40), 10) || 0,
    totalK2Records: parseInt(line.substring(40, 49), 10) || 0,
    totalK3Records: parseInt(line.substring(49, 58), 10) || 0,
    totalK4Records: parseInt(line.substring(58, 67), 10) || 0,
    totalL1Records: parseInt(line.substring(67, 76), 10) || 0,
    totalN1Records: parseInt(line.substring(76, 85), 10) || 0,
  };
}

function parseMetro2Date(dateStr: string): string | undefined {
  if (!dateStr || dateStr.trim().length !== 8 || dateStr.trim() === '00000000') {
    return undefined;
  }
  
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  
  if (parseInt(year, 10) < 1900 || parseInt(year, 10) > 2100) {
    return undefined;
  }
  
  return `${year}-${month}-${day}`;
}

function parseMetro2Amount(amountStr: string): number | undefined {
  if (!amountStr || amountStr.trim().length === 0) {
    return undefined;
  }
  
  const amount = parseInt(amountStr.trim(), 10);
  return isNaN(amount) ? undefined : amount;
}

export async function parseMetro2File(filePath: string): Promise<Metro2ParsedFile> {
  const content = await fs.promises.readFile(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.length >= 426);
  
  if (lines.length === 0) {
    throw new Error('Invalid Metro 2 file: no valid records found');
  }
  
  const header = parseMetro2Header(lines[0]);
  if (!header) {
    throw new Error('Invalid Metro 2 file: could not parse header');
  }
  
  const baseSegments: Metro2BaseSegment[] = [];
  let trailer: Metro2Trailer | null = null;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const recordId = line.substring(0, 4).trim();
    
    if (recordId === '0500') {
      trailer = parseMetro2Trailer(line);
    } else if (recordId === '0200' || recordId === '0300') {
      const segment = parseMetro2Line(line);
      if (segment) {
        baseSegments.push(segment);
      }
    }
  }
  
  if (!trailer) {
    trailer = {
      recordIdentifier: '0500',
      totalBaseRecords: baseSegments.length,
    };
  }
  
  return { header, baseSegments, trailer };
}

export function convertMetro2ToCreditReport(parsed: Metro2ParsedFile, bureauName: string = 'Other'): CreditReport {
  const tradelines: Tradeline[] = [];
  const collections: CollectionAccount[] = [];
  
  for (const segment of parsed.baseSegments) {
    const status = ACCOUNT_STATUS_MAP[segment.accountStatus] || 'Unknown';
    const tradelineType = PORTFOLIO_TYPE_MAP[segment.portfolioType] || 'Other';
    
    const internalId = nanoid();
    
    if (status === 'Collection' || segment.accountStatus === '93') {
      collections.push({
        internalId,
        collectorName: segment.accountNumber ? `Account ${segment.accountNumber}` : 'Unknown Collector',
        originalCreditorName: undefined,
        accountNumberMasked: segment.accountNumber ? `****${segment.accountNumber.slice(-4)}` : undefined,
        balance: segment.currentBalance,
        status: status === 'Paid' ? 'Paid' : 'Open',
        openedDate: segment.dateOpened,
        lastUpdatedDate: segment.dateOfAccountInformation,
        dateOfFirstDelinquency: segment.dateOfFirstDelinquency,
        metro2: {
          accountStatusCode: segment.accountStatus,
          paymentRatingCode: segment.paymentRating,
          specialCommentCode: segment.specialCommentCode,
          complianceConditionCode: segment.complianceConditionCode,
          consumerInformationIndicator: segment.consumerInformationIndicator,
        },
      });
    } else {
      tradelines.push({
        internalId,
        creditorName: segment.accountNumber ? `Account ${segment.accountNumber}` : 'Unknown Creditor',
        furnisherId: undefined,
        accountNumberMasked: segment.accountNumber ? `****${segment.accountNumber.slice(-4)}` : undefined,
        type: tradelineType as any,
        status: mapAccountStatusToTradelineStatus(status),
        isOriginalCreditor: true,
        openedDate: segment.dateOpened,
        closedDate: segment.dateClosed,
        highCreditLimit: segment.highestCredit,
        creditLimit: segment.creditLimit,
        balance: segment.currentBalance,
        pastDueAmount: segment.amountPastDue,
        lastPaymentDate: segment.dateOfLastPayment,
        lastUpdatedDate: segment.dateOfAccountInformation,
        dateOfFirstDelinquency: segment.dateOfFirstDelinquency,
        metro2: {
          accountStatusCode: segment.accountStatus,
          paymentRatingCode: segment.paymentRating,
          specialCommentCode: segment.specialCommentCode,
          complianceConditionCode: segment.complianceConditionCode,
          consumerInformationIndicator: segment.consumerInformationIndicator,
        },
      });
    }
  }
  
  const firstSegment = parsed.baseSegments[0];
  
  const bureauReport: BureauReport = {
    bureau: bureauName as any,
    tradelines,
    collections,
    publicRecords: [],
    inquiries: [],
  };
  
  return {
    pulledAt: new Date().toISOString().split('T')[0],
    provider: parsed.header.reporterName || 'Metro 2 File',
    consumer: {
      fullName: firstSegment 
        ? `${firstSegment.firstName || ''} ${firstSegment.lastName || ''}`.trim() || 'Unknown'
        : 'Unknown',
      ssnLast4: firstSegment?.socialSecurityNumber?.slice(-4),
      dob: firstSegment?.dateOfBirth,
      addresses: firstSegment ? [{
        line1: firstSegment.addressLine1 || '',
        line2: firstSegment.addressLine2,
        city: firstSegment.city || '',
        state: firstSegment.state || '',
        postalCode: firstSegment.postalCode || '',
      }] : [],
    },
    bureaus: [bureauReport],
  };
}

function mapAccountStatusToTradelineStatus(status: string): any {
  const statusMap: Record<string, string> = {
    'Current': 'Open',
    'Paid': 'Paid',
    'Transferred': 'Transferred',
    'ChargeOff': 'ChargeOff',
    'Collection': 'Collection',
    'Foreclosure': 'Foreclosure',
    'Repossession': 'Repossession',
    'Bankruptcy': 'Closed',
    'Unknown': 'Unknown',
    'Late30': 'Open',
    'Late60': 'Open',
    'Late90': 'Open',
    'Late120': 'Open',
    'Late150': 'Open',
    'Late180': 'Open',
  };
  
  return statusMap[status] || 'Unknown';
}

export function isMetro2File(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.m2' || ext === '.metro2' || ext === '.dat';
}
