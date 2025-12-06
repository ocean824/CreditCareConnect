import type { CreditReport, Tradeline, CollectionAccount, BureauName } from '../models/creditReport';
import type { IssueFlag } from '../models/issues';
import { createIssueFlag, clusterTradelinesByCreditorAndAccount } from './utils';

export function runCrossBureauTrainingRules(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  issues.push(...ruleR1StatusInconsistentAcrossBureaus(report));
  issues.push(...ruleR2BalanceInconsistentAcrossBureaus(report));
  issues.push(...ruleR3ChargeoffPastDueNonzero(report));
  issues.push(...ruleR4CollectionReportedAsOpenAccount(report));
  issues.push(...ruleR5DuplicateCollectionSameDebt(report));
  issues.push(...ruleR6SoldAccountStillChargeoffStatus(report));
  
  return issues;
}

type StatusSeverity = 
  | 'CURRENT' 
  | '30D_LATE' 
  | '60D_LATE' 
  | '90D_LATE' 
  | '120D_LATE' 
  | '150D_LATE'
  | '180D_LATE' 
  | 'CHARGEOFF' 
  | 'COLLECTION_CHARGEOFF' 
  | 'FORECLOSURE' 
  | 'REPOSSESSION'
  | 'UNKNOWN';

function mapStatusToSeverity(status?: string): StatusSeverity {
  if (!status) return 'UNKNOWN';
  const normalized = status.toLowerCase().replace(/[\s\-_]/g, '');
  
  if (normalized.includes('current') || normalized.includes('paidascurrent') || normalized.includes('ok') || normalized === 'open' || normalized === 'paid') {
    return 'CURRENT';
  }
  if (normalized.includes('foreclosure')) return 'FORECLOSURE';
  if (normalized.includes('repossession') || normalized.includes('repo')) return 'REPOSSESSION';
  if (normalized.includes('chargeoff') || normalized.includes('chargedoff') || normalized === 'chargeoff') {
    if (normalized.includes('collection')) return 'COLLECTION_CHARGEOFF';
    return 'CHARGEOFF';
  }
  if (normalized === 'collection') return 'COLLECTION_CHARGEOFF';
  if (normalized.includes('180') || normalized.includes('late150plus')) return '180D_LATE';
  if (normalized.includes('150')) return '150D_LATE';
  if (normalized.includes('120') || normalized === 'late120') return '120D_LATE';
  if (normalized.includes('90') || normalized === 'late90') return '90D_LATE';
  if (normalized.includes('60') || normalized === 'late60') return '60D_LATE';
  if (normalized.includes('30') || normalized === 'late30') return '30D_LATE';
  if (normalized.includes('late') || normalized.includes('delinquent')) return '30D_LATE';
  
  return 'UNKNOWN';
}

function getSeverityRank(severity: StatusSeverity): number {
  const ranks: Record<StatusSeverity, number> = {
    'CURRENT': 0,
    '30D_LATE': 1,
    '60D_LATE': 2,
    '90D_LATE': 3,
    '120D_LATE': 4,
    '150D_LATE': 5,
    '180D_LATE': 6,
    'CHARGEOFF': 7,
    'COLLECTION_CHARGEOFF': 8,
    'FORECLOSURE': 9,
    'REPOSSESSION': 10,
    'UNKNOWN': -1,
  };
  return ranks[severity];
}

function ruleR1StatusInconsistentAcrossBureaus(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  if (report.bureaus.length < 2) return issues;
  
  const clusters = clusterTradelinesByCreditorAndAccount(report);
  
  for (const cluster of clusters) {
    if (cluster.items.length < 2) continue;
    
    const bureauStatuses = cluster.items.map(item => ({
      bureau: item.bureau,
      status: item.tradeline.status,
      severity: mapStatusToSeverity(item.tradeline.status),
      internalId: item.tradeline.internalId,
    }));
    
    const validStatuses = bureauStatuses.filter(s => s.severity !== 'UNKNOWN');
    if (validStatuses.length < 2) continue;
    
    const severityRanks = validStatuses.map(s => getSeverityRank(s.severity));
    const minRank = Math.min(...severityRanks);
    const maxRank = Math.max(...severityRanks);
    
    if (maxRank - minRank >= 2) {
      const statusByBureau: Record<string, string> = {};
      for (const bs of bureauStatuses) {
        statusByBureau[`${bs.bureau}Status`] = bs.severity;
      }
      
      issues.push(
        createIssueFlag({
          ruleId: 'R1_FCRA_STATUS_INCONSISTENT_ACROSS_BUREAUS',
          family: 'FCRA',
          category: 'CROSS_BUREAU_STATUS_INCONSISTENT',
          severity: 'HIGH',
          statutes: ['FCRA_607b', '15_USC_1681e_b'],
          affectedEntityType: 'CrossBureau',
          affectedBureaus: cluster.items.map(i => i.bureau),
          affectedIds: cluster.items.map(i => i.tradeline.internalId),
          descriptionMachine:
            `Same tradeline has materially different delinquency/status across bureaus for ${cluster.items[0].tradeline.creditorName}. ${bureauStatuses.map(s => `${s.bureau}: ${s.severity}`).join(', ')}. This violates FCRA's "maximum possible accuracy" standard.`,
          explanationKey: 'R1_STATUS_INCONSISTENT_ACROSS_BUREAUS',
          details: {
            accountGroupId: cluster.clusterKey,
            creditorName: cluster.items[0].tradeline.creditorName,
            bureauStatuses: statusByBureau,
            bureauData: bureauStatuses.map(s => ({
              bureau: s.bureau,
              status: s.status,
              severity: s.severity,
            })),
          },
        })
      );
    }
  }
  
  return issues;
}

