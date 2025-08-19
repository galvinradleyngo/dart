import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Calendar,
  Users,
  ClipboardList,
  ListChecks,
  Download,
  Upload,
  Filter,
  Trash2,
  Clock3,
  AlertTriangle,
  RefreshCcw,
  UserPlus,
  Copy as CopyIcon,
  Link2,
  GitBranch,
  Minus,
  ArrowLeft,
} from "lucide-react";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase.js";

/**
 * Course Hub + Course Dashboard – Health-style PM (v12)
 * -----------------------------------------------------
 * NEW (this patch):
 * • Prominent **Back to Courses** button (filled style)
 * • **Tap course card** opens it (mobile-friendly); inner action buttons stop propagation
 * • Task card **Note** field (freeform notes)
 * • Header/banner shows **DART: Design and Development Accountability and Responsibility Tracker**
 */

// =====================================================
// Utilities
// =====================================================
const uid = () => Math.random().toString(36).slice(2, 9);
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => new Date(d).toISOString().slice(0, 10);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const rolePalette = { LD: "#4f46e5", SME: "#16a34a", MM: "#0891b2", PM: "#ea580c", PA: "#a855f7", Other: "#64748b" };
const roleColor = (roleType) => rolePalette[roleType] || rolePalette.Other;

const isHoliday = (dateObj, holidaySet) => holidaySet.has(fmt(dateObj));
const isWorkday = (dateObj, workweekSet) => workweekSet.has(dateObj.getDay());
const addBusinessDays = (dateStr, workdays, workweek = [1,2,3,4,5], holidays = []) => {
  if (!dateStr || isNaN(workdays)) return "";
  const workweekSet = new Set(workweek);
  const holidaySet = new Set(holidays);
  let remaining = Number(workdays);
  let cur = new Date(dateStr);
  while (!isWorkday(cur, workweekSet) || isHoliday(cur, holidaySet)) cur.setDate(cur.getDate() + 1);
  let counted = 0;
  while (counted < remaining) {
    cur.setDate(cur.getDate() + 1);
    if (isWorkday(cur, workweekSet) && !isHoliday(cur, holidaySet)) counted++;
  }
  return fmt(cur);
};

// =====================================================
// Global Schedule Store (shared across courses)
// =====================================================
const GLOBAL_SCHEDULE_KEY = "healthPM:globalSchedule:v1";
const defaultSchedule = { workweek: [1,2,3,4,5], holidays: [] };
const loadGlobalSchedule = () => { try { const raw = localStorage.getItem(GLOBAL_SCHEDULE_KEY); return raw ? JSON.parse(raw) : defaultSchedule; } catch { return defaultSchedule; } };
const saveGlobalSchedule = (sched) => { try { localStorage.setItem(GLOBAL_SCHEDULE_KEY, JSON.stringify(sched)); } catch {} };

