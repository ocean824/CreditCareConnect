import OpenAI from "openai";
import {
  TriMergeCreditReport,
  BureauCode,
  BureauSnapshot,
  Tradeline,
  CollectionAccount,
  PublicRecord,
  Inquiry,
  AccountStatus,
  TradelineType,
  CollectionStatus,
} from "../models/credit";
import { nanoid } from "nanoid";

// Use Replit AI Integrations if available, otherwise fall back to user's OpenAI API key
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const useReplitAI = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const userApiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.OPEN_AI_KEY;

const openai = useReplitAI 
  ? new OpenAI({ 
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
    })
  : (userApiKey ? new OpenAI({ apiKey: userApiKey }) : null);

const OPENAI_MODEL = useReplitAI ? "gpt-5" : (process.env.OPENAI_MODEL || "gpt-4o");

if (useReplitAI) {
  console.log("✅ Using Replit AI Integrations for credit report parsing");
} else if (userApiKey) {
  console.log("⚠️ Using user's OpenAI API key for credit report parsing");
} else {
  console.warn("❌ No OpenAI configuration found - parsing will use fallback");
}

export interface ParseCreditReportParams {
  rawText: string;
  bureauHint: BureauCode;
  provider?: string;
  userId: string;
  existingReportId?: string;
}

