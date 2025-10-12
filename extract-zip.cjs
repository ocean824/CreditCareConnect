const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Simple zip extraction using built-in modules
const zipPath = 'attached_assets/freeze_agent_bundle_v1_1760297513589.zip';
const buffer = fs.readFileSync(zipPath);

// Check for ZIP signature
if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
  console.error('Not a valid ZIP file');
  process.exit(1);
}

// Parse ZIP file manually (simple implementation)
let offset = 0;
const files = [];

while (offset < buffer.length - 4) {
  const signature = buffer.readUInt32LE(offset);
  
  if (signature === 0x04034b50) { // Local file header
    const version = buffer.readUInt16LE(offset + 4);
    const flags = buffer.readUInt16LE(offset + 6);
    const compression = buffer.readUInt16LE(offset + 8);
    const filenameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    
    const filename = buffer.toString('utf8', offset + 30, offset + 30 + filenameLength);
    const dataStart = offset + 30 + filenameLength + extraLength;
    const data = buffer.slice(dataStart, dataStart + compressedSize);
    
    files.push({ filename, data, compression, uncompressedSize });
    offset = dataStart + compressedSize;
  } else if (signature === 0x02014b50) { // Central directory
    break;
  } else {
    offset++;
  }
}

console.log('Files found:', files.map(f => f.filename).join(', '));

// Extract files
files.forEach(file => {
  const outputPath = path.join('attached_assets', file.filename);
  
  if (file.filename.endsWith('/')) {
    fs.mkdirSync(outputPath, { recursive: true });
  } else {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    
    if (file.compression === 0) {
      // No compression
      fs.writeFileSync(outputPath, file.data);
    } else if (file.compression === 8) {
      // Deflate compression
      const inflated = zlib.inflateRawSync(file.data);
      fs.writeFileSync(outputPath, inflated);
    }
    console.log('Extracted:', file.filename);
  }
});

console.log('\nExtraction complete!');
