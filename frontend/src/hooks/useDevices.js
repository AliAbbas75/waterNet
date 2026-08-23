import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";

export function useDevices(filters = {}) {
  const qc = useQueryClient();

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const handler = () => qc.invalidateQueries({ queryKey: ["devices"] });
    s.on("telemetry:new", handler);
    s.on("device:availability", handler);
    return () => {
      s.off("telemetry:new", handler);
      s.off("device:availability", handler);
    };
  }, [qc]);

  return useQuery({
    queryKey: ["devices", filters],
    queryFn: () => api.get("/api/devices", { params: filters }).then((r) => r.devices),
    // Sockets carry the live updates; this is the safety net. A missed event —
    // a drop, a proxy timing out an idle upgrade — otherwise leaves the screen
    // frozen with no clue anything is wrong, and the only cure is a refresh.
    refetchInterval: 30_000
  });
}

// Matches a socket payload against the Mongo id the device routes are keyed by.
// The backend sends `deviceRef` (Mongo _id) alongside `deviceId` (the hardware
// string, e.g. "ESP32-de5e"); comparing only against `deviceId` never matches a
// route param and silently disables live updates.
function matchesDevice(data, id) {
  if (!data || !id) return false;
  return String(data.deviceRef) === String(id) || String(data.deviceId) === String(id);
}

export function useDevice(id) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!id) return;
    const s = getSocket();
    if (!s) return;
    // telemetry refreshes lastSeenAt; device:availability carries the
    // online/offline flip, which fires on transitions only.
    const handler = (data) => {
      if (matchesDevice(data, id)) qc.invalidateQueries({ queryKey: ["device", id] });
    };
    s.on("telemetry:new", handler);
    s.on("device:availability", handler);
    return () => {
      s.off("telemetry:new", handler);
      s.off("device:availability", handler);
    };
  }, [id, qc]);

  return useQuery({
    enabled: !!id,
    queryKey: ["device", id],
    queryFn: () => api.get(`/api/devices/${id}`).then((r) => r.device),
    // Shorter than the list: this drives the online/offline badge somebody is
    // watching on a device page, where a stale answer is the whole complaint.
    refetchInterval: 15_000
  });
}

/**
 * Recent readings for one device.
 *
 * `sinceMs` bounds the window in TIME rather than row count. A device that was
 * dead for a fortnight and came back has its newest readings crushed into a
 * sliver of an axis spanning the whole outage — the graph then looks frozen
 * however often it refetches, because the new points are half a pixel wide.
 */
export function useDeviceReadings(id, limit = 200, sinceMs = null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!id) return;
    const s = getSocket();
    if (!s) return;
    const handler = (data) => {
      if (matchesDevice(data, id)) {
        qc.invalidateQueries({ queryKey: ["device-readings", id] });
      }
    };
    s.on("telemetry:new", handler);
    return () => s.off("telemetry:new", handler);
  }, [id, qc]);

  return useQuery({
    enabled: !!id,
    queryKey: ["device-readings", id, limit, sinceMs],
    queryFn: () =>
      api.get(`/api/devices/${id}/readings`, {
        params: { limit, ...(sinceMs ? { since: new Date(Date.now() - sinceMs).toISOString() } : {}) }
      }),
    // Backstop. These charts used to refresh only on a telemetry:new push,
    // while the plant state beside them polls on a timer — so whenever the
    // socket was down or the payload did not match, the charts froze while the
    // cards around them kept moving, and the page showed two points in time.
    refetchInterval: 15_000
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
