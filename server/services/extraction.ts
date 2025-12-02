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
    const convert = fromBuffer(dataBuffer, {
      density: 200,
      format: 'png',
      width: 2000,
      height: 2600,
    });
    
    const pages = await convert.bulk(-1, { responseType: 'base64' });
    
    if (!pages || pages.length === 0) {
      throw new Error('No pages extracted from PDF');
    }
    
    let allText = '';
    let totalConfidence = 0;
    
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (!page.base64) continue;
      
      const imageBuffer = Buffer.from(page.base64, 'base64');
      
      const result = await Tesseract.recognize(imageBuffer, 'eng', {
        logger: () => {},
      });
      
      allText += result.data.text + '\n\n';
      totalConfidence += result.data.confidence;
    }
    
    const avgConfidence = pages.length > 0 ? totalConfidence / pages.length : 0;
    
    return {
      text: allText.trim(),
      method: 'ocr-pdf2pic',
      confidence: avgConfidence / 100,
      pageCount: pages.length,
    };
  } catch (error) {
    console.error('[extraction] OCR failed:', error);
    throw new Error(`Failed to extract text from PDF: ${error}`);
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
