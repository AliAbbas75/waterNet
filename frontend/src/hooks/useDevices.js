import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useDevices(filters = {}) {
  return useQuery({
    queryKey: ["devices", filters],
    queryFn: () => api.get("/api/devices", { params: filters }).then((r) => r.devices)
  });
}

export function useDevice(id) {
  return useQuery({
    enabled: !!id,
    queryKey: ["device", id],
    queryFn: () => api.get(`/api/devices/${id}`).then((r) => r.device)
  });
}

export function useDeviceReadings(id, limit = 200) {
  return useQuery({
    enabled: !!id,
    queryKey: ["device-readings", id, limit],
    queryFn: () => api.get(`/api/devices/${id}/readings`, { params: { limit } })
  });
}

export function useCreateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post("/api/devices", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devices"] })
  });
}

export function useUpdateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/api/devices/${id}`, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["devices"] });
      qc.invalidateQueries({ queryKey: ["device", vars.id] });
    }
  });
}

export function useInstallDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, plantId }) => api.patch(`/api/devices/${id}/install`, { plantId }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["devices"] });
      qc.invalidateQueries({ queryKey: ["device", vars.id] });
    }
  });
}

export function useUninstallDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.patch(`/api/devices/${id}/uninstall`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["devices"] });
      qc.invalidateQueries({ queryKey: ["device", id] });
    }
  });
}

export function useDeleteDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.del(`/api/devices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devices"] })
  });
}
