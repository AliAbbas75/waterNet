import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useAlerts(filters = {}) {
  return useQuery({
    queryKey: ["alerts", filters],
    queryFn: () => api.get("/api/alerts", { params: filters }).then((r) => r.alerts)
  });
}

export function useAckAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.patch(`/api/alerts/${id}/ack`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] })
  });
}

export function useResolveAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.patch(`/api/alerts/${id}/resolve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] })
  });
}
