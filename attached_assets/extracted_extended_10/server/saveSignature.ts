import fs from 'fs';
import path from 'path';

export function saveSignature(base64Signature: string, userId: string): string {
  const data = base64Signature.replace(/^data:image\/png;base64,/, '');
  const filePath = path.join(__dirname, '../public/signatures', `${userId}_signature.png`);
  fs.writeFileSync(filePath, data, 'base64');
  return filePath;
}