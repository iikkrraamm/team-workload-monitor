const BASE = "/api";

function buildUrl(path, query) {
  const queryParams = Object.fromEntries(
    Object.entries(query || {}).filter(([, value]) => value != null)
  );
  const params = new URLSearchParams(queryParams).toString();
  return `${BASE}${path}${params ? `?${params}` : ""}`;
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
  getRiskyTasks: () => request("/tasks/risk"),
  // Activities (non-task work)
  getActivities: (filters = {}) => request("/activities", { query: filters }),
  createActivity: (data) => request("/activities", { method: "POST", body: data }),
  deleteActivity: (id) => request(`/activities/${id}`, { method: "DELETE" }),
  createTask: (data) => request("/tasks", { method: "POST", body: data }),
  updateTask: (id, data) => request(`/tasks/${id}`, { method: "PUT", body: data }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: "DELETE" }),

  // Workload / Burnout / Dashboard
  getWorkload: (period, date) => request("/workload", { query: { period, date } }),
  getBurnout: () => request("/burnout"),
  getDashboard: () => request("/dashboard"),
  getWorkloadDetails: (member_id, period, date) =>
    request("/workload/details", { query: { member_id, period, date } }),

  // AI chat
  sendChat: (message) => request("/ai-chat", { method: "POST", body: { message } }),
};
