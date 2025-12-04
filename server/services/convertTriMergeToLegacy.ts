import type { TriMergeCreditReport } from "../models/credit";
import type { CreditReport, BureauReport, BureauName, Tradeline as LegacyTradeline } from "../models/creditReport";

type ValidBureau = "EXPERIAN" | "EQUIFAX" | "TRANSUNION";

function normalizeBureauCode(bureau: string): ValidBureau | null {
  if (!bureau) return null;
  const upperBureau = String(bureau).toUpperCase().trim();
  
  if (upperBureau === "EXPERIAN" || upperBureau === "EXP" || upperBureau === "EX") return "EXPERIAN";
  if (upperBureau === "EQUIFAX" || upperBureau === "EQU" || upperBureau === "EQ" || upperBureau === "EFX") return "EQUIFAX";
  if (upperBureau === "TRANSUNION" || upperBureau === "TRANS UNION" || upperBureau === "TU" || upperBureau === "TRU") return "TRANSUNION";
  
  return null;
}

function normalizeBureauArray(bureaus: string[] | undefined): ValidBureau[] {
  if (!bureaus || !Array.isArray(bureaus)) return [];
  return bureaus
    .map(b => normalizeBureauCode(b))
    .filter((b): b is ValidBureau => b !== null);
}

export function convertTriMergeToLegacy(report: TriMergeCreditReport): CreditReport {
  // Normalize all bureau codes in the report to uppercase
  const normalizedBureausIncluded = normalizeBureauArray(report.meta.bureausIncluded);
  const bureausToCreate: ValidBureau[] = normalizedBureausIncluded.length > 0 
    ? normalizedBureausIncluded 
    : ["EXPERIAN", "EQUIFAX", "TRANSUNION"];

  // Normalize tradelines
  const normalizedTradelines = report.tradelines.map(tl => ({
    ...tl,
    bureaus: normalizeBureauArray(tl.bureaus),
    bureauSnapshots: tl.bureauSnapshots.map(bs => ({
      ...bs,
      bureau: normalizeBureauCode(bs.bureau) || bs.bureau
    }))
  }));

  // Normalize collections
  const normalizedCollections = report.collections.map(col => ({
    ...col,
    bureaus: normalizeBureauArray(col.bureaus),
    bureauSnapshots: col.bureauSnapshots.map(bs => ({
      ...bs,
      bureau: normalizeBureauCode(bs.bureau) || bs.bureau
    }))
  }));

  // Normalize public records
  const normalizedPublicRecords = report.publicRecords.map(pr => ({
    ...pr,
    bureaus: normalizeBureauArray(pr.bureaus)
  }));

  // Normalize inquiries
  const normalizedInquiries = report.inquiries.map(inq => ({
    ...inq,
    bureau: normalizeBureauCode(inq.bureau) || inq.bureau
  }));

  console.log(`[ConvertTriMerge] Processing ${normalizedTradelines.length} tradelines, ${normalizedCollections.length} collections`);
  console.log(`[ConvertTriMerge] Bureaus to create: ${bureausToCreate.join(', ')}`);

  const bureauReports: BureauReport[] = [];

  for (const bureau of bureausToCreate) {
    const legacyBureauName = bureau === "EXPERIAN" ? "Experian" : bureau === "EQUIFAX" ? "Equifax" : "TransUnion";

    const tradelines: LegacyTradeline[] = normalizedTradelines
      .filter((tl) => tl.bureaus.includes(bureau))
      .map((tl) => {
        const snapshot = tl.bureauSnapshots.find((bs) => bs.bureau === bureau);
        return {
          internalId: tl.id,
          creditorName: tl.creditorName,
          furnisherId: tl.creditorName,
          accountNumberMasked: tl.accountNumberLast4 ? `****${tl.accountNumberLast4}` : undefined,
          type: mapTradelineType(tl.type),
          status: mapAccountStatus(snapshot?.status || tl.status),
          balance: snapshot?.balance ?? tl.balance,
          pastDueAmount: snapshot?.pastDue ?? tl.pastDue,
          lastPaymentDate: tl.lastPaymentDate,
          lastUpdatedDate: snapshot?.lastUpdatedDate,
          dateOfFirstDelinquency: tl.dateOfFirstDelinquency,
          openedDate: tl.openedDate,
          closedDate: tl.closedDate,
          creditLimit: tl.creditLimit,
          highCreditLimit: tl.highCreditLimit,
          isOriginalCreditor: true
        } as LegacyTradeline;
      });

    const collections = normalizedCollections
      .filter((col) => col.bureaus.includes(bureau))
      .map((col) => {
        const snapshot = col.bureauSnapshots.find((bs) => bs.bureau === bureau);
        return {
          internalId: col.id,
          collectorName: col.collectorName,
          originalCreditorName: col.originalCreditorName,
          accountNumberMasked: col.accountNumberLast4 ? `****${col.accountNumberLast4}` : undefined,
          status: mapCollectionStatus(snapshot?.status),
          balance: snapshot?.balance ?? col.balance,
          dateOfFirstDelinquency: col.dateOfFirstDelinquency,
          openedDate: col.openedDate,
          lastUpdatedDate: col.lastUpdatedDate
        } as any;
      });

    const publicRecords = normalizedPublicRecords
      .filter((pr) => pr.bureaus.includes(bureau))
      .map((pr) => ({
        internalId: pr.id,
        type: pr.type as "Bankruptcy" | "TaxLien" | "Judgment" | "Other",
        courtName: pr.courtName,
        amount: pr.amount,
        filedDate: pr.filedDate,
        status: mapPublicRecordStatus(pr.status)
      }));

    const inquiries = normalizedInquiries
      .filter((inq) => inq.bureau === bureau)
      .map((inq) => ({
        internalId: inq.id,
        inquirerName: inq.inquirerName,
        date: inq.date,
        type: "Hard" as const
      }));

    console.log(`[ConvertTriMerge] Bureau ${bureau}: ${tradelines.length} tradelines, ${collections.length} collections, ${publicRecords.length} public records, ${inquiries.length} inquiries`);

    bureauReports.push({
      bureau: legacyBureauName,
      tradelines,
      collections,
      publicRecords,
      inquiries
    });
  }

  // Convert addresses to required format
  const addresses = (report.consumer?.addresses || []).map(addr => ({
    line1: addr.line1 || "",
    line2: addr.line2,
    city: addr.city || "",
    state: addr.state || "",
    postalCode: addr.postalCode || "",
  }));

  return {
    pulledAt: new Date().toISOString(),
    provider: report.meta.provider || "IDENTITYIQ",
    consumer: {
      fullName: report.consumer?.fullName || "Consumer",
      ssnLast4: report.consumer?.ssnLast4,
      dob: report.consumer?.dob,
      addresses: addresses.length > 0 ? addresses : [{ line1: "", city: "", state: "", postalCode: "" }],
      phones: report.consumer?.phones,
      employers: report.consumer?.employers
    },
    bureaus: bureauReports
  };
}