const SYSTEM_PROMPT = `You are a strict JSON-only parser for consumer credit reports, especially IdentityIQ tri-merge PDFs.

Your job:
- Read raw text of a credit report (often IdentityIQ tri-merge including Experian, Equifax, and TransUnion).
- Normalize it into a single JSON object with the exact shape of TriMergeCreditReport.
- When parsing tri-merge reports, you MUST:
  - Detect which tradelines/collections appear on which bureaus
  - Link the same underlying debt across bureaus using creditor name, account number, and similar balances
  - Populate per-bureau snapshots for tradelines and collections
- When parsing single-bureau reports, use the same structure with only that one bureau

OUTPUT RULES (CRITICAL):
- Output MUST be a single JSON object ONLY. No markdown. No prose. No explanations.
- All money amounts should be numeric (no '$' or commas)
- If a field value is unknown, use null or empty array
- All dates must be ISO-8601 format (YYYY-MM-DD)
- CRITICAL: Extract ALL date fields - these are essential for violation detection!

Return this exact JSON structure:
{
  "id": "string",
  "userId": "string",
  "meta": {
    "id": "string",
    "provider": "string",
    "reportDate": "YYYY-MM-DD",
    "bureausIncluded": ["EXPERIAN", "EQUIFAX", "TRANSUNION"]
  },
  "consumer": {
    "fullName": "string",
    "ssnLast4": "1234",
    "dob": "YYYY-MM-DD",
    "addresses": [{"line1": "string", "city": "string", "state": "XX", "postalCode": "12345"}]
  },
  "tradelines": [
    {
      "id": "string",
      "creditorName": "string",
      "accountNumberLast4": "string",
      "type": "MORTGAGE|AUTO|CREDIT_CARD|PERSONAL_LOAN|HELOC|STUDENT_LOAN|OTHER",
      "status": "OPEN|CLOSED|CURRENT|LATE_30|LATE_60|LATE_90|LATE_120|LATE_150_PLUS|COLLECTION|CHARGE_OFF|FORECLOSURE|REPOSSESSION|UNKNOWN",
      "balance": 1234.56,
      "pastDue": 123.45,
      "dateOfFirstDelinquency": "YYYY-MM-DD or null",
      "openedDate": "YYYY-MM-DD or null",
      "closedDate": "YYYY-MM-DD or null",
      "lastPaymentDate": "YYYY-MM-DD or null",
      "creditLimit": 5000,
      "highCreditLimit": 5000,
      "bureaus": ["EXPERIAN", "EQUIFAX"],
      "bureauSnapshots": [
        {
          "bureau": "EXPERIAN",
          "status": "CHARGE_OFF|LATE_120|CURRENT",
          "balance": 1234.56,
          "pastDue": 0,
          "lastUpdatedDate": "YYYY-MM-DD or null"
        }
      ],
      "remarks": ["string"]
    }
  ],
  "collections": [
    {
      "id": "string",
      "collectorName": "string",
      "originalCreditorName": "string|null",
      "accountNumberLast4": "string",
      "bureauAccountId": "string|null (the full or partial account/reference number as shown by the bureau)",
      "status": "OPEN_COLLECTION|PAID_COLLECTION|SETTLED|UNKNOWN",
      "balance": 1572.00,
      "dateOfFirstDelinquency": "YYYY-MM-DD or null",
      "openedDate": "YYYY-MM-DD or null",
      "lastUpdatedDate": "YYYY-MM-DD or null",
      "bureaus": ["TRANSUNION", "EXPERIAN"],
      "bureauSnapshots": [
        {
          "bureau": "TRANSUNION",
          "status": "OPEN_COLLECTION",
          "balance": 1572.00,
          "pastDue": 0,
          "lastUpdatedDate": "YYYY-MM-DD or null"
        }
      ],
      "remarks": []
    }
  ],
  "publicRecords": [
    {
      "id": "string",
      "type": "Bankruptcy|TaxLien|Judgment|Other",
      "courtName": "string",
      "amount": 0,
      "filedDate": "YYYY-MM-DD or null",
      "status": "Filed|Discharged|Dismissed",
      "bureaus": ["EXPERIAN"]
    }
  ],
  "inquiries": [
    {
      "id": "string",
      "bureau": "EXPERIAN",
      "inquirerName": "string",
      "date": "YYYY-MM-DD",
      "type": "Hard|Soft"
    }
  ]
}

DATE EXTRACTION RULES (CRITICAL FOR VIOLATION DETECTION):
- dateOfFirstDelinquency: The date when the account FIRST became delinquent. Often labeled "Date of First Delinquency", "DOFD", "First Delinquency", or "Date of Status". ESSENTIAL for 7-year rule violations.
- openedDate: When the account was opened. Often labeled "Date Opened", "Open Date", or "Account Opened".
- closedDate: When the account was closed (if applicable).
- lastPaymentDate: Date of the last payment made on the account.
- lastUpdatedDate: When the furnisher last reported this account. Often labeled "Date Updated", "Last Reported", "Date of Last Activity".
- filedDate: For bankruptcies and public records, the date filed with the court.

LOOK FOR THESE DATE LABELS in credit reports:
- "Date Opened", "Open Date" → openedDate
- "Date of First Delinquency", "DOFD", "1st Delinquency" → dateOfFirstDelinquency  
- "Date Closed", "Closed" → closedDate
- "Last Payment", "Last Payment Date" → lastPaymentDate
- "Date Reported", "Last Updated", "Date of Last Activity" → lastUpdatedDate
- "Filed", "Date Filed" → filedDate (for public records)

TRI-MERGE LINKING RULES:
- IdentityIQ tri-merge reports list accounts separately under "Experian", "Equifax", and "TransUnion" sections
- When the SAME underlying debt appears across multiple bureaus (matched by creditor name, account number, similar balance):
  - Merge into ONE tradeline/collection in the JSON
  - Use creditor name, account number last 4, and similar balances to determine matches
  - Example: "GM FINANCIAL" auto showing $0 on TU but $11,265 on EX/EQ = ONE tradeline with 3 bureauSnapshots
- tradlines[].bureaus = list of bureaus where this appears
- tradelines[].bureauSnapshots = array with one entry per bureau

SINGLE-BUREAU CASE:
- If only one bureau is present, still use the same structure
- meta.bureausIncluded contains only that bureau
- Each tradeline has bureaus: ["EXPERIAN"] with a single bureauSnapshot`;

