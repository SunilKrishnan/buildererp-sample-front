// Lightweight SVG charts, no chart library needed.

function niceMax(v) {
  if (!(v > 0)) return 1
  const step = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / step
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * step
}

function Legend({ labels, colors }) {
  return (
    <div className="legend" style={{ marginBottom: 10 }}>
      {labels.map((l, i) => (
        <span key={l}><i style={{ background: colors[i] }} />{l}</span>
      ))}
    </div>
  )
}

function ChartEmpty({ text }) {
  return <div className="empty sm">{text || 'No data for the selected filters.'}</div>
}

const id = (v) => v

export function BarChart({ data, xKey = 'm', keys, labels, colors, height = 240, unit = '', format = id, emptyText }) {
  const max = niceMax(Math.max(0, ...data.flatMap((d) => keys.map((k) => d[k]))))
  if (!data.length || data.every((d) => keys.every((k) => !d[k]))) return <ChartEmpty text={emptyText} />

  const W = 640, H = height, pad = { t: 10, r: 8, b: 28, l: 52 }
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)
  const group = iw / data.length
  const barW = Math.max(3, Math.min(16, (group * 0.7) / keys.length - 2))
  const labelEvery = Math.ceil(data.length / 12)

  return (
    <>
      <Legend labels={labels} colors={colors} />
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
        {ticks.map((t) => {
          const y = pad.t + ih - (t / max) * ih
          return (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="var(--chart-grid)" />
              <text x={pad.l - 8} y={y + 4} textAnchor="end">{format(t)}</text>
            </g>
          )
        })}
        {data.map((d, i) => {
          const cx = pad.l + group * i + group / 2
          const totalW = barW * keys.length + 2 * (keys.length - 1)
          return (
            <g key={`${d[xKey]}-${i}`}>
              {keys.map((k, j) => {
                const h = (d[k] / max) * ih
                return (
                  <rect key={k} x={cx - totalW / 2 + j * (barW + 2)} y={pad.t + ih - h} width={barW} height={h} rx="2" fill={colors[j]}>
                    <title>{`${d.label || d[xKey]} · ${labels[j]}: ${format(d[k])}${unit}`}</title>
                  </rect>
                )
              })}
              {i % labelEvery === 0 && <text x={cx} y={H - 8} textAnchor="middle">{d[xKey]}</text>}
            </g>
          )
        })}
      </svg>
    </>
  )
}

export function LineChart({ data, xKey = 'x', keys, labels, colors, height = 240, format = id, emptyText }) {
  if (!data.length) return <ChartEmpty text={emptyText} />
  const W = 640, H = height, pad = { t: 10, r: 12, b: 28, l: 44 }
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b
  const max = niceMax(Math.max(0, ...data.flatMap((d) => keys.map((k) => d[k]))))
  const x = (i) => pad.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw)
  const y = (v) => pad.t + ih - (v / max) * ih
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)
  const labelEvery = Math.ceil(data.length / 8)

  return (
    <>
      <Legend labels={labels} colors={colors} />
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end">{format(t)}</text>
          </g>
        ))}
        {keys.map((k, j) => {
          const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' ')
          return (
            <g key={k}>
              {j === 0 && (
                <polygon points={`${x(0)},${y(0)} ${pts} ${x(data.length - 1)},${y(0)}`} fill={colors[j]} opacity="0.1" />
              )}
              <polyline points={pts} fill="none" stroke={colors[j]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {data.length <= 31 && data.map((d, i) => (
                <circle key={i} cx={x(i)} cy={y(d[k])} r="3" fill={colors[j]}>
                  <title>{`${d[xKey]} · ${labels[j]}: ${format(d[k])}`}</title>
                </circle>
              ))}
            </g>
          )
        })}
        {data.map((d, i) =>
          i % labelEvery === 0 ? <text key={i} x={x(i)} y={H - 8} textAnchor="middle">{d[xKey]}</text> : null
        )}
      </svg>
    </>
  )
}

export function Donut({ data, colors, size = 160, centerLabel, centerValue, format = (v) => `${v}%`, emptyText }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) return <ChartEmpty text={emptyText} />
  const r = 60, c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--chart-grid)" strokeWidth="18" />
        {data.map((d, i) => {
          const len = (d.value / total) * c
          const el = (
            <circle
              key={d.label} cx="80" cy="80" r={r} fill="none" stroke={colors[i]} strokeWidth="18"
              strokeDasharray={`${Math.max(0, len - 2)} ${c - len + 2}`} strokeDashoffset={-offset}
              transform="rotate(-90 80 80)"
            >
              <title>{`${d.label}: ${format(d.value)}`}</title>
            </circle>
          )
          offset += len
          return el
        })}
        <text x="80" y="76" textAnchor="middle" style={{ fill: 'var(--muted)', fontSize: 11 }}>{centerLabel}</text>
        <text x="80" y="96" textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 17, fontWeight: 700 }}>{centerValue}</text>
      </svg>
      <div className="donut-legend">
        {data.map((d, i) => (
          <div key={d.label}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: colors[i], display: 'inline-block' }} />
            {d.label}
            <b>{format(d.value)}</b>
          </div>
        ))}
      </div>
    </div>
  )
}

// Horizontal bars: rows of { label, value, sub? }
export function HBarList({ rows, max, format = id, tone, emptyText }) {
  if (!rows.length) return <ChartEmpty text={emptyText} />
  const top = max ?? Math.max(...rows.map((r) => r.value), 1)
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbar" key={r.label}>
          <div className="hbar-label" title={r.label}>{r.label}</div>
          <div className={`progress ${typeof tone === 'function' ? tone(r) : tone || ''}`}>
            <span style={{ width: `${Math.min(100, (r.value / top) * 100)}%` }} />
          </div>
          <div className="hbar-value">{format(r.value)}</div>
        </div>
      ))}
    </div>
  )
}