// =====================================================
// Template & Courses Store
// =====================================================
const TEMPLATE_KEY = "healthPM:template:v1";
const COURSES_KEY  = "healthPM:courses:v1";
const saveTemplate = (state) => { try { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(state)); } catch {} };
const loadTemplate = () => { try { const raw = localStorage.getItem(TEMPLATE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } };
const saveCourses = (arr) => { try { localStorage.setItem(COURSES_KEY, JSON.stringify(arr)); } catch {} };
const loadCourses = () => { try { const raw = localStorage.getItem(COURSES_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; } };
const loadCoursesRemote = async () => {
  try {
    const snap = await getDoc(doc(db, 'app', 'courses'));
    return snap.exists() ? snap.data().courses || [] : [];
  } catch {
    return [];
  }
};
const saveCoursesRemote = async (arr) => {
  try {
    await setDoc(doc(db, 'app', 'courses'), { courses: arr });
  } catch {}
};

// =====================================================
// Seed + Migration
// =====================================================
const seed = () => ({
  course: { id: uid(), name: "Intro to Learning Design", description: "From analysis to deployment, track the whole build.", accent: "from-fuchsia-500 via-pink-500 to-rose-500", courseLDIds: [], courseSMEIds: [] },
  schedule: { workweek: [1,2,3,4,5], holidays: [] }, // back-compat; overridden by global
  team: [
    { id: uid(), name: "Alex Cruz", roleType: "LD",  color: roleColor("LD") },
    { id: uid(), name: "Dr. Reyes", roleType: "SME", color: roleColor("SME") },
    { id: uid(), name: "Pat Santos", roleType: "PM",  color: roleColor("PM") },
    { id: uid(), name: "Jae Lim", roleType: "MM",     color: roleColor("MM") },
    { id: uid(), name: "Rio Tan", roleType: "PA",     color: roleColor("PA") },
  ],
  milestones: [
    { id: uid(), title: "A–D Blueprint Approved", start: todayStr(), goal: "Complete sections A–D of blueprint" },
    { id: uid(), title: "Section E Approved",     start: todayStr(), goal: "Finalize Section E (Assessments & Rubrics)" },
    { id: uid(), title: "Canvas Build",            start: todayStr(), goal: "Transfer & QA in LMS" },
  ],
  tasks: [
    { id: uid(), order: 0, title: "Draft course outcomes", details: "Bloom + alignment checks", note: "", links: [], assigneeId: null, milestoneId: 0, status: "todo",       startDate: "",          workDays: 3, dueDate: "",                          depTaskId: null, completedDate: "" },
    { id: uid(), order: 1, title: "Collect source materials", details: "Slides, readings, datasets", note: "", links: [], assigneeId: null, milestoneId: 0, status: "inprogress", startDate: todayStr(),  workDays: 2, dueDate: addBusinessDays(todayStr(),2), depTaskId: null, completedDate: "" },
    { id: uid(), order: 2, title: "Storyboard videos",    details: "3 explainer videos", note: "", links: [], assigneeId: null, milestoneId: 2, status: "todo",       startDate: "",          workDays: 5, dueDate: "",                          depTaskId: null, completedDate: "" },
    { id: uid(), order: 3, title: "Build Canvas shell",   details: "Modules, pages, nav", note: "", links: [], assigneeId: null, milestoneId: 2, status: "todo",       startDate: "",          workDays: 4, dueDate: "",                          depTaskId: null, completedDate: "" },
    { id: uid(), order: 4, title: "SME review: A–D",      details: "Async comments", note: "", links: [], assigneeId: null, milestoneId: 0, status: "done",        startDate: todayStr(),  workDays: 1, dueDate: addBusinessDays(todayStr(),1), depTaskId: null, completedDate: todayStr() },
  ],
});

const remapSeed = (s) => {
  const msIds = s.milestones.map((m) => m.id);
  s.schedule = s.schedule || { workweek: [1,2,3,4,5], holidays: [] };
  s.tasks.forEach((t) => (t.milestoneId = msIds[t.milestoneId] ?? msIds[0]));
  s.tasks = s.tasks.map((t) => {
    const workDays = t.workDays ?? t.estimateDays ?? 0;
    let startDate = t.startDate || "";
    let dueDate = t.dueDate || "";
    const links = Array.isArray(t.links) ? t.links : [];
    const note = t.note ?? "";
    if (t.status === "todo") { startDate = ""; dueDate = ""; }
    if (!dueDate && startDate) dueDate = addBusinessDays(startDate, workDays, s.schedule.workweek, s.schedule.holidays);
    return { ...t, workDays, startDate, dueDate, links, note, depTaskId: t.depTaskId ?? null, completedDate: t.completedDate ?? (t.status === "done" ? todayStr() : "") };
  });
  s.milestones = s.milestones.map((m) => { const { due, ...rest } = m; return rest; });
  s.team = s.team.map((m) => ({ ...m, color: roleColor(m.roleType) }));
  const LD = s.team.find((m) => m.roleType === "LD");
  const SME = s.team.find((m) => m.roleType === "SME");
  s.course.courseLDIds  = s.course.courseLDIds?.length  ? s.course.courseLDIds  : (LD  ? [LD.id]  : []);
  s.course.courseSMEIds = s.course.courseSMEIds?.length ? s.course.courseSMEIds : (SME ? [SME.id] : []);
  return s;
};

// =====================================================
// Avatar, Ring, DuePill, Inputs, etc.
// =====================================================
function Ring({ size = 84, stroke = 10, progress = 0, trackOpacity = 0.15, color = "#111827", children }) {
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r; const pct = clamp(progress, 0, 100); const dash = (pct / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]"><circle cx={size/2} cy={size/2} r={r} stroke="currentColor" strokeWidth={stroke} className="text-black/10" style={{opacity:trackOpacity}} fill="none"/><circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} strokeDasharray={`${dash} ${c-dash}`} strokeLinecap="round" fill="none"/></svg>
      <div className="absolute inset-0 grid place-items-center text-center select-none">{children}</div>
    </div>
  );
}
function InlineText({ value, onChange, className = "", placeholder = "Untitled", multiline = false }) {
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(value ?? ""); useEffect(() => setDraft(value ?? ""), [value]);
  const commit = () => { setEditing(false); if (draft !== value) onChange?.(draft); };
  if (!editing) return (<span className={`cursor-text hover:bg-black/5 rounded px-1 ${className}`} onClick={() => setEditing(true)} title="Click to edit">{value?.trim() ? value : <span className="text-black/40">{placeholder}</span>}</span>);
  return multiline ? (<textarea autoFocus className={`w-full rounded border border-black/10 bg-white px-2 py-1 outline-none ${className}`} value={draft} onChange={(e)=>setDraft(e.target.value)} onBlur={commit} onKeyDown={(e)=>{ if(e.key==="Escape"){ setDraft(value??""); setEditing(false);} if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="enter") commit(); }} rows={3} />) : (<input autoFocus className={`w-full rounded border border-black/10 bg-white px-2 py-1 outline-none ${className}`} value={draft} onChange={(e)=>setDraft(e.target.value)} onBlur={commit} onKeyDown={(e)=> e.key==="Enter" ? commit() : (e.key==="Escape" && (setDraft(value??""), setEditing(false)))} />);
}
const Avatar = ({ name, roleType }) => (<span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-medium text-white" style={{ background: roleColor(roleType) }} title={name}>{name.split(" ").map((w)=>w[0]).join("")}</span>);
function DuePill({ date, status }) {
  if (!date) return <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-500 border border-slate-200">—</span>;
  const today = new Date(todayStr()); const d = new Date(date); const diffDays = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
  let classes = "bg-sky-100 text-sky-800 border-sky-200"; if (status !== "done" && diffDays < 0) classes = "bg-red-100 text-red-800 border-red-200"; else if (status !== "done" && diffDays <= 2) classes = "bg-amber-100 text-amber-800 border-amber-200";
  return <span className={`inline-block px-2 py-0.5 text-xs rounded-full border font-semibold ${classes}`}>{date}</span>;
}
function LinksEditor({ links = [], onAdd, onRemove }) {
  const [val, setVal] = useState(""); const add = () => { const url = val.trim(); if (!url) return; try { const u = new URL(url); onAdd?.(u.toString()); setVal(""); } catch {} };
  return (
    <div className="mt-1">
      <div className="flex flex-wrap gap-1 mb-1">{links.map((l, i) => (<a key={i} href={l} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border border-black/10 bg-white hover:bg-slate-50"><Link2 size={12}/> {(()=>{try{return new URL(l).hostname;}catch{return l;}})()}<button type="button" className="ml-1 text-slate-400 hover:text-rose-600" onClick={(e)=>{e.preventDefault(); onRemove?.(i);}}>×</button></a>))}</div>
      <div className="flex items-center gap-1"><input value={val} onChange={(e)=>setVal(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') add(); }} placeholder="Paste link & press Enter" className="w-full border rounded px-2 py-1 text-xs" /><button onClick={add} className="px-2 py-1 text-xs rounded border border-black/10 bg-white hover:bg-slate-50">Add</button></div>
    </div>
  );
}
function DocumentInput({ onAdd }) {
  const [val, setVal] = useState(""); const add = () => { const url = val.trim(); if (!url) return; try { const u = new URL(url); onAdd?.(u.toString()); setVal(""); } catch {} };
  return (
    <div className="flex items-center gap-2 text-xs w-full"><span className="font-medium">Document:</span><input type="url" value={val} onChange={(e)=>setVal(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') add(); }} placeholder="Paste link and press Enter" className="flex-1 border rounded px-1.5 py-1" /><button onClick={add} className="px-2 py-1 rounded border border-black/10 bg-white hover:bg-slate-50">Add</button></div>
  );
}
function LinkChips({ links = [], onRemove }) { return (<div className="mt-1 flex flex-wrap gap-1">{links.map((l, i) => (<a key={i} href={l} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text:[11px] border border-black/10 bg-white hover:bg-slate-50"><Link2 size={12}/> {(()=>{try{return new URL(l).hostname;}catch{return l;}})()}<button type="button" className="ml-1 text-slate-400 hover:text-rose-600" onClick={(e)=>{e.preventDefault(); onRemove?.(i);}}>×</button></a>))}</div>); }

// =====================================================
// Calendar View
// =====================================================
function CalendarView({ monthDate, tasks, milestones, team, onPrev, onNext, onToday, schedule, onTaskClick }) {
  const year = monthDate.getFullYear(); const month = monthDate.getMonth(); const first = new Date(year, month, 1);
  const startDay = new Date(year, month, 1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate() + i));
  const tasksByDue = tasks.reduce((acc, t) => { if (t.dueDate) (acc[t.dueDate] ||= []).push(t); return acc; }, {});
  const holidaySet = new Set(schedule.holidays); const workSet = new Set(schedule.workweek);
  return (
    <div className="border border-black/10 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-white border-b border-black/10"><div className="font-medium">{monthDate.toLocaleString(undefined, { month: "long", year: "numeric" })}</div><div className="flex items-center gap-2"><button onClick={onPrev} className="px-2 py-1 rounded border border-black/10 bg-white hover:bg-slate-50">Prev</button><button onClick={onToday} className="px-2 py-1 rounded border border-black/10 bg-white hover:bg-slate-50">Today</button><button onClick={onNext} className="px-2 py-1 rounded border border-black/10 bg-white hover:bg-slate-50">Next</button></div></div>
      <div className="grid grid-cols-7 text-xs bg-slate-50 border-b border-black/10">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d,i)=>(<div key={i} className="p-2 text-center font-medium text-slate-700">{d}</div>))}</div>
      <div className="grid grid-cols-7">
        {days.map((d, idx) => { const key = fmt(d); const inMonth = d.getMonth() === month; const isHolidayDay = holidaySet.has(key); const isWork = workSet.has(d.getDay()); const items = tasksByDue[key] || []; const isToday = key === todayStr(); return (
          <div key={idx} className={`min-h-[96px] p-2 border-b border-r border-black/5 ${inMonth?"bg-white":"bg-slate-50"} ${isToday?"ring-2 ring-indigo-500":""}`}>
            <div className="flex items-center justify-between"><div className={`text-xs ${inMonth?"text-slate-700":"text-slate-400"} ${isToday?"px-1 rounded bg-indigo-600 text-white":""}`}>{d.getDate()}</div>{!isWork && <span className="text-[10px] px-1 rounded bg-slate-100 text-slate-600 border border-slate-200">Off</span>}{isHolidayDay && <span className="text-[10px] px-1 rounded bg-rose-100 text-rose-700 border border-rose-200">Holiday</span>}</div>
            <div className="mt-1 space-y-1">{items.slice(0,3).map((t)=>(<div key={t.id} className="text-[11px] truncate px-2 py-1 rounded border border-black/10 bg-sky-50 text-sky-800 cursor-pointer" onClick={()=>onTaskClick?.(t)}>{t.title}</div>))}{items.length>3 && <div className="text-[10px] text-slate-500">+{items.length-3} more…</div>}</div>
          </div>
        ); })}
      </div>
    </div>
  );
}

// =====================================================
// Course Dashboard (formerly default export)
// =====================================================
function CoursePMApp({ boot, isTemplateLabel = false, onBack, onStateChange }) {
  const [state, setState] = useState(() => {
    if (boot) return { ...remapSeed(boot), schedule: loadGlobalSchedule() };
    const saved = localStorage.getItem("healthPM:state:v8");
    let base;
    if (saved) { try { base = remapSeed(JSON.parse(saved)); } catch { base = remapSeed(seed()); } }
    else {
      const prev = localStorage.getItem("healthPM:state:v7") || localStorage.getItem("healthPM:state:v6") || localStorage.getItem("healthPM:state:v5") || localStorage.getItem("healthPM:state:v4") || localStorage.getItem("healthPM:state:v3") || localStorage.getItem("healthPM:state:v2");
      base = prev ? remapSeed(JSON.parse(prev)) : remapSeed(seed());
    }
    return { ...base, schedule: loadGlobalSchedule() };
  });
  const [view, setView] = useState("board");
  const [milestoneFilter, setMilestoneFilter] = useState("all");
  const [listTab, setListTab] = useState("active");

  // Persist
  useEffect(() => { localStorage.setItem("healthPM:state:v8", JSON.stringify(state)); }, [state]);
  useEffect(() => { saveGlobalSchedule(state.schedule); }, [state.schedule]);
  useEffect(() => { onStateChange?.(state); }, [state, onStateChange]);

  // Listen for global schedule changes from other tabs
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === GLOBAL_SCHEDULE_KEY && e.newValue) {
        try {
          const sched = JSON.parse(e.newValue);
          setState((s) => {
            let tasks = s.tasks.map((t) => t.startDate ? { ...t, dueDate: addBusinessDays(t.startDate, t.workDays, sched.workweek, sched.holidays) } : t);
            tasks = propagateDependentForecasts(tasks, sched);
            return { ...s, schedule: sched, tasks };
          });
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Capture current content once as initial template (only if not already captured)
  useEffect(() => { try { const flag = localStorage.getItem("healthPM:template:captured"); if (!flag) { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(state)); localStorage.setItem("healthPM:template:captured","1"); } } catch {} }, []);

  const team = state.team; const milestones = state.milestones; const tasksRaw = state.tasks;
  const dueKey = (t) => (t.dueDate ? new Date(t.dueDate).getTime() : Number.POSITIVE_INFINITY);

  const filteredBase = useMemo(() => (milestoneFilter === "all" ? tasksRaw : tasksRaw.filter((t) => t.milestoneId === milestoneFilter)), [tasksRaw, milestoneFilter]);
  const tasksActive = useMemo(() => { const arr = filteredBase.filter((t) => t.status !== "done"); return [...arr].sort((a,b)=> dueKey(a)-dueKey(b) || (a.title||"").localeCompare(b.title||"")); }, [filteredBase]);
  const tasksDone   = useMemo(() => { const arr = filteredBase.filter((t) => t.status === "done"); return [...arr].sort((a,b)=> dueKey(a)-dueKey(b) || (a.title||"").localeCompare(b.title||"")); }, [filteredBase]);

  const totals = useMemo(() => {
    const total = tasksRaw.length; const done = tasksRaw.filter((t)=>t.status==="done").length; const inprog = tasksRaw.filter((t)=>t.status==="inprogress").length; const todo = total - done - inprog; const overdue = tasksRaw.filter((t)=>t.status!=="done" && t.dueDate && new Date(t.dueDate) < new Date(todayStr())).length; return { total, done, inprog, todo, overdue, pct: total ? Math.round((done/total)*100) : 0 };
  }, [tasksRaw]);

  const milestoneStats = useMemo(() => milestones.map((m) => { const subset = tasksRaw.filter((t)=>t.milestoneId===m.id); const total = subset.length; const done = subset.filter((t)=>t.status==="done").length; return { id:m.id, pct: total ? Math.round((done/total)*100) : 0, total, done }; }), [milestones, tasksRaw]);

  const recomputeDue = (t, patch = {}) => { const start = patch.startDate ?? t.startDate; const work = patch.workDays ?? t.workDays; const due = start ? addBusinessDays(start, work, state.schedule.workweek, state.schedule.holidays) : ""; return { ...patch, dueDate: due }; };
  const propagateDependentForecasts = (tasks, schedule) => { const map = new Map(tasks.map((t)=>[t.id,t])); return tasks.map((t)=>{ if(!t.depTaskId || t.status==="done") return t; const src = map.get(t.depTaskId); if(!src) return t; const startForecast = src.dueDate || ""; if (t.status !== "inprogress" && startForecast) { const due = addBusinessDays(startForecast, t.workDays, schedule.workweek, schedule.holidays); return { ...t, startDate: startForecast, dueDate: due }; } return t; }); };

  const updateTask = (id, patch) => setState((s) => {
    let changedTo = null;
    const tasks1 = s.tasks.map((t) => {
      if (t.id !== id) return t;
      let adjusted = { ...patch };
      if (patch.status && patch.status !== t.status) {
        changedTo = patch.status;
        if (patch.status === "inprogress") { if (!t.startDate && !patch.__skipAutoStart) adjusted.startDate = todayStr(); }
        if (patch.status === "todo") { adjusted.startDate = ""; adjusted.dueDate = ""; adjusted.completedDate = ""; }
        if (patch.status === "done") { adjusted.completedDate = todayStr(); }
      }
      if ("startDate" in adjusted || "workDays" in adjusted) adjusted = recomputeDue({ ...t, ...adjusted }, adjusted);
      return { ...t, ...adjusted };
    });
    let tasks2 = tasks1;
    if (changedTo === "inprogress") tasks2 = tasks2.map((d) => (d.depTaskId === id && d.status !== "done" ? { ...d, status: "inprogress" } : d));
    if (changedTo === "done") {
      const doneDate = todayStr();
      tasks2 = tasks2.map((x) => (x.id === id ? { ...x, completedDate: x.completedDate || doneDate } : x));
      tasks2 = tasks2.map((d) => { if (d.depTaskId === id && d.status !== "done") { const start = doneDate; const due = addBusinessDays(start, d.workDays, s.schedule.workweek, s.schedule.holidays); return { ...d, status: "inprogress", startDate: start, dueDate: due }; } return d; });
    }
    const tasks3 = propagateDependentForecasts(tasks2, s.schedule);
    return { ...s, tasks: tasks3 };
  });

  const addTask = (milestoneId) => setState((s) => ({ ...s, tasks: [...s.tasks, { id: uid(), order: s.tasks.length, title: "New Task", details: "", note: "", links: [], depTaskId: null, assigneeId: s.course.courseLDIds[0] || (s.team.find((m)=>m.roleType==='LD')?.id ?? null), milestoneId: milestoneId || s.milestones[0]?.id, status: "todo", startDate: "", workDays: 1, dueDate: "", completedDate: "" }] }));
  const duplicateTask = (id) => setState((s) => { const orig = s.tasks.find((t)=>t.id===id); if(!orig) return s; const clone = { ...orig, id: uid(), order: s.tasks.length, title: `${orig.title} (copy)`, status: "todo", startDate: "", dueDate: "", completedDate: "", depTaskId: null }; return { ...s, tasks: [...s.tasks, clone] }; });
  const patchTaskLinks = (id, op, payload) => setState((s)=>({ ...s, tasks: s.tasks.map((t)=>{ if(t.id!==id) return t; const links = Array.isArray(t.links)?[...t.links]:[]; if(op==='add') links.push(payload); if(op==='remove') links.splice(payload,1); return { ...t, links }; }) }));
  const deleteTask = (id) => setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));

  const updateMilestone  = (id, patch) => setState((s)=>({ ...s, milestones: s.milestones.map((m)=>(m.id===id?{...m,...patch}:m)) }));
  const addMilestone     = () => setState((s)=>({ ...s, milestones: [...s.milestones, { id: uid(), title: "New Milestone", start: todayStr(), goal: "" }] }));
  const deleteMilestone  = (id) => setState((s)=>({ ...s, milestones: s.milestones.filter((m)=>m.id!==id), tasks: s.tasks.map((t)=>(t.milestoneId===id?{...t, milestoneId: s.milestones[0]?.id}:t)) }));
  const duplicateMilestone = (id) => setState((s)=>{ const src = s.milestones.find((m)=>m.id===id); if(!src) return s; const newMs = { id: uid(), title: `${src.title} (copy)`, start: src.start, goal: src.goal }; const related = s.tasks.filter((t)=>t.milestoneId===id); const nextOrder = s.tasks.length; const ld = s.course.courseLDIds[0] || (s.team.find((m)=>m.roleType==='LD')?.id ?? null); const clonedTasks = related.map((t,i)=>({ ...t, id: uid(), order: nextOrder+i, milestoneId: newMs.id, status: "todo", startDate: "", dueDate: "", completedDate: "", assigneeId: ld, depTaskId: null })); return { ...s, milestones: [...s.milestones, newMs], tasks: [...s.tasks, ...clonedTasks] }; });

  // Milestone DnD
  const dragMsId = useRef(null);
  const onMsDragStart = (id) => (e) => { dragMsId.current = id; e.dataTransfer.effectAllowed = "move"; };
  const onMsDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onMsDrop = (targetId) => (e) => { e.preventDefault(); const from = dragMsId.current; if(!from || from===targetId) return; setState((s)=>{ const arr=[...s.milestones]; const i1=arr.findIndex((m)=>m.id===from); const i2=arr.findIndex((m)=>m.id===targetId); if(i1<0||i2<0) return s; const [m]=arr.splice(i1,1); arr.splice(i2,0,m); return { ...s, milestones: arr }; }); dragMsId.current=null; };

  // Members
  const updateMember = (id, patch) => setState((s)=>({ ...s, team: s.team.map((m)=>{ if(m.id!==id) return m; const next={...m,...patch}; if(patch.roleType) next.color = roleColor(patch.roleType); return next; }) }));
  const addMember    = () => setState((s)=>({ ...s, team: [...s.team, { id: uid(), name:"New Member", roleType:"Other", color: roleColor("Other") }] }));
  const deleteMember = (id) => setState((s)=>({ ...s, team: s.team.filter((m)=>m.id!==id), course: { ...s.course, courseLDIds: s.course.courseLDIds.filter((mId)=>mId!==id), courseSMEIds: s.course.courseSMEIds.filter((mId)=>mId!==id) }, tasks: s.tasks.map((t)=>(t.assigneeId===id?{...t, assigneeId:null}:t)) }));
  const toggleCourseWide = (kind, id) => setState((s)=>{ const key = kind === "LD" ? "courseLDIds" : "courseSMEIds"; const list = new Set(s.course[key]); list.has(id)?list.delete(id):list.add(id); return { ...s, course: { ...s.course, [key]: Array.from(list) } }; });

  // Global schedule mutators
  const toggleWorkday = (dow) => setState((s)=>{ const set = new Set(s.schedule.workweek); set.has(dow)?set.delete(dow):set.add(dow); const schedule = { ...s.schedule, workweek: Array.from(set).sort() }; saveGlobalSchedule(schedule); let tasks = s.tasks.map((t)=> t.startDate ? { ...t, dueDate: addBusinessDays(t.startDate, t.workDays, schedule.workweek, schedule.holidays) } : t ); tasks = propagateDependentForecasts(tasks, schedule); return { ...s, schedule, tasks }; });
  const addHoliday     = (dateStr) => dateStr && setState((s)=>{ const holidays = Array.from(new Set([ ...s.schedule.holidays, dateStr ])).sort(); const schedule = { ...s.schedule, holidays }; saveGlobalSchedule(schedule); let tasks = s.tasks.map((t)=> t.startDate ? { ...t, dueDate: addBusinessDays(t.startDate, t.workDays, schedule.workweek, schedule.holidays) } : t ); tasks = propagateDependentForecasts(tasks, schedule); return { ...s, schedule, tasks }; });
  const removeHoliday  = (dateStr) => setState((s)=>{ const schedule = { ...s.schedule, holidays: s.schedule.holidays.filter((h)=>h!==dateStr) }; saveGlobalSchedule(schedule); let tasks = s.tasks.map((t)=> t.startDate ? { ...t, dueDate: addBusinessDays(t.startDate, t.workDays, schedule.workweek, schedule.holidays) } : t ); tasks = propagateDependentForecasts(tasks, schedule); return { ...s, schedule, tasks }; });

  // Task DnD columns
  const dragTaskId = useRef(null);
  const onDragStart = (id) => (e) => { dragTaskId.current = id; e.dataTransfer.effectAllowed = "move"; };
  const onDragOverCol = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onDropToCol = (status) => (e) => { e.preventDefault(); const id = dragTaskId.current; if(!id) return; const t = state.tasks.find((x)=>x.id===id); let patch = { status }; if (t && status === "inprogress" && !t.startDate) { patch.startDate = todayStr(); } if (t && status === "todo") { patch.startDate = ""; patch.dueDate = ""; } patch = ("startDate" in patch || "workDays" in patch) ? recomputeDue(t, patch) : patch; updateTask(id, patch); dragTaskId.current = null; };

  // Calendar
  const [calMonth, setCalMonth] = useState(() => { const d=new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const gotoMonth = (offset) => setCalMonth((m)=>new Date(m.getFullYear(), m.getMonth()+offset, 1));

  const memberById = (id) => team.find((m) => m.id === id) || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/80 border-b border-black/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-slate-900 text-white border border-slate-900 shadow-sm hover:bg-slate-800"><ArrowLeft size={16}/> Back to Courses</button>
          )}
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${state.course.accent} shadow-sm`} />
          {/* DART banner title */}
          <div className="hidden sm:block text-sm sm:text-base font-semibold text-slate-800 truncate">DART: Design and Development Accountability and Responsibility Tracker</div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <button onClick={() => { if (confirm("Reset to fresh sample data?")) setState(remapSeed(seed())); }} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"><RefreshCcw size={16}/> Reset</button>
            <button onClick={() => saveTemplate(state)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"><CopyIcon size={16}/> Save as Template</button>
            <button onClick={() => { const tpl = loadTemplate(); if (tpl) setState({ ...remapSeed(tpl), schedule: loadGlobalSchedule() }); else alert("No template saved yet."); }} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"><RefreshCcw size={16}/> Reset to Template</button>
            <label className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50 cursor-pointer">
              <Upload size={16}/> Import
              <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && ((() => { const reader = new FileReader(); reader.onload = () => { try { const incoming = remapSeed(JSON.parse(reader.result)); setState((s)=>({ ...incoming, schedule: loadGlobalSchedule() })); } catch { alert("Invalid JSON"); } }; reader.readAsText(e.target.files[0]); })())} />
            </label>
            <button onClick={() => { const { schedule, ...rest } = state; const toSave = { ...rest, schedule: { workweek: [1,2,3,4,5], holidays: [] } }; const blob = new Blob([JSON.stringify(toSave, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `course-pm-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url); }} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"><Download size={16}/> Export</button>
          </div>
        </div>
        {/* Secondary row: course title and template pill */}
        <div className="max-w-7xl mx-auto px-4 pb-3 -mt-2">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-semibold leading-tight"><InlineText value={state.course.name} onChange={(v)=>setState((s)=>({ ...s, course: { ...s.course, name: v } }))} /></h1>
            {isTemplateLabel && <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200">Course Template</span>}
          </div>
          <p className="text-sm text-black/60"><InlineText value={state.course.description} onChange={(v)=>setState((s)=>({ ...s, course: { ...s.course, description: v } }))} /></p>
          {/* Course-wide LDs & SMEs */}
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {state.course.courseLDIds.map((id) => { const m = memberById(id); if (!m) return null; return <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-white" style={{ background: roleColor(m.roleType) }}><Avatar name={m.name} roleType={m.roleType} /> LD</span>; })}
            {state.course.courseSMEIds.map((id) => { const m = memberById(id); if (!m) return null; return <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-white" style={{ background: roleColor(m.roleType) }}><Avatar name={m.name} roleType={m.roleType} /> SME</span>; })}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        {/* Dashboard Rings */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardRing title="Course Progress" value={totals.pct} subtitle={`${totals.done}/${totals.total} done`} color="#10b981" icon={<ListChecks size={16}/>} />
          <DashboardRing title="In Progress" value={totals.inprog} subtitle="tasks" color="#6366f1" icon={<Clock3 size={16}/>} mode="count" />
          <DashboardRing title="To Do" value={totals.todo} subtitle="tasks" color="#0ea5e9" icon={<ClipboardList size={16}/>} mode="count" />
          <DashboardRing title="Overdue" value={totals.overdue} subtitle="needs attention" color="#ef4444" icon={<AlertTriangle size={16}/>} mode="count" />
        </section>

        {/* Team Members FIRST */}
        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold flex items-center gap-2"><Users size={18}/> Team Members</h2>
            <button onClick={() => addMember()} className="inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"><UserPlus size={16}/> Add Member</button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {team.map((m) => (
              <div key={m.id} className="rounded-xl border border-black/10 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0"><Avatar name={m.name} roleType={m.roleType} /><InlineText value={m.name} onChange={(v) => updateMember(m.id, { name: v })} className="font-medium truncate" /></div>
                <div className="flex items-center gap-2">
                  <select value={m.roleType} onChange={(e) => updateMember(m.id, { roleType: e.target.value })} className="border rounded px-2 py-1 text-sm">{Object.keys(rolePalette).map((r) => (<option key={r} value={r}>{r}</option>))}</select>
                  {(m.roleType === "LD" || m.roleType === "SME") && (
                    <label className="text-xs inline-flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={(m.roleType === "LD" ? state.course.courseLDIds : state.course.courseSMEIds).includes(m.id)} onChange={() => toggleCourseWide(m.roleType, m.id)} /> course-wide</label>
                  )}
                  <button className="text-black/40 hover:text-red-500" title="Remove member" onClick={() => deleteMember(m.id)}><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Global Workweek & Holidays (applies to all courses) */}
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2"><h2 className="font-semibold flex items-center gap-2 text-indigo-900"><Calendar size={18}/> Workweek & Holidays <span className="text-[11px] font-normal text-indigo-700">(Global)</span></h2></div>
          <div className="rounded-xl border border-indigo-200 bg-white p-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="font-medium">Workweek:</div>
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((label, idx) => (<button key={idx} onClick={() => toggleWorkday(idx)} className={`px-2 py-1 rounded-full border ${state.schedule.workweek.includes(idx) ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-black/10"}`}>{label}</button>))}
              <div className="ml-2 font-medium">Holidays:</div>
              <AddHoliday onAdd={addHoliday} />
              <div className="flex flex-wrap gap-2">{state.schedule.holidays.map((h) => (<span key={h} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">{h}<button className="text-rose-500 hover:text-rose-700" onClick={() => removeHoliday(h)} title="Remove">×</button></span>))}</div>
            </div>
          </div>
        </section>

        {/* Milestones */}
        <section>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="font-semibold flex items-center gap-2"><Calendar size={18}/> Milestones</h2>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2 shadow-sm">
                <Filter size={16} className="text-black/50"/>
                <select value={milestoneFilter} onChange={(e) => setMilestoneFilter(e.target.value)} className="text-sm outline-none bg-transparent">
                  <option value="all">All milestones</option>
                  {milestones.map((m) => (<option key={m.id} value={m.id}>{m.title}</option>))}
                </select>
              </div>
              <button onClick={() => addMilestone()} className="inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"><Plus size={16}/> Add Milestone</button>
            </div>
          </div>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
            {milestones.map((m) => { const st = milestoneStats.find((s)=>s.id===m.id) || { pct:0,total:0,done:0 }; return (
              <motion.div key={m.id} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm" draggable onDragStart={onMsDragStart(m.id)} onDragOver={onMsDragOver} onDrop={onMsDrop(m.id)}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight text-slate-800"><InlineText value={m.title} onChange={(v)=>updateMilestone(m.id,{ title:v })} /></h3>
                  <div className="flex items-center gap-1"><button className="text-black/60 hover:text-sky-600" title="Duplicate milestone and tasks" onClick={() => duplicateMilestone(m.id)}><CopyIcon size={16}/></button><button className="text-black/40 hover:text-red-500" title="Delete milestone" onClick={() => deleteMilestone(m.id)}><Trash2 size={16}/></button></div>
                </div>
                <p className="text-xs text-black/60 mt-1"><InlineText value={m.goal} onChange={(v)=>updateMilestone(m.id,{ goal:v })} placeholder="Goal…" /></p>
                <div className="flex items-center gap-4 mt-3">
                  <Ring size={72} stroke={10} progress={st.pct} color="#10b981"><div className="text-center"><div className="text-sm font-semibold">{st.pct}%</div><div className="text-[10px] text-black/60">{st.done}/{st.total}</div></div></Ring>
                  <div className="text-sm space-y-1"><div className="flex gap-2 items-center"><Calendar size={14} className="text-black/50"/> Start:&nbsp;<input type="date" value={m.start || ""} onChange={(e)=>updateMilestone(m.id,{ start:e.target.value })} className="border rounded px-1 py-0.5 text-xs"/></div></div>
                </div>
              </motion.div>
            ); })}
          </div>
        </section>

        {/* Tasks */}
        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
            <h2 className="font-semibold flex items-center gap-2"><ListChecks size={18}/> Tasks</h2>
            <div className="flex items-center gap-2"><Toggle value={view} onChange={setView} options={[{ id: "list", label: "List" }, { id: "board", label: "Board" }, { id: "calendar", label: "Calendar" }]} /><button onClick={() => addTask(milestoneFilter !== "all" ? milestoneFilter : undefined)} className="inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm bg-black text-white shadow hover:opacity-90"><Plus size={16}/> Add Task</button></div>
          </div>
          {view === "list" ? (
            <div>
              <div className="mb-2 inline-flex rounded-xl border border-black/10 bg-white p-1 shadow-sm text-sm">{[{id:"active",label:"Active"},{id:"done",label:"Done"}].map(t => (<button key={t.id} onClick={()=>setListTab(t.id)} className={`px-3 py-1.5 rounded-lg ${listTab===t.id?"bg-slate-900 text-white":"text-slate-700 hover:bg-slate-50"}`}>{t.label}</button>))}</div>
              {listTab === "active" ? (
                <TaskTable tasks={tasksActive} allTasks={filteredBase} team={team} milestones={milestones} onUpdate={updateTask} onDelete={deleteTask} onAddLink={(id, url)=>patchTaskLinks(id,'add',url)} onRemoveLink={(id, idx)=>patchTaskLinks(id,'remove',idx)} onDuplicate={duplicateTask} />
              ) : (
                <TaskTable tasks={tasksDone} allTasks={filteredBase} team={team} milestones={milestones} onUpdate={updateTask} onDelete={deleteTask} onAddLink={(id, url)=>patchTaskLinks(id,'add',url)} onRemoveLink={(id, idx)=>patchTaskLinks(id,'remove',idx)} onDuplicate={duplicateTask} />
              )}
            </div>
          ) : view === "board" ? (
            <BoardView tasks={filteredBase} team={team} milestones={milestones} onUpdate={updateTask} onDelete={deleteTask} onDragStart={onDragStart} onDragOverCol={onDragOverCol} onDropToCol={onDropToCol} onAddLink={(id, url)=>patchTaskLinks(id,'add',url)} onRemoveLink={(id, idx)=>patchTaskLinks(id,'remove',idx)} onDuplicate={duplicateTask} />
          ) : (
            <CalendarView monthDate={calMonth} tasks={filteredBase} milestones={milestones} team={team} onPrev={() => gotoMonth(-1)} onNext={() => gotoMonth(1)} onToday={() => setCalMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} schedule={state.schedule} />
          )}
        </section>
      </main>

      <footer className="max-w-7xl mx-auto px-4 pb-10 text-xs text-black/50">Tip: ⌘/Ctrl + Enter to commit multiline edits. Data auto-saves to your browser.</footer>
    </div>
  );
}

// =====================================================
// Table + Board components
// =====================================================
function DashboardRing({ title, subtitle, value, color, icon, mode = "percent" }) {
  const display = mode === "percent" ? `${value}%` : value; const pct = mode === "percent" ? value : undefined;
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm flex items-center gap-4">
      <Ring size={82} stroke={10} progress={pct ?? 100} color={color}><div className="text-center"><div className="text-base font-semibold leading-none">{display}</div><div className="text-[10px] text-black/60">{mode === "percent" ? "Progress" : "Count"}</div></div></Ring>
      <div className="flex-1 min-w-0"><div className="text-xs text-black/60 flex items-center gap-1">{icon} <span>{title}</span></div><div className="text-sm font-medium truncate">{subtitle}</div></div>
    </div>
  );
}
function Toggle({ value, onChange, options }) { return (<div className="inline-flex rounded-2xl border border-black/10 bg-white p-1 shadow-sm">{options.map((o)=>(<button key={o.id} onClick={()=>onChange(o.id)} className={`px-3 py-1.5 text-sm rounded-xl ${value===o.id?"bg-slate-900 text-white":"text-slate-700 hover:bg-slate-50"}`}>{o.label}</button>))}</div>); }
function AddHoliday({ onAdd }) { const [d, setD] = useState(""); return (<div className="inline-flex items-center gap-1"><input type="date" value={d} onChange={(e)=>setD(e.target.value)} className="border rounded px-2 py-1" /><button onClick={()=>{ if(d){ onAdd(d); setD(""); } }} className="px-2 py-1 text-xs rounded border border-black/10 bg-white hover:bg-slate-50">Add</button></div>); }

function TaskTable({ tasks, allTasks, team, milestones, onUpdate, onDelete, onAddLink, onRemoveLink, onDuplicate }) {
  const taskAssignableMembers = team; // include all roles
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-black/60 border-b border-black/10"><th className="py-2 pr-4">Title & Details</th><th className="py-2 pr-4">Milestone</th><th className="py-2 pr-4">Assignee</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Start</th><th className="py-2 pr-4"># of Workdays</th><th className="py-2 pr-4">Due</th><th className="py-2 pr-4">Completed</th><th className="py-2 pr-4">Dependency</th><th className="py-2">Actions</th></tr>
        </thead>
        <tbody>
          {tasks.map((t) => { const assignee = team.find((m)=>m.id===t.assigneeId); return (
            <tr key={t.id} className="border-b border-black/5 hover:bg-slate-50 align-top">
              <td className="py-2 pr-4 min-w-[320px]">
                <div className="font-medium"><InlineText value={t.title} onChange={(v)=>onUpdate(t.id,{ title:v })} /></div>
                <div className="text-xs text-black/60"><InlineText value={t.details} onChange={(v)=>onUpdate(t.id,{ details:v })} placeholder="Details…" multiline /></div>
                <div className="mt-1 text-xs text-slate-700"><span className="font-medium mr-1">Note:</span><InlineText value={t.note} onChange={(v)=>onUpdate(t.id,{ note:v })} placeholder="Add a quick note…" multiline /></div>
                <LinksEditor links={t.links} onAdd={(url)=>onAddLink(t.id,url)} onRemove={(i)=>onRemoveLink(t.id,i)} />
              </td>
              <td className="py-2 pr-4"><select value={t.milestoneId} onChange={(e)=>onUpdate(t.id,{ milestoneId:e.target.value })} className="border rounded px-2 py-1">{milestones.map((m)=>(<option key={m.id} value={m.id}>{m.title}</option>))}</select></td>
              <td className="py-2 pr-4"><div className="flex items-center gap-2">{assignee ? <Avatar name={assignee.name} roleType={assignee.roleType} /> : <span className="text-xs text-black/40">—</span>}<select value={t.assigneeId || ""} onChange={(e)=>onUpdate(t.id,{ assigneeId:e.target.value || null })} className="border rounded px-2 py-1"><option value="">Unassigned</option>{taskAssignableMembers.map((m)=>(<option key={m.id} value={m.id}>{m.name} ({m.roleType})</option>))}</select></div></td>
              <td className="py-2 pr-4"><select value={t.status} onChange={(e)=>onUpdate(t.id,{ status:e.target.value })} className={`border rounded px-2 py-1 ${statusBg(t.status)}`}><option value="todo">To Do</option><option value="inprogress">In Progress</option><option value="done">Done</option></select></td>
              <td className="py-2 pr-4">{t.status === "done" ? (<span className="text-xs text-slate-500">—</span>) : (<input type="date" value={t.startDate || ""} onChange={(e)=>onUpdate(t.id,{ startDate:e.target.value })} disabled={t.status === "todo"} className={`border rounded px-2 py-1 ${t.status === "todo" ? "bg-slate-50 text-slate-500" : ""}`} placeholder="—" />)}</td>
              <td className="py-2 pr-4"><input type="number" min={0} value={t.workDays ?? 0} onChange={(e)=>onUpdate(t.id,{ workDays:Number(e.target.value) })} className="w-24 border rounded px-2 py-1" /></td>
              <td className="py-2 pr-4"><DuePill date={t.dueDate} status={t.status} /></td>
              <td className="py-2 pr-4">{t.status === "done" ? (t.completedDate || "—") : "—"}</td>
              <td className="py-2 pr-4"><DepPicker task={t} tasks={allTasks} onUpdate={onUpdate} /></td>
              <td className="py-2"><button onClick={() => onDuplicate(t.id)} className="text-black/60 hover:text-sky-600 mr-2" title="Duplicate"><CopyIcon size={16}/></button><button onClick={() => onDelete(t.id)} className="text-red-500/80 hover:text-red-600"><Trash2 size={16}/></button></td>
            </tr>
          ); })}
        </tbody>
      </table>
    </div>
  );
}
function statusBg(status) { if (status === "done") return "bg-emerald-50"; if (status === "inprogress") return "bg-emerald-50"; return "bg-white"; }

function DepPicker({ task, tasks, onUpdate }) { const [open, setOpen] = useState(false); const peers = tasks.filter((x)=>x.milestoneId===task.milestoneId && x.id!==task.id); const current = peers.find((p)=>p.id===task.depTaskId); return (
  <div className="text-xs"><button onClick={()=>setOpen((v)=>!v)} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-black/10 bg-white hover:bg-slate-50"><GitBranch size={12}/> {current ? `Depends on: ${current.title}` : "Add dependency"}</button>{open && (<div className="mt-1"><select value={task.depTaskId || ""} onChange={(e)=>{ const val = e.target.value || null; onUpdate(task.id,{ depTaskId:val }); setOpen(false); }} className="border rounded px-2 py-1"><option value="">— none —</option>{peers.map((p)=>(<option key={p.id} value={p.id}>{p.title}</option>))}</select></div>)}</div>
); }

function BoardView({ tasks, team, milestones, onUpdate, onDelete, onDragStart, onDragOverCol, onDropToCol, onAddLink, onRemoveLink, onDuplicate }) {
  const cols = [ { id: "todo", title: "To Do" }, { id: "inprogress", title: "In Progress" }, { id: "done", title: "Done" } ];
  const taskAssignableMembers = team; const byCol = (id) => tasks.filter((t)=>t.status===id).sort((a,b)=>{ const da=a.dueDate?new Date(a.dueDate).getTime():Number.POSITIVE_INFINITY; const db=b.dueDate?new Date(b.dueDate).getTime():Number.POSITIVE_INFINITY; return da-db; });
  const [collapsedIds, setCollapsedIds] = React.useState(() => new Set()); const isCollapsed = (id) => collapsedIds.has(id); const toggleCollapse = (id) => setCollapsedIds((prev)=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  const statusPillClass = (status) => { if(status==="done") return "bg-emerald-200/80 text-emerald-900 border-emerald-300"; if(status==="inprogress") return "bg-emerald-100 text-emerald-900 border-emerald-300"; return "bg-slate-100 text-slate-700 border-slate-300"; };
  return (
    <div>
      <div className="grid md:grid-cols-3 gap-3">
        {cols.map((c) => (
          <div key={c.id} className={`rounded-xl border border-black/10 p-3 ${c.id==='inprogress' ? 'bg-emerald-50' : 'bg-white/60'}`} onDragOver={onDragOverCol} onDrop={onDropToCol(c.id)}>
            <div className="flex items-center justify-between mb-2"><div className="text-sm font-medium text-black/70">{c.title}</div></div>
            <div className="space-y-2 min-h-[140px]">
              {byCol(c.id).map((t) => { const a = team.find((m)=>m.id===t.assigneeId); const collapsed = isCollapsed(t.id); return (
                <motion.div key={t.id} className={`rounded-lg border border-black/10 p-3 shadow-sm ${c.id==='inprogress' ? 'bg-emerald-50' : 'bg-white'}`} draggable onDragStart={onDragStart(t.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><div className="text-[15px] sm:text-base font-semibold leading-tight truncate"><InlineText value={t.title} onChange={(v)=>onUpdate(t.id,{ title:v })} /></div></div>
                    <div className="flex items-center gap-1"><button onClick={()=>toggleCollapse(t.id)} className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-black/10 bg-slate-100 text-slate-600 hover:bg-slate-200" title={collapsed?'Expand':'Collapse'}>{collapsed ? <Plus size={16}/> : <Minus size={16}/>}</button><button onClick={()=>onDuplicate(t.id)} className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-black/10 bg-slate-100 text-slate-600 hover:bg-slate-200" title="Duplicate"><CopyIcon size={16}/></button><button onClick={()=>onDelete(t.id)} className="text-black/40 hover:text-red-500" title="Delete"><Trash2 size={16}/></button></div>
                  </div>
                  {collapsed ? (
                    <>
                      <div className="text-xs text-black/60 mt-1 truncate"><InlineText value={t.details} onChange={(v)=>onUpdate(t.id,{ details:v })} placeholder="Details…" /></div>
                      {t.note && <div className="text-[11px] text-slate-600 mt-1 truncate">📝 {t.note}</div>}
                      <div className="mt-2 flex items-center justify-between text-xs"><div className="flex items-center gap-2 min-w-0">{a ? <Avatar name={a.name} roleType={a.roleType} /> : <span className="text-black/40">—</span>}<span className="truncate">{a ? `${a.name} (${a.roleType})` : 'Unassigned'}</span></div><div className="flex items-center gap-2"><DuePill date={t.dueDate} status={t.status} />{t.status === "done" && <span className="text-slate-500">Completed: {t.completedDate || "—"}</span>}</div></div>
                    </>
                  ) : (
                    <>
                      <div className="mt-1"><select value={t.status} onChange={(e)=>onUpdate(t.id,{ status:e.target.value })} className={`px-2 py-1 rounded-full border font-semibold text-xs ${statusPillClass(t.status)}`}><option value="todo">To Do</option><option value="inprogress">In Progress</option><option value="done">Done</option></select></div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <select value={t.milestoneId} onChange={(e)=>onUpdate(t.id,{ milestoneId:e.target.value })} className="border rounded px-1.5 py-1">{milestones.map((m)=>(<option key={m.id} value={m.id}>{m.title}</option>))}</select>
                        <div className="flex items-center gap-1">{a ? <Avatar name={a.name} roleType={a.roleType} /> : <span className="text-black/40">—</span>}<select value={t.assigneeId || ""} onChange={(e)=>onUpdate(t.id,{ assigneeId:e.target.value || null })} className="border rounded px-1.5 py-1"><option value="">Unassigned</option>{taskAssignableMembers.map((m)=>(<option key={m.id} value={m.id}>{m.name} ({m.roleType})</option>))}</select></div>
                        <div className="flex items-center gap-2"><span>Start</span>{t.status === "done" ? (<span className="text-slate-500 text-xs">—</span>) : (<input type="date" value={t.startDate || ""} onChange={(e)=>onUpdate(t.id,{ startDate:e.target.value })} disabled={t.status === "todo"} className={`border rounded px-1.5 py-1 ${t.status === "todo" ? "bg-slate-50 text-slate-500" : ""}`} />)}</div>
                        <div className="flex items-center gap-2"><span># of Workdays</span><input type="number" min={0} value={t.workDays ?? 0} onChange={(e)=>onUpdate(t.id,{ workDays:Number(e.target.value) })} className="w-20 border rounded px-1.5 py-1" /></div>
                        <div className="basis-full w-full"><DocumentInput onAdd={(url)=>onAddLink(t.id,url)} />{t.links && t.links.length>0 && (<LinkChips links={t.links} onRemove={(i)=>onRemoveLink(t.id,i)} />)}</div>
                        <div className="basis-full text-xs text-slate-700"><span className="font-medium mr-1">Note:</span><InlineText value={t.note} onChange={(v)=>onUpdate(t.id,{ note:v })} placeholder="Add a quick note…" multiline /></div>
                        <DepPicker task={t} tasks={tasks} onUpdate={onUpdate} />
                        <div className="ml-auto flex items-center gap-2"><DuePill date={t.dueDate} status={t.status} />{t.status === "done" && <span className="text-slate-500">Completed: {t.completedDate || "—"}</span>}</div>
                      </div>
                    </>
                  )}
                </motion.div>
              ); })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// User Dashboard (NEW)
// =====================================================
function UserDashboard({ onBack, onOpenCourse }) {
  const [courses, setCourses] = useState(() => loadCourses());
  useEffect(() => {
    const onStorage = () => setCourses(loadCourses());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  useEffect(() => {
    (async () => {
      const remote = await loadCoursesRemote();
      if (remote.length) {
        saveCourses(remote);
        setCourses(remote);
      }
    })();
  }, []);

  const [taskView, setTaskView] = useState('list');
  const [saveState, setSaveState] = useState('saved');
  const updateTaskStatus = (courseId, taskId, status) => {
    setCourses((cs) => cs.map((c) => c.course.id === courseId ? { ...c, tasks: c.tasks.map((t) => t.id === taskId ? { ...t, status } : t) } : c));
    setSaveState('unsaved');
  };
  const handleSave = async () => {
    setSaveState('saving');
    saveCourses(courses);
    await saveCoursesRemote(courses);
    setSaveState('saved');
  };
  const cycleStatus = (s) => (s === 'todo' ? 'inprogress' : s === 'inprogress' ? 'done' : 'todo');
  const [calMonth, setCalMonth] = useState(() => new Date());

  const members = useMemo(() => {
    const map = new Map();
    courses.forEach((c) => c.team.forEach((m) => { if (!map.has(m.id)) map.set(m.id, m); }));
    return Array.from(map.values());
  }, [courses]);

  const [userId, setUserId] = useState(() => members[0]?.id || '');
  const user = members.find((m) => m.id === userId);

  const myCourses = useMemo(() => courses.filter((c) => c.team.some((m) => m.id === userId)), [courses, userId]);
  const myTasks = useMemo(() => {
    const arr = [];
    courses.forEach((c) => {
      c.tasks.forEach((t) => {
        if (t.assigneeId === userId) arr.push({ ...t, courseId: c.course.id, courseName: c.course.name });
      });
    });
    return arr.sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return da - db;
    });
  }, [courses, userId]);
  const groupedTasks = useMemo(() => {
    const g = { todo: [], inprogress: [], done: [] };
    myTasks.forEach((t) => { if (g[t.status]) g[t.status].push(t); });
    return g;
  }, [myTasks]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/80 border-b border-black/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"><ArrowLeft size={16}/> Back</button>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-semibold truncate">User Dashboard</div>
              {user && <div className="text-xs text-black/60 truncate">{user.name}</div>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={userId} onChange={(e)=>setUserId(e.target.value)} className="text-sm border rounded px-2 py-1">
              {members.map((m)=> (<option key={m.id} value={m.id}>{m.name} ({m.roleType})</option>))}
            </select>
            <button onClick={handleSave} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50">Save</button>
            <span className="text-xs text-black/60">
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Unsaved'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <section>
          <h2 className="text-lg font-semibold mb-2">My Courses</h2>
          {myCourses.length === 0 ? (
            <div className="text-sm text-black/60">No courses</div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {myCourses.map((c) => {
                const tCount = c.tasks.filter((t) => t.assigneeId === userId).length;
                return (
                  <li key={c.course.id} className="rounded-xl border border-black/10 bg-white p-4 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.course.name}</div>
                      <div className="text-xs text-black/60 truncate">{tCount} task{tCount!==1?'s':''}</div>
                    </div>
                    <button onClick={()=>onOpenCourse(c.course.id)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm bg-slate-900 text-white shadow">Open</button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">My Tasks</h2>
          {myTasks.length === 0 ? (
            <div className="text-sm text-black/60">No tasks assigned.</div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setTaskView('list')} className={`px-2 py-1 text-xs rounded border ${taskView==='list'?'bg-slate-900 text-white border-slate-900':'bg-white border-black/10'}`}>List</button>
                <button onClick={() => setTaskView('board')} className={`px-2 py-1 text-xs rounded border ${taskView==='board'?'bg-slate-900 text-white border-slate-900':'bg-white border-black/10'}`}>Board</button>
                <button onClick={() => setTaskView('calendar')} className={`px-2 py-1 text-xs rounded border ${taskView==='calendar'?'bg-slate-900 text-white border-slate-900':'bg-white border-black/10'}`}>Calendar</button>
              </div>
              {taskView === 'list' && (
                <div className="space-y-2">
                  {myTasks.map((t) => (
                    <div key={t.id} className="rounded-xl border border-black/10 bg-white p-3 text-sm flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{t.title}</div>
                        <div className="text-xs text-black/60 truncate">{t.courseName}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select value={t.status} onChange={(e)=>updateTaskStatus(t.courseId, t.id, e.target.value)} className="text-xs border rounded px-1 py-0.5">
                          <option value="todo">To do</option>
                          <option value="inprogress">In progress</option>
                          <option value="done">Done</option>
                        </select>
                        <DuePill date={t.dueDate} status={t.status} />
                        <button onClick={() => onOpenCourse(t.courseId)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs bg-slate-900 text-white shadow">Open</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {taskView === 'board' && (
                <div className="grid gap-4 sm:grid-cols-3">
                  {['todo','inprogress','done'].map((s) => (
                    <div key={s} className="rounded-xl border border-black/10 bg-white p-2">
                      <div className="font-medium text-sm capitalize mb-2">{s}</div>
                      <div className="space-y-2">
                        {groupedTasks[s].map((t) => (
                          <div key={t.id} className="p-2 rounded border border-black/10 bg-slate-50 text-sm">
                            <div className="font-medium truncate">{t.title}</div>
                            <select value={t.status} onChange={(e)=>updateTaskStatus(t.courseId, t.id, e.target.value)} className="mt-1 text-xs border rounded px-1 py-0.5">
                              <option value="todo">To do</option>
                              <option value="inprogress">In progress</option>
                              <option value="done">Done</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {taskView === 'calendar' && (
                <CalendarView
                  monthDate={calMonth}
                  tasks={myTasks}
                  milestones={[]}
                  team={[]}
                  onPrev={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
                  onNext={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
                  onToday={() => setCalMonth(new Date())}
                  schedule={loadGlobalSchedule()}
                  onTaskClick={(t) => updateTaskStatus(t.courseId, t.id, cycleStatus(t.status))}
                />
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

// =====================================================
// Courses Hub (NEW)
// =====================================================
function computeTotals(state) {
  const tasks = state.tasks || []; const total = tasks.length; const done = tasks.filter((t)=>t.status==="done").length; const inprog = tasks.filter((t)=>t.status==="inprogress").length; const todo = total - done - inprog; const pct = total ? Math.round((done/total)*100) : 0; const nextDue = tasks.filter((t)=>t.status!=="done" && t.dueDate).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate))[0]?.dueDate || null; return { total, done, inprog, todo, pct, nextDue };
}
function CoursesHub({ onOpenCourse, onEditTemplate, onAddCourse, onOpenUser }) {
  const [courses, setCourses] = useState(() => loadCourses());
  useEffect(() => { const onStorage = () => setCourses(loadCourses()); window.addEventListener('storage', onStorage); return () => window.removeEventListener('storage', onStorage); }, []);
  const removeCourse = (id) => { const next = courses.filter((c)=>c.id!==id); saveCourses(next); setCourses(next); };
  const duplicateCourse = (id) => { const src = courses.find((c)=>c.id===id); if(!src) return; const copy = JSON.parse(JSON.stringify(src)); copy.id = uid(); copy.course.id = copy.id; copy.course.name = `${src.course.name} (copy)`; const next = [...courses, copy]; saveCourses(next); setCourses(next); };
  const open = (id) => onOpenCourse(id);
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/80 border-b border-black/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500"/>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-semibold truncate">DART: Design and Development Accountability and Responsibility Tracker</div>
              <div className="text-xs text-black/60 truncate">Courses Hub</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onOpenUser} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"><Users size={16}/> User View</button>
            <button onClick={onEditTemplate} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"><CopyIcon size={16}/> Edit Template</button>
            <button onClick={onAddCourse} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-black text-white shadow"><Plus size={16}/> Add Course</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {courses.length === 0 ? (
          <div className="rounded-2xl border border-black/10 bg-white p-6 text-center">
            <div className="text-lg font-semibold mb-2">No courses yet</div>
            <p className="text-sm text-black/60 mb-4">Use your Course Template to spin up your first course.</p>
            <button onClick={onAddCourse} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-black text-white shadow"><Plus size={16}/> Add Course</button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => { const t = computeTotals(c); return (
              <motion.div
                key={c.id}
                layout
                role="button"
                tabIndex={0}
                aria-label={`Open ${c.course.name}`}
                onClick={() => open(c.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') open(c.id); }}
                className="group rounded-2xl border border-black/10 bg-white p-4 shadow-sm cursor-pointer hover:ring-2 hover:ring-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><div className="font-semibold truncate">{c.course.name}</div><div className="text-xs text-black/60 truncate">{c.course.description}</div></div>
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <Ring size={72} stroke={10} progress={t.pct} color="#10b981"><div className="text-center"><div className="text-sm font-semibold">{t.pct}%</div><div className="text-[10px] text-black/60">{t.done}/{t.total}</div></div></Ring>
                  <div className="text-xs space-y-1"><div>In progress: <b>{t.inprog}</b></div><div>To do: <b>{t.todo}</b></div><div>Next due: <b>{t.nextDue || '—'}</b></div></div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={(e)=>{ e.stopPropagation(); open(c.id); }} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm bg-slate-900 text-white shadow">Open</button>
                  <button onClick={(e)=>{ e.stopPropagation(); duplicateCourse(c.id); }} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"><CopyIcon size={16}/> Duplicate</button>
                  <button onClick={(e)=>{ e.stopPropagation(); if(confirm('Delete this course?')) removeCourse(c.id); }} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm bg-white border border-black/10 text-rose-600 shadow-sm hover:bg-rose-50"><Trash2 size={16}/> Delete</button>
                </div>
              </motion.div>
            ); })}
          </div>
        )}
      </main>
    </div>
  );
}

// =====================================================
// Root App – switches between Hub and Course Dashboard
// =====================================================
export default function PMApp() {
  const [view, setView] = useState(() => {
    const hasCourses = loadCourses().length > 0; return hasCourses ? "hub" : "hub"; // start at hub
  });
  const [prevView, setPrevView] = useState("hub");
  const [currentCourseId, setCurrentCourseId] = useState(null);
  const openCourse = (id) => { setPrevView(view); setCurrentCourseId(id); setView("course"); };
  const openUser = () => { setPrevView(view); setView("user"); };
  const editTemplate = () => { setPrevView(view); setCurrentCourseId("__TEMPLATE__"); setView("course"); };
  const addCourse = () => {
    const tpl = loadTemplate() || remapSeed(seed());
    const base = remapSeed(JSON.parse(JSON.stringify(tpl)));
    base.course = { ...base.course, id: uid(), name: base.course.name || "New Course" };
    const all = loadCourses(); const next = [...all, base]; saveCourses(next);
    setPrevView(view);
    setCurrentCourseId(base.course.id); setView("course");
  };
  const onBack = () => { setView(prevView); setPrevView("hub"); setCurrentCourseId(null); };

  if (view === "hub") {
    return <CoursesHub onOpenCourse={openCourse} onEditTemplate={editTemplate} onAddCourse={addCourse} onOpenUser={openUser} />;
  }

  if (view === "user") {
    return <UserDashboard onBack={onBack} onOpenCourse={openCourse} />;
  }

  // Course mode
  if (currentCourseId === "__TEMPLATE__") {
    // open template editor
    const tpl = loadTemplate() || remapSeed(seed());
    const boot = { ...remapSeed(JSON.parse(JSON.stringify(tpl))), schedule: loadGlobalSchedule() };
    const handleChange = (s) => { saveTemplate(s); };
    return <CoursePMApp boot={boot} isTemplateLabel={true} onBack={onBack} onStateChange={handleChange} />;
  }
  // open selected course
  const courses = loadCourses();
  const course = courses.find((c)=>c.id===currentCourseId || c.course.id===currentCourseId) || courses[0];
  const handleCourseChange = (s) => {
    const next = loadCourses().map((c)=> (c.id===currentCourseId || c.course.id===currentCourseId) ? s : c );
    saveCourses(next);
  };
  return <CoursePMApp boot={course} isTemplateLabel={false} onBack={onBack} onStateChange={handleCourseChange} />;
}

// =====================================================
// Lightweight tests (console)
// =====================================================
function runTests() {
  try {
    const dueMon = addBusinessDays("2025-01-10", 1, [1,2,3,4,5], []); // Fri + 1 -> Mon 13
    console.assert(dueMon === "2025-01-13", `addBusinessDays Fri+1 -> Mon failed: ${dueMon}`);

    const dueTueSkipHoliday = addBusinessDays("2025-01-10", 1, [1,2,3,4,5], ["2025-01-13"]);
    console.assert(dueTueSkipHoliday === "2025-01-14", `addBusinessDays skip holiday failed: ${dueTueSkipHoliday}`);

    (function(){
      const schedule = { workweek:[1,2,3,4,5], holidays:[] };
      const predecessorDue = "2025-01-10"; // Fri
      const succStart = predecessorDue;
      const succDue = addBusinessDays(succStart, 2, schedule.workweek, schedule.holidays); // Mon+Tue => Tue 14
      console.assert(succStart === "2025-01-10", `forecast start equals predecessor due: ${succStart}`);
      console.assert(succDue === "2025-01-14", `forecast due should be Tue 14: ${succDue}`);
    })();

    (function(){
      const today = todayStr();
      const t = { status:"done", completedDate:"" };
      const completed = t.completedDate || today;
      console.assert(completed === today, `completedDate should stamp today: ${completed}`);
    })();

    (function(){
      const sched = { workweek:[0,6], holidays:[] }; // weekends only
      const start = "2025-01-09"; // Thu
      const due = addBusinessDays(start, 1, sched.workweek, sched.holidays); // next weekend day => Sat 11
      console.assert(due === "2025-01-11" || due === "2025-01-12", `custom workweek calc unexpected: ${due}`);
    })();
  } catch (e) {
    console.warn('Test runner error', e);
  }
}
runTests();