function ruleR2BalanceInconsistentAcrossBureaus(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  if (report.bureaus.length < 2) return issues;
  
  const clusters = clusterTradelinesByCreditorAndAccount(report);
  
  for (const cluster of clusters) {
    if (cluster.items.length < 2) continue;
    
    const bureauBalances = cluster.items.map(item => ({
      bureau: item.bureau,
      balance: item.tradeline.balance ?? 0,
      pastDue: item.tradeline.pastDueAmount ?? 0,
      internalId: item.tradeline.internalId,
    }));
    
    const balances = bureauBalances.map(b => b.balance);
    const pastDues = bureauBalances.map(b => b.pastDue);
    
    const maxBalance = Math.max(...balances);
    const minBalance = Math.min(...balances);
    const balanceDiff = maxBalance - minBalance;
    
    const maxPastDue = Math.max(...pastDues);
    const minPastDue = Math.min(...pastDues);
    const pastDueDiff = maxPastDue - minPastDue;
    
    const isBalanceMateriallyDifferent = balanceDiff > 50;
    const isPastDueMateriallyDifferent = pastDueDiff > 50;
    
    if (isBalanceMateriallyDifferent || isPastDueMateriallyDifferent) {
      const balanceByBureau: Record<string, number> = {};
      for (const bb of bureauBalances) {
        balanceByBureau[`${bb.bureau}Balance`] = bb.balance;
        balanceByBureau[`${bb.bureau}PastDue`] = bb.pastDue;
      }
      
      issues.push(
        createIssueFlag({
          ruleId: 'R2_FCRA_BALANCE_INCONSISTENT_ACROSS_BUREAUS',
          family: 'FCRA',
          category: 'CROSS_BUREAU_BALANCE_INCONSISTENT',
          severity: 'HIGH',
          statutes: ['FCRA_607b', '15_USC_1681e_b'],
          affectedEntityType: 'CrossBureau',
          affectedBureaus: cluster.items.map(i => i.bureau),
          affectedIds: cluster.items.map(i => i.tradeline.internalId),
          descriptionMachine:
            `Same tradeline has materially different balances/past-due amounts across bureaus for ${cluster.items[0].tradeline.creditorName}. ${bureauBalances.map(b => `${b.bureau}: $${b.balance} (past due: $${b.pastDue})`).join(', ')}. This inconsistency violates FCRA's accuracy standard.`,
          explanationKey: 'R2_BALANCE_INCONSISTENT_ACROSS_BUREAUS',
          details: {
            accountGroupId: cluster.clusterKey,
            creditorName: cluster.items[0].tradeline.creditorName,
            ...balanceByBureau,
            bureauData: bureauBalances.map(b => ({
              bureau: b.bureau,
              balance: b.balance,
              pastDue: b.pastDue,
            })),
            balanceDifference: balanceDiff,
            pastDueDifference: pastDueDiff,
          },
        })
      );
    }
  }
  
  return issues;
}

