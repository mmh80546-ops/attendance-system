'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { toCsv, downloadCsv } from '@/lib/csv';

interface Row {
  id: string;
  work_date: string;
  status: string;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_geofence_pass: boolean | null;
  employees?: { employee_code?: string; full_name_ar?: string; full_name_en?: string };
  sites?: { name?: string };
}

const headers = [
  'employee_code',
  'employee_name',
  'work_date',
  'check_in',
  'check_out',
  'status',
  'geofence_pass',
  'site',
];

export function ReportsClient({ userId }: { userId: string }) {
  const t = useTranslations('reports');
  const today = new Date().toLocaleDateString('en-CA');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('attendance')
      .select('*, employees(employee_code, full_name_ar, full_name_en), sites(name)')
      .gte('work_date', from)
      .lte('work_date', to)
      .order('work_date', { ascending: false });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }

  function mapped() {
    return rows.map((r) => ({
      employee_code: r.employees?.employee_code ?? '',
      employee_name: r.employees?.full_name_ar ?? '',
      work_date: r.work_date,
      check_in: r.check_in_at ? new Date(r.check_in_at).toISOString() : '',
      check_out: r.check_out_at ? new Date(r.check_out_at).toISOString() : '',
      status: r.status,
      geofence_pass: r.check_in_geofence_pass === null ? '' : r.check_in_geofence_pass ? 'yes' : 'no',
      site: r.sites?.name ?? '',
    }));
  }

  async function exportCsv() {
    const csv = toCsv(mapped(), headers);
    downloadCsv(`attendance_${from}_${to}.csv`, csv);
    const supabase = createClient();
    await supabase.from('audit_log').insert({
      actor_id: userId,
      action: 'export_attendance',
      entity: 'attendance',
      after: { from, to, count: rows.length },
    } as never);
  }

  return (
    <div className="card">
      <h1 className="mb-4 text-lg font-bold">{t('daily')} / {t('monthly')}</h1>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">{t('from')}</label>
          <input type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('to')}</label>
          <input type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button onClick={load} className="btn-primary" disabled={loading}>
          {t('filter')}
        </button>
        <button onClick={exportCsv} className="btn-ghost" disabled={rows.length === 0}>
          {t('export')}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-right text-slate-500">
              {headers.map((h) => (
                <th key={h} className="p-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mapped().map((r, i) => (
              <tr key={rows[i].id} className="border-b last:border-0">
                {headers.map((h) => (
                  <td key={h} className="p-2">{(r as Record<string, string>)[h]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
