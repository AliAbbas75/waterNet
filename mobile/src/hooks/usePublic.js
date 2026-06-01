import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useNearbyPlants({ lat, lng, radius = 100 } = {}) {
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

export function usePlants() {
  return useQuery({
    queryKey: ["public-plants-list"],
    queryFn: () =>
      api.get("/api/public/plants/nearby", { auth: false }).then((r) => r.plants)
  });
}
