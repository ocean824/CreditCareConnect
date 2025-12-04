import type { CreditReport } from '../models/creditReport';
import type { IssueFlag } from '../models/issues';

import { runBalanceRules } from './rules_balances';
import { runStatusRules } from './rules_status';
import { runTimelineRules } from './rules_timeline';
import { runCollectionRules } from './rules_collections';
import { runIdentityRules } from './rules_identity';
import { runDisputeRules } from './rules_disputes';
import { runEnhancedFCRARules } from './rules_fcra_enhanced';
import { runDisputableRules } from './rules_disputable';
import { runComprehensiveFCRARules } from './rules_fcra_comprehensive';
import { runComprehensiveFDCPARules } from './rules_fdcpa_comprehensive';
import { runMetro2Rules } from './rules_metro2_comprehensive';

export function runAllRules(report: CreditReport): IssueFlag[] {
  console.log('🔬 [ENGINE] Starting rules engine...');
  
  // Log data summary for debugging
  const totalTradelines = report.bureaus.reduce((sum, b) => sum + b.tradelines.length, 0);
  const totalCollections = report.bureaus.reduce((sum, b) => sum + b.collections.length, 0);
  const totalPublicRecords = report.bureaus.reduce((sum, b) => sum + b.publicRecords.length, 0);
  const totalInquiries = report.bureaus.reduce((sum, b) => sum + b.inquiries.length, 0);
  
  console.log(`🔬 [ENGINE] Input data: ${report.bureaus.length} bureaus, ${totalTradelines} tradelines, ${totalCollections} collections, ${totalPublicRecords} public records, ${totalInquiries} inquiries`);
  
  // Log sample data for debugging
  for (const b of report.bureaus) {
    console.log(`🔬 [ENGINE] Bureau ${b.bureau}:`);
    for (const tl of b.tradelines.slice(0, 2)) {
      console.log(`     Tradeline: ${tl.creditorName}, Status: ${tl.status}, Balance: $${tl.balance}, DOFD: ${tl.dateOfFirstDelinquency || 'N/A'}`);
    }
    for (const col of b.collections.slice(0, 2)) {
      console.log(`     Collection: ${col.collectorName}, Balance: $${col.balance}, Status: ${col.status}`);
    }
  }
  
  const issues: IssueFlag[] = [];
  
  // Run all rule sets
  const balanceIssues = runBalanceRules(report);
  console.log(`🔬 [ENGINE] Balance rules: ${balanceIssues.length} issues`);
  issues.push(...balanceIssues);
  
  const statusIssues = runStatusRules(report);
  console.log(`🔬 [ENGINE] Status rules: ${statusIssues.length} issues`);
  issues.push(...statusIssues);
  
  const timelineIssues = runTimelineRules(report);
  console.log(`🔬 [ENGINE] Timeline rules: ${timelineIssues.length} issues`);
  issues.push(...timelineIssues);
  
  const collectionIssues = runCollectionRules(report);
  console.log(`🔬 [ENGINE] Collection rules: ${collectionIssues.length} issues`);
  issues.push(...collectionIssues);
  
  const identityIssues = runIdentityRules(report);
  console.log(`🔬 [ENGINE] Identity rules: ${identityIssues.length} issues`);
  issues.push(...identityIssues);
  
  const disputeIssues = runDisputeRules(report);
  console.log(`🔬 [ENGINE] Dispute rules: ${disputeIssues.length} issues`);
  issues.push(...disputeIssues);
  
  const fcraEnhancedIssues = runEnhancedFCRARules(report);
  console.log(`🔬 [ENGINE] FCRA Enhanced rules: ${fcraEnhancedIssues.length} issues`);
  issues.push(...fcraEnhancedIssues);
  
  // Run disputable rules (catches most negative items)
  const disputableIssues = runDisputableRules(report);
  console.log(`🔬 [ENGINE] Disputable rules: ${disputableIssues.length} issues`);
  issues.push(...disputableIssues);
  
  // Run comprehensive FCRA violation detection
  const comprehensiveFCRAIssues = runComprehensiveFCRARules(report);
  console.log(`🔬 [ENGINE] Comprehensive FCRA rules: ${comprehensiveFCRAIssues.length} issues`);
  issues.push(...comprehensiveFCRAIssues);
  
  // Run comprehensive FDCPA violation detection
  const comprehensiveFDCPAIssues = runComprehensiveFDCPARules(report);
  console.log(`🔬 [ENGINE] Comprehensive FDCPA rules: ${comprehensiveFDCPAIssues.length} issues`);
  issues.push(...comprehensiveFDCPAIssues);
  
  // Run comprehensive Metro2 violation detection
  const metro2Issues = runMetro2Rules(report);
  console.log(`🔬 [ENGINE] Metro2 rules: ${metro2Issues.length} issues`);
  issues.push(...metro2Issues);
  
  // Deduplicate issues by ruleId + affectedIds combination
  const seenKeys = new Set<string>();
  const deduplicatedIssues = issues.filter(issue => {
    const key = `${issue.ruleId}|${issue.affectedIds.sort().join(',')}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
  
  console.log(`🔬 [ENGINE] Total issues found: ${deduplicatedIssues.length} (deduplicated from ${issues.length})`);
  
  return deduplicatedIssues;
}
