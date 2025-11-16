export const featureFlags = {
  aiAnalysis: true,
  automaticMailing: true,
  cfpbComplaints: true,
  freezeAgent: true,
  adminAuditLogs: true,
  day34Reminders: true
};

export function isFeatureEnabled(flag: keyof typeof featureFlags): boolean {
  return featureFlags[flag];
}
