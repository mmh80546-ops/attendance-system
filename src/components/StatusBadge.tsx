import { useTranslations } from 'next-intl';

const styles: Record<string, string> = {
  present: 'bg-emerald-100 text-emerald-700',
  late: 'bg-amber-100 text-amber-700',
  absent: 'bg-red-100 text-red-700',
  incomplete: 'bg-slate-100 text-slate-600',
  approved: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
  reviewed: 'bg-emerald-100 text-emerald-700',
  flagged: 'bg-red-100 text-red-700',
};

export function StatusBadge({ value, ns }: { value: string; ns: 'attendance' | 'approval' }) {
  const t = useTranslations(ns);
  return <span className={`badge ${styles[value] ?? 'bg-slate-100 text-slate-600'}`}>{t(value)}</span>;
}

export function TamperBadges({ flags }: { flags: Record<string, boolean> }) {
  const active = Object.entries(flags || {}).filter(([, v]) => v);
  if (active.length === 0) return null;
  const labels: Record<string, string> = {
    outside_geofence: 'خارج النطاق',
    mock_location: 'موقع مزيّف',
    gps_off: 'GPS مغلق',
    low_accuracy: 'دقة منخفضة',
  };
  return (
    <span className="flex flex-wrap gap-1">
      {active.map(([k]) => (
        <span key={k} className="badge bg-red-100 text-red-700">
          ⚠ {labels[k] ?? k}
        </span>
      ))}
    </span>
  );
}
