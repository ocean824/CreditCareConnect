import fs from 'fs';
import path from 'path';
import * as pdfParseModule from 'pdf-parse';
import Tesseract from 'tesseract.js';
import { fromBuffer } from 'pdf2pic';

const pdfParse = (pdfParseModule as any).default || pdfParseModule;

export interface ExtractionResult {
  text: string;
  method: 'pdf-parse' | 'ocr' | 'ocr-pdf2pic';
  confidence: number;
  pageCount?: number;
}

const MIN_TEXT_LENGTH_THRESHOLD = 200;
const MIN_CONFIDENCE_THRESHOLD = 0.5;

export async function extractReportText(filePath: string): Promise<ExtractionResult> {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.pdf') {
    return extractFromPdf(filePath);
  } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'].includes(ext)) {
    return extractFromImage(filePath);
  } else {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return {
      text: content,
      method: 'pdf-parse',
      confidence: 1.0,
    };
  }
}

async function extractFromPdf(filePath: string): Promise<ExtractionResult> {
  const dataBuffer = await fs.promises.readFile(filePath);
  
  try {
    const parsed = await pdfParse(dataBuffer);
    const text = parsed.text.trim();
    
    if (text && text.length >= MIN_TEXT_LENGTH_THRESHOLD) {
      const wordsCount = text.split(/\s+/).length;
      const confidence = Math.min(1.0, wordsCount / 500);
      
      return {
        text,
        method: 'pdf-parse',
        confidence,
        pageCount: parsed.numpages,
      };
    }
    
    console.log('[extraction] pdf-parse found insufficient text, falling back to OCR');
    return await extractFromPdfWithOcr(filePath, dataBuffer);
  } catch (error) {
    console.warn('[extraction] pdf-parse failed, falling back to OCR:', error);
    return await extractFromPdfWithOcr(filePath, dataBuffer);
  }
}

async function extractFromPdfWithOcr(filePath: string, dataBuffer: Buffer): Promise<ExtractionResult> {
  try {
    console.log(`📸 [OCR] Starting Tesseract OCR extraction...`);
    const convert = fromBuffer(dataBuffer, {
      density: 300, // Increased from 200 for better quality
      format: 'png',
      width: 2400,  // Increased for better text clarity
      height: 3100, // Increased for better text clarity
    });
    
    const pages = await convert.bulk(-1, { responseType: 'base64' });
    
    if (!pages || pages.length === 0) {
      console.error(`❌ [OCR] No pages extracted from PDF`);
      throw new Error('No pages extracted from PDF - file may be corrupted or encrypted');
    }
    
    console.log(`📸 [OCR] Processing ${pages.length} pages...`);
    let allText = '';
    let totalConfidence = 0;
    let processedPages = 0;
    
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (!page.base64) {
        console.log(`⚠️ [OCR] Page ${i + 1} has no image data, skipping`);
        continue;
      }
      
      try {
        const imageBuffer = Buffer.from(page.base64, 'base64');
        
        const result = await Tesseract.recognize(imageBuffer, 'eng', {
          logger: () => {},
        });
        
        allText += result.data.text + '\n\n';
        totalConfidence += result.data.confidence;
        processedPages++;
        
        // Log progress every 5 pages
        if ((i + 1) % 5 === 0 || i === pages.length - 1) {
          console.log(`📸 [OCR] Processed ${i + 1}/${pages.length} pages (${allText.length} chars)`);
        }
      } catch (pageError: any) {
        console.log(`⚠️ [OCR] Failed to OCR page ${i + 1}: ${pageError.message}`);
      }
    }
    
    const avgConfidence = processedPages > 0 ? totalConfidence / processedPages : 0;
    
    console.log(`✅ [OCR] Extracted ${allText.length} chars, avg confidence: ${(avgConfidence).toFixed(1)}%`);
    
    // Log sample text for debugging
    if (allText.length > 0) {
      console.log(`📄 [OCR] Sample: ${allText.substring(0, 500).replace(/\n/g, ' ')}`);
    }
    
    return {
      text: allText.trim(),
      method: 'ocr-pdf2pic',
      confidence: avgConfidence / 100,
      pageCount: pages.length,
    };
  } catch (error: any) {
    console.error('[extraction] OCR failed:', error.message);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

async function extractFromImage(filePath: string): Promise<ExtractionResult> {
  try {
    const result = await Tesseract.recognize(filePath, 'eng', {
      logger: () => {},
    });
    
    return {
      text: result.data.text.trim(),
      method: 'ocr',
      confidence: result.data.confidence / 100,
    };
  } catch (error) {
    console.error('[extraction] Image OCR failed:', error);
    throw new Error(`Failed to extract text from image: ${error}`);
  }
}

export async function extractTextWithFallback(
  filePath: string,
  options?: {
    minConfidence?: number;
    minTextLength?: number;
  }
): Promise<ExtractionResult> {
  const minConfidence = options?.minConfidence ?? MIN_CONFIDENCE_THRESHOLD;
  const minTextLength = options?.minTextLength ?? MIN_TEXT_LENGTH_THRESHOLD;
  
  const result = await extractReportText(filePath);
  
  if (result.confidence < minConfidence || result.text.length < minTextLength) {
    console.warn(`[extraction] Low quality extraction (confidence: ${result.confidence}, length: ${result.text.length})`);
  }
  
  return result;
}

export function detectReportFormat(text: string): 'trimerge' | 'experian' | 'equifax' | 'transunion' | 'metro2' | 'unknown' {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('experian') && lowerText.includes('equifax') && lowerText.includes('transunion')) {
    return 'trimerge';
  }
  
  if (lowerText.includes('metro 2') || lowerText.includes('metro2')) {
    return 'metro2';
  }
  
  if (lowerText.includes('experian')) {
    return 'experian';
  }
  
  if (lowerText.includes('equifax')) {
    return 'equifax';
  }
  
  if (lowerText.includes('transunion')) {
    return 'transunion';
  }
  
  return 'unknown';
}

export function isTextQualitySufficient(result: ExtractionResult): boolean {
  return result.confidence >= MIN_CONFIDENCE_THRESHOLD && 
         result.text.length >= MIN_TEXT_LENGTH_THRESHOLD;
}
