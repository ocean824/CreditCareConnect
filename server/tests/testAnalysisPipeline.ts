import { parseCreditReportWithAiOnly } from '../services/creditReportParserV2';
import { convertTriMergeToLegacy } from '../services/convertTriMergeToLegacy';
import { analyzeWithRulesEngine } from '../services/advancedCreditAnalysis';

const SAMPLE_CREDIT_REPORT_TEXT = `
CREDIT REPORT
Consumer: John Q. Doe
Report Date: December 1, 2025
SSN: XXX-XX-1234

============ EXPERIAN ============

TRADELINES:

1. CAPITAL ONE BANK
   Account Number: ****4521
   Type: Credit Card
   Status: CHARGE_OFF
   Balance: $2,450.00
   Past Due: $2,450.00
   Date Opened: 01/15/2015
   Date of First Delinquency: 03/01/2017
   Last Payment: 02/15/2017
   Last Updated: 11/15/2025

2. GM FINANCIAL
   Account Number: ****7890
   Type: Auto Loan
   Status: Open
   Balance: $11,265.00
   Past Due: $0
   Date Opened: 06/20/2020
   Last Payment: 11/01/2025
   Last Updated: 11/15/2025

COLLECTIONS:

1. MIDLAND FUNDING LLC
   Original Creditor: SYNCHRONY BANK
   Account Number: ****3344
   Balance: $1,875.00
   Status: Open
   Date of First Delinquency: 08/15/2016
   Last Updated: 11/01/2025

============ TRANSUNION ============

TRADELINES:

1. CAPITAL ONE BANK
   Account Number: ****4521
   Type: Credit Card
   Status: CHARGE_OFF
   Balance: $2,450.00
   Past Due: $2,450.00
   Date Opened: 01/15/2015
   Date of First Delinquency: 03/01/2017
   Last Payment: 02/15/2017
   Last Updated: 10/20/2025

2. GM FINANCIAL
   Account Number: ****7890
   Type: Auto Loan
   Status: Open
   Balance: $11,500.00  <-- Different balance than Experian
   Past Due: $0
   Date Opened: 06/20/2020
   Last Payment: 11/01/2025
   Last Updated: 11/15/2025

COLLECTIONS:

1. MIDLAND FUNDING LLC
   Original Creditor: SYNCHRONY BANK
   Account Number: ****3344
   Balance: $1,875.00
   Status: Open
   Date of First Delinquency: 08/15/2016
   Last Updated: 11/01/2025

============ EQUIFAX ============

TRADELINES:

1. CAPITAL ONE BANK
   Account Number: ****4521
   Type: Credit Card
   Status: CHARGE_OFF
   Balance: $2,450.00
   Past Due: $2,450.00
   Date Opened: 01/15/2015
   Date of First Delinquency: 03/01/2017
   Last Payment: 02/15/2017
   Last Updated: 11/10/2025

2. GM FINANCIAL
   Account Number: ****7890
   Type: Auto Loan
   Status: Open
   Balance: $11,265.00
   Past Due: $0
   Date Opened: 06/20/2020
   Last Payment: 11/01/2025
   Last Updated: 11/15/2025

COLLECTIONS:

1. MIDLAND FUNDING LLC
   Original Creditor: SYNCHRONY BANK
   Account Number: ****3344
   Balance: $1,875.00
   Status: Open
   Date of First Delinquency: 08/15/2016
   Last Updated: 11/01/2025

PUBLIC RECORDS:

1. Chapter 7 Bankruptcy
   Filed Date: 01/10/2015
   Status: Discharged
   Court: US Bankruptcy Court Eastern District
`;

async function runTest() {
  console.log('='.repeat(60));
  console.log('CREDIT REPORT ANALYSIS PIPELINE TEST');
  console.log('='.repeat(60));
  
  try {
    console.log('\n📄 Step 1: Parsing credit report with AI V2 parser...');
    const triMergeReport = await parseCreditReportWithAiOnly({
      rawText: SAMPLE_CREDIT_REPORT_TEXT,
      bureauHint: 'TRI',
      provider: 'IDENTITYIQ',
      userId: 'test-user-123',
    });
    
    console.log('✅ Parsed tri-merge report:');
    console.log(`   - ID: ${triMergeReport.id}`);
    console.log(`   - Bureaus: ${triMergeReport.meta.bureausIncluded.join(', ')}`);
    console.log(`   - Tradelines: ${triMergeReport.tradelines.length}`);
    console.log(`   - Collections: ${triMergeReport.collections.length}`);
    console.log(`   - Public Records: ${triMergeReport.publicRecords.length}`);
    
    console.log('\n🔄 Step 2: Converting to legacy format...');
    const legacyReport = convertTriMergeToLegacy(triMergeReport);
    
    console.log('✅ Converted to legacy format:');
    console.log(`   - Bureaus: ${legacyReport.bureaus.length}`);
    for (const bureau of legacyReport.bureaus) {
      console.log(`   - ${bureau.bureau}: ${bureau.tradelines.length} tradelines, ${bureau.collections.length} collections, ${bureau.publicRecords.length} public records`);
      
      for (const tl of bureau.tradelines.slice(0, 3)) {
        console.log(`     📊 Tradeline: ${tl.creditorName}`);
        console.log(`        Status: ${tl.status}, Balance: ${tl.balance}`);
        console.log(`        DOFD: ${tl.dateOfFirstDelinquency || 'N/A'}`);
        console.log(`        Opened: ${tl.openedDate || 'N/A'}`);
        console.log(`        LastUpdated: ${tl.lastUpdatedDate || 'N/A'}`);
      }
      
      for (const col of bureau.collections.slice(0, 3)) {
        console.log(`     🚨 Collection: ${col.collectorName}`);
        console.log(`        Balance: ${col.balance}, Status: ${col.status}`);
        console.log(`        DOFD: ${col.dateOfFirstDelinquency || 'N/A'}`);
        console.log(`        LastUpdated: ${col.lastUpdatedDate || 'N/A'}`);
      }
    }
    
    console.log('\n🔬 Step 3: Running rules engine analysis...');
    const analysisResult = await analyzeWithRulesEngine(legacyReport);
    
    console.log('✅ Analysis complete:');
    console.log(`   - Issues detected: ${analysisResult.issues.length}`);
    console.log(`   - AI explanations: ${analysisResult.aiExplanations.length}`);
    console.log(`   - Summary: ${analysisResult.summary.slice(0, 200)}...`);
    
    if (analysisResult.issues.length > 0) {
      console.log('\n📋 VIOLATIONS FOUND:');
      for (const issue of analysisResult.issues) {
        console.log(`   - [${issue.severity}] ${issue.ruleId}: ${issue.category}`);
        console.log(`     ${issue.descriptionMachine}`);
        console.log(`     Bureaus: ${(issue.affectedBureaus || []).join(', ')}`);
        console.log(`     Statutes: ${issue.statutes.join(', ')}`);
        console.log('');
      }
    } else {
      console.log('\n⚠️  NO VIOLATIONS DETECTED');
      console.log('   This might indicate an issue with the rules engine or date extraction.');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('TEST COMPLETE');
    console.log('='.repeat(60));
    
    return analysisResult.issues.length > 0;
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    return false;
  }
}

runTest().then(success => {
  console.log(`\nResult: ${success ? '✅ PASS' : '❌ FAIL'}`);
  process.exit(success ? 0 : 1);
});
