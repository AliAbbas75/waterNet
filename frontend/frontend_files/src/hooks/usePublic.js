import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useNearbyPlants({ lat, lng, radius = 50 } = {}) {
  return useQuery({
    queryKey: ["public-nearby", lat, lng, radius],
    queryFn: () =>
      api.get("/api/public/plants/nearby", {
        auth: false,
        params: { lat, lng, radius }
      }).then((r) => r.plants),
    refetchInterval: 60_000
  });
}

export function usePublicPlantStatus(id) {
  return useQuery({
    enabled: !!id,
    queryKey: ["public-plant-status", id],
    queryFn: () => api.get(`/api/public/plants/${id}/status`, { auth: false }),
    refetchInterval: 30_000
  });
}

export function useMyReports() {
  return useQuery({
    queryKey: ["my-reports"],
    queryFn: () => api.get("/api/public/reports/mine").then((r) => r.reports)
  });
}

export function useSubmitReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post("/api/public/reports", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-reports"] })
  });
}

export function useAdminReports(filters = {}) {
  return useQuery({
    queryKey: ["admin-reports", filters],
    queryFn: () => api.get("/api/public/reports", { params: filters }).then((r) => r.reports)
  });
}

export function useUpdateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/api/public/reports/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reports"] })
  });
}
