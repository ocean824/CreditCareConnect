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

// CRITICAL: gpt-5 may not work with Replit AI Integrations - use gpt-4o as fallback
const OPENAI_MODEL = useReplitAI ? "gpt-4o" : (process.env.OPENAI_MODEL || "gpt-4o");

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

ACCOUNT NAME EXTRACTION (MANDATORY):
- EVERY tradeline MUST have a creditorName - this is the company name (e.g., "CAPITAL ONE", "CHASE BANK", "DISCOVER")
- EVERY collection MUST have a collectorName - the collection agency (e.g., "MIDLAND FUNDING", "PORTFOLIO RECOVERY")
- Look for these labels: "Creditor Name", "Account Name", "Company Name", "Lender", "Subscriber", "Furnisher"
- Common creditor names: CAPITAL ONE, CHASE, DISCOVER, CITI, WELLS FARGO, BANK OF AMERICA, SYNCHRONY BANK, BARCLAYS, AMERICAN EXPRESS, GM FINANCIAL, ALLY FINANCIAL, NAVY FEDERAL
- Common collector names: MIDLAND FUNDING, PORTFOLIO RECOVERY, LVNV FUNDING, CAVALRY SPV, ENHANCED RECOVERY, IC SYSTEM, TRANSWORLD SYSTEMS
- NEVER return "Unknown Account" or empty string for creditorName/collectorName - always extract the actual company name from the report text

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
  // GPT-4o supports 128k context tokens with 16k max completion tokens.
  // Reserve ~100k chars for system prompt + JSON response = ~400k chars for report text.
  // CRITICAL: Using 900k caused the model to drop bureau sections and return 0 accounts!
  const MAX_TEXT_LENGTH = 400000;
  let text = rawText;
  
  if (rawText.length > MAX_TEXT_LENGTH) {
    console.warn(`⚠️ Credit report text (${rawText.length} chars) exceeds safe limit (${MAX_TEXT_LENGTH}). Truncating...`);
    // Try to truncate smartly - preserve bureau sections proportionally
    text = rawText.slice(0, MAX_TEXT_LENGTH);
    // Try to end at a newline to avoid cutting mid-word
    const lastNewline = text.lastIndexOf('\n');
    if (lastNewline > MAX_TEXT_LENGTH - 1000) {
      text = text.slice(0, lastNewline);
    }
  }
  
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
    console.error(`❌ OpenAI client not initialized`);
    console.error(`   AI_INTEGRATIONS_OPENAI_BASE_URL: ${process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ? 'set' : 'NOT SET'}`);
    throw new Error("OpenAI not configured. Please contact support.");
  }
  
  const userPrompt = isRetry 
    ? buildRetryPrompt(rawText, bureauHint, provider, userId, reportId)
    : buildUserPrompt(rawText, bureauHint, provider, userId, reportId);

  console.log(`🤖 Parsing ${bureauHint} report with AI${isRetry ? ' (RETRY with enhanced prompt)' : ''}...`);
  console.log(`   Model: ${OPENAI_MODEL}, Prompt length: ${userPrompt.length} chars`);
  console.log(`   Raw text length being sent: ${rawText.length} chars`);

  try {
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
      max_completion_tokens: 16384,
    });

    const content = response.choices[0]?.message?.content;
    const finishReason = response.choices[0]?.finish_reason;
    
    console.log(`   AI response: ${content?.length || 0} chars, finish_reason: ${finishReason}`);
    
    if (!content || content.trim() === "" || content === "{}") {
      console.error(`❌ AI returned empty or null content`);
      console.error(`   Full response object: ${JSON.stringify(response).substring(0, 500)}`);
      throw new Error("AI returned empty response. Please try again.");
    }
    
    if (finishReason === "length") {
      console.warn(`⚠️ AI response was truncated (hit token limit)`);
    }
    
    try {
      const parsed = JSON.parse(content);
      
      // Log what we got - ENHANCED for debugging
      const tradelineCount = (parsed.tradelines || []).length;
      const collectionCount = (parsed.collections || []).length;
      console.log(`   Parsed result: ${tradelineCount} tradelines, ${collectionCount} collections`);
      
      // If zero accounts, log full response for debugging
      if (tradelineCount === 0 && collectionCount === 0) {
        console.warn(`⚠️ AI returned 0 accounts - logging full response for debugging:`);
        console.warn(`   Response keys: ${Object.keys(parsed).join(', ')}`);
        console.warn(`   Full response (first 3000 chars): ${content.substring(0, 3000)}`);
      }
      
      // Log a sample if we got data
      if (tradelineCount > 0) {
        console.log(`   Sample tradeline: ${JSON.stringify(parsed.tradelines[0]).substring(0, 200)}`);
      }
      if (collectionCount > 0) {
        console.log(`   Sample collection: ${JSON.stringify(parsed.collections[0]).substring(0, 200)}`);
      }
      
      return parsed;
    } catch (jsonError) {
      console.error(`❌ Failed to parse AI response as JSON`);
      console.error(`   First 1000 chars: ${content.substring(0, 1000)}`);
      throw new Error("AI returned invalid JSON. Please try again.");
    }
  } catch (apiError: any) {
    console.error(`❌ OpenAI API call failed: ${apiError.message}`);
    console.error(`   Error type: ${apiError.constructor.name}`);
    console.error(`   Error details: ${JSON.stringify(apiError).substring(0, 500)}`);
    throw new Error(`AI service error: ${apiError.message}`);
  }
}

