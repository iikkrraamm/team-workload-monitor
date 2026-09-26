export function initials(name = "") {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Avatar({ name, color, size = 40 }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        background: color || "#8E8E93",
        width: size,
        height: size,
        fontSize: size * 0.36,
      }}
    >
      {initials(name)}
    </div>
  );
}