function ruleR3ChargeoffPastDueNonzero(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      const status = (tl.status || '').toLowerCase();
      const isChargeoff = status === 'chargeoff' || 
                          status === 'collection' ||
                          status.includes('chargeoff');
      
      const pastDue = tl.pastDueAmount ?? 0;
      const balance = tl.balance ?? 0;
      
      if (isChargeoff && pastDue > 0) {
        issues.push(
          createIssueFlag({
            ruleId: 'R3_METRO2_CHARGEOFF_PAST_DUE_NONZERO',
            family: 'METRO2',
            category: 'CHARGEOFF_PAST_DUE_CONFLICT',
            severity: 'HIGH',
            statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623a1'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `Account ${tl.creditorName} is reported as charge-off but still shows $${pastDue} as past due. Under Metro 2 guidance, charged-off accounts should not show the full balance as "past due" since the account is no longer in a repayment status. This is Metro 2 non-compliant and misleading.`,
            explanationKey: 'R3_CHARGEOFF_PAST_DUE_NONZERO',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              accountName: tl.creditorName,
              status: tl.status,
              balance,
              pastDueAmount: pastDue,
            },
          })
        );
      }
    }
    
    for (const col of b.collections) {
      const status = (col.status || '').toLowerCase();
      const balance = col.balance ?? 0;
      
      if (balance > 0 && (status === 'open' || !status)) {
        issues.push(
          createIssueFlag({
            ruleId: 'R3_METRO2_CHARGEOFF_PAST_DUE_NONZERO',
            family: 'METRO2',
            category: 'CHARGEOFF_PAST_DUE_CONFLICT',
            severity: 'HIGH',
            statutes: ['METRO2_BASE_SEGMENT', 'FCRA_623a1'],
            affectedEntityType: 'Collection',
            affectedBureaus: [b.bureau],
            affectedIds: [col.internalId],
            descriptionMachine:
              `Collection ${col.collectorName} shows balance of $${balance} which effectively represents a past-due amount on a collection account. Under Metro 2 guidance, collection accounts should properly reflect the nature of the debt.`,
            explanationKey: 'R3_CHARGEOFF_PAST_DUE_NONZERO',
            details: {
              bureau: b.bureau,
              internalId: col.internalId,
              accountName: col.collectorName,
              status: col.status,
              balance,
            },
          })
        );
      }
    }
  }
  
  return issues;
}

const KNOWN_DEBT_COLLECTORS = [
  'lvnv', 'midland', 'portfolio recovery', 'pra', 'encore capital',
  'cavalry', 'resurgent', 'alorica', 'convergent', 'coast professional',
  'jefferson capital', 'crown asset', 'absolute resolutions', 'absres',
  'enhanced recovery', 'radius global', 'worldwide asset', 'mccall',
  'asset acceptance', 'pinnacle credit', 'pyod', 'onemain', 'zwicker',
  'weltman', 'collection bureau', 'medicredit', 'transworld',
  'national enterprise', 'cbe group', 'credit management', 'genesis',
  'client services', 'diversified consultants', 'financial asset',
  'helvey & associates', 'ic system', 'icc corporation', 'ncb',
  'ncc business services', 'receivables management', 'rsi',
  'simm associates', 'sunrise credit', 'tsi', 'unifund',
];

function isDebtCollector(name?: string): boolean {
  if (!name) return false;
  const normalized = name.toLowerCase();
  return KNOWN_DEBT_COLLECTORS.some(collector => normalized.includes(collector)) ||
         normalized.includes('collection') ||
         normalized.includes('recovery') ||
         normalized.includes('funding llc') ||
         normalized.includes('portfolio');
}

function ruleR4CollectionReportedAsOpenAccount(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      const creditorName = tl.creditorName || '';
      const isCollector = isDebtCollector(creditorName);
      
      if (!isCollector) continue;
      
      const status = (tl.status || '').toLowerCase();
      const tradelineType = tl.type || '';
      
      const isNotCollectionType = tradelineType !== 'Other' && 
                                   tradelineType !== 'Collection' as any;
      
      const hasLatePaymentHistory = tl.paymentHistory?.some(p => 
        p.status && p.status !== 'OK' && p.status !== 'Unknown'
      );
      
      const statusShowsLates = status.includes('late') || 
                               status === 'late30' ||
                               status === 'late60' ||
                               status === 'late90' ||
                               status === 'late120' ||
                               status === 'late150plus' ||
                               status === 'delinquent';
      
      if (isNotCollectionType && (hasLatePaymentHistory || statusShowsLates)) {
        issues.push(
          createIssueFlag({
            ruleId: 'R4_METRO2_COLLECTION_REPORTED_AS_OPEN_ACCOUNT',
            family: 'METRO2',
            category: 'COLLECTION_MISCODED_AS_TRADE',
            severity: 'HIGH',
            statutes: ['METRO2_BASE_SEGMENT', 'FCRA_607b'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `${creditorName} is a third-party debt collector but is coded as a ${tradelineType || 'trade'} account with late payments instead of a collection account. This misclassification is misleading and not consistent with Metro 2 coding standards for third-party collections.`,
            explanationKey: 'R4_COLLECTION_REPORTED_AS_OPEN',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              accountName: creditorName,
              isDebtCollector: true,
              accountType: tradelineType || 'UNKNOWN',
              status: tl.status,
              paymentHistoryWorst: hasLatePaymentHistory ? 'LATE' : undefined,
            },
          })
        );
      }
    }
  }
  
  return issues;
}

