import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useUsers(filters = {}) {
  return useQuery({
    queryKey: ["users", filters],
    queryFn: () => api.get("/api/users", { params: filters }).then((r) => r.users)
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }) => api.patch(`/api/users/${id}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] })
  });
}

export function useToggleUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }) => api.patch(`/api/users/${id}/active`, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] })
  });
}

export function useDevUsers(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["dev-users"],
    queryFn: () => api.get("/api/auth/dev-users", { auth: false }).then((r) => r.users),
    staleTime: 60_000
  });
}
