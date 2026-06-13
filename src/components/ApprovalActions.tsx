'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { callRpc } from '@/lib/rpc';

type Kind = 'attendance' | 'leave';
type Level = 'supervisor' | 'hr';

export function ApprovalActions({ id, kind, level }: { id: string; kind: Kind; level: Level }) {
  const t = useTranslations('approval');
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(decision: 'approved' | 'rejected') {
    let reason: string | null = null;
    if (decision === 'rejected') {
      reason = window.prompt(t('rejectReason')) ?? null;
      if (reason === null) return;
    }
    setBusy(true);
    const supabase = createClient();
    let error: { message: string } | null = null;
    if (kind === 'attendance' && level === 'supervisor') {
      ({ error } = await callRpc(supabase, 'decide_attendance', { p_id: id, p_decision: decision, p_reason: reason }));
    } else if (kind === 'attendance' && level === 'hr') {
      ({ error } = await callRpc(supabase, 'hr_review_attendance', {
        p_id: id,
        p_status: decision === 'approved' ? 'reviewed' : 'flagged',
      }));
    } else if (kind === 'leave' && level === 'supervisor') {
      ({ error } = await callRpc(supabase, 'supervisor_decide_leave', { p_id: id, p_decision: decision, p_reason: reason }));
    } else {
      ({ error } = await callRpc(supabase, 'hr_decide_leave', { p_id: id, p_decision: decision, p_reason: reason }));
    }
    setBusy(false);
    if (error) window.alert(error.message);
    else router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button onClick={() => act('approved')} disabled={busy} className="btn-success px-3 py-1.5 text-sm">
        {t('approve')}
      </button>
      <button onClick={() => act('rejected')} disabled={busy} className="btn-danger px-3 py-1.5 text-sm">
        {t('reject')}
      </button>
    </div>
  );
}
