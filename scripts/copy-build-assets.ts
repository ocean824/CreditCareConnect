#!/usr/bin/env tsx
/**
 * Copy non-TypeScript assets to dist/ directory after build
 * This ensures openapi.yml and attached_assets are available in production builds
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

// Copy attached_assets to dist/public/attached_assets
const attachedAssetsSource = path.join(rootDir, 'attached_assets');
const attachedAssetsDest = path.join(rootDir, 'dist', 'public', 'attached_assets');

if (fs.existsSync(attachedAssetsSource)) {
  try {
    // Recursively copy directory
    fs.cpSync(attachedAssetsSource, attachedAssetsDest, { recursive: true, force: true });
    console.log('✅ Copied attached_assets → dist/public/attached_assets');
  } catch (error) {
    console.error('❌ Failed to copy attached_assets:', error);
    process.exit(1);
  }
} else {
  console.log('⚠️  attached_assets directory not found, skipping copy');
}

console.log('✅ Build assets copied successfully!');