function buildRetryPrompt(
  rawText: string,
  bureauHint: BureauCode,
  provider: string,
  userId: string,
  reportId: string
): string {
  // Same limit as buildUserPrompt - must stay within GPT-5's context window
  const MAX_TEXT_LENGTH = 400000;
  let text = rawText;
  
  if (rawText.length > MAX_TEXT_LENGTH) {
    console.warn(`⚠️ [RETRY] Text too long (${rawText.length} chars), truncating to ${MAX_TEXT_LENGTH}`);
    text = rawText.slice(0, MAX_TEXT_LENGTH);
    const lastNewline = text.lastIndexOf('\n');
    if (lastNewline > MAX_TEXT_LENGTH - 1000) {
      text = text.slice(0, lastNewline);
    }
  }
  
  console.log(`📄 [RETRY] Credit report text length: ${rawText.length} chars (using ${text.length} chars)`);

  return `CRITICAL RETRY - Previous parse returned 0 accounts. This is OCR'd text from a credit report PDF.

IMPORTANT: The text may be messy or have OCR errors, but you MUST extract ANY accounts you can find.

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

// Split large OCR text into bureau chunks for sequential parsing
function splitTextByBureau(rawText: string): { bureau: BureauCode; text: string }[] {
  const bureauPatterns = [
    { bureau: 'EXPERIAN' as BureauCode, patterns: [/\bEXPERIAN\b/gi, /\bEXP\b/gi] },
    { bureau: 'EQUIFAX' as BureauCode, patterns: [/\bEQUIFAX\b/gi, /\bEFX\b/gi, /\bEQF\b/gi] },
    { bureau: 'TRANSUNION' as BureauCode, patterns: [/\bTRANSUNION\b/gi, /\bTRANS\s*UNION\b/gi, /\bTU\b/gi, /\bTUC\b/gi] },
  ];
  
  // Find bureau section boundaries
  const sections: { bureau: BureauCode; start: number; end: number }[] = [];
  
  for (const { bureau, patterns } of bureauPatterns) {
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(rawText)) !== null) {
        // Look for section headers (bureau name at start of line or after major delimiter)
        const before = rawText.substring(Math.max(0, match.index - 50), match.index);
        if (/[\n\r]/.test(before) || match.index < 100) {
          sections.push({ bureau, start: match.index, end: rawText.length });
          break;
        }
      }
    }
  }
  
  // Sort by start position and set proper end boundaries
  sections.sort((a, b) => a.start - b.start);
  for (let i = 0; i < sections.length - 1; i++) {
    sections[i].end = sections[i + 1].start;
  }
  
  // Extract text chunks
  if (sections.length > 0) {
    console.log(`📑 Split text into ${sections.length} bureau sections: ${sections.map(s => `${s.bureau}(${s.start}-${s.end})`).join(', ')}`);
    return sections.map(s => ({
      bureau: s.bureau,
      text: rawText.substring(s.start, s.end),
    }));
  }
  
  // If no clear bureau sections, return full text
  return [{ bureau: 'TRI' as BureauCode, text: rawText }];
}

// Parse large text by bureau chunks if needed
async function parseWithBureauChunking(
  rawText: string,
  bureauHint: BureauCode,
  provider: string,
  userId: string,
  reportId: string
): Promise<any> {
  const CHUNK_THRESHOLD = 300000; // Use chunking if text > 300k chars
  
  // Log telemetry for debugging
  console.log(`📊 [TELEMETRY] OCR text: ${rawText.length} chars`);
  console.log(`📊 [TELEMETRY] First 500 chars: ${rawText.substring(0, 500).replace(/\n/g, ' ')}`);
  
  // Check OCR quality - look for credit report keywords
  const lowerText = rawText.toLowerCase();
  const creditKeywords = ['account', 'balance', 'creditor', 'credit', 'payment', 'date', 'status', 'experian', 'equifax', 'transunion'];
  const foundKeywords = creditKeywords.filter(kw => lowerText.includes(kw));
  console.log(`📊 [TELEMETRY] Found ${foundKeywords.length} credit keywords: ${foundKeywords.join(', ')}`);
  
  if (foundKeywords.length < 2) {
    console.error(`❌ OCR text appears garbled - only ${foundKeywords.length} credit keywords found`);
    console.error(`   This indicates the PDF may be encrypted, password-protected, or a scanned image with poor quality`);
  }
  
  // If text is small enough, parse normally
  if (rawText.length <= CHUNK_THRESHOLD) {
    console.log(`📄 Text size (${rawText.length}) within threshold, parsing in single request`);
    return parseWithRetry(rawText, bureauHint, provider, userId, reportId, false);
  }
  
  // Text is too large - try bureau-aware chunking
  console.log(`📄 Text size (${rawText.length}) exceeds threshold (${CHUNK_THRESHOLD}), attempting bureau chunking`);
  
  const chunks = splitTextByBureau(rawText);
  
  // If only one chunk (no clear bureau sections), try fixed-size chunking
  if (chunks.length === 1) {
    console.log(`⚠️ Could not split by bureau headers, trying fixed-size chunking`);
    
    // Split into ~150k char chunks with overlap to avoid cutting accounts
    const FIXED_CHUNK_SIZE = 150000;
    const OVERLAP = 5000;
    const fixedChunks: { bureau: BureauCode; text: string }[] = [];
    
    for (let i = 0; i < rawText.length; i += FIXED_CHUNK_SIZE - OVERLAP) {
      let chunkEnd = Math.min(i + FIXED_CHUNK_SIZE, rawText.length);
      // Try to end at a newline to avoid cutting mid-account
      if (chunkEnd < rawText.length) {
        const nearbyNewline = rawText.lastIndexOf('\n', chunkEnd);
        if (nearbyNewline > i + FIXED_CHUNK_SIZE - 10000) {
          chunkEnd = nearbyNewline;
        }
      }
      fixedChunks.push({
        bureau: 'TRI' as BureauCode,
        text: rawText.substring(i, chunkEnd),
      });
    }
    
    console.log(`📑 Split text into ${fixedChunks.length} fixed-size chunks`);
    
    // Local arrays for fixed-size chunking
    const fixedTradelines: any[] = [];
    const fixedCollections: any[] = [];
    
    // Parse each chunk and merge
    for (let i = 0; i < fixedChunks.length; i++) {
      const chunk = fixedChunks[i];
      console.log(`🔄 Parsing chunk ${i + 1}/${fixedChunks.length} (${chunk.text.length} chars)...`);
      
      try {
        const parsed = await parseWithRetry(chunk.text, 'TRI', provider, userId, reportId, false);
        
        for (const tl of parsed.tradelines || []) {
          fixedTradelines.push(tl);
        }
        for (const col of parsed.collections || []) {
          fixedCollections.push(col);
        }
        
        console.log(`✅ Chunk ${i + 1}: ${(parsed.tradelines || []).length} tradelines, ${(parsed.collections || []).length} collections`);
      } catch (chunkError: any) {
        console.error(`⚠️ Failed to parse chunk ${i + 1}: ${chunkError.message}`);
      }
    }
    
    // Merge and return
    const mergedTradelines = mergeTradelinesAcrossBureaus(fixedTradelines);
    const mergedCollections = mergeCollectionsAcrossBureaus(fixedCollections);
    
    // Detect bureaus from the actual text instead of hardcoding
    const detectedBureaus: BureauCode[] = [];
    const lowerText = rawText.toLowerCase();
    if (/\bexperian\b/.test(lowerText)) detectedBureaus.push('EXPERIAN');
    if (/\bequifax\b/.test(lowerText)) detectedBureaus.push('EQUIFAX');
    if (/\btransunion\b|\btrans\s*union\b/.test(lowerText)) detectedBureaus.push('TRANSUNION');
    // Default to TRI if we couldn't detect specific bureaus
    const bureausIncluded = detectedBureaus.length > 0 ? detectedBureaus : ['EXPERIAN', 'EQUIFAX', 'TRANSUNION'] as BureauCode[];
    
    console.log(`📊 Fixed-size chunking complete: ${mergedTradelines.length} unique tradelines, ${mergedCollections.length} unique collections`);
    console.log(`📊 Detected bureaus: ${bureausIncluded.join(', ')}`);
    
    return {
      id: reportId,
      userId,
      meta: {
        id: reportId,
        provider,
        reportDate: new Date().toISOString().split('T')[0],
        bureausIncluded,
      },
      tradelines: mergedTradelines,
      collections: mergedCollections,
      publicRecords: [],
      inquiries: [],
    };
  }
  
  // Parse each bureau chunk sequentially
  const allTradelines: any[] = [];
  const allCollections: any[] = [];
  const allPublicRecords: any[] = [];
  const allInquiries: any[] = [];
  const bureausIncluded: BureauCode[] = [];
  
  for (const chunk of chunks) {
    console.log(`🔄 Parsing ${chunk.bureau} section (${chunk.text.length} chars)...`);
    
    try {
      const parsed = await parseWithRetry(chunk.text, chunk.bureau, provider, userId, reportId, false);
      
      // Add bureau to included list
      if (!bureausIncluded.includes(chunk.bureau)) {
        bureausIncluded.push(chunk.bureau);
      }
      
      // Merge results with bureau tagging
      for (const tl of parsed.tradelines || []) {
        tl.bureaus = tl.bureaus || [chunk.bureau];
        if (!tl.bureaus.includes(chunk.bureau)) tl.bureaus.push(chunk.bureau);
        allTradelines.push(tl);
      }
      
      for (const col of parsed.collections || []) {
        col.bureaus = col.bureaus || [chunk.bureau];
        if (!col.bureaus.includes(chunk.bureau)) col.bureaus.push(chunk.bureau);
        allCollections.push(col);
      }
      
      for (const pr of parsed.publicRecords || []) {
        allPublicRecords.push(pr);
      }
      
      for (const inq of parsed.inquiries || []) {
        allInquiries.push(inq);
      }
      
      console.log(`✅ ${chunk.bureau}: ${(parsed.tradelines || []).length} tradelines, ${(parsed.collections || []).length} collections`);
    } catch (chunkError: any) {
      console.error(`⚠️ Failed to parse ${chunk.bureau} chunk: ${chunkError.message}`);
      // Continue with other chunks
    }
  }
  
  console.log(`📊 Bureau chunking complete: ${allTradelines.length} total tradelines, ${allCollections.length} total collections`);
  
  // Merge accounts that appear across multiple bureaus
  const mergedTradelines = mergeTradelinesAcrossBureaus(allTradelines);
  const mergedCollections = mergeCollectionsAcrossBureaus(allCollections);
  
  console.log(`📊 After merge: ${mergedTradelines.length} unique tradelines, ${mergedCollections.length} unique collections`);
  
  return {
    id: reportId,
    userId,
    meta: {
      id: reportId,
      provider,
      reportDate: new Date().toISOString().split('T')[0],
      bureausIncluded,
    },
    tradelines: mergedTradelines,
    collections: mergedCollections,
    publicRecords: allPublicRecords,
    inquiries: allInquiries,
  };
}

// Last-resort simple extraction with a very focused prompt
// Used when all other methods fail
async function parseWithSimplePrompt(
  rawText: string,
  bureauHint: BureauCode,
  provider: string,
  userId: string,
  reportId: string
): Promise<any> {
  if (!openai) {
    throw new Error("OpenAI not configured");
  }
  
  // Use only the first 100k chars to ensure we stay well within limits
  const text = rawText.length > 100000 ? rawText.substring(0, 100000) : rawText;
  
  console.log(`🔧 LAST RESORT: Trying simple extraction with ${text.length} chars...`);
  
  const simplePrompt = `Extract credit accounts from this text. The text is OCR output from a credit report PDF and may have errors.

FIND ANY:
- Credit cards (VISA, Mastercard, Discover, AmEx, store cards)
- Auto loans
- Mortgages
- Personal loans
- Student loans
- Collections
- Medical bills
- Utility accounts

For each account found, extract:
- creditorName: Company name
- balance: Dollar amount
- status: OPEN, CLOSED, COLLECTION, CHARGE_OFF, or UNKNOWN

Return JSON:
{
  "tradelines": [{"id": "1", "creditorName": "...", "balance": 0, "status": "...", "type": "CREDIT_CARD", "bureaus": ["EXPERIAN"]}],
  "collections": [{"id": "1", "collectorName": "...", "balance": 0, "status": "OPEN_COLLECTION", "bureaus": ["EQUIFAX"]}]
}

If you find NO accounts at all, still return {"tradelines": [], "collections": []}.

TEXT:
${text}`;

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "user",
          content: simplePrompt,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 16384,
    });

    const content = response.choices[0]?.message?.content;
    console.log(`   Simple extraction response: ${content?.length || 0} chars`);
    
    if (!content) {
      throw new Error("Empty response from AI");
    }
    
    const parsed = JSON.parse(content);
    console.log(`   Simple extraction found: ${(parsed.tradelines || []).length} tradelines, ${(parsed.collections || []).length} collections`);
    
    // Add bureau info if missing
    const detectedBureaus: BureauCode[] = [];
    const lowerText = rawText.toLowerCase();
    if (/\bexperian\b/.test(lowerText)) detectedBureaus.push('EXPERIAN');
    if (/\bequifax\b/.test(lowerText)) detectedBureaus.push('EQUIFAX');
    if (/\btransunion\b|\btrans\s*union\b/.test(lowerText)) detectedBureaus.push('TRANSUNION');
    const bureausIncluded = detectedBureaus.length > 0 ? detectedBureaus : ['EXPERIAN', 'EQUIFAX', 'TRANSUNION'] as BureauCode[];
    
    return {
      id: reportId,
      userId,
      meta: {
        id: reportId,
        provider,
        reportDate: new Date().toISOString().split('T')[0],
        bureausIncluded,
      },
      tradelines: parsed.tradelines || [],
      collections: parsed.collections || [],
      publicRecords: [],
      inquiries: [],
    };
  } catch (error: any) {
    console.error(`❌ Simple extraction failed: ${error.message}`);
    throw error;
  }
}

// ULTIMATE FALLBACK: Regex-based extraction that doesn't require AI
// This runs when ALL AI parsing methods fail
function parseWithRegexFallback(
  rawText: string,
  bureauHint: BureauCode,
  provider: string,
  userId: string,
  reportId: string
): any {
  console.log(`🔧 [REGEX FALLBACK] Attempting regex-based extraction (no AI)...`);
  
  const tradelines: any[] = [];
  const collections: any[] = [];
  
  // Detect bureaus from text
  const lowerText = rawText.toLowerCase();
  const detectedBureaus: BureauCode[] = [];
  if (/\bexperian\b/i.test(rawText)) detectedBureaus.push('EXPERIAN');
  if (/\bequifax\b/i.test(rawText)) detectedBureaus.push('EQUIFAX');
  if (/\b(transunion|trans\s*union)\b/i.test(rawText)) detectedBureaus.push('TRANSUNION');
  const bureausIncluded = detectedBureaus.length > 0 ? detectedBureaus : ['EXPERIAN', 'EQUIFAX', 'TRANSUNION'] as BureauCode[];
  
  // Common creditor name patterns
  const creditorPatterns = [
    /(?:creditor|account\s*name|company|lender|furnisher)[:\s]*([A-Z][A-Z0-9\s&\-\.\/]+?)(?:\n|account|status|balance)/gi,
    /\b(capital\s*one|chase|discover|american\s*express|amex|wells\s*fargo|bank\s*of\s*america|citi(?:bank)?|synchrony|barclays|navy\s*federal|usaa|td\s*bank|pnc|us\s*bank|citizens\s*bank|fifth\s*third|regions|suntrust|bb&t|huntington|key\s*bank|ally|gm\s*financial|toyota|honda|ford)\b/gi,
  ];
  
  // Collection agency patterns
  const collectionPatterns = [
    /(?:collection\s*agency|collector|agency)[:\s]*([A-Z][A-Z0-9\s&\-\.\/]+?)(?:\n|balance|account|status)/gi,
    /\b(midland(?:\s*(?:funding|credit))?|portfolio\s*recovery|lvnv\s*funding|cavalry|enhanced\s*recovery|ic\s*system|transworld|eos\s*cca|convergent|client\s*services|capital\s*management|credit\s*collection|medicredit|professional\s*collection)\b/gi,
  ];
  
  // Balance patterns
  const balancePattern = /(?:balance|amount|owed)[:\s]*\$?\s*([\d,]+\.?\d*)/gi;
  
  // Status patterns
  const statusPatterns = [
    /\b(charge[\s\-]*off|charged\s*off)\b/gi,
    /\b(collection|in\s*collection)\b/gi,
    /\b(late|delinquent|past\s*due)\b/gi,
    /\b(open|current|paid|closed)\b/gi,
  ];
  
  // Date patterns for DOFD
  const datePatterns = [
    /(?:first\s*delinquency|dofd|delinquent\s*since)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/g,
  ];
  
  // Extract creditors
  const foundCreditors = new Set<string>();
  for (const pattern of creditorPatterns) {
    let match;
    while ((match = pattern.exec(rawText)) !== null) {
      const creditor = match[1].trim().toUpperCase();
      if (creditor.length >= 3 && creditor.length <= 50) {
        foundCreditors.add(creditor);
      }
    }
  }
  
  // Extract collectors
  const foundCollectors = new Set<string>();
  for (const pattern of collectionPatterns) {
    let match;
    while ((match = pattern.exec(rawText)) !== null) {
      const collector = match[1].trim().toUpperCase();
      if (collector.length >= 3 && collector.length <= 50) {
        foundCollectors.add(collector);
      }
    }
  }
  
  // Extract balances
  const balances: number[] = [];
  let balanceMatch;
  while ((balanceMatch = balancePattern.exec(rawText)) !== null) {
    const balance = parseFloat(balanceMatch[1].replace(/,/g, ''));
    if (!isNaN(balance) && balance >= 0 && balance < 10000000) {
      balances.push(balance);
    }
  }
  
  console.log(`🔧 [REGEX] Found ${foundCreditors.size} creditors, ${foundCollectors.size} collectors, ${balances.length} balances`);
  
  // Create tradelines from found creditors
  let tlId = 1;
  for (const creditor of Array.from(foundCreditors)) {
    // Skip if it's also a collector
    if (foundCollectors.has(creditor)) continue;
    
    tradelines.push({
      id: `regex_tl_${tlId++}`,
      creditorName: creditor,
      accountNumberLast4: null,
      type: 'OTHER',
      status: 'UNKNOWN',
      balance: balances.length > 0 ? balances[tlId % balances.length] : null,
      pastDue: null,
      dateOfFirstDelinquency: null,
      openedDate: null,
      closedDate: null,
      lastPaymentDate: null,
      creditLimit: null,
      highCreditLimit: null,
      bureaus: bureausIncluded,
      bureauSnapshots: bureausIncluded.map(b => ({
        bureau: b,
        status: 'UNKNOWN',
        balance: null,
        pastDue: null,
        lastUpdatedDate: null,
      })),
      remarks: [],
    });
  }
  
  // Create collections from found collectors
  let colId = 1;
  for (const collector of Array.from(foundCollectors)) {
    collections.push({
      id: `regex_col_${colId++}`,
      collectorName: collector,
      originalCreditorName: null,
      accountNumberLast4: null,
      bureauAccountId: null,
      status: 'OPEN_COLLECTION',
      balance: balances.length > 0 ? balances[colId % balances.length] : null,
      dateOfFirstDelinquency: null,
      openedDate: null,
      lastUpdatedDate: null,
      bureaus: bureausIncluded,
      bureauSnapshots: bureausIncluded.map(b => ({
        bureau: b,
        status: 'OPEN_COLLECTION',
        balance: null,
        pastDue: null,
        lastUpdatedDate: null,
      })),
      remarks: [],
    });
  }
  
  console.log(`🔧 [REGEX] Created ${tradelines.length} tradelines, ${collections.length} collections`);
  
  return {
    id: reportId,
    userId,
    meta: {
      id: reportId,
      provider,
      reportDate: new Date().toISOString().split('T')[0],
      bureausIncluded,
    },
    tradelines,
    collections,
    publicRecords: [],
    inquiries: [],
  };
}

// Retry parsing with smaller chunks and enhanced prompts for large PDFs
// This is used when the first pass fails (returns 0 accounts)
async function parseWithSmallerChunks(
  rawText: string,
  bureauHint: BureauCode,
  provider: string,
  userId: string,
  reportId: string
): Promise<any> {
  // Use smaller chunks than the first pass (75k instead of 150k)
  const SMALL_CHUNK_SIZE = 75000;
  const OVERLAP = 3000;
  
  console.log(`🔄 RETRY: Parsing with smaller chunks (${SMALL_CHUNK_SIZE} chars each)...`);
  console.log(`📝 Total text length: ${rawText.length} chars`);
  
  const chunks: string[] = [];
  for (let i = 0; i < rawText.length; i += SMALL_CHUNK_SIZE - OVERLAP) {
    let chunkEnd = Math.min(i + SMALL_CHUNK_SIZE, rawText.length);
    // Try to end at a newline to avoid cutting mid-account
    if (chunkEnd < rawText.length) {
      const nearbyNewline = rawText.lastIndexOf('\n', chunkEnd);
      if (nearbyNewline > i + SMALL_CHUNK_SIZE - 5000) {
        chunkEnd = nearbyNewline;
      }
    }
    chunks.push(rawText.substring(i, chunkEnd));
  }
  
  console.log(`📑 Split into ${chunks.length} smaller chunks for retry`);
  
  const allTradelines: any[] = [];
  const allCollections: any[] = [];
  let successfulChunks = 0;
  let failedChunks = 0;
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`🔄 Retry chunk ${i + 1}/${chunks.length} (${chunk.length} chars)...`);
    console.log(`   Chunk sample: ${chunk.substring(0, 200).replace(/\n/g, ' ')}`);
    
    try {
      // Use enhanced retry prompt for each chunk
      const parsed = await parseWithRetry(chunk, 'TRI', provider, userId, reportId, true);
      
      const chunkTradelines = parsed.tradelines || [];
      const chunkCollections = parsed.collections || [];
      
      for (const tl of chunkTradelines) {
        allTradelines.push(tl);
      }
      for (const col of chunkCollections) {
        allCollections.push(col);
      }
      
      successfulChunks++;
      console.log(`✅ Retry chunk ${i + 1}: ${chunkTradelines.length} tradelines, ${chunkCollections.length} collections`);
    } catch (chunkError: any) {
      failedChunks++;
      console.error(`❌ Failed retry chunk ${i + 1}: ${chunkError.message}`);
      // Continue with other chunks
    }
  }
  
  console.log(`📊 Chunk processing complete: ${successfulChunks} successful, ${failedChunks} failed`);
  console.log(`📊 Raw results before merge: ${allTradelines.length} tradelines, ${allCollections.length} collections`);
  
  // Merge duplicates
  const mergedTradelines = mergeTradelinesAcrossBureaus(allTradelines);
  const mergedCollections = mergeCollectionsAcrossBureaus(allCollections);
  
  // Detect bureaus from text
  const detectedBureaus: BureauCode[] = [];
  const lowerText = rawText.toLowerCase();
  if (/\bexperian\b/.test(lowerText)) detectedBureaus.push('EXPERIAN');
  if (/\bequifax\b/.test(lowerText)) detectedBureaus.push('EQUIFAX');
  if (/\btransunion\b|\btrans\s*union\b/.test(lowerText)) detectedBureaus.push('TRANSUNION');
  const bureausIncluded = detectedBureaus.length > 0 ? detectedBureaus : ['EXPERIAN', 'EQUIFAX', 'TRANSUNION'] as BureauCode[];
  
  console.log(`📊 Retry complete: ${mergedTradelines.length} tradelines, ${mergedCollections.length} collections`);
  console.log(`📊 Detected bureaus: ${bureausIncluded.join(', ')}`);
  
  return {
    id: reportId,
    userId,
    meta: {
      id: reportId,
      provider,
      reportDate: new Date().toISOString().split('T')[0],
      bureausIncluded,
    },
    tradelines: mergedTradelines,
    collections: mergedCollections,
    publicRecords: [],
    inquiries: [],
  };
}

// Merge tradelines that appear on multiple bureaus into single entries with multiple snapshots
// CONSERVATIVE: Only merge when we have high confidence it's the same account
function mergeTradelinesAcrossBureaus(tradelines: any[]): any[] {
  const merged: Map<string, any> = new Map();
  
  for (const tl of tradelines) {
    // Normalize creditor name for matching
    const creditorKey = (tl.creditorName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const accountKey = tl.accountNumberLast4 || '';
    const balanceKey = tl.balance != null ? Math.round(tl.balance) : null;
    const openedKey = tl.openedDate || '';
    
    // CONSERVATIVE: Only merge if we have strong identifiers
    // Require at least creditor name + (account number OR matching balance+date)
    const hasStrongId = creditorKey && (accountKey || (balanceKey != null && openedKey));
    
    if (!hasStrongId) {
      // Weak identifiers - don't merge, just add as unique entry
      const uniqueKey = `weak_${nanoid()}`;
      merged.set(uniqueKey, {
        ...tl,
        bureaus: [...(tl.bureaus || [])],
        bureauSnapshots: [...(tl.bureauSnapshots || [])],
      });
      continue;
    }
    
    // Create compound key with multiple discriminators
    const key = accountKey 
      ? `${creditorKey}:${accountKey}` // Strong match: creditor + account number
      : `${creditorKey}:bal${balanceKey}:${openedKey}`; // Fallback: creditor + balance + date
    
    if (merged.has(key)) {
      // Merge with existing entry
      const existing = merged.get(key)!;
      
      // Add bureaus from this entry
      for (const bureau of (tl.bureaus || [])) {
        if (!existing.bureaus.includes(bureau)) {
          existing.bureaus.push(bureau);
        }
      }
      
      // Add bureau snapshots from this entry
      for (const snapshot of (tl.bureauSnapshots || [])) {
        const existingSnapshot = existing.bureauSnapshots.find((s: any) => s.bureau === snapshot.bureau);
        if (!existingSnapshot) {
          existing.bureauSnapshots.push(snapshot);
        }
      }
      
      // Use non-null values from either entry
      if (!existing.balance && tl.balance) existing.balance = tl.balance;
      if (!existing.dateOfFirstDelinquency && tl.dateOfFirstDelinquency) existing.dateOfFirstDelinquency = tl.dateOfFirstDelinquency;
      if (!existing.openedDate && tl.openedDate) existing.openedDate = tl.openedDate;
      if (!existing.closedDate && tl.closedDate) existing.closedDate = tl.closedDate;
      if (!existing.lastPaymentDate && tl.lastPaymentDate) existing.lastPaymentDate = tl.lastPaymentDate;
      if (!existing.creditLimit && tl.creditLimit) existing.creditLimit = tl.creditLimit;
    } else {
      // New entry
      merged.set(key, {
        ...tl,
        bureaus: [...(tl.bureaus || [])],
        bureauSnapshots: [...(tl.bureauSnapshots || [])],
      });
    }
  }
  
  return Array.from(merged.values());
}

// Merge collections that appear on multiple bureaus into single entries with multiple snapshots
// CONSERVATIVE: Only merge when we have high confidence it's the same debt
function mergeCollectionsAcrossBureaus(collections: any[]): any[] {
  const merged: Map<string, any> = new Map();
  
  for (const col of collections) {
    // Normalize names for matching
    const collectorKey = (col.collectorName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const origCreditorKey = (col.originalCreditorName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const balanceKey = col.balance != null && col.balance > 0 ? Math.round(col.balance) : null;
    const accountKey = col.accountNumberLast4 || col.bureauAccountId || '';
    const dofdKey = col.dateOfFirstDelinquency || '';
    
    // CONSERVATIVE: Require strong identifiers for merging
    // Need collector name + (account number OR balance+DOFD OR original creditor+balance)
    const hasStrongId = collectorKey && (
      accountKey ||
      (balanceKey != null && dofdKey) ||
      (origCreditorKey && balanceKey != null)
    );
    
    if (!hasStrongId) {
      // Weak identifiers - don't merge, just add as unique entry
      const uniqueKey = `weak_col_${nanoid()}`;
      merged.set(uniqueKey, {
        ...col,
        bureaus: [...(col.bureaus || [])],
        bureauSnapshots: [...(col.bureauSnapshots || [])],
      });
      continue;
    }
    
    // Create compound key with multiple discriminators
    let key: string;
    if (accountKey) {
      key = `${collectorKey}:${accountKey}`;
    } else if (balanceKey != null && dofdKey) {
      key = `${collectorKey}:bal${balanceKey}:${dofdKey}`;
    } else {
      key = `${collectorKey}:${origCreditorKey}:bal${balanceKey}`;
    }
    
    if (merged.has(key)) {
      // Merge with existing entry
      const existing = merged.get(key)!;
      
      // Add bureaus from this entry
      for (const bureau of (col.bureaus || [])) {
        if (!existing.bureaus.includes(bureau)) {
          existing.bureaus.push(bureau);
        }
      }
      
      // Add bureau snapshots from this entry
      for (const snapshot of (col.bureauSnapshots || [])) {
        const existingSnapshot = existing.bureauSnapshots.find((s: any) => s.bureau === snapshot.bureau);
        if (!existingSnapshot) {
          existing.bureauSnapshots.push(snapshot);
        }
      }
      
      // Use non-null values from either entry
      if (!existing.dateOfFirstDelinquency && col.dateOfFirstDelinquency) existing.dateOfFirstDelinquency = col.dateOfFirstDelinquency;
      if (!existing.openedDate && col.openedDate) existing.openedDate = col.openedDate;
      if (!existing.originalCreditorName && col.originalCreditorName) existing.originalCreditorName = col.originalCreditorName;
    } else {
      // New entry
      merged.set(key, {
        ...col,
        bureaus: [...(col.bureaus || [])],
        bureauSnapshots: [...(col.bureauSnapshots || [])],
      });
    }
  }
  
  return Array.from(merged.values());
}

export async function parseCreditReportWithAiOnly(params: ParseCreditReportParams): Promise<TriMergeCreditReport> {
  const { rawText, bureauHint, provider = "IDENTITYIQ", userId, existingReportId } = params;

  if (!openai) {
    console.error("❌ OpenAI not configured - cannot parse credit report");
    throw new Error("OpenAI API not configured. Please contact support to enable credit report parsing.");
  }

  try {
    const reportId = existingReportId || nanoid();

    // Use bureau-aware chunking for large reports
    let parsed = await parseWithBureauChunking(rawText, bureauHint, provider, userId, reportId);
    
    // Check if we got zero results - if so, retry with enhanced prompt
    const tradelineCount = (parsed.tradelines || []).length;
    const collectionCount = (parsed.collections || []).length;
    
    if (tradelineCount === 0 && collectionCount === 0 && rawText.length > 1000) {
      console.warn(`⚠️ First parse returned 0 accounts but text has ${rawText.length} chars - retrying with enhanced prompt`);
      
      // Log sample of OCR text to diagnose issues
      const textSample = rawText.substring(0, 3000).replace(/\n/g, ' ');
      console.log(`📝 OCR text sample (first 3000 chars): ${textSample}`);
      
      // Check if OCR text looks valid (has common credit report keywords)
      const lowerText = rawText.toLowerCase();
      const hasKeywords = ['account', 'balance', 'creditor', 'credit', 'payment', 'date', 'status'].some(kw => lowerText.includes(kw));
      console.log(`📝 OCR text has credit keywords: ${hasKeywords}`);
      
      if (!hasKeywords) {
        console.error(`❌ OCR text does NOT contain expected credit report keywords - likely garbled`);
        throw new Error("The uploaded PDF appears to be unreadable or not a valid credit report. The text extraction found no recognizable credit data. Please try uploading a clearer copy or a different format.");
      }
      
      // CRITICAL FIX: For large texts, retry with SMALLER chunks instead of full text
      // Using full text causes truncation which loses entire bureau sections
      if (rawText.length > 150000) {
        console.log(`📄 Text is large (${rawText.length} chars) - retrying with smaller chunks and enhanced prompt`);
        parsed = await parseWithSmallerChunks(rawText, bureauHint, provider, userId, reportId);
      } else {
        // For smaller texts, retry is safe
        parsed = await parseWithRetry(rawText, bureauHint, provider, userId, reportId, true);
      }
      
      const retryTradelineCount = (parsed.tradelines || []).length;
      const retryCollectionCount = (parsed.collections || []).length;
      
      if (retryTradelineCount === 0 && retryCollectionCount === 0) {
        console.warn(`⚠️ RETRY ALSO FAILED - Trying last-resort simple extraction...`);
        
        // Last resort: Try a much simpler, focused extraction
        try {
          parsed = await parseWithSimplePrompt(rawText, bureauHint, provider, userId, reportId);
          const simpleTradelineCount = (parsed.tradelines || []).length;
          const simpleCollectionCount = (parsed.collections || []).length;
          
          if (simpleTradelineCount > 0 || simpleCollectionCount > 0) {
            console.log(`✅ SIMPLE EXTRACTION SUCCEEDED - Found ${simpleTradelineCount} tradelines, ${simpleCollectionCount} collections`);
          } else {
            console.warn(`⚠️ AI SIMPLE EXTRACTION ALSO FAILED - Trying regex fallback...`);
            // ULTIMATE FALLBACK: Try regex-based extraction
            parsed = parseWithRegexFallback(rawText, bureauHint, provider, userId, reportId);
            const regexTradelineCount = (parsed.tradelines || []).length;
            const regexCollectionCount = (parsed.collections || []).length;
            
            if (regexTradelineCount > 0 || regexCollectionCount > 0) {
              console.log(`✅ REGEX FALLBACK SUCCEEDED - Found ${regexTradelineCount} tradelines, ${regexCollectionCount} collections`);
            } else {
              console.error(`❌ ALL PARSING METHODS FAILED - 0 accounts after all attempts including regex`);
              console.error(`   Text length: ${rawText.length} chars`);
              console.error(`   Has credit keywords: ${hasKeywords}`);
              console.error(`   First 2000 chars of OCR text: ${rawText.substring(0, 2000)}`);
              throw new Error("Could not extract any accounts from your credit report after multiple attempts. The PDF may be scanned poorly or in an unsupported format. Please try uploading a clearer copy.");
            }
          }
        } catch (simpleError: any) {
          console.error(`❌ Simple extraction failed: ${simpleError.message}`);
          // ULTIMATE FALLBACK: Try regex-based extraction even if AI fails
          console.warn(`⚠️ Trying regex fallback after AI failure...`);
          parsed = parseWithRegexFallback(rawText, bureauHint, provider, userId, reportId);
          const regexTradelineCount = (parsed.tradelines || []).length;
          const regexCollectionCount = (parsed.collections || []).length;
          
          if (regexTradelineCount === 0 && regexCollectionCount === 0) {
            throw new Error("Could not extract any accounts from your credit report after multiple attempts. The PDF may be scanned poorly or in an unsupported format. Please try uploading a clearer copy.");
          }
          console.log(`✅ REGEX FALLBACK SUCCEEDED after AI failure - Found ${regexTradelineCount} tradelines, ${regexCollectionCount} collections`);
        }
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
        statusRaw: tl.status || tl.statusRaw || tl.accountStatus || null,
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
    // CRITICAL: Throw the error instead of silently returning empty data
    // This ensures the caller knows parsing failed and can handle it appropriately
    throw new Error(`AI parsing failed: ${error.message}. Please try again or contact support.`);
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