function buildUserPrompt(
  rawText: string,
  bureauHint: BureauCode,
  provider: string,
  userId: string,
  existingReportId?: string
): string {
  // GPT-5 supports 128k tokens (~500k chars). Using 900k char limit for extra large reports.
  const MAX_TEXT_LENGTH = 900000;
  const text = rawText.length > MAX_TEXT_LENGTH ? rawText.slice(0, MAX_TEXT_LENGTH) : rawText;
  
  console.log(`📄 Credit report text length: ${rawText.length} chars (using ${text.length} chars)`);

  return `Provider: ${provider}
Bureau hint: ${bureauHint}
User ID: ${userId}
Report ID: ${existingReportId || nanoid()}

If bureauHint == "TRI":
- This is a tri-merge report with Experian, Equifax, and TransUnion sections
- IdentityIQ often labels sections clearly with headers
- MUST detect the three bureau sections and match accounts across them
- Populate bureauSnapshots for each tradeline/collection
- Set meta.bureausIncluded to list of bureaus actually present

If bureauHint is a single bureau:
- Only that bureau's data is present
- meta.bureausIncluded: [that bureau]
- All items have bureaus/bureauSnapshots for only that one bureau

FULL CREDIT REPORT TEXT:

"""${text}"""

Return ONLY a single JSON object matching TriMergeCreditReport. No explanations.`;
}

async function parseWithRetry(
  rawText: string,
  bureauHint: BureauCode,
  provider: string,
  userId: string,
  reportId: string,
  isRetry: boolean = false
): Promise<any> {
  if (!openai) {
    throw new Error("OpenAI not configured");
  }
  
  const userPrompt = isRetry 
    ? buildRetryPrompt(rawText, bureauHint, provider, userId, reportId)
    : buildUserPrompt(rawText, bureauHint, provider, userId, reportId);

  console.log(`🤖 Parsing ${bureauHint} report with AI${isRetry ? ' (RETRY with enhanced prompt)' : ''}...`);

  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 8192,
  });

  return JSON.parse(response.choices[0].message.content || "{}");
}

function buildRetryPrompt(
  rawText: string,
  bureauHint: BureauCode,
  provider: string,
  userId: string,
  reportId: string
): string {
  const MAX_TEXT_LENGTH = 900000;
  const text = rawText.length > MAX_TEXT_LENGTH ? rawText.slice(0, MAX_TEXT_LENGTH) : rawText;
  
  console.log(`📄 [RETRY] Credit report text length: ${rawText.length} chars`);

  return `CRITICAL RETRY - Previous parse returned 0 accounts. This is a credit report that MUST contain tradelines and/or collections.

Provider: ${provider}
Bureau hint: ${bureauHint}
User ID: ${userId}
Report ID: ${reportId}

IMPORTANT INSTRUCTIONS FOR RETRY:
1. This is an IdentityIQ tri-merge credit report PDF that was OCR'd
2. Look for ANY accounts, debts, loans, credit cards, collections, charge-offs
3. Common section headers: "Accounts", "Trade Lines", "Collections", "Negative Items", "Credit Summary"
4. Look for creditor/collector names like: Capital One, Chase, Discover, Midland Credit, Portfolio Recovery
5. Extract balances (even if $0), account statuses, and dates
6. If you find ANY financial accounts, include them as tradelines
7. If you find ANY collection agencies or debt collectors, include them as collections
8. For bureauSnapshots: if an account appears under "Equifax" section, add a snapshot for EQUIFAX bureau

COMMON PATTERNS IN IDENTITYIQ REPORTS:
- "EXPERIAN" / "EQUIFAX" / "TRANSUNION" section headers
- Account Name: [creditor name]
- Status: Open/Closed/Collection/Charge-off
- Balance: $X,XXX or $0
- Date Opened: MM/DD/YYYY
- Last Payment: MM/DD/YYYY

Even if data quality is poor, return whatever accounts you can find. Empty tradelines/collections arrays is NOT acceptable for a real credit report.

FULL CREDIT REPORT TEXT:

"""${text}"""

Return ONLY a single JSON object matching TriMergeCreditReport with ALL accounts found. No explanations.`;
}

