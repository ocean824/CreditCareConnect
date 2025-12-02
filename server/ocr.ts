import { fromBuffer } from "pdf2pic";
import Tesseract from "tesseract.js";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

export async function ocrPdfOrImage(absPath: string): Promise<string> {
  const ext = path.extname(absPath).toLowerCase();
  if (ext === ".pdf") {
    const convert = fromBuffer(fs.readFileSync(absPath), { density: 200, format: "png" });
    const pages = await convert.bulk(-1, { responseType: 'base64' });
    let text = "";
    for (const p of pages) {
      const res = await Tesseract.recognize(p.base64!, "eng");
      text += res.data.text + "\n";
    }
    return text.trim();
  } else {
    const res = await Tesseract.recognize(absPath, "eng");
    return res.data.text.trim();
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
