import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useThresholds(plantId) {
  return useQuery({
    queryKey: ["thresholds", plantId ?? "global"],
    queryFn: () =>
      api.get("/api/analysis/thresholds", { params: plantId ? { plantId } : {} }).then((r) => r.thresholds)
  });
}

export function useCreateThreshold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post("/api/analysis/thresholds", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["thresholds"] })
  });
}

export function useUpdateThreshold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/api/analysis/thresholds/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["thresholds"] })
  });
}

export function useDeleteThreshold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.del(`/api/analysis/thresholds/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["thresholds"] })
  });
}
