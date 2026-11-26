import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, X, Sprout, AlertCircle, LoaderCircle } from 'lucide-react';

export function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="brand"><span className="brand-mark"><Sprout size={36} strokeWidth={1.7} /></span>{!compact && <div><strong>Agro<span>Vision</span></strong><small>Cultivos con futuro</small></div>}</div>;
}

export function Panel({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  const semanticClass = title === 'Seguimiento y avisos' ? 'panel-alerts-legacy' : title === 'Agua, infraestructura y mantenimiento' ? 'panel-water-summary' : '';
  return <section className={`panel ${semanticClass} ${className}`}>{title && <div className="panel-heading"><h3>{title}</h3>{action}</div>}{children}</section>;
}

export function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button className="text-button" onClick={onClick}>{children}<ArrowRight size={14} /></button>;
}

export function Badge({ children, tone = 'green' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Empty({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty"><span className="icon-tile green"><Sprout size={26} /></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="notice"><AlertCircle size={17} /><span>{children}</span></div>;
}

export function Loading() { return <div className="loading" role="status"><LoaderCircle className="spin" />Cargando tu finca…</div>; }

export function Modal({ title, children, onClose, wide = false, className = '' }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; className?: string }) {
  const dialog = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    const overflow = document.body.style.overflow;
    root?.setAttribute('inert', '');
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') close.current();
      if (event.key !== 'Tab') return;
      const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') ?? []);
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', keyboard);
    return () => { root?.removeAttribute('inert'); document.body.style.overflow = overflow; document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, []);
  return createPortal(<div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`modal ${wide ? 'modal-wide' : ''} ${className}`} role="dialog" aria-modal="true" aria-label={title} ref={dialog}>
      <header><h2>{title}</h2><button className="icon-button" aria-label="Cerrar" onClick={onClose}><X size={20} /></button></header>{children}
    </section>
  </div>, document.body);
}

export function Donut({ value, label, segments = [72, 18, 8, 2], colors = ['#65b55a', '#f5cb47', '#fa9648', '#ef615b'] }: { value: string; label: string; segments?: number[]; colors?: string[] }) {
  let offset = 0;
  const sum = segments.reduce((total, part) => total + part, 0) || 1;
  const gradient = segments.map((part, index) => { const start = offset; offset += part / sum * 100; return `${colors[index % colors.length]} ${start}% ${offset}%`; }).join(',');
  return <div className="donut" style={{ '--donut': `conic-gradient(${gradient})` } as CSSProperties}><div><strong>{value}</strong><small>{label}</small></div></div>;
}

export function LineChart({ variant = 'health', labels = ['May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct'] }: { variant?: 'health' | 'moisture' | 'nutrient'; labels?: string[] }) {
  const values = variant === 'health' ? [42, 59, 51, 67, 76, 86] : variant === 'nutrient' ? [20, 42, 36, 60, 73, 87] : [68, 78, 74, 76, 69, 72];
  const points = values.map((value, index) => `${42 + index * 64},${155 - value * 1.35}`).join(' ');
  const color = variant === 'moisture' ? '#4f87f6' : '#58a550';
  const id = `fill-${variant}`;
  return <svg className="line-chart" viewBox="0 0 395 195" role="img" aria-label={variant === 'health' ? 'Evolución ilustrativa de la salud del cultivo' : 'Tendencia ilustrativa'}>
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.18" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
    {[0, 25, 50, 75, 100].map(value => <g key={value}><line x1="42" y1={155 - value * 1.35} x2="365" y2={155 - value * 1.35} stroke="#edf0ed" /><text x="29" y={159 - value * 1.35} textAnchor="end">{value}</text></g>)}
    {labels.map((label, index) => <g key={label}><line x1={42 + index * 64} y1="20" x2={42 + index * 64} y2="155" stroke="#f0f3f0" /><text x={42 + index * 64} y="181" textAnchor="middle">{label}</text></g>)}
    <polygon points={`42,155 ${points} 362,155`} fill={`url(#${id})`} /><polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
    {values.map((value, index) => <circle key={index} cx={42 + index * 64} cy={155 - value * 1.35} r="4" fill={color} />)}
    {variant === 'moisture' && <polyline points="42,122 106,111 170,118 234,124 298,135 362,129" fill="none" stroke="#f5a34a" strokeWidth="2.5" />}
  </svg>;
}
