#!/usr/bin/env tsx
/**
 * Copy non-TypeScript assets to dist/ directory after build
 * This ensures openapi.yml is available in production builds
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('📦 Copying build assets...');

// Ensure dist directory exists
const distDir = path.join(rootDir, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy openapi.yml to dist/
const openapiSource = path.join(rootDir, 'server', 'openapi.yml');
const openapiDest = path.join(distDir, 'openapi.yml');

try {
  fs.copyFileSync(openapiSource, openapiDest);
  console.log('✅ Copied server/openapi.yml → dist/openapi.yml');
} catch (error) {
  console.error('❌ Failed to copy openapi.yml:', error);
  process.exit(1);
}

console.log('✅ Build assets copied successfully!');
