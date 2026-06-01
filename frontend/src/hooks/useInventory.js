import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useInventory(filters = {}) {
  return useQuery({
    queryKey: ["inventory", filters],
    queryFn: () => api.get("/api/inventory", { params: filters }).then((r) => r.items)
  });
}

export function useCreateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post("/api/inventory", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] })
  });
}

export function useUpdateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/api/inventory/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
    }
  });
}

export function useDeleteInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.del(`/api/inventory/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] })
  });
}
