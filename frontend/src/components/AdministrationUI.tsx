import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { csvCell, number } from '../lib/domain';
import { Donut } from './ui';

export const colors = ['#138c4e', '#4380e4', '#efa924', '#9770d1', '#9fb0bc'];
type Metric = { label: string; value: ReactNode; note: string; icon: LucideIcon; tone?: string };

export function AdminHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <header className="admin-heading"><div><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

export function Metrics({ items }: { items: Metric[] }) {
  return <div className="admin-metrics">{items.map(({ label, value, note, icon: Icon, tone = 'green' }) =>
    <article className="module-kpi" key={label}>
      <span className={`module-kpi-icon ${tone}`}><Icon size={23} /></span>
      <div><small>{label}</small><strong>{value}</strong><span>{note}</span></div>
    </article>
  )}</div>;
}

export function AdminTabs({ tabs, value, onSelect, children }: {
  tabs: { label: string; icon: LucideIcon }[]; value: string; onSelect: (value: string) => void; children?: ReactNode;
}) {
  return <div className="admin-toolbar"><div className="admin-tabs" role="group" aria-label="Secciones">
    {tabs.map(({ label, icon: Icon }) => <button type="button" key={label} aria-pressed={label === value} onClick={() => onSelect(label)}><Icon size={16} />{label}</button>)}
  </div>{children}</div>;
}

export function AdminTable({ headers, rows }: { headers: string[]; rows: { key: string | number; cells: ReactNode[] }[] }) {
  return <div className="table-wrap"><table className="admin-table" role="table"><thead role="rowgroup"><tr role="row">
    {headers.map(header => <th key={header} scope="col">{header}</th>)}
  </tr></thead><tbody role="rowgroup">
    {rows.map(row => <tr role="row" key={row.key}>{row.cells.map((cell, index) => index === 0
      ? <th scope="row" key={headers[index]}>{cell}</th>
      : <td role="cell" data-label={headers[index]} key={headers[index]}>{cell}</td>)}</tr>)}
  </tbody></table></div>;
}

export function downloadCsv(fileName: string, rows: unknown[][]) {
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ChartBars({ title, groups, labels }: { title: string; groups: { name: string; values: number[] }[]; labels: { name: string; color: string }[] }) {
  const max = Math.max(1, ...groups.flatMap(group => group.values));
  return <div className="admin-chart" role="img" aria-label={`${title}. ${groups.map(group =>
    `${group.name}, ${group.values.map((value, index) => `${labels[index].name} ${number(value, 2)}`).join(', ')}`).join('. ')}`}>
    <div className="admin-chart-key" aria-hidden="true">{labels.map(label => <span key={label.name}><i style={{ background: label.color }} />{label.name}</span>)}</div>
    <div className="admin-bar-chart" aria-hidden="true">{groups.map(group =>
      <div className="admin-bar-group" key={group.name}>
        <div>{group.values.map((value, index) => <span key={labels[index].name}
          style={{ height: `${value / max * 91}%`, background: labels[index].color }}
          title={`${labels[index].name} · ${group.name} · ${number(value, 2)}`} />)}</div>
        <small>{group.name}</small>
      </div>
    )}</div>
  </div>;
}

export function Breakdown({ value, label, entries, suffix = '' }: {
  value: string; label: string; entries: { name: string; value: number }[]; suffix?: string;
}) {
  const values = entries.map(entry => entry.value);
  const total = values.reduce((sum, item) => sum + item, 0);
  return <div className="admin-breakdown">
    <Donut value={value} label={label} segments={total ? values : [1]} colors={total ? colors : ['#e0e8e4']} />
    <ul>{entries.map((entry, index) => <li key={entry.name}><i style={{ background: colors[index % colors.length] }} />{entry.name}<strong>{number(entry.value)}{suffix}</strong></li>)}</ul>
  </div>;
}
