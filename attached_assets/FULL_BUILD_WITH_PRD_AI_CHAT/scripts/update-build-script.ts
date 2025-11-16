#!/usr/bin/env tsx
/**
 * Update package.json build script to copy openapi.yml to dist/
 * This is required for production deployments
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');

console.log('📝 Updating package.json build script...');

try {
  // Read package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Update build script to include copying openapi.yml
  const currentBuild = packageJson.scripts.build;
  const newBuild = `${currentBuild} && tsx scripts/copy-build-assets.ts`;
  
  console.log('Current build script:', currentBuild);
  console.log('New build script:', newBuild);
  
  packageJson.scripts.build = newBuild;
  
  // Write back to package.json with proper formatting
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  
  console.log('✅ Successfully updated package.json build script!');
  console.log('\nYou can now run: npm run build');
} catch (error) {
  console.error('❌ Failed to update package.json:', error);
  process.exit(1);
}