function mapTradelineType(type: string): "Mortgage" | "Auto" | "CreditCard" | "StudentLoan" | "PersonalLoan" | "LineOfCredit" | "Other" {
  if (!type) return "Other";
  const typeStr = String(type).toUpperCase();
  const typeMap: Record<string, "Mortgage" | "Auto" | "CreditCard" | "StudentLoan" | "PersonalLoan" | "LineOfCredit" | "Other"> = {
    MORTGAGE: "Mortgage",
    AUTO: "Auto",
    CREDIT_CARD: "CreditCard",
    STUDENT_LOAN: "StudentLoan",
    PERSONAL_LOAN: "PersonalLoan",
    HELOC: "LineOfCredit",
    REVOLVING: "CreditCard",
    INSTALLMENT: "PersonalLoan"
  };
  return typeMap[typeStr] || "Other";
}

function mapAccountStatus(status: string): "Open" | "Closed" | "ChargeOff" | "Collection" | "Repossession" | "Foreclosure" | "Late30" | "Late60" | "Late90" | "Late120" | "Late150Plus" | "Delinquent" | "Unknown" {
  if (!status) return "Unknown";
  const statusStr = String(status).toUpperCase();
  const statusMap: Record<string, "Open" | "Closed" | "ChargeOff" | "Collection" | "Repossession" | "Foreclosure" | "Late30" | "Late60" | "Late90" | "Late120" | "Late150Plus" | "Delinquent" | "Unknown"> = {
    CURRENT: "Open",
    OPEN: "Open",
    CLOSED: "Closed",
    LATE_30: "Late30",
    LATE_60: "Late60",
    LATE_90: "Late90",
    LATE_120: "Late120",
    LATE_150_PLUS: "Late150Plus",
    DELINQUENT: "Delinquent",
    CHARGE_OFF: "ChargeOff",
    CHARGEOFF: "ChargeOff",
    COLLECTION: "Collection",
    FORECLOSURE: "Foreclosure",
    REPOSSESSION: "Repossession"
  };
  return statusMap[statusStr] || "Unknown";
}

function mapCollectionStatus(status?: string): "Open" | "Closed" | "Paid" | "Settled" | "Disputed" {
  if (!status) return "Open";
  const statusStr = String(status).toUpperCase();
  const statusMap: Record<string, "Open" | "Closed" | "Paid" | "Settled" | "Disputed"> = {
    OPEN_COLLECTION: "Open",
    OPEN: "Open",
    PAID_COLLECTION: "Paid",
    PAID: "Paid",
    SETTLED: "Settled",
    CLOSED: "Closed",
    DISPUTED: "Disputed"
  };
  return statusMap[statusStr] || "Open";
}

function mapPublicRecordStatus(status?: string): "Open" | "Satisfied" | "Released" | "Discharged" | undefined {
  if (!status) return undefined;
  const statusStr = String(status).toUpperCase();
  const statusMap: Record<string, "Open" | "Satisfied" | "Released" | "Discharged"> = {
    OPEN: "Open",
    FILED: "Open",
    SATISFIED: "Satisfied",
    RELEASED: "Released",
    DISCHARGED: "Discharged",
    DISMISSED: "Released"
  };
  return statusMap[statusStr];
}
