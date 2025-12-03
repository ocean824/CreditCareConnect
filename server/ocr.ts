import { fromBuffer } from "pdf2pic";
import Tesseract from "tesseract.js";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

export async function ocrPdfOrImage(absPath: string): Promise<string> {
  const ext = path.extname(absPath).toLowerCase();
  
  // Validate that the path exists
  if (!fs.existsSync(absPath)) {
    throw new Error(`File not found: ${absPath}`);
  }
  
  if (ext === ".pdf") {
    const fileBuffer = fs.readFileSync(absPath);
    const convert = fromBuffer(fileBuffer, { density: 200, format: "png" });
    const pages = await convert.bulk(-1, { responseType: 'base64' });
    
    if (!pages || pages.length === 0) {
      throw new Error('No pages extracted from PDF');
    }
    
    let text = "";
    for (const p of pages) {
      if (!p.base64) continue;
      
      // Convert base64 to Buffer for Tesseract (more reliable than raw base64 string)
      const imageBuffer = Buffer.from(p.base64, 'base64');
      const res = await Tesseract.recognize(imageBuffer, "eng", {
        logger: () => {}, // Suppress verbose logging
      });
      text += res.data.text + "\n";
    }
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
