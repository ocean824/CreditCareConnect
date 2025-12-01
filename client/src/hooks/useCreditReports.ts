import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export interface CreditReportSummary {
  id: string;
  fileName: string;
  bureau: string;
  analysisStatus: string;
  createdAt: string;
  violationCount?: number;
}

export function useCreditReports() {
  return useQuery<CreditReportSummary[]>({
    queryKey: ["/api/credit-reports"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
}

export function useCreditReport(reportId: string) {
  return useQuery({
    queryKey: ["/api/credit-reports", reportId],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!reportId,
  });
}

export function useViolations(reportId: string) {
  return useQuery({
    queryKey: ["/api/violations", reportId],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!reportId,
  });
}
