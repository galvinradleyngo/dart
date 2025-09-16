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
import { Plus, Minus, Copy, Trash2, Pencil, StickyNote } from 'lucide-react';

export default function TaskCard({ task: t, team = [], milestones = [], tasks = [], onUpdate, onDelete, onDuplicate, onAddLink, onRemoveLink, dragHandlers = {} }) {
  const [collapsed, setCollapsed] = useState(true);
  const isMobile = useIsMobile();
  const dragProps = isMobile ? {} : dragHandlers;
  const statusList = ['todo', 'inprogress', 'done'];
  const statusLabel = { todo: 'To Do', inprogress: 'In Progress', done: 'Done' };
  const soundEnabled = useContext(SoundContext);
  const audioCtxRef = useRef(null);
  const controls = useAnimation();
  const statusColors = { todo: '#ffffff', inprogress: '#dcfce7', done: '#fce7f3' };
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
  const milestone = milestones.find((m) => m.id === t.milestoneId);
  const [milestoneEdit, setMilestoneEdit] = useState(false);
  useEffect(() => {
    if (collapsed) setMilestoneEdit(false);
  }, [collapsed]);
  const statusPillClass = (status) => {
    if (status === 'done') return 'bg-pink-100/70 text-pink-700 border-pink-200/80';
    if (status === 'inprogress') return 'bg-emerald-100/70 text-emerald-700 border-emerald-200/80';
    return 'bg-white/80 text-slate-700 border-white/60';
  };
  const statusPillBase = 'min-w-[10rem] px-3 pr-10 py-1.5 rounded-full border font-semibold text-sm shadow-sm backdrop-blur';
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
      className={`w-full max-w-full break-words glass-card p-3 sm:p-4 text-sm sm:text-[14px] ${dragProps.draggable ? 'cursor-move' : ''}`}
      animate={controls}
      whileTap={{ scale: 0.98 }}
      style={isMobile ? { touchAction: 'pan-y' } : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm sm:text-[14px] font-semibold leading-tight truncate">
            <InlineText value={t.title} onChange={(v) => update(t.id, { title: v })} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="glass-icon-button w-7 h-7 sm:w-9 sm:h-9"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <Plus className="icon" /> : <Minus className="icon" />}
          </button>
          {onDuplicate && (
            <button
              onClick={() => onDuplicate(t.id)}
              className="glass-icon-button w-7 h-7 sm:w-9 sm:h-9"
              title="Duplicate"
              aria-label="Duplicate"
            >
              <Copy className="icon" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(t.id)}
              className="glass-icon-button w-7 h-7 sm:w-9 sm:h-9 text-rose-500 hover:text-rose-600"
              title="Delete"
              aria-label="Delete"
            >
              <Trash2 className="icon" />
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
                  className={`${statusPillBase} ${statusPillClass(t.status)}`}
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
                  className={`${statusPillBase} ${statusPillClass(t.status)}`}
                >
                  {statusLabel[t.status]}
                </button>
              )
            ) : (
              <select
                aria-label="Status"
                value={t.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className={`${statusPillBase} ${statusPillClass(t.status)}`}
              >
                <option value="todo">To Do</option>
                <option value="inprogress">In Progress</option>
                <option value="done">Done</option>
              </select>
            )}
          </div>
          <div className="text-sm text-slate-600/90 mt-1 truncate">
            <InlineText value={t.details} onChange={(v) => update(t.id, { details: v })} placeholder="Details…" />
          </div>
          {t.note && (
            <div className="text-sm text-slate-600/90 mt-1 flex items-center gap-1 truncate">
              <StickyNote className="icon flex-shrink-0 text-amber-500" /> {t.note}
            </div>
          )}
            <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm">
              <div className="flex items-start gap-2 min-w-0">
                {a ? (
                  <Avatar name={a.name} roleType={a.roleType} avatar={a.avatar} />
                ) : (
                  <span className="text-slate-400 text-sm">—</span>
                )}
                <div className="flex flex-col min-w-0">
                  <select
                    aria-label="Assignee"
                    value={t.assigneeId || ''}
                    onChange={(e) => update(t.id, { assigneeId: e.target.value || null })}
                    className="min-w-[8rem] max-w-full w-auto rounded-2xl border border-white/60 bg-white/80 px-3 py-1.5 shadow-sm flex-1"
                    title={team.find((m) => m.id === t.assigneeId)?.name}
                  >
                    <option value="">Unassigned</option>
                    {team.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.roleType})
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-slate-500/90 mt-1 truncate">
                    {milestone ? milestone.title : '—'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DuePill date={t.dueDate} status={t.status} />
                {t.status === 'done' && (
                  <span className="text-slate-500/90">Completed: {t.completedDate || '—'}</span>
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
                  className={`${statusPillBase} ${statusPillClass(t.status)}`}
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
                  className={`${statusPillBase} ${statusPillClass(t.status)}`}
                >
                  {statusLabel[t.status]}
                </button>
              )
            ) : (
              <select
                aria-label="Status"
                value={t.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className={`${statusPillBase} ${statusPillClass(t.status)}`}
              >
                <option value="todo">To Do</option>
                <option value="inprogress">In Progress</option>
                <option value="done">Done</option>
              </select>
            )}
          </div>
          <div className="mt-2 flex flex-col gap-2 text-sm">
            {milestoneEdit ? (
              <select
                aria-label="Milestone"
                value={t.milestoneId ?? ''}
                onChange={(e) => {
                  update(t.id, { milestoneId: e.target.value || null });
                  setMilestoneEdit(false);
                }}
                className="text-xs text-slate-600 rounded-xl border border-white/60 bg-white/80 px-2 py-1 shadow-sm"
              >
                <option value="">Unassigned</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs text-slate-500 flex items-center gap-1 truncate">
                <span className="truncate">{milestone ? milestone.title : 'Unassigned'}</span>
                <button
                  type="button"
                  onClick={() => setMilestoneEdit(true)}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label="Edit Milestone"
                >
                  <Pencil className="icon" />
                </button>
              </div>
            )}
            <div className="flex items-start gap-1">
              {a ? (
                <Avatar name={a.name} roleType={a.roleType} avatar={a.avatar} />
              ) : (
                <span className="text-slate-400 text-sm">—</span>
              )}
              <select
                aria-label="Assignee"
                value={t.assigneeId || ''}
                onChange={(e) => update(t.id, { assigneeId: e.target.value || null })}
                className="min-w-[8rem] max-w-full w-auto rounded-2xl border border-white/60 bg-white/80 px-3 py-1.5 shadow-sm flex-1"
                title={team.find((m) => m.id === t.assigneeId)?.name}
              >
                <option value="">Unassigned</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.roleType})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
                  className="w-24 rounded-2xl border border-white/60 bg-white/80 px-2.5 py-1.5 shadow-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <span># of Workdays</span>
                <input
                  type="number"
                  min={0}
                  value={t.workDays ?? 0}
                  onChange={(e) => update(t.id, { workDays: Number(e.target.value) })}
                  className="w-24 rounded-2xl border border-white/60 bg-white/80 px-2.5 py-1.5 shadow-sm"
                />
              </div>
            </div>
            <div className="w-fit">
              <DocumentInput onAdd={(url) => onAddLink?.(t.id, url)} />
              {t.links && t.links.length > 0 && (
                <LinkChips links={t.links} onRemove={(i) => onRemoveLink?.(t.id, i)} />
              )}
            </div>
            <div className="text-sm text-slate-700/90">
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

