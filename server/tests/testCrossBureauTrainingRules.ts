import { runAllRules } from '../rules/engine';
import type { CreditReport, BureauReport, Tradeline, CollectionAccount } from '../models/creditReport';

function createBaseReport(): CreditReport {
  return {
    pulledAt: new Date().toISOString(),
    provider: 'TEST',
    consumer: {
      fullName: 'Test Consumer',
      addresses: [{ line1: '123 Test St', city: 'Testville', state: 'CA', postalCode: '90210' }],
    },
    bureaus: [],
  };
}

async function testR5Path1BureauAccountId() {
  console.log('\n=== Test R5 Path 1: bureauAccountId Match ===');
  
  const collection1: CollectionAccount = {
    internalId: 'col-001',
    collectorName: 'MIDLAND FUNDING LLC',
    originalCreditorName: 'SYNCHRONY BANK',
    accountNumberMasked: '****XXXX',
    bureauAccountId: 'ACCOUNT123456',
    balance: 1875,
    status: 'Open',
    openedDate: '2020-01-15',
    dateOfFirstDelinquency: '2020-03-01',
  };

  const collection2: CollectionAccount = {
    internalId: 'col-002',
    collectorName: 'MIDLAND FUNDING LLC',
    originalCreditorName: 'SYNCHRONY BANK',
    accountNumberMasked: '****YYYY',
    bureauAccountId: 'ACCOUNT123456',
    balance: 1875,
    status: 'Open',
    openedDate: '2020-01-16',
    dateOfFirstDelinquency: '2020-03-02',
  };

  const equifaxBureau: BureauReport = {
    bureau: 'Equifax',
    tradelines: [],
    collections: [collection1, collection2],
    publicRecords: [],
    inquiries: [],
  };

  const report = createBaseReport();
  report.bureaus = [equifaxBureau];

  const issues = await runAllRules(report);
  const r5Issues = issues.filter(i => i.ruleId === 'R5_FCRA_DUPLICATE_COLLECTION_SAME_DEBT');
  
  console.log(`Found ${r5Issues.length} R5 violations`);
  if (r5Issues.length > 0) {
    console.log('Details:', JSON.stringify(r5Issues[0].details, null, 2));
    console.log('✅ PASS: bureauAccountId path detected duplicate');
  } else {
    console.log('❌ FAIL: bureauAccountId path did not detect duplicate');
  }
  
  return r5Issues.length > 0;
}

async function testR5Path2AccountNumber() {
  console.log('\n=== Test R5 Path 2: Account Number Match ===');
  
  const collection1: CollectionAccount = {
    internalId: 'col-001',
    collectorName: 'PORTFOLIO RECOVERY',
    originalCreditorName: 'CAPITAL ONE',
    accountNumberMasked: '****5678',
    balance: 2500,
    status: 'Open',
    openedDate: '2021-06-01',
    dateOfFirstDelinquency: '2021-08-15',
  };

  const collection2: CollectionAccount = {
    internalId: 'col-002',
    collectorName: 'PORTFOLIO RECOVERY',
    originalCreditorName: 'CAPITAL ONE',
    accountNumberMasked: '****5678',
    balance: 2500,
    status: 'Open',
    openedDate: '2021-06-02',
    dateOfFirstDelinquency: '2021-08-16',
  };

  const transunionBureau: BureauReport = {
    bureau: 'TransUnion',
    tradelines: [],
    collections: [collection1, collection2],
    publicRecords: [],
    inquiries: [],
  };

  const report = createBaseReport();
  report.bureaus = [transunionBureau];

  const issues = await runAllRules(report);
  const r5Issues = issues.filter(i => i.ruleId === 'R5_FCRA_DUPLICATE_COLLECTION_SAME_DEBT');
  
  console.log(`Found ${r5Issues.length} R5 violations`);
  if (r5Issues.length > 0) {
    console.log('Details:', JSON.stringify(r5Issues[0].details, null, 2));
    console.log('✅ PASS: Account number path detected duplicate');
  } else {
    console.log('❌ FAIL: Account number path did not detect duplicate');
  }
  
  return r5Issues.length > 0;
}

