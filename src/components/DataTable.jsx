/**
 * Generic table.
 * columns: [{ key, header, render?(row), align?: 'num' }]
 * dense: tighter padding and wrapping sub-lines, for wide tables
 */
export default function DataTable({ columns, rows, rowKey = 'id', emptyText = 'Nothing to show for the selected filters.', limit, dense = false }) {
  const shown = limit ? rows.slice(0, limit) : rows
  return (
    <div className={`table-wrap ${dense ? 'dense' : ''}`}>
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align || ''}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={r[rowKey] ?? i}>
              {columns.map((c) => (
                <td key={c.key} className={c.align || ''}>{c.render ? c.render(r) : r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="empty sm">{emptyText}</div>}
      {limit && rows.length > limit && (
        <div className="table-more">Showing {limit} of {rows.length}</div>
      )}
    </div>
  )
}
