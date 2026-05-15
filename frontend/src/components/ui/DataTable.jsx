import clsx from "clsx";

/**
 * Lightweight responsive table:
 * - md+ : actual <table>
 * - mobile : stacked card rows
 *
 * Each column = { key, header, render(row), className, cellClassName, headerClassName, mobileLabel }
 */
export function DataTable({ columns, rows, rowKey = (r) => r._id, onRowClick, empty, dense }) {
  if (!rows?.length) {
    return empty || null;
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
      <table className="hidden md:table w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={clsx("text-left font-medium px-4 py-3", c.headerClassName)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={clsx(
                onRowClick && "cursor-pointer hover:bg-slate-50",
                dense ? "[&>td]:py-2" : "[&>td]:py-3"
              )}
            >
              {columns.map((c) => (
                <td key={c.key} className={clsx("px-4 align-middle", c.cellClassName)}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="md:hidden divide-y divide-slate-100">
        {rows.map((r) => (
          <li
            key={rowKey(r)}
            onClick={onRowClick ? () => onRowClick(r) : undefined}
            className={clsx("p-4 flex flex-col gap-2", onRowClick && "active:bg-slate-50")}
          >
            {columns.map((c) => (
              <div key={c.key} className="flex justify-between gap-3 items-start">
                <span className="text-xs uppercase tracking-wide text-slate-500 shrink-0">
                  {c.mobileLabel ?? c.header}
                </span>
                <span className="text-sm text-slate-800 text-right break-words min-w-0">
                  {c.render ? c.render(r) : r[c.key]}
                </span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