async function testR5Path3DOFD() {
  console.log('\n=== Test R5 Path 3: DOFD Match (Masked Numbers) ===');
  
  const collection1: CollectionAccount = {
    internalId: 'col-001',
    collectorName: 'CONVERGENT OUTSOURCING',
    originalCreditorName: 'TMOBILE',
    accountNumberMasked: '****XXXX',
    balance: 450,
    status: 'Open',
    openedDate: '2022-01-10',
    dateOfFirstDelinquency: '2022-04-15',
  };

  const collection2: CollectionAccount = {
    internalId: 'col-002',
    collectorName: 'CONVERGENT OUTSOURCING',
    originalCreditorName: 'TMOBILE',
    accountNumberMasked: '****XXXX',
    balance: 450,
    status: 'Open',
    openedDate: '2022-01-11',
    dateOfFirstDelinquency: '2022-04-15',
  };

  const experianBureau: BureauReport = {
    bureau: 'Experian',
    tradelines: [],
    collections: [collection1, collection2],
    publicRecords: [],
    inquiries: [],
  };

  const report = createBaseReport();
  report.bureaus = [experianBureau];

  const issues = await runAllRules(report);
  const r5Issues = issues.filter(i => i.ruleId === 'R5_FCRA_DUPLICATE_COLLECTION_SAME_DEBT');
  
  console.log(`Found ${r5Issues.length} R5 violations`);
  if (r5Issues.length > 0) {
    console.log('Details:', JSON.stringify(r5Issues[0].details, null, 2));
    console.log('✅ PASS: DOFD path detected duplicate');
  } else {
    console.log('❌ FAIL: DOFD path did not detect duplicate');
  }
  
  return r5Issues.length > 0;
}

async function testR5Path4OpenedDate() {
  console.log('\n=== Test R5 Path 4: OpenedDate Match (No DOFD) ===');
  
  const collection1: CollectionAccount = {
    internalId: 'col-001',
    collectorName: 'IC SYSTEM',
    originalCreditorName: 'ATT MOBILITY',
    accountNumberMasked: '****XXXX',
    balance: 325,
    status: 'Open',
    openedDate: '2023-03-20',
  };

  const collection2: CollectionAccount = {
    internalId: 'col-002',
    collectorName: 'IC SYSTEM',
    originalCreditorName: 'ATT MOBILITY',
    accountNumberMasked: '****YYYY',
    balance: 325,
    status: 'Open',
    openedDate: '2023-03-20',
  };

  const equifaxBureau: BureauReport = {
    bureau: 'Equifax',
    tradelines: [],
    collections: [collection1, collection2],
    publicRecords: [],
    inquiries: [],
  };

  const report = createBaseReport();
  report.bureaus = [equifaxBureau];

  const issues = await runAllRules(report);
  const r5Issues = issues.filter(i => i.ruleId === 'R5_FCRA_DUPLICATE_COLLECTION_SAME_DEBT');
  
  console.log(`Found ${r5Issues.length} R5 violations`);
  if (r5Issues.length > 0) {
    console.log('Details:', JSON.stringify(r5Issues[0].details, null, 2));
    console.log('✅ PASS: OpenedDate path detected duplicate');
  } else {
    console.log('❌ FAIL: OpenedDate path did not detect duplicate');
  }
  
  return r5Issues.length > 0;
}

