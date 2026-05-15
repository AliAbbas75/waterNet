import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function usePlants(filters = {}) {
  return useQuery({
    queryKey: ["plants", filters],
    queryFn: () => api.get("/api/plants", { params: filters }).then((r) => r.plants)
  });
}

export function usePlant(id) {
  return useQuery({
    enabled: !!id,
    queryKey: ["plant", id],
    queryFn: () => api.get(`/api/plants/${id}`).then((r) => r.plant)
  });
}

export function usePlantState(id) {
  return useQuery({
    enabled: !!id,
    queryKey: ["plant-state", id],
    queryFn: () => api.get(`/api/analysis/plants/${id}/state`),
    refetchInterval: 30000
  });
}

export function useCreatePlant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post("/api/plants", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plants"] })
  });
}

export function useUpdatePlant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/api/plants/${id}`, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["plants"] });
      qc.invalidateQueries({ queryKey: ["plant", vars.id] });
    }
  });
}

export function useDeletePlant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.del(`/api/plants/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plants"] })
  });
}
