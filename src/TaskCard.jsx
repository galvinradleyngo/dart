import React, { useState, useEffect, useRef, useContext } from 'react';
import { useIsMobile } from './hooks/use-is-mobile.js';
import { motion, useAnimation } from 'framer-motion';
import InlineText from './components/InlineText.jsx';
import Avatar from './components/Avatar.jsx';
import DuePill from './components/DuePill.jsx';
import { LinkChips } from './components/LinksEditor.jsx';
import DocumentInput from './components/DocumentInput.jsx';
import DepPicker from './components/DepPicker.jsx';
import LinkReminderModal from './components/LinkReminderModal.jsx';
import { SoundContext } from './sound-context.js';

export default function TaskCard({ task: t, team = [], milestones = [], tasks = [], onUpdate, onDelete, onDuplicate, onAddLink, onRemoveLink, dragHandlers = {} }) {
  const [collapsed, setCollapsed] = useState(true);
  const isMobile = useIsMobile();
  const dragProps = isMobile ? {} : dragHandlers;
  const statusList = ['todo', 'inprogress', 'done'];
  const statusLabel = { todo: 'To Do', inprogress: 'In Progress', done: 'Done' };
  const soundEnabled = useContext(SoundContext);
  const audioCtxRef = useRef(null);
  const controls = useAnimation();
  const statusColors = { todo: '#ffffff', inprogress: '#ecfdf5', done: '#d1fae5' };
  useEffect(() => { controls.set({ backgroundColor: statusColors[t.status], scale: 1 }); }, []);
  useEffect(() => {
    controls.start({
      backgroundColor: statusColors[t.status],
      scale: [1.02, 1],
      transition: { duration: 0.2 }
    });
  }, [t.status, controls]);
  const playSound = () => {
    if (!soundEnabled) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = audioCtxRef.current || new Ctx();
      audioCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 440;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.2);
      osc.stop(ctx.currentTime + 0.2);
    } catch {}
  };
  const update = (id, patch) => {
    onUpdate?.(id, patch);
    playSound();
  };
  const [statusOpen, setStatusOpen] = useState(false);
  const [linkModal, setLinkModal] = useState(false);
  const a = team.find((m) => m.id === t.assigneeId);
  const statusPillClass = (status) => {
    if (status === 'done') return 'bg-emerald-200/80 text-emerald-900 border-emerald-300';
    if (status === 'inprogress') return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    return 'bg-slate-100 text-slate-700 border-slate-300';
  };
  const handleStatusChange = (value) => {
    if (value === 'done' && (!t.links || t.links.length === 0)) {
      setCollapsed(false);
      setLinkModal(true);
      return;
    }
    update(t.id, { status: value });
  };

  return (
    <motion.div
      data-testid="task-card"
      {...dragProps}
      className={`w-full max-w-full break-words rounded-lg border border-black/10 p-2 sm:p-3 shadow-sm text-sm sm:text-[14px] ${dragProps.draggable ? 'cursor-move' : ''}`}
      animate={controls}
      whileTap={{ scale: 0.98 }}
      style={isMobile ? { touchAction: 'pan-y' } : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <select
            aria-label="Milestone"
            value={t.milestoneId}
            onChange={(e) => update(t.id, { milestoneId: e.target.value })}
            className="mb-1 text-sm border rounded px-1 py-0.5"
          >
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
          <div className="text-sm sm:text-[14px] font-semibold leading-tight truncate">
            <InlineText value={t.title} onChange={(v) => update(t.id, { title: v })} />
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-black/10 bg-slate-100 text-slate-600 hover:bg-slate-200"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '+' : '-'}
          </button>
          {onDuplicate && (
            <button
              onClick={() => onDuplicate(t.id)}
              className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-black/10 bg-slate-100 text-slate-600 hover:bg-slate-200"
              title="Duplicate"
              aria-label="Duplicate"
            >
              ⧉
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(t.id)}
              className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-black/10 bg-slate-100 text-slate-600 hover:bg-slate-200"
              title="Delete"
              aria-label="Delete"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
      {collapsed ? (
        <>
          <div className="mt-1">
            {isMobile ? (
              statusOpen ? (
                <select
                  aria-label="Status"
                  value={t.status}
                  onChange={(e) => {
                    handleStatusChange(e.target.value);
                    setStatusOpen(false);
                  }}
                  onBlur={() => setStatusOpen(false)}
                  className={`px-2 py-1 rounded-full border font-semibold text-sm ${statusPillClass(t.status)}`}
                  autoFocus
                >
                  <option value="todo">To Do</option>
                  <option value="inprogress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              ) : (
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={statusOpen}
                  aria-label={`Status: ${statusLabel[t.status]}`}
                  onClick={() => setStatusOpen((v) => !v)}
                  className={`px-2 py-1 rounded-full border font-semibold text-sm ${statusPillClass(t.status)}`}
                >
                  {statusLabel[t.status]}
                </button>
              )
            ) : (
              <select
                aria-label="Status"
                value={t.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className={`px-2 py-1 rounded-full border font-semibold text-sm ${statusPillClass(t.status)}`}
              >
                <option value="todo">To Do</option>
                <option value="inprogress">In Progress</option>
                <option value="done">Done</option>
              </select>
            )}
          </div>
          <div className="text-sm text-black/60 mt-1 truncate">
            <InlineText value={t.details} onChange={(v) => update(t.id, { details: v })} placeholder="Details…" />
          </div>
          {t.note && <div className="text-sm text-slate-600 mt-1 truncate">📝 {t.note}</div>}
          <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              {a ? (
                <Avatar name={a.name} roleType={a.roleType} avatar={a.avatar} />
              ) : (
                <span className="text-black/40">—</span>
              )}
              <select
                aria-label="Assignee"
                value={t.assigneeId || ''}
                onChange={(e) => update(t.id, { assigneeId: e.target.value || null })}
                className="border rounded px-1.5 py-1"
              >
                <option value="">Unassigned</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.roleType})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <DuePill date={t.dueDate} status={t.status} />
              {t.status === 'done' && (
                <span className="text-slate-500">Completed: {t.completedDate || '—'}</span>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mt-1">
            {isMobile ? (
              statusOpen ? (
                <select
                  aria-label="Status"
                  value={t.status}
                  onChange={(e) => {
                    handleStatusChange(e.target.value);
                    setStatusOpen(false);
                  }}
                  onBlur={() => setStatusOpen(false)}
                  className={`px-2 py-1 rounded-full border font-semibold text-sm ${statusPillClass(t.status)}`}
                  autoFocus
                >
                  <option value="todo">To Do</option>
                  <option value="inprogress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              ) : (
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={statusOpen}
                  aria-label={`Status: ${statusLabel[t.status]}`}
                  onClick={() => setStatusOpen((v) => !v)}
                  className={`px-2 py-1 rounded-full border font-semibold text-sm ${statusPillClass(t.status)}`}
                >
                  {statusLabel[t.status]}
                </button>
              )
            ) : (
              <select
                aria-label="Status"
                value={t.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className={`px-2 py-1 rounded-full border font-semibold text-sm ${statusPillClass(t.status)}`}
              >
                <option value="todo">To Do</option>
                <option value="inprogress">In Progress</option>
                <option value="done">Done</option>
              </select>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <div className="flex items-center gap-1">
              {a ? (
                <Avatar name={a.name} roleType={a.roleType} avatar={a.avatar} />
              ) : (
                <span className="text-black/40">—</span>
              )}
              <select
                aria-label="Assignee"
                value={t.assigneeId || ''}
                onChange={(e) => update(t.id, { assigneeId: e.target.value || null })}
                className="border rounded px-1.5 py-1"
              >
                <option value="">Unassigned</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.roleType})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span>Start</span>
              <input
                type="date"
                value={t.startDate || ''}
                onChange={(e) => {
                  const patch = { startDate: e.target.value };
                  if (t.status === 'todo') patch.status = 'inprogress';
                  update(t.id, patch);
                }}
                className="border rounded px-1.5 py-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <span># of Workdays</span>
              <input
                type="number"
                min={0}
                value={t.workDays ?? 0}
                onChange={(e) => update(t.id, { workDays: Number(e.target.value) })}
                className="w-20 border rounded px-1.5 py-1"
              />
            </div>
            <div className="basis-full w-full">
              <DocumentInput onAdd={(url) => onAddLink?.(t.id, url)} />
              {t.links && t.links.length > 0 && (
                <LinkChips links={t.links} onRemove={(i) => onRemoveLink?.(t.id, i)} />
              )}
            </div>
            <div className="basis-full text-sm text-slate-700">
              <span className="font-medium mr-1">Note:</span>
              <InlineText
                value={t.note}
                onChange={(v) => update(t.id, { note: v })}
                placeholder="Add a quick note…"
                multiline
              />
            </div>
            <DepPicker task={t} tasks={tasks} onUpdate={update} />
            <div className="ml-auto flex items-center gap-2">
              <DuePill date={t.dueDate} status={t.status} />
              {t.status === 'done' && (
                <span className="text-slate-500">Completed: {t.completedDate || '—'}</span>
              )}
            </div>
          </div>
        </>
      )}
      {linkModal && (
        <LinkReminderModal
          onOkay={() => setLinkModal(false)}
          onNoLink={() => {
            setLinkModal(false);
            update(t.id, { status: 'done' });
          }}
        />
      )}
    </motion.div>
  );
}

