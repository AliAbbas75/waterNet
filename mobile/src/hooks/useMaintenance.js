import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useMyTasks() {
  return useQuery({
    queryKey: ["my-tasks"],
    queryFn: () => api.get("/api/maintenance/tasks/mine").then((r) => r.tasks)
  });
}

export function useTask(id) {
  return useQuery({
    enabled: !!id,
    queryKey: ["task", id],
    queryFn: () => api.get(`/api/maintenance/tasks/${id}`).then((r) => r.task)
  });
}

export function useTaskLogs(id) {
  return useQuery({
    enabled: !!id,
    queryKey: ["task-logs", id],
    queryFn: () => api.get(`/api/maintenance/tasks/${id}/logs`).then((r) => r.logs)
  });
}

export function useStartTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.patch(`/api/maintenance/tasks/${id}/start`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      qc.invalidateQueries({ queryKey: ["task", id] });
    }
  });
}

export function useAddTaskLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note, structuredFields }) =>
      api.post(`/api/maintenance/tasks/${id}/logs`, { note, structuredFields }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["task-logs", vars.id] });
    }
  });
}

export function useResolveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolutionSummary, materials }) =>
      api.post(`/api/maintenance/tasks/${id}/resolve`, { resolutionSummary, materials }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      qc.invalidateQueries({ queryKey: ["task", vars.id] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    }
  });
}