async function testR5NoDuplicate() {
  console.log('\n=== Test R5 Negative: No False Positives ===');
  
  const collection1: CollectionAccount = {
    internalId: 'col-001',
    collectorName: 'MIDLAND FUNDING LLC',
    originalCreditorName: 'SYNCHRONY BANK',
    accountNumberMasked: '****1111',
    balance: 1875,
    status: 'Open',
    openedDate: '2020-01-15',
    dateOfFirstDelinquency: '2020-03-01',
  };

  const collection2: CollectionAccount = {
    internalId: 'col-002',
    collectorName: 'PORTFOLIO RECOVERY',
    originalCreditorName: 'CAPITAL ONE',
    accountNumberMasked: '****2222',
    balance: 2500,
    status: 'Open',
    openedDate: '2021-06-01',
    dateOfFirstDelinquency: '2021-08-15',
  };

  const equifaxBureau: BureauReport = {
    bureau: 'Equifax',
    tradelines: [],
    collections: [collection1, collection2],
    publicRecords: [],
    inquiries: [],
  };

  const report = createBaseReport();
  report.bureaus = [equifaxBureau];

  const issues = await runAllRules(report);
  const r5Issues = issues.filter(i => i.ruleId === 'R5_FCRA_DUPLICATE_COLLECTION_SAME_DEBT');
  
  console.log(`Found ${r5Issues.length} R5 violations`);
  if (r5Issues.length === 0) {
    console.log('✅ PASS: No false positives for different collections');
  } else {
    console.log('❌ FAIL: False positive detected for different collections');
  }
  
  return r5Issues.length === 0;
}

async function testR6SoldAccountChargeoff() {
  console.log('\n=== Test R6: Sold Account Still Chargeoff ===');
  console.log('Testing: statusRaw contains sold+chargeoff combined status');
  
  const soldTradeline: Tradeline = {
    internalId: 'tl-001',
    creditorName: 'CAPITAL ONE BANK',
    accountNumberMasked: '****4521',
    type: 'CreditCard',
    status: 'Sold',
    statusRaw: 'Sold / Charge-Off',
    remarks: ['Account sold to collection agency'],
    isOriginalCreditor: true,
    balance: 0,
    pastDueAmount: 0,
    openedDate: '2018-01-15',
    dateOfFirstDelinquency: '2020-03-01',
    lastPaymentDate: '2020-02-15',
    lastUpdatedDate: '2025-11-15',
  };

  const equifaxBureau: BureauReport = {
    bureau: 'Equifax',
    tradelines: [soldTradeline],
    collections: [],
    publicRecords: [],
    inquiries: [],
  };

  const report = createBaseReport();
  report.bureaus = [equifaxBureau];

  const issues = await runAllRules(report);
  const r6Issues = issues.filter(i => i.ruleId === 'R6_FCRA_SOLD_ACCOUNT_STILL_CHARGEOFF_STATUS');
  
  console.log(`Found ${r6Issues.length} R6 violations`);
  if (r6Issues.length > 0) {
    console.log('Details:', JSON.stringify(r6Issues[0].details, null, 2));
    console.log('✅ PASS: Sold account with chargeoff status detected');
  } else {
    console.log('❌ FAIL: Sold account with chargeoff status not detected');
  }
  
  return r6Issues.length > 0;
}

async function runAllTests() {
  console.log('========================================');
  console.log('Cross-Bureau Training Rules Test Suite');
  console.log('========================================');
  
  const results: { name: string; passed: boolean }[] = [];
  
  results.push({ name: 'R5 Path 1 (bureauAccountId)', passed: await testR5Path1BureauAccountId() });
  results.push({ name: 'R5 Path 2 (Account Number)', passed: await testR5Path2AccountNumber() });
  results.push({ name: 'R5 Path 3 (DOFD)', passed: await testR5Path3DOFD() });
  results.push({ name: 'R5 Path 4 (OpenedDate)', passed: await testR5Path4OpenedDate() });
  results.push({ name: 'R5 No False Positives', passed: await testR5NoDuplicate() });
  results.push({ name: 'R6 Sold Account Chargeoff', passed: await testR6SoldAccountChargeoff() });
  
  console.log('\n========================================');
  console.log('Test Results Summary');
  console.log('========================================');
  
  let passed = 0;
  let failed = 0;
  
  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${result.name}`);
    if (result.passed) passed++;
    else failed++;
  }
  
  console.log(`\nTotal: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(console.error);
