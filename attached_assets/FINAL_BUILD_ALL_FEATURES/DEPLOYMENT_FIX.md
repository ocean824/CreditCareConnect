# Deployment Fix: Copy openapi.yml to dist/

## Problem
The production build fails because `openapi.yml` is not copied to the `dist/` directory during the build process. The esbuild command only bundles TypeScript files.

## Solution
Update the build script in `package.json` to copy the OpenAPI spec file after bundling.

### Required Change to package.json

**Current build script:**
```json
"build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist"
```

**Updated build script (choose one option):**

#### Option 1: Simple inline copy (works on Unix/Linux/Mac)
```json
"build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist && cp server/openapi.yml dist/openapi.yml"
```

#### Option 2: Using the copy script (cross-platform)
```json
"build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist && tsx scripts/copy-build-assets.ts"
```

#### Option 3: Windows-compatible
```json
"build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist && (cp server/openapi.yml dist/openapi.yml || copy server\\openapi.yml dist\\openapi.yml)"
```

## Manual Steps

1. Open `package.json`
2. Find the `"build"` script under `"scripts"`
3. Replace it with one of the options above
4. Save the file
5. Test the build: `npm run build`
6. Verify `dist/openapi.yml` exists after build

## Verification

After updating the build script, you can verify it works by:

```bash
# Run the build
npm run build

# Check if openapi.yml was copied
ls -la dist/openapi.yml

# Test the production server locally
npm start

# Visit http://localhost:5000/api/docs to verify OpenAPI docs load
```

## Alternative: Automated Copy Script

I've created `scripts/copy-build-assets.ts` which handles copying the file in a cross-platform way. This is recommended if you need Windows compatibility.

To use it, update your build script to:
```json
"build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist && tsx scripts/copy-build-assets.ts"
```
