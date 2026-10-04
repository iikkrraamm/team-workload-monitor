export function readPersistedFilters(key, defaults) {
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return defaults;

    return Object.fromEntries(Object.entries(defaults).map(([name, fallback]) => {
      const value = stored[name];
      const valid = Array.isArray(fallback)
        ? Array.isArray(value) && value.every((item) => typeof item === "string")
        : typeof value === typeof fallback;
      return [name, valid ? value : fallback];
    }));
  } catch {
    return defaults;
  }
}

export function writePersistedFilters(key, filters) {
  try {
    localStorage.setItem(key, JSON.stringify(filters));
  } catch {
    // Storage can be unavailable in private browsing or restricted contexts.
  }
}