'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { callRpc } from '@/lib/rpc';
import { readPosition } from '@/lib/geo';
import type { Attendance, Site } from '@/lib/types';

type Phase = 'idle' | 'locating' | 'submitting';

export function CheckInOut({
  sites,
  employeeId,
  today,
}: {
  sites: Site[];
  employeeId: string;
  today: Attendance | null;
}) {
  const t = useTranslations('attendance');
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [siteId, setSiteId] = useState(today?.site_id ?? sites[0]?.id ?? '');
  const [phase, setPhase] = useState<Phase>('idle');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const checkedIn = Boolean(today?.check_in_at);
  const checkedOut = Boolean(today?.check_out_at);

  async function uploadSelfie(): Promise<string> {
    const file = fileRef.current?.files?.[0];
    if (!file) throw new Error('selfie');
    const supabase = createClient();
    const path = `${employeeId}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('attendance-photos').upload(path, file, {
      upsert: true,
      contentType: file.type || 'image/jpeg',
    });
    if (error) throw error;
    const { data } = supabase.storage.from('attendance-photos').getPublicUrl(path);
    return data.publicUrl;
  }

  async function doCheckIn() {
    try {
      if (!fileRef.current?.files?.[0]) {
        setMsg({ text: t('selfieRequired'), ok: false });
        return;
      }
      setPhase('locating');
      const pos = await readPosition().catch(() => null);
      setPhase('submitting');
      const photoUrl = await uploadSelfie();
      const supabase = createClient();
      const { error } = await callRpc(supabase, 'attendance_check_in', {
        p_site_id: siteId,
        p_lat: pos?.lat ?? null,
        p_lng: pos?.lng ?? null,
        p_photo_url: photoUrl,
        p_accuracy: pos?.accuracy ?? null,
        p_mock_location: false,
      });
      if (error) throw error;
      setMsg({ text: t('success'), ok: true });
      router.refresh();
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    } finally {
      setPhase('idle');
    }
  }

  async function doCheckOut() {
    try {
      setPhase('locating');
      const pos = await readPosition().catch(() => null);
      setPhase('submitting');
      const supabase = createClient();
      const { error } = await callRpc(supabase, 'attendance_check_out', {
        p_lat: pos?.lat ?? null,
        p_lng: pos?.lng ?? null,
        p_photo_url: null,
      });
      if (error) throw error;
      setMsg({ text: t('success'), ok: true });
      router.refresh();
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    } finally {
      setPhase('idle');
    }
  }

  const busy = phase !== 'idle';
  const phaseLabel = phase === 'locating' ? t('gettingLocation') : t('submit');

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 p-4 text-center">
        <p className="text-lg font-bold">
          {checkedOut ? t('checkOutTime') : checkedIn ? t('checkedIn') : t('notCheckedIn')}
        </p>
        {today?.check_in_at ? (
          <p className="text-sm text-slate-500">
            {t('checkInTime')}: {new Date(today.check_in_at).toLocaleTimeString('ar-SA')}
          </p>
        ) : null}
        {today?.check_out_at ? (
          <p className="text-sm text-slate-500">
            {t('checkOutTime')}: {new Date(today.check_out_at).toLocaleTimeString('ar-SA')}
          </p>
        ) : null}
      </div>

      {!checkedIn && (
        <>
          <div>
            <label className="label">{t('selectSite')}</label>
            <select className="field" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('takeSelfie')}</label>
            <input ref={fileRef} type="file" accept="image/*" capture="user" className="field" />
          </div>
          <button onClick={doCheckIn} disabled={busy || !siteId} className="btn-success w-full">
            {busy ? phaseLabel : `✅ ${t('checkIn')}`}
          </button>
        </>
      )}

      {checkedIn && !checkedOut && (
        <button onClick={doCheckOut} disabled={busy} className="btn-danger w-full">
          {busy ? phaseLabel : `❌ ${t('checkOut')}`}
        </button>
      )}

      {msg ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {msg.text}
        </p>
      ) : null}

      <p className="text-xs leading-relaxed text-slate-400">{t('limitation')}</p>
    </div>
  );
}
