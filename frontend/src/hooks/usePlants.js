import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";

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

// Daily consumption / tank level for one plant. Refreshes off the same
// telemetry:new push the device views use, so the tank draws down live rather
// than waiting for a reload.
export function usePlantConsumption(id) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!id) return;
    const s = getSocket();
    if (!s) return;
    const handler = (data) => {
      if (String(data?.plantId) !== String(id)) return;
      qc.invalidateQueries({ queryKey: ["plant-consumption", id] });
    };
    s.on("telemetry:new", handler);
    return () => s.off("telemetry:new", handler);
  }, [id, qc]);

  return useQuery({
    enabled: !!id,
    queryKey: ["plant-consumption", id],
    queryFn: () => api.get(`/api/plants/${id}/consumption`).then((r) => r.consumption),
    // Backstop so the tank still rolls over at midnight on an idle dashboard.
    refetchInterval: 60000
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
      qc.invalidateQueries({ queryKey: ["plant-state", vars.id] });
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