export async function parseCreditReportWithAiOnly(params: ParseCreditReportParams): Promise<TriMergeCreditReport> {
  const { rawText, bureauHint, provider = "IDENTITYIQ", userId, existingReportId } = params;

  if (!openai) {
    console.warn("⚠️ OpenAI not configured - using fallback parser");
    return buildFallbackReport(userId, bureauHint, existingReportId);
  }

  try {
    const reportId = existingReportId || nanoid();

    // First attempt with standard prompt
    let parsed = await parseWithRetry(rawText, bureauHint, provider, userId, reportId, false);
    
    // Check if we got zero results - if so, retry with enhanced prompt
    const tradelineCount = (parsed.tradelines || []).length;
    const collectionCount = (parsed.collections || []).length;
    
    if (tradelineCount === 0 && collectionCount === 0 && rawText.length > 1000) {
      console.warn(`⚠️ First parse returned 0 accounts but text has ${rawText.length} chars - retrying with enhanced prompt`);
      parsed = await parseWithRetry(rawText, bureauHint, provider, userId, reportId, true);
      
      const retryTradelineCount = (parsed.tradelines || []).length;
      const retryCollectionCount = (parsed.collections || []).length;
      
      if (retryTradelineCount === 0 && retryCollectionCount === 0) {
        console.error(`❌ RETRY ALSO FAILED - Still 0 accounts. OCR text may be corrupted.`);
        console.error(`   First 1000 chars of OCR text: ${rawText.substring(0, 1000)}`);
      } else {
        console.log(`✅ RETRY SUCCEEDED - Found ${retryTradelineCount} tradelines, ${retryCollectionCount} collections`);
      }
    }

    // Validate and normalize the parsed report
    const report: TriMergeCreditReport = {
      id: parsed.id || reportId,
      userId,
      meta: {
        id: parsed.meta?.id || reportId,
        provider: parsed.meta?.provider || provider,
        reportDate: parsed.meta?.reportDate || new Date().toISOString().split("T")[0],
        bureausIncluded: parsed.meta?.bureausIncluded || [
          bureauHint === "TRI" ? "EXPERIAN" : bureauHint,
        ],
      },
      tradelines: (parsed.tradelines || []).map((tl: any) => ({
        id: tl.id || nanoid(),
        creditorName: tl.creditorName || tl.accountName || tl.name || "Unknown Account",
        accountNumberLast4: tl.accountNumberLast4,
        type: validateTradelineType(tl.type) || "OTHER",
        status: validateAccountStatus(tl.status) || "UNKNOWN",
        balance: tl.balance ?? null,
        pastDue: tl.pastDue ?? null,
        dateOfFirstDelinquency: normalizeDate(tl.dateOfFirstDelinquency),
        openedDate: normalizeDate(tl.openedDate),
        closedDate: normalizeDate(tl.closedDate),
        lastPaymentDate: normalizeDate(tl.lastPaymentDate),
        creditLimit: tl.creditLimit ?? null,
        highCreditLimit: tl.highCreditLimit ?? null,
        bureaus: tl.bureaus || [],
        bureauSnapshots: (tl.bureauSnapshots || []).map((bs: any) => ({
          bureau: bs.bureau as any,
          status: validateAccountStatus(bs.status) || "UNKNOWN",
          balance: bs.balance ?? null,
          pastDue: bs.pastDue ?? null,
          lastUpdatedDate: normalizeDate(bs.lastUpdatedDate),
        })),
        remarks: tl.remarks || [],
      })),
      collections: (parsed.collections || []).map((c: any) => ({
        id: c.id || nanoid(),
        collectorName: c.collectorName || c.accountName || c.name || c.creditorName || "Unknown Collection",
        originalCreditorName: c.originalCreditorName,
        accountNumberLast4: c.accountNumberLast4,
        bureauAccountId: c.bureauAccountId || c.accountNumber || c.referenceNumber || c.accountId || null,
        status: validateCollectionStatus(c.status) || "UNKNOWN",
        balance: c.balance ?? null,
        dateOfFirstDelinquency: normalizeDate(c.dateOfFirstDelinquency),
        openedDate: normalizeDate(c.openedDate),
        lastUpdatedDate: normalizeDate(c.lastUpdatedDate),
        bureaus: c.bureaus || [],
        bureauSnapshots: (c.bureauSnapshots || []).map((bs: any) => ({
          bureau: bs.bureau as any,
          status: validateAccountStatus(bs.status) || "UNKNOWN",
          balance: bs.balance ?? null,
          pastDue: bs.pastDue ?? null,
          lastUpdatedDate: normalizeDate(bs.lastUpdatedDate),
        })),
        remarks: c.remarks || [],
      })),
      publicRecords: (parsed.publicRecords || []).map((pr: any) => ({
        id: pr.id || nanoid(),
        type: pr.type || "OTHER",
        courtName: pr.courtName,
        amount: pr.amount ?? null,
        filedDate: normalizeDate(pr.filedDate),
        status: pr.status,
        bureaus: pr.bureaus || [],
      })),
      inquiries: (parsed.inquiries || []).map((inq: any) => ({
        id: inq.id || nanoid(),
        bureau: inq.bureau as any,
        inquirerName: inq.inquirerName || "Unknown",
        date: inq.date || new Date().toISOString().split("T")[0],
        type: inq.type,
      })),
    };

    console.log(`✅ Parsed report: ${report.tradelines.length} tradelines, ${report.collections.length} collections, ${report.publicRecords.length} public records, ${report.inquiries.length} inquiries`);
    
    // Log sample tradeline info for debugging
    if (report.tradelines.length > 0) {
      const sample = report.tradelines[0];
      console.log(`   Sample tradeline: ${sample.creditorName} | Status: ${sample.status} | Balance: ${sample.balance}`);
    }
    if (report.collections.length > 0) {
      const sample = report.collections[0];
      console.log(`   Sample collection: ${sample.collectorName} | Status: ${sample.status} | Balance: ${sample.balance}`);
    }
    
    return report;
  } catch (error: any) {
    console.error("❌ AI parsing failed:", error.message);
    console.error("   Stack:", error.stack?.split('\n').slice(0, 3).join('\n'));
    return buildFallbackReport(userId, bureauHint, existingReportId);
  }
}

