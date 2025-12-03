import { runAllRules } from '../rules/engine';
import type { CreditReport, BureauReport, Tradeline, CollectionAccount } from '../models/creditReport';

function createMockCreditReport(): CreditReport {
  const expiredCollection: CollectionAccount = {
    internalId: 'col-001',
    collectorName: 'MIDLAND FUNDING LLC',
    originalCreditorName: 'SYNCHRONY BANK',
    accountNumberMasked: '****3344',
    balance: 1875,
    status: 'Open',
    openedDate: '2016-08-15',
    dateOfFirstDelinquency: '2016-08-15',
    lastUpdatedDate: '2025-11-01',
  };

  const chargeOffTradeline: Tradeline = {
    internalId: 'tl-001',
    creditorName: 'CAPITAL ONE BANK',
    accountNumberMasked: '****4521',
    type: 'CreditCard',
    status: 'ChargeOff',
    balance: 2450,
    pastDueAmount: 2450,
    openedDate: '2015-01-15',
    dateOfFirstDelinquency: '2017-03-01',
    lastPaymentDate: '2017-02-15',
    lastUpdatedDate: '2025-11-15',
  };

  const normalTradeline: Tradeline = {
    internalId: 'tl-002',
    creditorName: 'GM FINANCIAL',
    accountNumberMasked: '****7890',
    type: 'Auto',
    status: 'Open',
    balance: 11265,
    pastDueAmount: 0,
    openedDate: '2020-06-20',
    lastPaymentDate: '2025-11-01',
    lastUpdatedDate: '2025-11-15',
  };

  const experianBureau: BureauReport = {
    bureau: 'Experian',
    tradelines: [chargeOffTradeline, normalTradeline],
    collections: [expiredCollection],
    publicRecords: [],
    inquiries: [],
  };

  const transunionBureau: BureauReport = {
    bureau: 'TransUnion',
    tradelines: [
      { ...chargeOffTradeline, internalId: 'tl-001-tu' },
      { ...normalTradeline, internalId: 'tl-002-tu', balance: 11500 },
    ],
    collections: [{ ...expiredCollection, internalId: 'col-001-tu' }],
    publicRecords: [],
    inquiries: [],
  };

  const equifaxBureau: BureauReport = {
    bureau: 'Equifax',
    tradelines: [
      { ...chargeOffTradeline, internalId: 'tl-001-eq' },
      { ...normalTradeline, internalId: 'tl-002-eq' },
    ],
    collections: [{ ...expiredCollection, internalId: 'col-001-eq' }],
    publicRecords: [],
    inquiries: [],
  };

  return {
    pulledAt: new Date().toISOString(),
    provider: 'TEST',
    consumer: {
      fullName: 'John Q. Doe',
      addresses: [{ line1: '123 Main St', city: 'Anytown', state: 'CA', postalCode: '90210' }],
    },
    bureaus: [experianBureau, transunionBureau, equifaxBureau],
  };
}

async function runTest() {
  console.log('='.repeat(60));
  console.log('RULES ENGINE TEST (NO AI REQUIRED)');
  console.log('='.repeat(60));
  
  console.log('\n📄 Creating mock credit report with known violations...');
  const mockReport = createMockCreditReport();
  
  console.log('✅ Mock report created:');
  console.log(`   - Bureaus: ${mockReport.bureaus.length}`);
  for (const bureau of mockReport.bureaus) {
    console.log(`   - ${bureau.bureau}: ${bureau.tradelines.length} tradelines, ${bureau.collections.length} collections`);
  }
  
  console.log('\n🔬 Running rules engine analysis...');
  const issues = runAllRules(mockReport);
  
  console.log(`\n✅ Analysis complete: ${issues.length} violations detected`);
  
  if (issues.length > 0) {
    console.log('\n📋 VIOLATIONS FOUND:');
    for (const issue of issues) {
      console.log(`\n   [${issue.severity}] ${issue.ruleId}`);
      console.log(`   Category: ${issue.category}`);
      console.log(`   Description: ${issue.descriptionMachine}`);
      console.log(`   Bureaus: ${(issue.affectedBureaus || []).join(', ')}`);
      console.log(`   Statutes: ${issue.statutes.join(', ')}`);
    }
  } else {
    console.log('\n⚠️  NO VIOLATIONS DETECTED');
    console.log('   The mock report includes:');
    console.log('   - Collection from 2016 (should be >7 years obsolete)');
    console.log('   - Charge-off from 2017 (near 7-year mark)');
    console.log('   - Balance discrepancy between bureaus');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
  
  const expected = issues.length > 0;
  console.log(`\nResult: ${expected ? '✅ PASS - Violations detected' : '❌ FAIL - No violations detected'}`);
  
  return expected;
}

runTest().then(success => {
  process.exit(success ? 0 : 1);
});
