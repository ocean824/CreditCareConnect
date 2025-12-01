import type { TriMergeCreditReport } from "../models/credit";
import type { CreditReport, BureauReport, BureauName, Tradeline as LegacyTradeline } from "../models/creditReport";

export function convertTriMergeToLegacy(report: TriMergeCreditReport): CreditReport {
  // Convert new tri-merge format back to legacy format for compatibility with existing rules engine
  const bureauReports: BureauReport[] = [];

  // Get unique bureaus from the report
  const bureausToCreate = report.meta.bureausIncluded || ["EXPERIAN", "EQUIFAX", "TRANSUNION"];

  for (const bureau of bureausToCreate) {
    const legacyBureauName = bureau === "EXPERIAN" ? "Experian" : bureau === "EQUIFAX" ? "Equifax" : "TransUnion";

    const tradelines: LegacyTradeline[] = report.tradelines
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
          isOriginalCreditor: true
        };
      });

    const collections = report.collections
      .filter((col) => col.bureaus.includes(bureau))
      .map((col) => {
        const snapshot = col.bureauSnapshots.find((bs) => bs.bureau === bureau);
        return {
          internalId: col.id,
          collectorName: col.collectorName,
          originalCreditorName: col.originalCreditorName,
          status: mapCollectionStatus(snapshot?.status),
          balance: snapshot?.balance ?? col.balance
        };
      });

    bureauReports.push({
      bureau: legacyBureauName,
      tradelines,
      collections,
      publicRecords: report.publicRecords.filter((pr) => pr.bureaus.includes(bureau)).map((pr) => ({
        internalId: pr.id,
        type: pr.type as "Bankruptcy" | "TaxLien" | "Judgment" | "Other",
        courtName: pr.courtName,
        amount: pr.amount
      })),
      inquiries: report.inquiries.filter((inq) => inq.bureau === bureau).map((inq) => ({
        internalId: inq.id,
        inquirerName: inq.inquirerName,
        date: inq.date,
        type: "Hard" as const
      }))
    });
  }

  return {
    pulledAt: new Date().toISOString(),
    provider: report.meta.provider || "IDENTITYIQ",
    consumer: {
      fullName: report.consumer?.fullName || "Consumer",
      ssnLast4: report.consumer?.ssnLast4,
      dob: report.consumer?.dob,
      addresses: report.consumer?.addresses || [{ line1: "", city: "", state: "", postalCode: "" }],
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

function mapAccountStatus(status: string): "Open" | "Closed" | "ChargeOff" | "Collection" | "Repossession" | "Foreclosure" | "Unknown" {
  if (!status) return "Unknown";
  const statusStr = String(status).toUpperCase();
  const statusMap: Record<string, "Open" | "Closed" | "ChargeOff" | "Collection" | "Repossession" | "Foreclosure" | "Unknown"> = {
    CURRENT: "Open",
    OPEN: "Open",
    CLOSED: "Closed",
    LATE_30: "Open",
    LATE_60: "Open",
    LATE_90: "Open",
    LATE_120: "Open",
    LATE_150_PLUS: "Open",
    CHARGE_OFF: "ChargeOff",
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
