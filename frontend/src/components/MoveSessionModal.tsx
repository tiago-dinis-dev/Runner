import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { PlanSession } from './Calendar';

interface Props {
  session: PlanSession | null;
  planFilename: string | null;
  onClose: () => void;
  onMoved: () => void;
}

export default function MoveSessionModal({ session, planFilename, onClose, onMoved }: Props) {
  const [toDate, setToDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill with session's current date, reset on open
  useEffect(() => {
    if (session) { setToDate(session.date); setError(null); }
  }, [session]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!session || !planFilename) return null;

  async function handleMove() {
    if (!toDate || toDate === session!.date) { onClose(); return; }
    setSaving(true);
    setError(null);
    try {
      await api.movePlanSession(planFilename!, session!.date, session!.label, toDate);
      onMoved();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const TYPE_COLORS: Record<string, string> = {
    Run: 'bg-blue-500',
    Hyrox: 'bg-orange-500',
    Gym: 'bg-slate-500',
    Erg: 'bg-cyan-500',
    Race: 'bg-yellow-500',
  };
  const TYPE_ICONS: Record<string, string> = {
    Run: '🏃', Hyrox: '🏋️', Gym: '💪', Erg: '🚣', Race: '🏆',
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
        <div
          className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ animation: 'fadeUp 0.18s ease-out' }}
          onClick={(e) => e.stopPropagation()}
        >
          <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <p className="text-white font-semibold text-sm">Move Session</p>
            <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer p-1 rounded transition-colors" aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 flex flex-col gap-4">
            {/* Session info */}
            <div className="flex items-center gap-3 bg-slate-800/60 rounded-xl px-3 py-2.5">
              <div className={`${TYPE_COLORS[session.type] ?? 'bg-gray-500'} w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0`}>
                {TYPE_ICONS[session.type] ?? '🏅'}
              </div>
              <div>
                <p className="text-white text-sm font-medium">{session.label}</p>
                <p className="text-slate-400 text-xs">
                  Currently: {new Date(session.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
              </div>
            </div>

            {/* Date picker */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 uppercase tracking-wide">Move to date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="bg-slate-800 border border-slate-700 focus:border-purple-500 text-white text-sm rounded-xl px-3 py-2.5 outline-none transition-colors cursor-pointer"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">
                ⚠️ {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 px-5 pb-4">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-xl text-sm text-slate-400 hover:text-white border border-white/10 hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleMove}
              disabled={!toDate || saving}
              className="flex-1 py-2 rounded-xl text-sm text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer font-medium"
            >
              {saving ? 'Moving…' : 'Move session'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
