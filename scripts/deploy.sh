#!/bin/bash
# Deploy script - builds and prepares for production

echo "🔄 Starting deployment preparation..."

# Clean old build artifacts
echo "🧹 Cleaning old build..."
rm -rf dist

# Build the application
echo "🔨 Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Show the new bundle hash
echo ""
echo "✅ Build complete!"
echo ""
echo "📦 New bundle files:"
ls -la dist/public/assets/*.js 2>/dev/null | tail -1
ls -la dist/public/assets/*.css 2>/dev/null | tail -1

# Verify no old text remains
echo ""
echo "🔍 Verifying build content..."
if strings dist/public/assets/*.js 2>/dev/null | grep -q '"Download PDF"'; then
    echo "⚠️  WARNING: 'Download PDF' still found in bundle!"
else
    echo "✅ No 'Download PDF' text in bundle"
fi

echo ""
echo "================================================"
echo "📢 NEXT STEP: Click the 'Publish' button in Replit"
echo "   Then hard refresh your browser (Ctrl+Shift+R)"
echo "================================================"
