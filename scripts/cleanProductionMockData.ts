import { db } from "../server/db";
import { violations, creditReports } from "@shared/schema";
import { inArray, or, eq } from "drizzle-orm";

/**
 * Clean mock data from production database
 * 
 * USAGE:
 *   DATABASE_URL=<your-production-database-url> npx tsx scripts/cleanProductionMockData.ts
 * 
 * This removes:
 * - Mock violations ("Test Account", "Credit Card XYZ")
 * - Mock credit reports ("test-credit-report.pdf", "dummy.pdf")
 */

async function cleanMockData() {
  console.log("🧹 Starting production mock data cleanup...");
  
  try {
    // Delete mock violations
    const mockAccountNames = ['Test Account', 'Credit Card XYZ'];
    const mockAccountNumbers = ['1234567890', '9876543210', '37890'];
    
    const deletedViolations = await db.delete(violations)
      .where(
        or(
          inArray(violations.accountName, mockAccountNames),
          inArray(violations.accountNumber, mockAccountNumbers)
        )
      );
    
    console.log(`✅ Deleted ${deletedViolations.rowCount || 0} mock violations`);
    
    // Delete mock credit reports (optional - only if they don't have real analysis)
    const mockFileNames = ['test-credit-report.pdf', 'dummy.pdf'];
    
    const deletedReports = await db.delete(creditReports)
      .where(inArray(creditReports.fileName, mockFileNames));
    
    console.log(`✅ Deleted ${deletedReports.rowCount || 0} mock credit reports`);
    
    // Verify cleanup
    const remainingViolations = await db.select().from(violations);
    console.log(`📊 Remaining violations in database: ${remainingViolations.length}`);
    
    if (remainingViolations.length === 0) {
      console.log("✨ Database is clean! Upload a real credit report to generate violations.");
    } else {
      console.log("✅ Database cleaned. Remaining violations are from real credit reports.");
    }
    
  } catch (error) {
    console.error("❌ Error cleaning mock data:", error);
    throw error;
  }
}

cleanMockData()
  .then(() => {
    console.log("✅ Cleanup complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  });
