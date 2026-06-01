import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";

// Maintainers need inventory to log materials when resolving a task.
// Backend gates inventory list on ADMIN today, so this will 403 for plain
// MAINTAINERS — the resolve flow tolerates a missing list.
export function useInventory() {
  return useQuery({
    queryKey: ["inventory"],
    queryFn: () => api.get("/api/inventory").then((r) => r.items),
    retry: false
  });
}
