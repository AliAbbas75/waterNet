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
