// Date helpers working on local 'YYYY-MM-DD' strings (they compare correctly as strings).

export const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const parseISO = (s) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayISO = () => toISO(new Date())

export const addDays = (iso, n) => {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export const diffDays = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000)

export const isValidISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(parseISO(s).getTime())

export const RANGE_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'fy', label: 'This financial year' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom range' },
]

export function resolveDateRange(range, from, to) {
  const t = todayISO()
  switch (range) {
    case 'today': return { from: t, to: t }
    case '7d': return { from: addDays(t, -6), to: t }
    case '90d': return { from: addDays(t, -89), to: t }
    // Data sources clip this to the earliest project start
    case 'all': return { from: '2000-01-01', to: t }
    case 'fy': {
      const now = new Date()
      const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
      return { from: `${y}-04-01`, to: t }
    }
    case 'custom':
      if (isValidISO(from) && isValidISO(to) && from <= to) return { from, to }
      return { from: addDays(t, -29), to: t }
    default: return { from: addDays(t, -29), to: t }
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const shortDate = (iso) => {
  const d = parseISO(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

// Split a range into chart buckets: days (≤14d), weeks (≤92d) or months.
export function makeBuckets(from, to) {
  const days = diffDays(from, to) + 1
  const out = []
  if (days <= 14) {
    for (let d = from; d <= to; d = addDays(d, 1)) out.push({ start: d, end: d, label: shortDate(d) })
  } else if (days <= 92) {
    for (let d = from; d <= to; d = addDays(d, 7)) {
      const end = addDays(d, 6) < to ? addDays(d, 6) : to
      out.push({ start: d, end, label: shortDate(d) })
    }
  } else {
    const multiYear = from.slice(0, 4) !== to.slice(0, 4)
    let cur = parseISO(from)
    cur.setDate(1)
    while (toISO(cur) <= to) {
      const monthStart = toISO(cur)
      const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
      const monthEnd = addDays(toISO(next), -1)
      out.push({
        start: monthStart < from ? from : monthStart,
        end: monthEnd > to ? to : monthEnd,
        label: MONTHS[cur.getMonth()] + (multiYear ? ` ${String(cur.getFullYear()).slice(2)}` : ''),
      })
      cur = next
    }
  }
  return out
}

export const bucketOf = (buckets, iso) => {
  const d = iso.slice(0, 10)
  return buckets.findIndex((b) => d >= b.start && d <= b.end)
}
