// Simulated document signing logic
export function simulateSignature(documentId, userId) {
  const now = new Date().toISOString();
  console.log(`📄 Document ${documentId} signed by User ${userId} at ${now}`);
  return {
    status: 'success',
    signedAt: now,
    message: 'Document signed (simulated).'
  };
}