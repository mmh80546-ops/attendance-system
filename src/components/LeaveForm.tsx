'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { callRpc } from '@/lib/rpc';
import type { LeaveType } from '@/lib/types';

const types: LeaveType[] = ['annual', 'sick', 'emergency', 'unpaid', 'other'];

export function LeaveForm() {
  const t = useTranslations('leave');
  const router = useRouter();
  const [type, setType] = useState<LeaveType>('annual');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await callRpc(supabase, 'submit_leave', {
      p_leave_type: type,
      p_start: start,
      p_end: end,
      p_reason: reason,
    });
    setBusy(false);
    if (error) setMsg({ text: error.message, ok: false });
    else {
      setMsg({ text: t('submit'), ok: true });
      setReason('');
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label">{t('type')}</label>
        <select className="field" value={type} onChange={(e) => setType(e.target.value as LeaveType)}>
          {types.map((ty) => (
            <option key={ty} value={ty}>
              {t(ty)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t('from')}</label>
          <input type="date" className="field" value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>
        <div>
          <label className="label">{t('to')}</label>
          <input type="date" className="field" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className="label">{t('reason')}</label>
        <textarea className="field" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {msg ? (
        <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </p>
      ) : null}
      <button className="btn-primary w-full" disabled={busy}>
        {t('submit')}
      </button>
    </form>
  );
}
