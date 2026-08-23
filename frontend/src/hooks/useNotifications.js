import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useNotificationConfig() {
  return useQuery({
    queryKey: ["notification-config"],
    queryFn: () => api.get("/api/notifications/config")
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (preferences) => api.put("/api/notifications/preferences", { preferences }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-config"] })
  });
}

export function useNotificationDevices() {
  return useQuery({
    queryKey: ["notification-devices"],
    queryFn: () => api.get("/api/notifications/devices").then((r) => r.devices)
  });
}

export function useSendTestNotification() {
  return useMutation({
    mutationFn: () => api.post("/api/notifications/test")
  });
}
