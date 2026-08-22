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
    // An alert row carries its work order, so a ticket moving — assigned,
    // resolved, cancelled — changes the row even when the alert itself did not.
    s.on("alert:updated", handler);
    s.on("task:updated", handler);
    return () => {
      s.off("alert:new", handler);
      s.off("alert:updated", handler);
      s.off("task:updated", handler);
    };
  }, [qc]);

  return useQuery({
    queryKey: ["alerts", filters],
    queryFn: () => api.get("/api/alerts", { params: filters }).then((r) => r.alerts)
  });
}

// Acknowledging, assigning and closing all move work between queues, so each
// one invalidates the task lists too — otherwise the maintenance board keeps
// showing a ticket that has just been routed somewhere else.
function invalidateAlertsAndWork(qc) {
  qc.invalidateQueries({ queryKey: ["alerts"] });
  qc.invalidateQueries({ queryKey: ["tasks"] });
  qc.invalidateQueries({ queryKey: ["my-tasks"] });
}

export function useAckAlert() {
  const qc = useQueryClient();
  return useMutation({
    // Acknowledging opens the work order now — it is no longer a status flip
    // that leaves the alert with nowhere to go.
    mutationFn: (id) => api.patch(`/api/alerts/${id}/ack`),
    onSuccess: () => invalidateAlertsAndWork(qc)
  });
}

export function useDispatchAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assignedToUserId, note }) =>
      api.patch(`/api/alerts/${id}/dispatch`, { assignedToUserId, note }),
    onSuccess: () => invalidateAlertsAndWork(qc)
  });
}

export function useResolveAlert() {
  const qc = useQueryClient();
  return useMutation({
    // Closing without dispatch. A reason is required at the call site: closing
    // an alert with no record of why is the behaviour this revamp exists to remove.
    mutationFn: ({ id, note }) => api.patch(`/api/alerts/${id}/resolve`, { note }),
    onSuccess: () => invalidateAlertsAndWork(qc)
  });
}
