import clsx from "clsx";

function Cell({ value }) {
  if (value === null) {
    return <span className="italic text-ink-faint">NULL</span>;
  }
  return String(value);
}

export default function SqlResultTable({ columns, rows }) {
  return (
    <div className="max-h-[480px] overflow-auto rounded-xl border border-line">
      <table className="w-full border-collapse font-mono text-[12.5px]">
        <thead className="sticky top-0 z-10 bg-canvas">
          <tr>
            <th className="w-10 border-b border-line px-3 py-2 text-right font-medium text-ink-faint">
              #
            </th>
            {columns.map((col, i) => (
              <th
                key={i}
                className="whitespace-nowrap border-b border-line px-3 py-2 text-left font-semibold text-ink"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-line/60 last:border-b-0 hover:bg-ink/[0.02]">
              <td className="px-3 py-1.5 text-right text-ink-faint">{r + 1}</td>
              {row.map((value, c) => (
                <td
                  key={c}
                  title={value === null ? "NULL" : String(value)}
                  className={clsx(
                    "max-w-[320px] truncate px-3 py-1.5 text-ink",
                    typeof value === "number" && "text-right tabular-nums"
                  )}
                >
                  <Cell value={value} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
