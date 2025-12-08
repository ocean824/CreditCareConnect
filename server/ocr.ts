import { fromBuffer } from "pdf2pic";
import Tesseract from "tesseract.js";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

async function loadPdfParse(): Promise<(buffer: Buffer) => Promise<{ text: string }>> {
  const pdfParseModule = await import("pdf-parse");
  return (pdfParseModule as any).default || pdfParseModule;
}

export async function ocrPdfOrImage(absPath: string): Promise<string> {
  const ext = path.extname(absPath).toLowerCase();
  
  // Validate that the path exists
  if (!fs.existsSync(absPath)) {
    throw new Error(`File not found: ${absPath}`);
  }
  
  const fileSize = fs.statSync(absPath).size;
  console.log(`📄 [OCR] Processing file: ${absPath} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
  
  if (ext === ".pdf") {
    const fileBuffer = fs.readFileSync(absPath);
    
    let pdfParseText = "";
    let ocrText = "";
    
    // Strategy 1: Try pdf-parse first (fast for text-based PDFs)
    try {
      console.log(`📄 [OCR] Attempting text extraction with pdf-parse...`);
      const pdfParse = await loadPdfParse();
      const pdfData = await pdfParse(fileBuffer);
      pdfParseText = pdfData.text?.trim() || "";
      
      console.log(`📄 [OCR] pdf-parse extracted ${pdfParseText.length} characters`);
      
      // Log first 500 chars for debugging
      if (pdfParseText.length > 0) {
        console.log(`📄 [OCR] pdf-parse sample: ${pdfParseText.substring(0, 500).replace(/\n/g, ' ')}`);
      }
      
      // Check if we got meaningful text (at least 500 chars for a credit report)
      if (pdfParseText.length >= 500) {
        // Verify it looks like a credit report (contains common keywords)
        const creditKeywords = ['credit', 'account', 'balance', 'payment', 'experian', 'equifax', 'transunion', 'tradeline', 'collection', 'creditor', 'status', 'date', 'opened'];
        const lowerText = pdfParseText.toLowerCase();
        const keywordMatches = creditKeywords.filter(kw => lowerText.includes(kw)).length;
        
        if (keywordMatches >= 2) {
          console.log(`✅ [OCR] pdf-parse text appears to be a credit report (${keywordMatches} keywords matched)`);
          return pdfParseText;
        } else {
          console.log(`⚠️ [OCR] pdf-parse text doesn't look like credit report (only ${keywordMatches} keywords), will try OCR...`);
        }
      } else {
        console.log(`⚠️ [OCR] pdf-parse only got ${pdfParseText.length} chars (need 500+), will try OCR...`);
      }
    } catch (pdfParseError: any) {
      console.log(`⚠️ [OCR] pdf-parse failed: ${pdfParseError.message}, will try OCR fallback...`);
    }
    
    // Strategy 2: Fall back to OCR for scanned PDFs
    try {
      console.log(`📸 [OCR] Attempting Tesseract OCR extraction (this may take a while for large files)...`);
      const convert = fromBuffer(fileBuffer, { density: 300, format: "png" }); // Increased density from 200 to 300
      const pages = await convert.bulk(-1, { responseType: 'base64' });
      
      if (!pages || pages.length === 0) {
        console.error(`❌ [OCR] No pages extracted from PDF - file may be corrupted or encrypted`);
        // Fall back to pdf-parse result if we have any
        if (pdfParseText.length > 100) {
          console.log(`⚠️ [OCR] Falling back to pdf-parse text (${pdfParseText.length} chars)`);
          return pdfParseText;
        }
        throw new Error('No pages extracted from PDF - file may be corrupted, encrypted, or password-protected');
      }
      
      console.log(`📸 [OCR] Processing ${pages.length} pages with Tesseract...`);
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        if (!p.base64) {
          console.log(`⚠️ [OCR] Page ${i + 1} has no image data, skipping...`);
          continue;
        }
        
        // Convert base64 to Buffer for Tesseract (more reliable than raw base64 string)
        const imageBuffer = Buffer.from(p.base64, 'base64');
        try {
          const res = await Tesseract.recognize(imageBuffer, "eng", {
            logger: () => {}, // Suppress verbose logging
          });
          ocrText += res.data.text + "\n";
        } catch (pageError: any) {
          console.log(`⚠️ [OCR] Failed to OCR page ${i + 1}: ${pageError.message}`);
        }
        
        // Log progress every 5 pages
        if ((i + 1) % 5 === 0 || i === pages.length - 1) {
          console.log(`📸 [OCR] Processed ${i + 1}/${pages.length} pages (${ocrText.length} chars so far)`);
        }
      }
      
      console.log(`📸 [OCR] Tesseract extracted ${ocrText.length} characters total`);
      
      if (ocrText.length > 0) {
        console.log(`📸 [OCR] OCR sample: ${ocrText.substring(0, 500).replace(/\n/g, ' ')}`);
      }
      
    } catch (ocrError: any) {
      console.error(`❌ [OCR] Tesseract OCR failed: ${ocrError.message}`);
    }
    
    // Choose the best result
    const bestText = ocrText.length > pdfParseText.length ? ocrText : pdfParseText;
    
    if (bestText.length < 100) {
      console.error(`❌ [OCR] CRITICAL: Could not extract meaningful text from PDF`);
      console.error(`   pdf-parse result: ${pdfParseText.length} chars`);
      console.error(`   OCR result: ${ocrText.length} chars`);
      throw new Error(`Could not extract text from PDF. The file may be encrypted, password-protected, or contain only images that cannot be read. Please try a different file or contact support.`);
    }
    
    console.log(`✅ [OCR] Final text: ${bestText.length} characters (pdf-parse: ${pdfParseText.length}, OCR: ${ocrText.length})`);
    return bestText.trim();
  } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'].includes(ext)) {
    // For image files, read as buffer for consistency
    const imageBuffer = fs.readFileSync(absPath);
    const res = await Tesseract.recognize(imageBuffer, "eng", {
      logger: () => {},
    });
    return res.data.text.trim();
  } else {
    // For text files, just read the content directly
    return fs.readFileSync(absPath, 'utf-8').trim();
  }
}

export async function ollamaGenerate(model: string, prompt: string): Promise<string> {
  const r = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false })
  });
  const j = await r.json() as any;
  return j.response?.trim() || "";
}
