export function checkUploadCap(tier: string, currentUploads: number): boolean {
  const limits = {
    Basic: 3,
    Premium: 10,
    Super: 999
  };
  return currentUploads < (limits[tier] || 0);
}