function ruleR5DuplicateCollectionSameDebt(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    interface CollectionEntry {
      collectorName: string;
      originalCreditor: string;
      balance: number;
      internalId: string;
      accountNumberLast4: string;
      bureauAccountId: string;
      dofd: string;
      openedDate: string;
    }
    
    const allCollections: CollectionEntry[] = [];
    
    for (const col of b.collections) {
      allCollections.push({
        collectorName: (col.collectorName || '').toLowerCase().trim(),
        originalCreditor: (col.originalCreditorName || '').toLowerCase().trim(),
        balance: col.balance ?? 0,
        internalId: col.internalId,
        accountNumberLast4: (col.accountNumberMasked || '').slice(-4),
        bureauAccountId: (col.bureauAccountId || '').trim(),
        dofd: col.dateOfFirstDelinquency || '',
        openedDate: col.openedDate || '',
      });
    }
    
    const reportedDuplicates = new Set<string>();
    
    for (let i = 0; i < allCollections.length; i++) {
      for (let j = i + 1; j < allCollections.length; j++) {
        const a = allCollections[i];
        const b2 = allCollections[j];
        
        if (a.internalId === b2.internalId) continue;
        
        const sameCollector = !!(a.collectorName && b2.collectorName && 
                              a.collectorName === b2.collectorName);
        
        const sameOriginalCreditor = !!(a.originalCreditor && b2.originalCreditor && 
                                     a.originalCreditor === b2.originalCreditor);
        
        const sameBureauAccountId = !!(a.bureauAccountId && b2.bureauAccountId && 
                                       a.bureauAccountId.length >= 4 &&
                                       a.bureauAccountId === b2.bureauAccountId);
        
        const extractDigits = (num: string) => (num || '').replace(/\D/g, '');
        const hasValidAccountNumber = (num: string) => {
          const digits = extractDigits(num);
          return digits.length >= 4 && !/^0+$/.test(digits);
        };
        
        const aDigits = extractDigits(a.accountNumberLast4);
        const b2Digits = extractDigits(b2.accountNumberLast4);
        
        const bothHaveValidAccountNumbers = hasValidAccountNumber(a.accountNumberLast4) && 
                                            hasValidAccountNumber(b2.accountNumberLast4);
        
        const sameAccountNumber = bothHaveValidAccountNumbers && aDigits === b2Digits;
        
        const sameDOFD = !!(a.dofd && b2.dofd && a.dofd === b2.dofd);
        
        const sameOpenedDate = !!(a.openedDate && b2.openedDate && a.openedDate === b2.openedDate);
        
        const exactSameBalance = a.balance > 0 && a.balance === b2.balance;
        
        const hasNameMatch = sameCollector || sameOriginalCreditor;
        
        const hasBothNamesMatch = sameCollector && sameOriginalCreditor;
        
        const primaryPath = sameBureauAccountId && hasNameMatch && exactSameBalance;
        
        const accountNumberPath = sameAccountNumber && hasNameMatch && exactSameBalance;
        
        const dofdPath = sameDOFD && hasNameMatch && exactSameBalance && !sameBureauAccountId && !sameAccountNumber;
        
        const openedDatePath = sameOpenedDate && hasBothNamesMatch && exactSameBalance && !sameBureauAccountId && !sameAccountNumber && !sameDOFD;
        
        const isDuplicate = primaryPath || accountNumberPath || dofdPath || openedDatePath;
        
        if (isDuplicate) {
          const dedupKey = [a.internalId, b2.internalId].sort().join(',');
          if (reportedDuplicates.has(dedupKey)) continue;
          reportedDuplicates.add(dedupKey);
          
          issues.push(
            createIssueFlag({
              ruleId: 'R5_FCRA_DUPLICATE_COLLECTION_SAME_DEBT',
              family: 'FCRA',
              category: 'DUPLICATE_COLLECTION',
              severity: 'HIGH',
              statutes: ['FCRA_607b', '15_USC_1681e_b'],
              affectedEntityType: 'Collection',
              affectedBureaus: [b.bureau],
              affectedIds: [a.internalId, b2.internalId],
              descriptionMachine:
                `Same collection debt appears multiple times on ${b.bureau} report. Collector: ${a.collectorName || b2.collectorName}, Original Creditor: ${a.originalCreditor || b2.originalCreditor || 'Unknown'}, Balance: $${a.balance}. Reporting the same debt multiple times is misleading and violates FCRA's accuracy requirement.`,
              explanationKey: 'R5_DUPLICATE_COLLECTION_SAME_DEBT',
              details: {
                bureau: b.bureau,
                collectorName: a.collectorName || b2.collectorName,
                originalCreditor: a.originalCreditor || b2.originalCreditor || 'Unknown',
                balance: a.balance,
                duplicateTradelines: [a.internalId, b2.internalId],
                duplicateCount: 2,
                matchCriteria: {
                  sameCollector,
                  sameOriginalCreditor,
                  sameBureauAccountId,
                  sameAccountNumber,
                  sameDOFD,
                  sameOpenedDate,
                  exactSameBalance,
                  hasNameMatch,
                  hasBothNamesMatch,
                  matchedViaPrimaryPath: primaryPath,
                  matchedViaAccountNumberPath: accountNumberPath,
                  matchedViaDOFDPath: dofdPath,
                  matchedViaOpenedDatePath: openedDatePath,
                },
              },
            })
          );
        }
      }
    }
  }
  
  return issues;
}

