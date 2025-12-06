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
  
  if (ext === ".pdf") {
    const fileBuffer = fs.readFileSync(absPath);
    
    // Strategy 1: Try pdf-parse first (fast for text-based PDFs)
    try {
      console.log(`📄 [OCR] Attempting text extraction with pdf-parse...`);
      const pdfParse = await loadPdfParse();
      const pdfData = await pdfParse(fileBuffer);
      const pdfText = pdfData.text?.trim() || "";
      
      // Check if we got meaningful text (at least 500 chars for a credit report)
      if (pdfText.length >= 500) {
        console.log(`✅ [OCR] pdf-parse extracted ${pdfText.length} characters`);
        
        // Verify it looks like a credit report (contains common keywords)
        const creditKeywords = ['credit', 'account', 'balance', 'payment', 'experian', 'equifax', 'transunion', 'tradeline', 'collection'];
        const lowerText = pdfText.toLowerCase();
        const keywordMatches = creditKeywords.filter(kw => lowerText.includes(kw)).length;
        
        if (keywordMatches >= 2) {
          console.log(`✅ [OCR] Text appears to be a credit report (${keywordMatches} keywords matched)`);
          return pdfText;
        } else {
          console.log(`⚠️ [OCR] pdf-parse text doesn't look like credit report, trying OCR fallback`);
        }
      } else {
        console.log(`⚠️ [OCR] pdf-parse only got ${pdfText.length} chars, trying OCR fallback`);
      }
    } catch (pdfParseError: any) {
      console.log(`⚠️ [OCR] pdf-parse failed: ${pdfParseError.message}, trying OCR fallback`);
    }
    
    // Strategy 2: Fall back to OCR for scanned PDFs
    console.log(`📸 [OCR] Attempting Tesseract OCR extraction...`);
    const convert = fromBuffer(fileBuffer, { density: 200, format: "png" });
    const pages = await convert.bulk(-1, { responseType: 'base64' });
    
    if (!pages || pages.length === 0) {
      throw new Error('No pages extracted from PDF');
    }
    
    console.log(`📸 [OCR] Processing ${pages.length} pages with Tesseract...`);
    let text = "";
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (!p.base64) continue;
      
      // Convert base64 to Buffer for Tesseract (more reliable than raw base64 string)
      const imageBuffer = Buffer.from(p.base64, 'base64');
      const res = await Tesseract.recognize(imageBuffer, "eng", {
        logger: () => {}, // Suppress verbose logging
      });
      text += res.data.text + "\n";
      
      // Log progress every 5 pages
      if ((i + 1) % 5 === 0 || i === pages.length - 1) {
        console.log(`📸 [OCR] Processed ${i + 1}/${pages.length} pages (${text.length} chars so far)`);
      }
    }
    
    console.log(`✅ [OCR] Tesseract extracted ${text.length} characters total`);
    return text.trim();
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
