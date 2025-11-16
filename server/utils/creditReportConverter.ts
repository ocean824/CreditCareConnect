import type { CreditReport, BureauReport, Tradeline, BureauName } from "../models/creditReport";

/**
 * Converts a simplified parsed credit report to the comprehensive CreditReport format
 * required by the rules engine.
 * 
 * This is a basic converter that creates a minimal valid credit report structure.
 * In a production implementation, you would parse actual PDF/HTML credit reports
 * to extract all the detailed information.
 */
export function convertToCreditReport(params: {
  bureau: string;
  reportText?: string;
  userId: string;
  fileName: string;
}): CreditReport {
  const { bureau, reportText, userId, fileName } = params;

  // Map bureau string to BureauName type
  const bureauName: BureauName = mapBureauName(bureau);

  // Create a basic credit report structure
  // In production, this would parse the actual report content
  const bureauReport: BureauReport = {
    bureau: bureauName,
    reportId: fileName,
    tradelines: extractTradelines(reportText || ""),
    collections: extractCollections(reportText || ""),
    publicRecords: [],
    inquiries: [],
  };

  const creditReport: CreditReport = {
    pulledAt: new Date().toISOString(),
    provider: "Upload", // or parse from report
    consumer: {
      fullName: "Consumer Name", // Should be extracted from report
      addresses: [{
        line1: "Address Line 1",
        city: "City",
        state: "State",
        postalCode: "00000"
      }],
    },
    bureaus: [bureauReport],
  };

  return creditReport;
}

function mapBureauName(bureau: string): BureauName {
  const normalized = bureau.toUpperCase();
  
  if (normalized.includes("EQUIFAX")) return "Equifax";
  if (normalized.includes("TRANSUNION")) return "TransUnion";
  if (normalized.includes("EXPERIAN")) return "Experian";
  
  return "Other";
}

/**
 * Extract tradelines from report text
 * This is a placeholder - in production, use proper PDF parsing
 */
function extractTradelines(reportText: string): Tradeline[] {
  // TODO: Implement actual parsing logic
  // For now, return empty array or sample data
  return [];
}

/**
 * Extract collections from report text
 * This is a placeholder - in production, use proper PDF parsing
 */
function extractCollections(reportText: string) {
  // TODO: Implement actual parsing logic
  return [];
}

/**
 * Converts a TRI-MERGE report to multiple bureau reports
 */
export function convertTriMergeToCreditReport(params: {
  reportText: string;
  userId: string;
  fileName: string;
}): CreditReport {
  // Parse TRI-MERGE and create separate bureau reports
  // For now, create placeholder structure with all three bureaus
  
  const creditReport: CreditReport = {
    pulledAt: new Date().toISOString(),
    provider: "TRI-MERGE Upload",
    consumer: {
      fullName: "Consumer Name",
      addresses: [{
        line1: "Address Line 1",
        city: "City",
        state: "State",
        postalCode: "00000"
      }],
    },
    bureaus: [
      {
        bureau: "Equifax",
        tradelines: [],
        collections: [],
        publicRecords: [],
        inquiries: [],
      },
      {
        bureau: "TransUnion",
        tradelines: [],
        collections: [],
        publicRecords: [],
        inquiries: [],
      },
      {
        bureau: "Experian",
        tradelines: [],
        collections: [],
        publicRecords: [],
        inquiries: [],
      },
    ],
  };

  return creditReport;
}

/**
 * Creates a sample credit report with realistic violations for testing
 */
export function createSampleCreditReport(): CreditReport {
  return {
    pulledAt: new Date().toISOString(),
    provider: "Sample",
    consumer: {
      fullName: "John Doe",
      ssnLast4: "1234",
      dob: "1980-01-15",
      addresses: [{
        line1: "123 Main Street",
        city: "Naples",
        state: "FL",
        postalCode: "34117"
      }],
    },
    bureaus: [
      {
        bureau: "Equifax",
        tradelines: [
          {
            internalId: "tradeline_1",
            creditorName: "Capital One",
            type: "CreditCard",
            status: "ChargeOff",
            balance: 1500, // VIOLATION: Charged-off account shouldn't have balance
            highCreditLimit: 2000,
            creditLimit: 2000,
            openedDate: "2015-06-01",
            lastUpdatedDate: "2023-01-15",
            // Missing dateOfFirstDelinquency - VIOLATION
          },
          {
            internalId: "tradeline_2",
            creditorName: "Chase Bank",
            type: "CreditCard",
            status: "Open",
            balance: 500,
            creditLimit: 5000,
            openedDate: "2018-03-15",
            lastUpdatedDate: "2024-11-01",
          },
        ],
        collections: [
          {
            internalId: "collection_1",
            collectorName: "LVNV Funding",
            originalCreditorName: "Discover Card",
            balance: 800,
            status: "Open",
            openedDate: "2016-08-01", // VIOLATION: Collection older than 7 years
          },
        ],
        publicRecords: [],
        inquiries: [
          {
            internalId: "inquiry_1",
            inquirerName: "Random Inquiry",
            date: "2024-10-15",
            type: "Hard",
            // POTENTIAL VIOLATION: Unauthorized inquiry
          },
        ],
      },
    ],
  };
}
