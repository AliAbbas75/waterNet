import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";

export function useAlerts(filters = {}) {
  const qc = useQueryClient();

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const handler = () => qc.invalidateQueries({ queryKey: ["alerts"] });
    s.on("alert:new", handler);
    return () => s.off("alert:new", handler);
  }, [qc]);

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
    // A note is required at the call site now: closing an alert with no record
    // of what was done is the behaviour this whole revamp exists to remove.
    mutationFn: ({ id, note }) => api.patch(`/api/alerts/${id}/resolve`, { note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] })
  });
}