function ruleR6SoldAccountStillChargeoffStatus(report: CreditReport): IssueFlag[] {
  const issues: IssueFlag[] = [];
  
  for (const b of report.bureaus) {
    for (const tl of b.tradelines) {
      const balance = tl.balance ?? 0;
      const status = tl.status || '';
      const statusLower = status.toLowerCase();
      const statusRaw = (tl.statusRaw || '').toLowerCase();
      const remarksText = (tl.remarks || []).join(' ').toLowerCase();
      
      const checkSold = (text: string) => 
        text.includes('sold') || text.includes('transferred') || text.includes('purchased');
      
      const checkChargeoff = (text: string) => 
        text.includes('chargeoff') || text.includes('charge-off') || 
        text.includes('charge off') || text.includes('collection');
      
      const hasSoldIndicator = 
        statusLower === 'sold' || 
        statusLower === 'transferred' ||
        checkSold(statusLower) ||
        checkSold(statusRaw) ||
        checkSold(remarksText);
      
      const hasChargeoffIndicator = 
        statusLower === 'chargeoff' || 
        statusLower === 'collection' ||
        checkChargeoff(statusLower) ||
        checkChargeoff(statusRaw) ||
        checkChargeoff(remarksText);
      
      const hasZeroBalance = balance === 0;
      
      const isSoldWithChargeoffStatus = hasSoldIndicator && hasChargeoffIndicator && hasZeroBalance;
      
      const isOriginalCreditorSoldWithZeroBalance = 
        tl.isOriginalCreditor === true && 
        hasZeroBalance && 
        hasSoldIndicator &&
        (hasChargeoffIndicator || statusLower === 'sold' || statusLower === 'transferred');
      
      if (isSoldWithChargeoffStatus || isOriginalCreditorSoldWithZeroBalance) {
        issues.push(
          createIssueFlag({
            ruleId: 'R6_FCRA_SOLD_ACCOUNT_STILL_CHARGEOFF_STATUS',
            family: 'FCRA',
            category: 'SOLD_ACCOUNT_MISLEADING_STATUS',
            severity: 'HIGH',
            statutes: ['FCRA_607b', 'METRO2_BASE_SEGMENT'],
            affectedEntityType: 'Tradeline',
            affectedBureaus: [b.bureau],
            affectedIds: [tl.internalId],
            descriptionMachine:
              `Account ${tl.creditorName} has been sold/transferred with $0 balance but still reports a charge-off/collection status. Under Metro 2 standards, once an account is sold with zero balance, it should show Sold/Transferred status, not an active derogatory status. This dual reporting is misleading.`,
            explanationKey: 'R6_SOLD_ACCOUNT_STILL_CHARGEOFF',
            details: {
              bureau: b.bureau,
              internalId: tl.internalId,
              accountName: tl.creditorName,
              isOriginalCreditor: tl.isOriginalCreditor,
              balance,
              status: tl.status,
              hasSoldIndicator,
              hasChargeoffIndicator,
            },
          })
        );
      }
    }
  }
  
  return issues;
}
