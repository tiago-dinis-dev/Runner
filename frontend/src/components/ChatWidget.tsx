import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { api, type ChatMessage, type PendingAction } from '../api/client';

const MIN_W = 380;
const MIN_H = 480;
const MAX_W = 720;
const MAX_H = Math.round(window.innerHeight * 0.85);
const DEFAULT_W = 420;
const DEFAULT_H = 560;

// ── Simple markdown renderer (bold, headings, newlines) ───────────────────────
function renderMarkdown(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const key = i;
    if (/^### (.+)/.test(line)) {
      return <p key={key} className="font-bold text-purple-400 mt-2">{line.replace(/^### /, '')}</p>;
    }
    if (/^## (.+)/.test(line)) {
      return <p key={key} className="font-bold text-purple-300 text-base mt-3">{line.replace(/^## /, '')}</p>;
    }
    if (/^# (.+)/.test(line)) {
      return <p key={key} className="font-bold text-purple-200 text-lg mt-3">{line.replace(/^# /, '')}</p>;
    }
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
      /^\*\*[^*]+\*\*$/.test(part)
        ? <strong key={j}>{part.slice(2, -2)}</strong>
        : part
    );
    return <p key={key} className={line === '' ? 'mt-2' : 'leading-relaxed'}>{parts}</p>;
  });
}

// ── Thinking dots animation ───────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 px-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-gray-400"
          style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}

// ── Resize handle ─────────────────────────────────────────────────────────────
type ResizeEdge = 'top' | 'left' | 'top-left';

interface ResizeHandleProps {
  edge: ResizeEdge;
  onMouseDown: (e: React.MouseEvent, edge: ResizeEdge) => void;
}

function ResizeHandle({ edge, onMouseDown }: ResizeHandleProps) {
  const base = 'absolute z-10 select-none';
  if (edge === 'top-left') {
    return (
      <div
        className={`${base} top-0 left-0 w-4 h-4 cursor-nw-resize flex items-center justify-center`}
        onMouseDown={(e) => onMouseDown(e, 'top-left')}
      >
        <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 text-gray-600 rotate-0" fill="currentColor">
          <path d="M0 0h4v1H1v3H0V0zm0 0" />
          <path d="M0 0v4h1V1h3V0H0z" />
        </svg>
      </div>
    );
  }
  if (edge === 'top') {
    return (
      <div
        className={`${base} top-0 left-4 right-0 h-1.5 cursor-n-resize hover:bg-purple-500/20 transition-colors rounded-t-2xl`}
        onMouseDown={(e) => onMouseDown(e, 'top')}
      />
    );
  }
  // left
  return (
    <div
      className={`${base} top-4 left-0 bottom-0 w-1.5 cursor-w-resize hover:bg-purple-500/20 transition-colors rounded-bl-2xl`}
      onMouseDown={(e) => onMouseDown(e, 'left')}
    />
  );
}

// ── Confirmation card ─────────────────────────────────────────────────────────
interface ConfirmCardProps {
  action: PendingAction;
  onApply: () => void;
  onCancel: () => void;
  busy: boolean;
}

function ConfirmCard({ action, onApply, onCancel, busy }: ConfirmCardProps) {
  const label = action.type === 'edit_session' ? '✏️ Confirm edit'
    : action.type === 'save_plan' ? '💾 Confirm save'
    : '🗑️ Confirm delete';

  const accentClass = action.type === 'delete_plan'
    ? 'border-red-700 bg-red-950/40'
    : 'border-purple-700 bg-purple-950/40';

  const applyClass = action.type === 'delete_plan'
    ? 'bg-red-600 hover:bg-red-500'
    : 'bg-purple-600 hover:bg-purple-500';

  // Show each · segment on its own line for edit previews
  const detailLines = action.new_details
    ? action.new_details.split(/\s*·\s*/).filter(Boolean)
    : [];

  return (
    <div className={`rounded-xl border p-3 text-sm ${accentClass} flex flex-col gap-2`}>
      <p className="font-semibold text-white">{label}</p>
      {action.type === 'edit_session' && (
        <div className="flex flex-col gap-1">
          <p className="text-slate-400 line-through text-xs">{action.old_title}</p>
          <p className="text-white font-medium">{action.new_title}</p>
          {detailLines.length > 0 && (
            <div className="mt-1 pl-2 border-l border-white/10 flex flex-col gap-0.5">
              {detailLines.map((d, i) => (
                <p key={i} className="text-xs text-slate-300"><span className="opacity-40 mr-1">›</span>{d}</p>
              ))}
            </div>
          )}
        </div>
      )}
      {(action.type === 'save_plan' || action.type === 'delete_plan') && (
        <p className="text-slate-300 text-xs">{action.filename}</p>
      )}
      <div className="flex gap-2 mt-1">
        <button
          onClick={onApply}
          disabled={busy}
          className={`flex-1 rounded-lg px-3 py-1.5 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 ${applyClass}`}
        >
          {busy ? 'Applying…' : 'Apply'}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="flex-1 rounded-lg px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '👋 Hey coach! Ask me about your training, last session, fitness trends, or to build a plan.' },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H });
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ edge: ResizeEdge; startX: number; startY: number; startW: number; startH: number } | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  // ── Resize mouse handlers ─────────────────────────────────────────────────
  const onResizeMouseDown = useCallback((e: React.MouseEvent, edge: ResizeEdge) => {
    e.preventDefault();
    resizeRef.current = { edge, startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h };
  }, [size]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!resizeRef.current) return;
      const { edge, startX, startY, startW, startH } = resizeRef.current;
      const dx = startX - e.clientX; // dragging left → dx positive → width grows
      const dy = startY - e.clientY; // dragging up   → dy positive → height grows
      let newW = startW;
      let newH = startH;
      if (edge === 'left' || edge === 'top-left') {
        newW = Math.min(MAX_W, Math.max(MIN_W, startW + dx));
      }
      if (edge === 'top' || edge === 'top-left') {
        newH = Math.min(MAX_H, Math.max(MIN_H, startH + dy));
      }
      setSize({ w: newW, h: newH });
    }
    function onMouseUp() { resizeRef.current = null; }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  async function sendMessage() {
    const text = input.trim();
    if (!text || thinking) return;

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setError(null);
    setThinking(true);

    try {
      const conversationMessages = newMessages.filter((m) => !(m.role === 'assistant' && m.content.startsWith('👋')));
      const result = await api.chat(conversationMessages);
      setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }]);
      if (result.pendingAction) {
        setPendingAction(result.pendingAction);
      }
      if (result.toolsUsed.includes('save_plan') && !result.pendingAction) {
        window.dispatchEvent(new CustomEvent('plan-saved'));
      }
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setThinking(false);
    }
  }

  async function handleConfirmApply() {
    if (!pendingAction) return;
    setConfirmBusy(true);
    try {
      if (pendingAction.type === 'edit_session' && pendingAction.updated_markdown) {
        await api.applyPlanEdit(pendingAction.filename, pendingAction.updated_markdown);
        setMessages((prev) => [...prev, { role: 'assistant', content: `✅ Done! **${pendingAction.new_title}** updated in *${pendingAction.filename}*.` }]);
        window.dispatchEvent(new CustomEvent('plan-saved'));
      } else if (pendingAction.type === 'save_plan' && pendingAction.content) {
        await api.savePlanDirect(pendingAction.filename, pendingAction.content);
        setMessages((prev) => [...prev, { role: 'assistant', content: `✅ Plan saved as *${pendingAction.filename}*. You can find it in All Plans.` }]);
        window.dispatchEvent(new CustomEvent('plan-saved'));
      } else if (pendingAction.type === 'delete_plan') {
        await api.deletePlan(pendingAction.filename);
        setMessages((prev) => [...prev, { role: 'assistant', content: `🗑️ Plan *${pendingAction.filename}* deleted.` }]);
        window.dispatchEvent(new CustomEvent('plan-saved'));
      }
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ Failed: ${err.message}` }]);
    } finally {
      setConfirmBusy(false);
      setPendingAction(null);
    }
  }

  function handleConfirmCancel() {
    setPendingAction(null);
    setMessages((prev) => [...prev, { role: 'assistant', content: 'No changes made. Let me know if you want to adjust anything!' }]);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-50">
      {/* ── Chat panel ───────────────────────────────────────────────────── */}
      {open && (
        <div
          className="relative bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden"
          style={{ width: size.w, height: size.h, maxWidth: 'calc(100vw - 3rem)', maxHeight: `calc(100vh - 7rem)` }}
        >
          {/* Resize handles */}
          <ResizeHandle edge="top-left" onMouseDown={onResizeMouseDown} />
          <ResizeHandle edge="top" onMouseDown={onResizeMouseDown} />
          <ResizeHandle edge="left" onMouseDown={onResizeMouseDown} />

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="text-sm font-semibold text-white">Running Coach</span>
            </div>
            {/* Size hint */}
            <span className="text-[10px] text-gray-600 select-none mr-auto ml-3">
              drag corners to resize
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-white transition-colors cursor-pointer p-1 rounded"
              aria-label="Close chat"
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white rounded-br-sm'
                      : 'bg-gray-800 text-gray-100 rounded-bl-sm'
                  }`}
                >
                  {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                </div>
              </div>
            ))}

            {pendingAction && !thinking && (
              <div className="flex justify-start w-full">
                <div className="max-w-[85%] w-full">
                  <ConfirmCard
                    action={pendingAction}
                    onApply={handleConfirmApply}
                    onCancel={handleConfirmCancel}
                    busy={confirmBusy}
                  />
                </div>
              </div>
            )}

            {thinking && (
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-3.5 py-3">
                  <ThinkingDots />
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-red-400 bg-red-950/50 border border-red-800/50 rounded-xl px-3 py-2">
                ⚠️ {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-gray-800 px-3 py-3 flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your training…"
              rows={1}
              disabled={thinking}
              className="flex-1 bg-gray-800 text-white text-sm placeholder-gray-500 rounded-xl px-3 py-2.5 resize-none outline-none border border-gray-700 focus:border-purple-500 transition-colors disabled:opacity-50"
              style={{ maxHeight: '100px', overflowY: 'auto' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || thinking}
              className="w-9 h-9 shrink-0 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center cursor-pointer"
              aria-label="Send message"
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── FAB button ────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 rounded-full bg-purple-600 hover:bg-purple-500 transition-colors duration-200 shadow-lg shadow-purple-900/40 flex items-center justify-center cursor-pointer"
        aria-label={open ? 'Close coach chat' : 'Open coach chat'}
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="white" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" aria-hidden="true">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" fill="white" opacity="0.15" />
            <circle cx="9" cy="12" r="1.5" fill="white" />
            <circle cx="12" cy="12" r="1.5" fill="white" />
            <circle cx="15" cy="12" r="1.5" fill="white" />
          </svg>
        )}
      </button>
    </div>
  );
}
