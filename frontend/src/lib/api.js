const BASE = "/api";

function buildUrl(path, query) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value == null) return;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else params.append(key, value);
  });
  const qs = params.toString();
  return `${BASE}${path}${qs ? `?${qs}` : ""}`;
}

async function request(path, { method = "GET", query, body } = {}) {
  const headers = body === undefined ? undefined : { "Content-Type": "application/json" };
  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  // Members
  getMembers: () => request("/members"),
  createMember: (data) => request("/members", { method: "POST", body: data }),
  updateMember: (id, data) => request(`/members/${id}`, { method: "PUT", body: data }),
  deleteMember: (id) => request(`/members/${id}`, { method: "DELETE" }),

  // Tasks
  getTasks: (filters = {}) => request("/tasks", { query: filters }),
  // Server-side paginated fetch for the List view — returns
  // { items, total, page, page_size }. Kanban and project-suggestions
  // keep using getTasks() above, which returns the full filtered set.
  getTasksPage: (filters = {}, page = 1, pageSize = 20) =>
    request("/tasks", { query: { ...filters, page, page_size: pageSize } }),
  getRiskyTasks: () => request("/tasks/risk"),
  // Activities (non-task work)
  getActivities: (filters = {}) => request("/activities", { query: filters }),
  createActivity: (data) => request("/activities", { method: "POST", body: data }),
  updateActivity: (id, data) => request(`/activities/${id}`, { method: "PUT", body: data }),
  deleteActivity: (id) => request(`/activities/${id}`, { method: "DELETE" }),
  createTask: (data) => request("/tasks", { method: "POST", body: data }),
  updateTask: (id, data) => request(`/tasks/${id}`, { method: "PUT", body: data }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: "DELETE" }),

  // Workload / Burnout / Dashboard
  getWorkload: (period, date) => request("/workload", { query: { period, date } }),
  getBurnout: () => request("/burnout"),
  getDashboard: (date) => request("/dashboard", { query: { date } }),
  getWorkloadDetails: (member_id, period, date) =>
    request("/workload/details", { query: { member_id, period, date } }),

  // SQL client
  getSqlSchema: () => request("/sql/schema"),
  executeSql: (sql) => request("/sql/execute", { method: "POST", body: { sql } }),
  // Returns { blob, filename, rows, truncated } for the caller to save.
  exportSql: async (payload) => {
    const res = await fetch(`${BASE}/sql/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new Error(errorBody.error || `Request failed (${res.status})`);
    }
    return {
      blob: await res.blob(),
      filename: res.headers.get("X-Export-Filename") || "hasil-query",
      rows: Number(res.headers.get("X-Export-Rows")),
      truncated: res.headers.get("X-Export-Truncated") === "1",
    };
  },
  getSavedQueries: () => request("/sql/queries"),
  createSavedQuery: (data) => request("/sql/queries", { method: "POST", body: data }),
  updateSavedQuery: (id, data) => request(`/sql/queries/${id}`, { method: "PUT", body: data }),
  deleteSavedQuery: (id) => request(`/sql/queries/${id}`, { method: "DELETE" }),

  // AI chat
  sendChat: (message) => request("/ai-chat", { method: "POST", body: { message } }),
};
