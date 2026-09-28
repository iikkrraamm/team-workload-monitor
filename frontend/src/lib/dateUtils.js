export function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftWorkloadDate(value, amount, period) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (period === "month") {
    date.setDate(1);
    date.setMonth(date.getMonth() + amount);
    date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  } else {
    date.setDate(date.getDate() + amount * (period === "week" ? 7 : 1));
  }
  return formatDateInput(date);
}

export function startOfMonth(date = new Date()) {
  return formatDateInput(new Date(date.getFullYear(), date.getMonth(), 1));
}

// "2026-09-28" -> "Senin, 28 September 2026". Parsed as local noon so the
// date never shifts a day because of the timezone.
export function formatDateLabel(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day, 12));
}