function buildFallbackReport(
  userId: string,
  bureauHint: BureauCode,
  existingReportId?: string
): TriMergeCreditReport {
  const reportId = existingReportId || nanoid();
  const bureaus =
    bureauHint === "TRI"
      ? ["EXPERIAN", "EQUIFAX", "TRANSUNION"]
      : [
          bureauHint === "EXPERIAN"
            ? "EXPERIAN"
            : bureauHint === "EQUIFAX"
              ? "EQUIFAX"
              : "TRANSUNION",
        ];

  return {
    id: reportId,
    userId,
    meta: {
      id: reportId,
      provider: "IDENTITYIQ",
      reportDate: new Date().toISOString().split("T")[0],
      bureausIncluded: bureaus as any,
    },
    tradelines: [],
    collections: [],
    publicRecords: [],
    inquiries: [],
  };
}

function validateTradelineType(type: any): TradelineType | null {
  if (!type) return null;
  const t = String(type).toUpperCase();
  if (["MORTGAGE", "AUTO", "CREDIT_CARD", "PERSONAL_LOAN", "HELOC", "STUDENT_LOAN", "OTHER"].includes(t))
    return t as TradelineType;
  return null;
}

function validateAccountStatus(status: any): AccountStatus | null {
  if (!status) return null;
  const s = String(status).toUpperCase();
  if (
    [
      "OPEN",
      "CLOSED",
      "CURRENT",
      "LATE_30",
      "LATE_60",
      "LATE_90",
      "LATE_120",
      "LATE_150_PLUS",
      "COLLECTION",
      "CHARGE_OFF",
      "FORECLOSURE",
      "REPOSSESSION",
      "UNKNOWN",
    ].includes(s)
  )
    return s as AccountStatus;
  return null;
}

function validateCollectionStatus(status: any): CollectionStatus | null {
  if (!status) return null;
  const s = String(status).toUpperCase();
  if (["OPEN_COLLECTION", "PAID_COLLECTION", "SETTLED", "UNKNOWN"].includes(s)) return s as CollectionStatus;
  return null;
}

function normalizeDate(dateStr: any): string | undefined {
  if (!dateStr || dateStr === "null" || dateStr === "YYYY-MM-DD or null") return undefined;
  
  const str = String(dateStr).trim();
  if (!str) return undefined;
  
  // Already ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  
  // Handle MM/DD/YYYY format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const [month, day, year] = str.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Handle Month DD, YYYY format (e.g., "January 15, 2024")
  try {
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {
    // Ignore parsing errors
  }
  
  return undefined;
}
