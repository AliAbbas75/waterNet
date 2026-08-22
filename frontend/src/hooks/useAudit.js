import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";

/**
 * The audit log is a record, not a workspace: it is read and never written from
 * the UI, so these are queries only — there is deliberately no mutation here.
 */
export function useAuditLogs(params = {}) {
  return useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => api.get("/api/admin/audit-logs", { params }).then((r) => r.logs)
  });
}

/** Counts across the whole log, so section totals are not just the loaded page. */
export function useAuditSummary() {
  return useQuery({
    queryKey: ["audit-summary"],
    queryFn: () => api.get("/api/admin/audit-logs/summary")
  });
}

/** History of one entity — used by the alert history dialog. */
export function useAuditTrail(targetType, targetId) {
  return useQuery({
    enabled: !!targetType && !!targetId,
    queryKey: ["audit-trail", targetType, targetId],
    queryFn: () =>
      api
        .get("/api/admin/audit-logs", { params: { targetType, targetId, limit: 50 } })
        .then((r) => r.logs)
  });
}
