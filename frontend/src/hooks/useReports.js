import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useOverview() {
  return useQuery({
    queryKey: ["report-overview"],
    queryFn: () => api.get("/api/reports/overview"),
    refetchInterval: 30_000
  });
}

export function useQualityTrends({ plantId, from, to, bucket } = {}) {
  return useQuery({
    queryKey: ["report-quality", plantId, from, to, bucket],
    queryFn: () =>
      api.get("/api/reports/quality/trends", {
        params: { plantId, from, to, bucket }
      })
  });
}

// Stats behind the report preview. plantIds is sent as a comma-joined list;
// an empty list means the whole network.
export function useQualityStats({ plantIds = [], range = "7d", mode = "aggregate", enabled = true } = {}) {
  const ids = [...plantIds].sort();
  return useQuery({
    queryKey: ["report-quality-stats", ids.join(","), range, mode],
    enabled,
    queryFn: () =>
      api.get("/api/reports/quality/stats", {
        params: { plantIds: ids.join(","), range, mode }
      })
  });
}

export function useMaintenancePerformance({ from, to } = {}) {
  return useQuery({
    queryKey: ["report-maintenance", from, to],
    queryFn: () => api.get("/api/reports/maintenance/performance", { params: { from, to } })
  });
}

export function useUptime({ from, to } = {}) {
  return useQuery({
    queryKey: ["report-uptime", from, to],
    queryFn: () => api.get("/api/reports/uptime", { params: { from, to } })
  });
}
