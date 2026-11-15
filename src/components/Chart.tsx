import { useState } from "react";
export const fmt = (n: number | null | undefined, d = 1) =>
  n === null || n === undefined || !Number.isFinite(n)
    ? "Unavailable"
    : n.toLocaleString("en-AU", {
        maximumFractionDigits: d,
        minimumFractionDigits: d,
      });
type Series = {
  name: string;
  color: string;
  values: { date: string; value: number | null }[];
};
export default function Chart({
  series,
  unit,
  title,
  source,
  bar = false,
}: {
  series: Series[];
  unit: string;
  title: string;
  source: string;
  bar?: boolean;
}) {
  const [table, setTable] = useState(false);
  const all = series.flatMap((s) =>
    s.values.map((x) => x.value).filter((v): v is number => v !== null),
  );
  const min = Math.min(0, ...all),
    max = Math.max(1, ...all),
    w = 880,
    h = 200;
  const x = (i: number, n: number) => 50 + (i / Math.max(n - 1, 1)) * (w - 75),
    y = (v: number) => h - 30 - ((v - min) / (max - min)) * (h - 55);
  return (
    <div className="chart-wrap">
      <div className="section-title">
        <h3>{title}</h3>
        <button
          className="text-button"
          onClick={() => setTable(!table)}
          aria-expanded={table}
        >
          {table ? "Hide" : "Show"} accessible table
        </button>
      </div>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}{" "}
        <span>{unit} · gaps remain blank</span>
      </div>
      {all.length ? (
        <svg
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label={`${title}. ${unit}. Missing observations are gaps; values available in table.`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line
                x1="50"
                x2="860"
                y1={y(min + (max - min) * v)}
                y2={y(min + (max - min) * v)}
                stroke="#e2e5dc"
              />
              <text
                x="42"
                y={y(min + (max - min) * v) + 4}
                textAnchor="end"
                fill="#748074"
                fontSize="11"
              >
                {fmt(min + (max - min) * v, 1)}
              </text>
            </g>
          ))}
          {series.map((s) => {
            if (bar)
              return (
                <g key={s.name}>
                  {s.values.map((p, i) =>
                    p.value !== null ? (
                      <rect
                        key={p.date}
                        x={x(i, s.values.length) - 2}
                        y={y(p.value)}
                        width={Math.max(2, 700 / s.values.length)}
                        height={Math.max(1, y(0) - y(p.value))}
                        fill={s.color}
                      >
                        <title>
                          {p.date}: {fmt(p.value)} {unit}
                        </title>
                      </rect>
                    ) : (
                      <text
                        key={p.date}
                        x={x(i, s.values.length)}
                        y={h - 20}
                        fill="#aa6544"
                        fontSize="10"
                      >
                        ×
                      </text>
                    ),
                  )}
                </g>
              );
            let path = "";
            let gap = true;
            s.values.forEach((p, i) => {
              if (p.value === null) {
                gap = true;
                return;
              }
              path +=
                (gap ? "M" : "L") +
                x(i, s.values.length) +
                "," +
                y(p.value) +
                " ";
              gap = false;
            });
            return (
              <path
                key={s.name}
                d={path}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
              />
            );
          })}
          {series[0]?.values
            .filter(
              (_, i, a) =>
                i === 0 || i === a.length - 1 || i === Math.floor(a.length / 2),
            )
            .map((p) => (
              <text
                key={p.date}
                x={x(series[0].values.indexOf(p), series[0].values.length)}
                y={h - 5}
                textAnchor="middle"
                fill="#748074"
                fontSize="11"
              >
                {p.date}
              </text>
            ))}
        </svg>
      ) : (
        <p className="empty-small">No valid observations in this window.</p>
      )}
      <p className="source-line">
        {source}
        <br />
        {series
          .map((s) => {
            const last = s.values.filter((v) => v.value !== null).at(-1)?.date;
            const lastDate =
              last?.length === 7
                ? new Date(Date.UTC(+last.slice(0, 4), +last.slice(5, 7), 0))
                    .toISOString()
                    .slice(0, 10)
                : last;
            const age = lastDate
              ? Math.max(
                  0,
                  Math.floor((Date.now() - Date.parse(lastDate)) / 86400000),
                )
              : null;
            return `${s.name}: ${s.values.filter((v) => v.value !== null).length}/${s.values.length} valid plotted observations; window ${s.values[0]?.date || "none"}–${s.values.at(-1)?.date || "none"}; latest valid ${lastDate || "none"}${age === null ? "" : `, ${age} days old`}.`;
          })
          .join(" ")}
      </p>
      {table && (
        <div className="table-scroll">
          <table>
            <caption>
              {title} · {unit} · null = unavailable (no interpolation)
            </caption>
            <thead>
              <tr>
                <th>Date / window</th>
                {series.map((s) => (
                  <th key={s.name}>{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {series[0]?.values.map((v, i) => (
                <tr key={v.date}>
                  <th scope="row">{v.date}</th>
                  {series.map((s) => (
                    <td key={s.name}>{fmt(s.values[i]?.value, 3)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
