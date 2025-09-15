import React, { useEffect, useMemo, useState, useRef, Fragment, useCallback } from "react";
import { useIsMobile } from "./hooks/use-is-mobile.js";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import {
  Plus,
  Calendar,
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
  Minus,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Volume2,
  VolumeX,
  MoreHorizontal,
} from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import MilestoneCard from "./MilestoneCard.jsx";
import TeamMembersSection from "./components/TeamMembersSection.jsx";
import SectionCard from "./components/SectionCard.jsx";
import Avatar from "./components/Avatar.jsx";
import InlineText from "./components/InlineText.jsx";
import DuePill from "./components/DuePill.jsx";
import { LinksEditor, LinkChips } from "./components/LinksEditor.jsx";
import DocumentInput from "./components/DocumentInput.jsx";
import AddHoliday from "./components/AddHoliday.jsx";
import DepPicker from "./components/DepPicker.jsx";
import CalendarView from "./components/CalendarView.jsx";
import TaskModal from "./components/TaskModal.jsx";
import TaskCard from "./TaskCard.jsx";
import { SoundContext } from "./sound-context.js";
import pkg from "../package.json";
import {
  uid,
  todayStr,
  fmt,
  clamp,
  rolePalette,
  roleOrder,
  roleColor,
  nextMemberName,
  isHoliday,
  isWorkday,
  addBusinessDays
} from "./utils.js";

/**
 * Course Hub + Course Dashboard – Health-style PM (v12)
 * -----------------------------------------------------
 * NEW (this patch):
 * • Prominent **Back to Courses** button (filled style)
 * • **Tap course card** opens it (mobile-friendly); inner action buttons stop propagation
 * • Task card **Note** field (freeform notes)
 * • Header/banner shows **DART: Design and Development Accountability and Responsibility Tracker**
 */


// Predefined emoji choices for user avatars
const AVATAR_CHOICES = [
  "😀","😎","🤓","😂","😍","🥰","😇","😉","🙃","😛",
  "🤠","😺","🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼",
  "🐨","🐯","🦁","🐮","🐷","🐸","🐵","🦄","🐝","🐢"
];


// =====================================================
// Utilities
// =====================================================
// utilities moved to utils.js

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
const loadTemplateRemote = async () => {
  try {
    const snap = await getDoc(doc(db, 'app', 'template'));
    return snap.exists() ? snap.data().template || null : null;
  } catch {
    return null;
  }
};
const saveTemplateRemote = async (tpl) => {
  try {
    await setDoc(doc(db, 'app', 'template'), { template: tpl });
  } catch {}
};
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

const loadScheduleRemote = async () => {
  try {
    const snap = await getDoc(doc(db, 'app', 'schedule'));
    return snap.exists() ? snap.data().schedule || defaultSchedule : null;
  } catch {
    return null;
  }
};
const saveScheduleRemote = async (sched) => {
  try {
    await setDoc(doc(db, 'app', 'schedule'), { schedule: sched });
  } catch {}
};

const loadPeopleRemote = async () => {
  try {
    const snap = await getDoc(doc(db, 'app', 'people'));
    return snap.exists() ? snap.data().people || [] : [];
  } catch {
    return [];
  }
};
const savePeopleRemote = async (arr) => {
  try {
    await setDoc(doc(db, 'app', 'people'), { people: arr });
  } catch {}
};

// =====================================================
// People Store (global team members)
// =====================================================
const PEOPLE_KEY = "healthPM:people:v1";
const loadPeople = () => {
  try {
    const raw = localStorage.getItem(PEOPLE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const savePeople = (arr) => {
  try {
    localStorage.setItem(PEOPLE_KEY, JSON.stringify(arr));
  } catch {}
};
const syncPeopleToCourses = (people) => {
  const courses = loadCourses();
  const updated = courses.map((c) => ({
    ...c,
    team: c.team.map((m) => {
      const p = people.find((p) => p.id === m.id);
      return p ? { ...m, ...p } : m;
    }),
  }));
  saveCourses(updated);
  saveCoursesRemote(updated).catch(() => {});
};

// =====================================================
// Seed + Migration
// =====================================================
const seed = () => ({
  course: { id: uid(), name: "Intro to Learning Design", description: "From analysis to deployment, track the whole build.", accent: "from-fuchsia-500 via-pink-500 to-rose-500", courseLDIds: [], courseSMEIds: [] },
  schedule: { workweek: [1,2,3,4,5], holidays: [] }, // back-compat; overridden by global
  team: [
    { id: uid(), name: "Alex Cruz", roleType: "LD",  color: roleColor("LD"),  avatar: "" },
    { id: uid(), name: "Dr. Reyes", roleType: "SME", color: roleColor("SME"), avatar: "" },
    { id: uid(), name: "Pat Santos", roleType: "PM",  color: roleColor("PM"),  avatar: "" },
    { id: uid(), name: "Jae Lim", roleType: "MM",     color: roleColor("MM"),   avatar: "" },
    { id: uid(), name: "Rio Tan", roleType: "PA",     color: roleColor("PA"),   avatar: "" },
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
  s.tasks.forEach((t) => {
    if (typeof t.milestoneId === 'number') {
      t.milestoneId = msIds[t.milestoneId] ?? msIds[0];
    } else if (!msIds.includes(t.milestoneId)) {
      t.milestoneId = msIds[0];
    }
  });
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
  s.team = s.team.map((m) => ({ ...m, color: roleColor(m.roleType), avatar: m.avatar || "" }));
  const LD = s.team.find((m) => m.roleType === "LD");
  const SME = s.team.find((m) => m.roleType === "SME");
  s.course.courseLDIds  = s.course.courseLDIds?.length  ? s.course.courseLDIds  : (LD  ? [LD.id]  : []);
  s.course.courseSMEIds = s.course.courseSMEIds?.length ? s.course.courseSMEIds : (SME ? [SME.id] : []);
  if (s.course.courseLDIds.length) {
    const defaultLd = s.course.courseLDIds[0];
    s.tasks = s.tasks.map((t) => ({ ...t, assigneeId: t.assigneeId ?? defaultLd }));
  }
  return s;
};

// =====================================================
// Avatar, Ring, DuePill, Inputs, etc.
// =====================================================
function Ring({ className = "w-20 h-20", stroke = 10, progress = 0, trackOpacity = 0.15, color = "#111827", children }) {
  const r = 50 - stroke / 2;
  const c = 2 * Math.PI * r;
  const pct = clamp(progress, 0, 100);
  const dash = (pct / 100) * c;
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 rotate-[-90deg]">
        <circle
          cx="50"
          cy="50"
          r={r}
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-black/10"
          style={{ opacity: trackOpacity }}
          fill="none"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center select-none">{children}</div>
    </div>
  );
}

// =====================================================
// Course Dashboard (formerly default export)
// =====================================================
function CoursePMApp({ boot, isTemplateLabel = false, onBack, onStateChange, people = [], onOpenUser }) {
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
  const isMobile = useIsMobile();
  const [milestonesCollapsed, setMilestonesCollapsed] = useState(isMobile);
  const [saveState, setSaveState] = useState('saved');
  const firstRun = useRef(true);

  useEffect(() => {
    setMilestonesCollapsed(isMobile);
  }, [isMobile]);

  useEffect(() => {
    setState((s) => ({
      ...s,
      team: s.team.map((m) => {
        const p = people.find((p) => p.id === m.id);
        return p ? { ...m, ...p } : m;
      }),
    }));
  }, [people]);

  // Persist
  useEffect(() => { localStorage.setItem("healthPM:state:v8", JSON.stringify(state)); }, [state]);
  useEffect(() => { saveGlobalSchedule(state.schedule); }, [state.schedule]);
  useEffect(() => {
    onStateChange?.(state);
    if (firstRun.current) {
      firstRun.current = false;
    } else {
      setSaveState('unsaved');
    }
  }, [state, onStateChange]);

const handleSave = async () => {
  setSaveState('saving');
  const all = loadCourses();
  const idx = all.findIndex(
    (c) => c.id === state.course.id || c.course?.id === state.course.id
  );
  if (idx >= 0) all[idx] = state;
  else all.push(state);
  saveCourses(all);
  await saveCoursesRemote(all);
  onStateChange?.(state);
  setSaveState('saved');
};

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

  const sortByDep = (arr) => {
    const ordered = [...arr].sort(
      (a, b) => dueKey(a) - dueKey(b) || (a.title || "").localeCompare(b.title || "")
    );
    const map = new Map(ordered.map((t) => [t.id, t]));
    const visited = new Set();
    const stack = new Set();
    const res = [];
    const visit = (task) => {
      if (visited.has(task.id)) return;
      if (stack.has(task.id)) {
        stack.delete(task.id);
        visited.add(task.id);
        res.push(task);
        return;
      }
      stack.add(task.id);
      if (task.depTaskId && map.has(task.depTaskId)) visit(map.get(task.depTaskId));
      stack.delete(task.id);
      visited.add(task.id);
      res.push(task);
    };
    ordered.forEach(visit);
    return res;
  };

const filteredTasks = useMemo(() => (milestoneFilter === "all" ? tasksRaw : tasksRaw.filter((t) => t.milestoneId === milestoneFilter)), [tasksRaw, milestoneFilter]);
const groupedTasks = useMemo(() => {
  return filteredTasks.reduce((acc, t) => {
    (acc[t.milestoneId] ||= []).push(t);
    return acc;
  }, {});
}, [filteredTasks]);
const filteredMilestones = useMemo(() => (milestoneFilter === "all" ? milestones : milestones.filter((m) => m.id === milestoneFilter)), [milestones, milestoneFilter]);
const tasksActive = useMemo(() => {
  const arr = filteredTasks.filter((t) => t.status !== "done");
  return sortByDep(arr);
}, [filteredTasks]);
const tasksDone = useMemo(() => {
  const arr = filteredTasks.filter((t) => t.status === "done");
  return sortByDep(arr);
}, [filteredTasks]);

  const totals = useMemo(() => {
    const total = tasksRaw.length; const done = tasksRaw.filter((t)=>t.status==="done").length; const inprog = tasksRaw.filter((t)=>t.status==="inprogress").length; const todo = total - done - inprog; const overdue = tasksRaw.filter((t)=>t.status!=="done" && t.dueDate && new Date(t.dueDate) < new Date(todayStr())).length; return { total, done, inprog, todo, overdue, pct: total ? Math.round((done/total)*100) : 0 };
  }, [tasksRaw]);


  const recomputeDue = (t, patch = {}) => { const start = patch.startDate ?? t.startDate; const work = patch.workDays ?? t.workDays; const due = start ? addBusinessDays(start, work, state.schedule.workweek, state.schedule.holidays) : ""; return { ...patch, dueDate: due }; };
  const propagateDependentForecasts = (tasks, schedule) => { const map = new Map(tasks.map((t)=>[t.id,t])); return tasks.map((t)=>{ if(!t.depTaskId || t.status==="done") return t; const src = map.get(t.depTaskId); if(!src) return t; const startForecast = src.dueDate || ""; if (t.status !== "inprogress" && startForecast) { const due = addBusinessDays(startForecast, t.workDays, schedule.workweek, schedule.holidays); return { ...t, startDate: startForecast, dueDate: due }; } return t; }); };

  const updateTask = (id, patch) => {
    let nextState = null;
    setState((s) => {
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
      nextState = { ...s, tasks: tasks3 };
      return nextState;
    });

    if (nextState) {
      setSaveState('saving');
      const all = loadCourses();
      const idx = all.findIndex((c) => c.id === nextState.course.id || c.course?.id === nextState.course.id);
      if (idx >= 0) all[idx] = nextState; else all.push(nextState);
      saveCourses(all);
      saveCoursesRemote(all).finally(() => setSaveState('saved'));
      onStateChange?.(nextState);
    }
  };

  const addTask = (milestoneId) => setState((s) => ({ ...s, tasks: [...s.tasks, { id: uid(), order: s.tasks.length, title: "New Task", details: "", note: "", links: [], depTaskId: null, assigneeId: s.course.courseLDIds[0] || (s.team.find((m)=>m.roleType==='LD')?.id ?? null), milestoneId: milestoneId || s.milestones[0]?.id, status: "todo", startDate: "", workDays: 1, dueDate: "", completedDate: "" }] }));
  const duplicateTask = (id) => setState((s) => { const orig = s.tasks.find((t)=>t.id===id); if(!orig) return s; const clone = { ...orig, id: uid(), order: s.tasks.length, title: `${orig.title} (copy)`, status: "todo", startDate: "", dueDate: "", completedDate: "", depTaskId: null }; return { ...s, tasks: [...s.tasks, clone] }; });
  const patchTaskLinks = (id, op, payload) => setState((s)=>({ ...s, tasks: s.tasks.map((t)=>{ if(t.id!==id) return t; const links = Array.isArray(t.links)?[...t.links]:[]; if(op==='add') links.push(payload); if(op==='remove') links.splice(payload,1); return { ...t, links }; }) }));
  const deleteTask = (id) => setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));

  const updateMilestone  = (id, patch) => setState((s)=>({ ...s, milestones: s.milestones.map((m)=>(m.id===id?{...m,...patch}:m)) }));
  const addMilestone     = () => setState((s)=>({ ...s, milestones: [...s.milestones, { id: uid(), title: "New Milestone", start: todayStr(), goal: "" }] }));
  const deleteMilestone  = (id) => setState((s)=>({ ...s, milestones: s.milestones.filter((m)=>m.id!==id), tasks: s.tasks.map((t)=>(t.milestoneId===id?{...t, milestoneId: s.milestones[0]?.id}:t)) }));
  const duplicateMilestone = (id) => setState((s)=>{ const src = s.milestones.find((m)=>m.id===id); if(!src) return s; const newMs = { id: uid(), title: `${src.title} (copy)`, start: src.start, goal: src.goal }; const related = s.tasks.filter((t)=>t.milestoneId===id); const nextOrder = s.tasks.length; const ld = s.course.courseLDIds[0] || (s.team.find((m)=>m.roleType==='LD')?.id ?? null); const clonedTasks = related.map((t,i)=>({ ...t, id: uid(), order: nextOrder+i, milestoneId: newMs.id, status: "todo", startDate: "", dueDate: "", completedDate: "", assigneeId: ld, depTaskId: null })); return { ...s, milestones: [...s.milestones, newMs], tasks: [...s.tasks, ...clonedTasks] }; });

  // Milestone DnD

  const dragMilestoneId = useRef(null);
  const [dragMilestoneOverId, setDragMilestoneOverId] = useState(null);
  const onMilestoneDragStart = (id) => (e) => {
    dragMilestoneId.current = id;
    e.dataTransfer.effectAllowed = "move";
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
    e.dataTransfer.setDragImage(img, 0, 0);
  };
  const onMilestoneDragOver = (id) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragMilestoneOverId(id);
  };
  const onMilestoneDragLeave = () => setDragMilestoneOverId(null);
  const onMilestoneDrop = (targetId) => (e) => {
    e.preventDefault();
    const srcId = dragMilestoneId.current;
    dragMilestoneId.current = null;
    setDragMilestoneOverId(null);
    if (!srcId || srcId === targetId) return;
    setState((s) => {
      const ms = [...s.milestones];
      const from = ms.findIndex((m) => m.id === srcId);
      if (from === -1) return s;
      const [moved] = ms.splice(from, 1);
      let to = targetId ? ms.findIndex((m) => m.id === targetId) : ms.length;
      if (to === -1) to = ms.length;
      ms.splice(to, 0, moved);
      return { ...s, milestones: ms };
    });
  };

  // Members
  const updateMember = (id, patch) => setState((s)=>({ ...s, team: s.team.map((m)=>{ if(m.id!==id) return m; const next={...m,...patch}; if(patch.roleType) next.color = roleColor(patch.roleType); return next; }) }));
  const addMember    = () => setState((s)=>({ ...s, team: [...s.team, { id: uid(), name: nextMemberName(s.team), roleType:"Other", color: roleColor("Other"), avatar: "" }] }));
  const addExistingMember = (pid) => setState((s)=>{
    if (s.team.some((m)=>m.id===pid)) return s;
    const person = people.find((p)=>p.id===pid);
    if (!person) return s;
    return { ...s, team: [...s.team, { ...person }] };
  });
  const deleteMember = (id) => setState((s)=>({ ...s, team: s.team.filter((m)=>m.id!==id), course: { ...s.course, courseLDIds: s.course.courseLDIds.filter((mId)=>mId!==id), courseSMEIds: s.course.courseSMEIds.filter((mId)=>mId!==id) }, tasks: s.tasks.map((t)=>(t.assigneeId===id?{...t, assigneeId:null}:t)) }));
  const toggleCourseWide = (kind, id) =>
    setState((s) => {
      const key = kind === "LD" ? "courseLDIds" : "courseSMEIds";
      const list = new Set(s.course[key]);
      list.has(id) ? list.delete(id) : list.add(id);
      const course = { ...s.course, [key]: Array.from(list) };
      let tasks = s.tasks;
      if (kind === "LD") {
        const defaultLd = course.courseLDIds[0] || null;
        tasks = s.tasks.map((t) =>
          t.assigneeId ? t : { ...t, assigneeId: defaultLd }
        );
      }
      return { ...s, course, tasks };
    });

   // Task DnD columns
  const dragTaskId = useRef(null);
  const onDragStart = (id) => (e) => { dragTaskId.current = id; e.dataTransfer.effectAllowed = "move"; };
  const onDragOverCol = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onDropToCol = (status) => (e) => { e.preventDefault(); const id = dragTaskId.current; if(!id) return; const t = state.tasks.find((x)=>x.id===id); let patch = { status }; if (t && status === "inprogress" && !t.startDate) { patch.startDate = todayStr(); } if (t && status === "todo") { patch.startDate = ""; patch.dueDate = ""; } patch = ("startDate" in patch || "workDays" in patch) ? recomputeDue(t, patch) : patch; updateTask(id, patch); dragTaskId.current = null; };

  // Calendar
  const [calMonth, setCalMonth] = useState(() => { const d=new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const gotoMonth = (offset) => setCalMonth((m)=>new Date(m.getFullYear(), m.getMonth()+offset, 1));
  const [editing, setEditing] = useState(null);
  const editingTask = state.tasks.find((t) => t.id === editing?.taskId) || null;

  const [actionsOpen, setActionsOpen] = useState(false);

  const memberById = (id) => team.find((m) => m.id === id) || null;

  const ActionButtons = () => (
    <>
      <button
        onClick={handleSave}
        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"
      >
        Save
      </button>
      <span className="text-sm text-black/60">
        {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Unsaved'}
      </span>
      <button
        onClick={() => {
          if (confirm("Reset to fresh sample data?")) setState(remapSeed(seed()));
        }}
        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"
      >
        <RefreshCcw size={16} /> Reset
      </button>
      <button
        onClick={async () => {
          saveTemplate(state);
          await saveTemplateRemote(state).catch(() => {});
        }}
        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"
      >
        <CopyIcon size={16} /> Save as Template
      </button>
      <button
        onClick={async () => {
          const tpl = (await loadTemplateRemote()) || loadTemplate();
          if (tpl)
            setState({ ...remapSeed(tpl), schedule: loadGlobalSchedule() });
          else alert("No template saved yet.");
        }}
        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"
      >
        <RefreshCcw size={16} /> Reset to Template
      </button>
      <label className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50 cursor-pointer">
        <Upload size={16} /> Import
        <input
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) =>
            e.target.files?.[0] &&
            (() => {
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const incoming = remapSeed(JSON.parse(reader.result));
                  setState((s) => ({
                    ...incoming,
                    schedule: loadGlobalSchedule(),
                  }));
                } catch {
                  alert("Invalid JSON");
                }
              };
              reader.readAsText(e.target.files[0]);
            })()
          }
        />
      </label>
      <button
        onClick={() => {
          const { schedule, ...rest } = state;
          const toSave = {
            ...rest,
            schedule: { workweek: [1, 2, 3, 4, 5], holidays: [] },
          };
          const blob = new Blob([JSON.stringify(toSave, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `course-pm-${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }}
        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"
      >
        <Download size={16} /> Export
      </button>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/80 border-b border-black/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-slate-900 text-white border border-slate-900 shadow-sm hover:bg-slate-800"><ArrowLeft size={16}/> Back to Courses</button>
          )}
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${state.course.accent} shadow-sm`} />
          {/* DART banner title */}
          <div className="hidden sm:block text-sm sm:text-base font-semibold text-slate-800 truncate">DART: Design and Development Accountability and Responsibility Tracker</div>
          <div className="flex-1" />
          <div className="w-full flex justify-end sm:w-auto">
            <div className="hidden sm:flex flex-wrap items-center gap-2">
              <ActionButtons />
            </div>
            <div className="relative sm:hidden">
              <button
                onClick={() => setActionsOpen((v) => !v)}
                className="inline-flex items-center justify-center rounded-xl p-2 bg-white border border-black/10 shadow-sm hover:bg-slate-50"
                aria-label="Toggle actions menu"
                aria-expanded={actionsOpen}
                aria-controls="actions-menu"
              >
                <MoreHorizontal size={16} />
              </button>
              {actionsOpen && (
                <div
                  id="actions-menu"
                  className="absolute right-0 mt-2 z-10 w-56 rounded-xl border border-black/10 bg-white p-2 shadow-lg flex flex-col gap-2"
                >
                  <ActionButtons />
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Secondary row: course title and template pill */}
        <div className="max-w-7xl mx-auto px-4 pb-3 -mt-2">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-semibold leading-tight"><InlineText value={state.course.name} onChange={(v)=>setState((s)=>({ ...s, course: { ...s.course, name: v } }))} /></h1>
            {isTemplateLabel && <span className="text-sm px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200">Course Template</span>}
          </div>
          <p className="text-sm text-black/60"><InlineText value={state.course.description} onChange={(v)=>setState((s)=>({ ...s, course: { ...s.course, description: v } }))} /></p>
          {/* Course-wide LDs & SMEs */}
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {state.course.courseLDIds.map((id) => { const m = memberById(id); if (!m) return null; return <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-white" style={{ background: roleColor(m.roleType) }}><Avatar name={m.name} roleType={m.roleType} avatar={m.avatar} /> LD</span>; })}
            {state.course.courseSMEIds.map((id) => { const m = memberById(id); if (!m) return null; return <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-white" style={{ background: roleColor(m.roleType) }}><Avatar name={m.name} roleType={m.roleType} avatar={m.avatar} /> SME</span>; })}
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
        <TeamMembersSection
          team={team}
          people={people}
          onAddMember={addMember}
          onAddExistingMember={addExistingMember}
          onUpdateMember={updateMember}
          onDeleteMember={deleteMember}
          onToggleCourseWide={toggleCourseWide}
          onOpenUser={onOpenUser}
          courseLDIds={state.course.courseLDIds}
          courseSMEIds={state.course.courseSMEIds}
        />
        {/* Milestones */}
          <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm text-base sm:text-sm">
            <div
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2 px-1 cursor-pointer"
              onClick={() => setMilestonesCollapsed(v => !v)}
            >
              <h2 className="font-semibold flex items-center gap-2">
                <Calendar size={18} /> Milestones
              </h2>
              <div
                className="flex flex-wrap items-center gap-2 w-full sm:w-auto"
                onClick={e => e.stopPropagation()}
              >
              {!milestonesCollapsed && (
                <div className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2 shadow-sm w-full sm:w-auto">
                  <Filter size={16} className="text-black/50"/>
                  <select
                    value={milestoneFilter}
                    onChange={e => setMilestoneFilter(e.target.value)}
                    className="text-sm outline-none bg-transparent"
                  >
                    <option value="all">All milestones</option>
                    {milestones.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {!milestonesCollapsed && (
                <button
                  onClick={() => addMilestone()}
                  className="inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50 w-full sm:w-auto"
                >
                  <Plus size={16}/> Add Milestone
                </button>
              )}
                <button
                  onClick={() => setMilestonesCollapsed(v => !v)}
                  title={milestonesCollapsed ? 'Expand Milestones' : 'Collapse Milestones'}
                  aria-label={milestonesCollapsed ? 'Expand milestones' : 'Collapse milestones'}
                  aria-expanded={!milestonesCollapsed}
                  className="inline-flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full border border-black/10 bg-white text-slate-600 hover:bg-slate-50"
                >
                  {milestonesCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Tap the Milestones bar to expand or collapse.
          </p>
          <motion.div
            initial={false}
            animate={milestonesCollapsed ? "collapsed" : "open"}
            variants={{
              open: { height: "auto", opacity: 1 },
              collapsed: { height: 0, opacity: 0 },
            }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
            aria-hidden={milestonesCollapsed}
          >
            <div
              className="space-y-2"
              onDragOver={onMilestoneDragOver(null)}
              onDragLeave={onMilestoneDragLeave}
              onDrop={onMilestoneDrop(null)}
            >
              <AnimatePresence initial={false}>
                {filteredMilestones.map(m => (
                  <motion.div
                    key={m.id}
                    layout
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                    draggable
                    onDragStart={onMilestoneDragStart(m.id)}
                    onDragOver={onMilestoneDragOver(m.id)}
                    onDragLeave={onMilestoneDragLeave}
                    onDrop={onMilestoneDrop(m.id)}
                    className={dragMilestoneOverId === m.id ? 'ring-2 ring-indigo-400 rounded-lg' : ''}
                  >
                    <MilestoneCard
                      milestone={m}
                      tasks={groupedTasks[m.id] || []}
                      tasksAll={tasksRaw}
                      team={team}
                      milestones={milestones}
                      onUpdate={updateTask}
                      onDelete={deleteTask}
                      onDuplicate={duplicateTask}
                      onDuplicateMilestone={duplicateMilestone}
                      onDeleteMilestone={deleteMilestone}
                      onUpdateMilestone={updateMilestone}
                      onAddLink={(id, url) => patchTaskLinks(id, 'add', url)}
                      onRemoveLink={(id, idx) => patchTaskLinks(id, 'remove', idx)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
              {dragMilestoneOverId === null && dragMilestoneId.current && (
                <div className="h-2 rounded border-2 border-dashed border-indigo-400"></div>
              )}
            </div>
          </motion.div>
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
                <TaskTable tasks={tasksActive} allTasks={filteredTasks} team={team} milestones={milestones} onUpdate={updateTask} onDelete={deleteTask} onAddLink={(id, url)=>patchTaskLinks(id,'add',url)} onRemoveLink={(id, idx)=>patchTaskLinks(id,'remove',idx)} onDuplicate={duplicateTask} />
              ) : (
                <TaskTable tasks={tasksDone} allTasks={filteredTasks} team={team} milestones={milestones} onUpdate={updateTask} onDelete={deleteTask} onAddLink={(id, url)=>patchTaskLinks(id,'add',url)} onRemoveLink={(id, idx)=>patchTaskLinks(id,'remove',idx)} onDuplicate={duplicateTask} />
              )}
            </div>
          ) : view === "board" ? (
            <BoardView tasks={filteredTasks} team={team} milestones={milestones} onUpdate={updateTask} onDelete={deleteTask} onDragStart={onDragStart} onDragOverCol={onDragOverCol} onDropToCol={onDropToCol} onAddLink={(id, url)=>patchTaskLinks(id,'add',url)} onRemoveLink={(id, idx)=>patchTaskLinks(id,'remove',idx)} onDuplicate={duplicateTask} />
          ) : (
            <CalendarView
              monthDate={calMonth}
              tasks={filteredTasks}
              milestones={milestones}
              team={team}
              onPrev={() => gotoMonth(-1)}
              onNext={() => gotoMonth(1)}
              onToday={() => setCalMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
              schedule={state.schedule}
              onTaskClick={(t) => setEditing({ courseId: state.course.id, taskId: t.id })}
            />
          )}
        </section>
      {editingTask && (
        <TaskModal
          task={editingTask}
          tasks={state.tasks}
          team={team}
          milestones={milestones}
          onUpdate={updateTask}
          onDelete={deleteTask}
          onAddLink={(id, url)=>patchTaskLinks(id,'add',url)}
          onRemoveLink={(id, idx)=>patchTaskLinks(id,'remove',idx)}
          onClose={()=>setEditing(null)}
        />
      )}
      </main>

      {isMobile && (
        <button
          onClick={() => addTask(milestoneFilter !== "all" ? milestoneFilter : undefined)}
          className="fixed bottom-6 right-6 z-50 inline-flex items-center justify-center w-14 h-14 rounded-full bg-black text-white shadow-lg sm:hidden"
          aria-label="Add task"
        >
          <Plus size={24} />
        </button>
      )}

      <footer className="max-w-7xl mx-auto px-4 pb-10 text-sm text-black/50">Tip: ⌘/Ctrl + Enter to commit multiline edits. Data auto-saves to your browser.</footer>
    </div>
  );
}

// =====================================================
// Table + Board components
// =====================================================
function DashboardRing({ title, subtitle, value, color, icon, mode = "percent" }) {
  const display = mode === "percent" ? `${value}%` : value;
  const pct = mode === "percent" ? value : undefined;
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm flex items-center gap-4">
      <Ring
        className="w-16 h-16 xs:w-20 xs:h-20 sm:w-24 sm:h-24"
        stroke={10}
        progress={pct ?? 100}
        color={color}
      >
        <div className="text-center">
          <div className="text-base font-semibold leading-none">{display}</div>
          <div className="text-sm text-black/60">
            {mode === "percent" ? "Progress" : "Count"}
          </div>
        </div>
      </Ring>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-black/60 flex items-center gap-1">
          {icon} <span>{title}</span>
        </div>
        <div className="text-sm font-medium truncate">{subtitle}</div>
      </div>
    </div>
  );
}
function Toggle({ value, onChange, options }) { return (<div className="inline-flex rounded-2xl border border-black/10 bg-white p-1 shadow-sm">{options.map((o)=>(<button key={o.id} onClick={()=>onChange(o.id)} className={`px-3 py-1.5 text-sm rounded-xl ${value===o.id?"bg-slate-900 text-white":"text-slate-700 hover:bg-slate-50"}`}>{o.label}</button>))}</div>); }
function TaskTable({ tasks, allTasks, team, milestones, onUpdate, onDelete, onAddLink, onRemoveLink, onDuplicate }) {
  const taskAssignableMembers = team; // include all roles
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <div className="space-y-3">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            tasks={allTasks}
            team={team}
            milestones={milestones}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onAddLink={onAddLink}
            onRemoveLink={onRemoveLink}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-black/60 border-b border-black/10">
            <th className="py-2 pr-4">Title & Details</th>
            <th className="py-2 pr-4">Milestone</th>
            <th className="py-2 pr-4">Assignee</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4 hidden lg:table-cell">Start</th>
            <th className="py-2 pr-4 hidden lg:table-cell"># of Workdays</th>
            <th className="py-2 pr-4">Due</th>
            <th className="py-2 pr-4 hidden xl:table-cell">Completed</th>
            <th className="py-2 pr-4 hidden xl:table-cell">Dependency</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const assignee = team.find((m) => m.id === t.assigneeId);
            return (
              <tr key={t.id} className="border-b border-black/5 hover:bg-slate-50 align-top">
                <td className="py-2 pr-4">
                  <div className="font-medium"><InlineText value={t.title} onChange={(v) => onUpdate(t.id, { title: v })} /></div>
                  <div className="text-sm text-black/60"><InlineText value={t.details} onChange={(v) => onUpdate(t.id, { details: v })} placeholder="Details…" multiline /></div>
                  <div className="mt-1 text-sm text-slate-700"><span className="font-medium mr-1">Note:</span><InlineText value={t.note} onChange={(v) => onUpdate(t.id, { note: v })} placeholder="Add a quick note…" multiline /></div>
                  <LinksEditor links={t.links} onAdd={(url) => onAddLink(t.id, url)} onRemove={(i) => onRemoveLink(t.id, i)} />
                </td>
                <td className="py-2 pr-4"><select value={t.milestoneId} onChange={(e) => onUpdate(t.id, { milestoneId: e.target.value })} className="border rounded px-2 py-1">{milestones.map((m) => (<option key={m.id} value={m.id}>{m.title}</option>))}</select></td>
                <td className="py-2 pr-4"><div className="flex items-center gap-2">{assignee ? <Avatar name={assignee.name} roleType={assignee.roleType} avatar={assignee.avatar} /> : <span className="text-sm text-black/40">—</span>}<select value={t.assigneeId || ""} onChange={(e) => onUpdate(t.id, { assigneeId: e.target.value || null })} className="border rounded px-2 py-1"><option value="">Unassigned</option>{taskAssignableMembers.map((m) => (<option key={m.id} value={m.id}>{m.name} ({m.roleType})</option>))}</select></div></td>
                <td className="py-2 pr-4"><select value={t.status} onChange={(e) => onUpdate(t.id, { status: e.target.value })} className={`border rounded px-2 py-1 ${statusBg(t.status)}`}><option value="todo">To Do</option><option value="inprogress">In Progress</option><option value="done">Done</option></select></td>
                <td className="py-2 pr-4 hidden lg:table-cell">{t.status === "done" ? (<span className="text-sm text-slate-500">—</span>) : (<input type="date" value={t.startDate || ""} onChange={(e) => onUpdate(t.id, { startDate: e.target.value })} disabled={t.status === "todo"} className={`border rounded px-2 py-1 ${t.status === "todo" ? "bg-slate-50 text-slate-500" : ""}`} placeholder="—" />)}</td>
                <td className="py-2 pr-4 hidden lg:table-cell"><input type="number" min={0} value={t.workDays ?? 0} onChange={(e) => onUpdate(t.id, { workDays: Number(e.target.value) })} className="w-24 border rounded px-2 py-1" /></td>
                <td className="py-2 pr-4"><DuePill date={t.dueDate} status={t.status} /></td>
                <td className="py-2 pr-4 hidden xl:table-cell">{t.status === "done" ? (t.completedDate || "—") : "—"}</td>
                <td className="py-2 pr-4 hidden xl:table-cell"><DepPicker task={t} tasks={allTasks} onUpdate={onUpdate} /></td>
                <td className="py-2"><button onClick={() => onDuplicate(t.id)} className="text-black/60 hover:text-sky-600 mr-2" title="Duplicate" aria-label="Duplicate"><CopyIcon size={16} /></button><button onClick={() => onDelete(t.id)} className="text-red-500/80 hover:text-red-600" title="Delete" aria-label="Delete"><Trash2 size={16} /></button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function statusBg(status) { if (status === "done") return "bg-emerald-50"; if (status === "inprogress") return "bg-emerald-50"; return "bg-white"; }

export function BoardView({ tasks, team, milestones, onUpdate, onDelete, onDragStart, onDragOverCol, onDropToCol, onAddLink, onRemoveLink, onDuplicate }) {
  const cols = [ { id: "todo", title: "To Do" }, { id: "inprogress", title: "In Progress" }, { id: "done", title: "Done" } ];
  const taskAssignableMembers = team;
  const byCol = (id) =>
    tasks
      .filter((t) => t.status === id)
      .sort((a, b) => {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
        return da - db;
      });
  const [collapsedIds, setCollapsedIds] = React.useState(() => new Set(tasks.map((t) => t.id)));
  const isMobile = useIsMobile();
  const [statusOpenId, setStatusOpenId] = React.useState(null);
  React.useEffect(() => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      tasks.forEach((t) => { if (!next.has(t.id)) next.add(t.id); });
      return next;
    });
  }, [tasks]);
  const isCollapsed = (id) => collapsedIds.has(id);
  const toggleCollapse = (id) =>
    setCollapsedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const statusPillClass = (status) => { if(status==="done") return "bg-emerald-200/80 text-emerald-900 border-emerald-300"; if(status==="inprogress") return "bg-emerald-100 text-emerald-900 border-emerald-300"; return "bg-slate-100 text-slate-700 border-slate-300"; };
  const statusLabel = { todo: 'To Do', inprogress: 'In Progress', done: 'Done' };
  const renderStatusControl = (task) => {
    if (!isMobile) {
      return (
        <select
          aria-label="Status"
          value={task.status}
          onChange={(e) => onUpdate(task.id, { status: e.target.value })}
          className={`px-2 py-1 rounded-full border font-semibold text-sm ${statusPillClass(task.status)}`}
        >
          <option value="todo">To Do</option>
          <option value="inprogress">In Progress</option>
          <option value="done">Done</option>
        </select>
      );
    }
    const open = statusOpenId === task.id;
    return open ? (
      <select
        aria-label="Status"
        value={task.status}
        onChange={(e) => {
          onUpdate(task.id, { status: e.target.value });
          setStatusOpenId(null);
        }}
        onBlur={() => setStatusOpenId(null)}
        className={`px-2 py-1 rounded-full border font-semibold text-sm ${statusPillClass(task.status)}`}
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
        aria-expanded={open}
        aria-label={`Status: ${statusLabel[task.status]}`}
        onClick={() => setStatusOpenId(open ? null : task.id)}
        className={`px-2 py-1 rounded-full border font-semibold text-sm ${statusPillClass(task.status)}`}
      >
        {statusLabel[task.status]}
      </button>
    );
  };
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cols.map((c) => (
          <div key={c.id} className={`rounded-xl border border-black/10 p-3 ${c.id==='inprogress' ? 'bg-emerald-50' : 'bg-white/60'}`} onDragOver={onDragOverCol} onDrop={onDropToCol(c.id)}>
            <div className="flex items-center justify-between mb-2"><div className="text-sm font-medium text-black/70">{c.title}</div></div>
            <div className="space-y-2 min-h-[140px]">
              {byCol(c.id).map((t) => { const a = team.find((m)=>m.id===t.assigneeId); const collapsed = isCollapsed(t.id); return (
                  <motion.div
                    key={t.id}
                    data-testid="task-card"
                    className={`rounded-lg border border-black/10 p-3 shadow-sm text-base sm:text-sm ${c.id==='inprogress' ? 'bg-emerald-50' : 'bg-white'}`}
                    draggable={!isMobile}
                    onDragStart={!isMobile ? onDragStart(t.id) : undefined}
                    style={isMobile ? { touchAction: 'pan-y' } : undefined}
                    whileTap={{ scale: 0.98 }}
                  >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><div className="text-[15px] sm:text-base font-semibold leading-tight truncate"><InlineText value={t.title} onChange={(v)=>onUpdate(t.id,{ title:v })} /></div></div>
                    <div className="flex items-center gap-1"><button onClick={()=>toggleCollapse(t.id)} className="inline-flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full border border-black/10 bg-slate-100 text-slate-600 hover:bg-slate-200" title={collapsed?'Expand':'Collapse'} aria-label={collapsed?'Expand':'Collapse'}>{collapsed ? <Plus size={16}/> : <Minus size={16}/>}</button><button onClick={()=>onDuplicate(t.id)} className="inline-flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full border border-black/10 bg-slate-100 text-slate-600 hover:bg-slate-200" title="Duplicate" aria-label="Duplicate"><CopyIcon size={16}/></button><button onClick={()=>onDelete(t.id)} className="text-black/40 hover:text-red-500" title="Delete" aria-label="Delete"><Trash2 size={16}/></button></div>
                  </div>
                  {collapsed ? (
                    <>
                      <div className="mt-1">{renderStatusControl(t)}</div>
                      <div className="text-sm text-black/60 mt-1 truncate"><InlineText value={t.details} onChange={(v)=>onUpdate(t.id,{ details:v })} placeholder="Details…" /></div>
                      {t.note && <div className="text-sm text-slate-600 mt-1 truncate">📝 {t.note}</div>}
                      <div className="mt-2 flex items-center justify-between text-sm"><div className="flex items-center gap-2 min-w-0">{a ? <Avatar name={a.name} roleType={a.roleType} avatar={a.avatar} /> : <span className="text-black/40">—</span>}<span className="truncate">{a ? `${a.name} (${a.roleType})` : 'Unassigned'}</span></div><div className="flex items-center gap-2"><DuePill date={t.dueDate} status={t.status} />{t.status === "done" && <span className="text-slate-500">Completed: {t.completedDate || "—"}</span>}</div></div>
                    </>
                  ) : (
                    <>
                      <div className="mt-1">{renderStatusControl(t)}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        <select value={t.milestoneId} onChange={(e)=>onUpdate(t.id,{ milestoneId:e.target.value })} className="border rounded px-1.5 py-1">{milestones.map((m)=>(<option key={m.id} value={m.id}>{m.title}</option>))}</select>
                        <div className="flex items-center gap-1">{a ? <Avatar name={a.name} roleType={a.roleType} avatar={a.avatar} /> : <span className="text-black/40">—</span>}<select value={t.assigneeId || ""} onChange={(e)=>onUpdate(t.id,{ assigneeId:e.target.value || null })} className="border rounded px-1.5 py-1"><option value="">Unassigned</option>{taskAssignableMembers.map((m)=>(<option key={m.id} value={m.id}>{m.name} ({m.roleType})</option>))}</select></div>
                        <div className="flex items-center gap-2"><span>Start</span>{t.status === "done" ? (<span className="text-slate-500 text-sm">—</span>) : (<input type="date" value={t.startDate || ""} onChange={(e)=>onUpdate(t.id,{ startDate:e.target.value })} disabled={t.status === "todo"} className={`border rounded px-1.5 py-1 ${t.status === "todo" ? "bg-slate-50 text-slate-500" : ""}`} />)}</div>
                        <div className="flex items-center gap-2"><span># of Workdays</span><input type="number" min={0} value={t.workDays ?? 0} onChange={(e)=>onUpdate(t.id,{ workDays:Number(e.target.value) })} className="w-20 border rounded px-1.5 py-1" /></div>
                        <div className="basis-full w-full"><DocumentInput onAdd={(url)=>onAddLink(t.id,url)} />{t.links && t.links.length>0 && (<LinkChips links={t.links} onRemove={(i)=>onRemoveLink(t.id,i)} />)}</div>
                      <div className="basis-full text-sm text-slate-700"><span className="font-medium mr-1">Note:</span><InlineText value={t.note} onChange={(v)=>onUpdate(t.id,{ note:v })} placeholder="Add a quick note…" multiline /></div>
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
export const UPCOMING_DAYS = 15;

export function UserDashboard({ onOpenCourse, initialUserId, onBack }) {
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

  const [taskView, setTaskView] = useState('board');
  const [saveState, setSaveState] = useState('saved');
  const [taskQuery, setTaskQuery] = useState('');
  const [courseQuery, setCourseQuery] = useState('');
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('userTab') || 'deadlines');
  useEffect(() => { localStorage.setItem('userTab', activeTab); }, [activeTab]);

  const recomputeDue = (t, patch = {}, schedule) => {
    const start = patch.startDate ?? t.startDate;
    const work = patch.workDays ?? t.workDays;
    const due = start ? addBusinessDays(start, work, schedule.workweek || [1,2,3,4,5], schedule.holidays || []) : "";
    return { ...patch, dueDate: due };
  };

  const propagateDependentForecasts = (tasks, schedule) => {
    const map = new Map(tasks.map((x) => [x.id, x]));
    return tasks.map((t) => {
      if (!t.depTaskId || t.status === 'done') return t;
      const src = map.get(t.depTaskId);
      if (!src) return t;
      const startForecast = src.dueDate || '';
      if (t.status !== 'inprogress' && startForecast) {
        const due = addBusinessDays(startForecast, t.workDays, schedule.workweek || [1,2,3,4,5], schedule.holidays || []);
        return { ...t, startDate: startForecast, dueDate: due };
      }
      return t;
    });
  };

  const updateTask = (courseId, taskId, patch) => {
    setCourses((cs) => cs.map((c) => {
      if (c.course.id !== courseId) return c;
      const sched = c.schedule || loadGlobalSchedule();
      let changedTo = null;
      const tasks1 = c.tasks.map((t) => {
        if (t.id !== taskId) return t;
        let adjusted = { ...patch };
        if (patch.status && patch.status !== t.status) {
          changedTo = patch.status;
          if (patch.status === 'inprogress') { if (!t.startDate && !patch.__skipAutoStart) adjusted.startDate = todayStr(); }
          if (patch.status === 'todo') { adjusted.startDate = ''; adjusted.dueDate = ''; adjusted.completedDate = ''; }
          if (patch.status === 'done') { adjusted.completedDate = todayStr(); }
        }
        if ('startDate' in adjusted || 'workDays' in adjusted) adjusted = recomputeDue({ ...t, ...adjusted }, adjusted, sched);
        return { ...t, ...adjusted };
      });
      let tasks2 = tasks1;
      if (changedTo === 'inprogress') tasks2 = tasks2.map((d) => (d.depTaskId === taskId && d.status !== 'done' ? { ...d, status: 'inprogress' } : d));
      if (changedTo === 'done') {
        const doneDate = todayStr();
        tasks2 = tasks2.map((x) => (x.id === taskId ? { ...x, completedDate: x.completedDate || doneDate } : x));
        tasks2 = tasks2.map((d) => {
          if (d.depTaskId === taskId && d.status !== 'done') {
            const start = doneDate;
            const due = addBusinessDays(start, d.workDays, sched.workweek || [1,2,3,4,5], sched.holidays || []);
            return { ...d, status: 'inprogress', startDate: start, dueDate: due };
          }
          return d;
        });
      }
      const tasks3 = propagateDependentForecasts(tasks2, sched);
      return { ...c, tasks: tasks3 };
    }));
    setSaveState('unsaved');
  };

  const updateTaskStatus = (courseId, taskId, status) => updateTask(courseId, taskId, { status });

  const patchTaskLinks = (courseId, id, op, payload) => {
    setCourses((cs) => cs.map((c) => {
      if (c.course.id !== courseId) return c;
      return {
        ...c,
        tasks: c.tasks.map((t) => {
          if (t.id !== id) return t;
          const links = Array.isArray(t.links) ? [...t.links] : [];
          if (op === 'add') links.push(payload);
          if (op === 'remove') links.splice(payload,1);
          return { ...t, links };
        })
      };
    }));
    setSaveState('unsaved');
  };

  const duplicateTask = (courseId, id) => {
    setCourses((cs) => cs.map((c) => {
      if (c.course.id !== courseId) return c;
      const orig = c.tasks.find((t) => t.id === id);
      if (!orig) return c;
      const clone = {
        ...orig,
        id: uid(),
        title: `${orig.title} (copy)`,
        status: 'todo',
        startDate: '',
        dueDate: '',
        completedDate: '',
        depTaskId: null,
      };
      return { ...c, tasks: [...c.tasks, clone] };
    }));
    setSaveState('unsaved');
  };

  const deleteTask = (courseId, id) => {
    setCourses((cs) => cs.map((c) => c.course.id === courseId ? { ...c, tasks: c.tasks.filter((t) => t.id !== id) } : c));
    setSaveState('unsaved');
  };
  const changeTaskCourse = (fromCourseId, taskId, toCourseId) => {
    setCourses((cs) => {
      const from = cs.find((c) => c.course.id === fromCourseId);
      const to = cs.find((c) => c.course.id === toCourseId);
      if (!from || !to) return cs;
      const task = from.tasks.find((t) => t.id === taskId);
      if (!task) return cs;
      return cs.map((c) => {
        if (c.course.id === fromCourseId) {
          return { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) };
        }
        if (c.course.id === toCourseId) {
          return { ...c, tasks: [...c.tasks, task] };
        }
        return c;
      });
    });
    setEditing({ courseId: toCourseId, taskId });
    setSaveState('unsaved');
  };
  const handleNewTask = () => {
    if (myCoursesAll.length === 0) return;
    const cid = myCoursesAll[0].course.id;
    const targetCourse = courses.find((c) => c.course.id === cid);
    if (!targetCourse) return;
    const newTask = {
      id: uid(),
      order: targetCourse.tasks.length,
      title: '',
      details: '',
      note: '',
      links: [],
      assigneeId: userId || null,
      milestoneId: targetCourse.milestones[0]?.id || null,
      status: 'todo',
      startDate: '',
      workDays: 0,
      dueDate: '',
      depTaskId: null,
      completedDate: '',
    };
    setCourses((cs) => cs.map((c) => c.course.id === cid ? { ...c, tasks: [...c.tasks, newTask] } : c));
    setEditing({ courseId: cid, taskId: newTask.id });
    setSaveState('unsaved');
  };
  const handleSave = useCallback(async () => {
    setSaveState('saving');
    saveCourses(courses);
    await saveCoursesRemote(courses);
    setSaveState('saved');
  }, [courses]);
  useEffect(() => {
    if (saveState !== 'unsaved') return;
    const t = setTimeout(handleSave, 1500);
    return () => clearTimeout(t);
  }, [saveState, handleSave]);
  const cycleStatus = (s) => (s === 'todo' ? 'inprogress' : s === 'inprogress' ? 'done' : 'todo');
  const [calMonth, setCalMonth] = useState(() => new Date());
  const [editing, setEditing] = useState(null);

  const members = useMemo(() => {
    const map = new Map();
    courses.forEach((c) => c.team.forEach((m) => { if (!map.has(m.id)) map.set(m.id, m); }));
    return Array.from(map.values());
  }, [courses]);

  const [userId, setUserId] = useState(() => localStorage.getItem('userId') || initialUserId || '');
  useEffect(() => {
    if (!userId && members[0]) setUserId(members[0].id);
  }, [members, userId]);
  useEffect(() => {
    if (userId) localStorage.setItem('userId', userId);
  }, [userId]);
  useEffect(() => {
    if (initialUserId) setUserId(initialUserId);
  }, [initialUserId]);
  const user = members.find((m) => m.id === userId);

  const myCoursesAll = useMemo(
    () => courses.filter((c) => c.team.some((m) => m.id === userId)),
    [courses, userId]
  );
  const myCourses = useMemo(
    () =>
      myCoursesAll.filter((c) =>
        c.course.name.toLowerCase().includes(courseQuery.toLowerCase())
      ),
    [myCoursesAll, courseQuery]
  );
  const myTasks = useMemo(() => {
    const arr = [];
    courses.forEach((c) => {
      c.tasks.forEach((t) => {
        if (t.assigneeId === userId)
          arr.push({ ...t, courseId: c.course.id, courseName: c.course.name });
      });
    });
    return arr
      .filter(
        (t) =>
          t.title.toLowerCase().includes(taskQuery.toLowerCase()) ||
          t.courseName.toLowerCase().includes(taskQuery.toLowerCase())
      )
      .sort((a, b) => {
        const nameCmp = a.courseName.localeCompare(b.courseName);
        if (nameCmp !== 0) return nameCmp;
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return da - db;
      });
  }, [courses, userId, taskQuery]);
  const groupedTasks = useMemo(() => {
    const g = { todo: [], inprogress: [], done: [] };
    myTasks.forEach((t) => { if (g[t.status]) g[t.status].push(t); });
    return g;
  }, [myTasks]);

  const upcoming = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return [...Array(UPCOMING_DAYS)].map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const ds = fmt(d);
      const tasks = myTasks.filter((t) => t.dueDate === ds);
      return { date: d, tasks };
    });
  }, [myTasks]);
  const today = fmt(new Date());

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/80 border-b border-black/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-slate-900 text-white border border-slate-900 shadow-sm hover:bg-slate-800"
              >
                <ArrowLeft size={16} /> Back to Courses
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold truncate">User Dashboard</h1>
              {user && <div className="text-sm text-black/60 truncate">{user.name}</div>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && <Avatar name={user.name} roleType={user.roleType} avatar={user.avatar} className="w-8 h-8 text-base" />}
            <select value={userId} onChange={(e)=>setUserId(e.target.value)} className="text-sm border rounded px-2 py-1">
              {members.map((m)=> (<option key={m.id} value={m.id}>{m.name} ({m.roleType})</option>))}
            </select>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"
            >
              Save
            </button>
            <span className="text-sm text-black/60">
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Unsaved'}
            </span>
          </div>
        </div>
      </header>

        <main className="max-w-7xl mx-auto px-4 py-6">
          {user && (
            <h2 className="text-lg font-semibold mb-4">
              Welcome, {user.name}!
            </h2>
          )}
          <div className="mb-4 flex gap-2">
            {[['deadlines','Deadlines'],['courses','Courses'],['milestones','Milestones'],['tasks','Tasks']].map(([id,label]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
              className={`px-3 py-1.5 text-sm rounded border ${activeTab===id?'bg-slate-900 text-white border-slate-900':'bg-white border-black/10'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6">
          {activeTab === 'deadlines' && (
            <SectionCard title="Upcoming Deadlines">
              {upcoming.every((d) => d.tasks.length === 0) ? (
                <div className="text-sm text-black/60">No tasks due in the next 2 weeks.</div>
              ) : (
                <ul className="space-y-2">
                  {upcoming
                    .filter(({ tasks }) => tasks.length > 0)
                    .map(({ date, tasks }) => (
                      <li key={fmt(date)} className="rounded-xl border border-black/10 bg-white p-3 w-full">
                        <div className="text-sm font-medium mb-1">
                          {date.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' })}
                        </div>
                        <ul className="space-y-1">
                          {tasks.map((t) => {
                            const urgentClass =
                              t.dueDate < today
                                ? 'bg-rose-100 text-rose-800'
                                : t.dueDate === today
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100';
                            return (
                              <li
                                key={t.id}
                                className={`text-sm flex items-center gap-1 truncate w-full rounded px-2 py-1 ${urgentClass}`}
                              >
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-300"
                                  aria-label={`${t.title} in ${t.courseName}`}
                                  checked={t.status === 'done'}
                                  onChange={(e) =>
                                    updateTask(t.courseId, t.id, {
                                      status: e.target.checked ? 'done' : 'todo'
                                    })
                                  }
                                />
                                <button
                                  onClick={() => setEditing({ courseId: t.courseId, taskId: t.id })}
                                  className="truncate text-left flex-1"
                                  title={`${t.title} – ${t.courseName}`}
                                >
                                  {t.title} <span className="text-black/60">in {t.courseName}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    ))}
                </ul>
              )}
            </SectionCard>
          )}

          {activeTab === 'courses' && (
            <SectionCard title="My Courses">
              {myCourses.length === 0 ? (
                <div className="text-sm text-black/60">No courses</div>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {myCourses.map((c) => {
                    const tTotal = c.tasks.filter((t) => t.assigneeId === userId).length;
                    const tDone = c.tasks.filter((t) => t.assigneeId === userId && t.status === 'done').length;
                    const pct = tTotal ? Math.round((tDone / tTotal) * 100) : 0;
                    return (
                      <li key={c.course.id} className="rounded-xl border border-black/10 bg-white p-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{c.course.name}</div>
                            <div className="text-sm text-black/60 truncate">{tTotal} task{tTotal!==1?'s':''}</div>
                          </div>
                          <button onClick={()=>onOpenCourse(c.course.id)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm bg-slate-900 text-white shadow">Open</button>
                        </div>
                        <div className="h-2 bg-slate-100 rounded">
                          <div className="h-2 bg-emerald-500 rounded" style={{width:`${pct}%`}} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
          )}

          {activeTab === 'milestones' && (
            <SectionCard title="My Milestones">
              {myCourses.length === 0 ? (
                <div className="text-sm text-black/60">No milestones</div>
              ) : (
                <div className="space-y-4">
                  {myCourses.map((c) => (
                    <details key={c.course.id} className="group rounded-xl border border-black/10 bg-white">
                      <summary className="cursor-pointer select-none p-4 flex items-center justify-between gap-2 list-none [&::-webkit-details-marker]:hidden">
                        <div className="flex items-center gap-2">
                          <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                          <div className="font-medium">{c.course.name}</div>
                        </div>
                      </summary>
                      <div className="p-4 space-y-2">
                        {c.milestones.map((m) => (
                          <MilestoneCard
                            key={m.id}
                            milestone={m}
                            tasks={c.tasks.filter((t) => t.milestoneId === m.id)}
                            tasksAll={c.tasks}
                            team={c.team}
                            milestones={c.milestones}
                            onUpdate={(id, patch) => updateTask(c.course.id, id, patch)}
                            onDelete={(id) => deleteTask(c.course.id, id)}
                            onDuplicate={(id) => duplicateTask(c.course.id, id)}
                            onAddLink={(id, url) => patchTaskLinks(c.course.id, id, 'add', url)}
                            onRemoveLink={(id, idx) => patchTaskLinks(c.course.id, id, 'remove', idx)}
                          />
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {activeTab === 'tasks' && (
            <SectionCard title="My Tasks" actions={<button onClick={handleNewTask} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"><Plus size={16}/> New Task</button>}>
              {myTasks.length === 0 ? (
                <div className="text-sm text-black/60">{taskQuery ? 'No tasks match your search.' : 'No tasks assigned.'}</div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={taskQuery}
                      onChange={(e) => setTaskQuery(e.target.value)}
                      placeholder="Search..."
                      className="px-2 py-1 text-sm border rounded flex-1"
                    />
                    <button onClick={() => setTaskView('list')} className={`px-2 py-1 text-sm rounded border ${taskView==='list'?'bg-slate-900 text-white border-slate-900':'bg-white border-black/10'}`}>List</button>
                    <button onClick={() => setTaskView('board')} className={`px-2 py-1 text-sm rounded border ${taskView==='board'?'bg-slate-900 text-white border-slate-900':'bg-white border-black/10'}`}>Board</button>
                    <button onClick={() => setTaskView('calendar')} className={`px-2 py-1 text-sm rounded border ${taskView==='calendar'?'bg-slate-900 text-white border-slate-900':'bg-white border-black/10'}`}>Calendar</button>
                  </div>
                  {taskView === 'list' && (
                    <div className="space-y-2">
                      {myTasks.map((t) => {
                        const c = courses.find((x) => x.course.id === t.courseId);
                        if (!c) return null;
                        return (
                          <TaskCard
                            key={t.id}
                            task={t}
                            tasks={c.tasks}
                            team={c.team}
                            milestones={c.milestones}
                            onUpdate={(id, patch) => updateTask(c.course.id, id, patch)}
                            onDelete={(id) => deleteTask(c.course.id, id)}
                            onDuplicate={(id) => duplicateTask(c.course.id, id)}
                            onAddLink={(id, url) => patchTaskLinks(c.course.id, id, 'add', url)}
                            onRemoveLink={(id, idx) => patchTaskLinks(c.course.id, id, 'remove', idx)}
                          />
                        );
                      })}
                    </div>
                  )}
                  {taskView === 'board' && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      {[
                        { id: 'todo', label: 'To Do' },
                        { id: 'inprogress', label: 'In Progress' },
                        { id: 'done', label: 'Done' },
                      ].map(({ id, label }) => (
                        <div
                          key={id}
                          className={`rounded-xl border border-black/10 p-3 ${id==='inprogress' ? 'bg-emerald-50' : 'bg-white/60'}`}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            const tid = e.dataTransfer.getData('text/task');
                            const cid = e.dataTransfer.getData('text/course');
                            if (tid && cid) updateTaskStatus(cid, tid, id);
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium text-black/70">{label} ({groupedTasks[id].length})</div>
                          </div>
                          <div className="space-y-2 min-h-[140px]">
                            {groupedTasks[id].map((t) => {
                              const c = courses.find((x) => x.course.id === t.courseId);
                              if (!c) return null;
                              return (
                                <TaskCard
                                  key={t.id}
                                  task={t}
                                  tasks={c.tasks}
                                  team={c.team}
                                  milestones={c.milestones}
                                  onUpdate={(tid, patch) => updateTask(c.course.id, tid, patch)}
                                  onDelete={(tid) => deleteTask(c.course.id, tid)}
                                  onDuplicate={(tid) => duplicateTask(c.course.id, tid)}
                                  onAddLink={(tid, url) => patchTaskLinks(c.course.id, tid, 'add', url)}
                                  onRemoveLink={(tid, idx) => patchTaskLinks(c.course.id, tid, 'remove', idx)}
                                  dragHandlers={{
                                    draggable: true,
                                    onDragStart: (e) => {
                                      e.dataTransfer.setData('text/task', t.id);
                                      e.dataTransfer.setData('text/course', t.courseId);
                                    },
                                  }}
                                />
                              );
                            })}
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
                      // open TaskModal when clicking a calendar event
                      onTaskClick={(t) => setEditing({ courseId: t.courseId, taskId: t.id })}
                    />
                  )}
                </>
              )}
            </SectionCard>
          )}
        </div>
        {editing && (() => {
          const c = courses.find((x) => x.course.id === editing.courseId);
          const task = c?.tasks.find((t) => t.id === editing.taskId);
          if (!c || !task) return null;
          return (
            <TaskModal
              task={task}
              courseId={c.course.id}
              courses={myCoursesAll}
              onChangeCourse={(toId) => changeTaskCourse(c.course.id, task.id, toId)}
              tasks={c.tasks}
              team={c.team}
              milestones={c.milestones}
              onUpdate={(id, patch) => updateTask(c.course.id, id, patch)}
              onDelete={(id) => { deleteTask(c.course.id, id); setEditing(null); }}
              onAddLink={(id, url) => patchTaskLinks(c.course.id, id, 'add', url)}
              onRemoveLink={(id, idx) => patchTaskLinks(c.course.id, id, 'remove', idx)}
              onClose={() => setEditing(null)}
            />
          );
        })()}
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
export function CoursesHub({
  onOpenCourse,
  onEditTemplate,
  onAddCourse,
  onOpenUser,
  people = [],
  onPeopleChange,
  onRemoveCourse,
  onDuplicateCourse,
}) {
  const [courses, setCourses] = useState(() => loadCourses());
  const [schedule, setSchedule] = useState(() => loadGlobalSchedule());
  const [membersEditing, setMembersEditing] = useState(false);
  const [history, setHistory] = useState([]);

  const pushHistory = useCallback((snapshot) => {
    setHistory((h) => [JSON.parse(JSON.stringify(snapshot)), ...h].slice(0, 5));
  }, []);

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const [latest, ...rest] = h;
      saveCourses(latest);
      saveCoursesRemote(latest).catch(() => {});
      setCourses(latest);
      return rest;
    });
  };

  useEffect(() => {
    const onSchedStorage = (e) => {
      if (e.key === GLOBAL_SCHEDULE_KEY && e.newValue) {
        try { setSchedule(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener('storage', onSchedStorage);
    return () => window.removeEventListener('storage', onSchedStorage);
  }, []);

  useEffect(() => {
    (async () => {
      const remoteCourses = await loadCoursesRemote();
      if (remoteCourses.length) {
        saveCourses(remoteCourses);
        setCourses(remoteCourses);
      } else {
        const localCourses = loadCourses();
        setCourses(localCourses);
        if (localCourses.length) saveCoursesRemote(localCourses).catch(() => {});
      }
      const remoteSched = await loadScheduleRemote();
      if (remoteSched) {
        setSchedule(remoteSched);
        applySchedule(remoteSched);
      } else {
        const localSched = loadGlobalSchedule();
        setSchedule(localSched);
        applySchedule(localSched);
      }
      const remotePeople = await loadPeopleRemote();
      if (remotePeople.length) {
        savePeople(remotePeople);
        onPeopleChange(remotePeople);
      } else {
        const localPeople = loadPeople();
        if (localPeople.length) {
          onPeopleChange(localPeople);
          savePeopleRemote(localPeople).catch(() => {});
        }
      }
      const remoteTpl = await loadTemplateRemote();
      if (remoteTpl) saveTemplate(remoteTpl);
    })();
  }, []);

  const propagateDependentForecasts = (tasks, sched) => {
    const map = new Map(tasks.map((t) => [t.id, t]));
    return tasks.map((t) => {
      if (!t.depTaskId || t.status === 'done') return t;
      const src = map.get(t.depTaskId);
      if (!src) return t;
      const startForecast = src.dueDate || '';
      if (t.status !== 'inprogress' && startForecast) {
        const due = addBusinessDays(startForecast, t.workDays, sched.workweek, sched.holidays);
        return { ...t, startDate: startForecast, dueDate: due };
      }
      return t;
    });
  };

  function applySchedule(sched) {
    saveGlobalSchedule(sched);
    saveScheduleRemote(sched).catch(() => {});
    const updated = loadCourses().map((c) => {
      const tasks1 = c.tasks.map((t) =>
        t.startDate ? { ...t, dueDate: addBusinessDays(t.startDate, t.workDays, sched.workweek, sched.holidays) } : t
      );
      const tasks2 = propagateDependentForecasts(tasks1, sched);
      return { ...c, schedule: sched, tasks: tasks2 };
    });
    saveCourses(updated);
    saveCoursesRemote(updated).catch(() => {});
    setCourses(updated);
  }

  const toggleWorkday = (dow) => {
    setSchedule((s) => {
      const set = new Set(s.workweek);
      set.has(dow) ? set.delete(dow) : set.add(dow);
      const next = { ...s, workweek: Array.from(set).sort() };
      pushHistory(loadCourses());
      applySchedule(next);
      return next;
    });
  };

  const addHoliday = (dateStr) => {
    if (!dateStr) return;
    setSchedule((s) => {
      const holidays = Array.from(new Set([...s.holidays, dateStr])).sort();
      const next = { ...s, holidays };
      pushHistory(loadCourses());
      applySchedule(next);
      return next;
    });
  };

  const removeHoliday = (dateStr) => {
    setSchedule((s) => {
      const next = { ...s, holidays: s.holidays.filter((h) => h !== dateStr) };
      pushHistory(loadCourses());
      applySchedule(next);
      return next;
    });
  };

  const removeCourse = (id) => {
    pushHistory(courses);
    const next = courses.filter((c) => c.id !== id);
    saveCourses(next);
    saveCoursesRemote(next).catch(() => {});
    setCourses(next);
    onRemoveCourse && onRemoveCourse(id);
  };
  const duplicateCourse = (id) => {
    pushHistory(courses);
    const src = courses.find((c) => c.id === id);
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = uid();
    copy.course.id = copy.id;
    copy.course.name = `${src.course.name} (copy)`;
    const next = [...courses, copy];
    saveCourses(next);
    saveCoursesRemote(next).catch(() => {});
    setCourses(next);
    onDuplicateCourse && onDuplicateCourse(copy.id);
  };
  const handleAddCourse = () => {
    pushHistory(courses);
    onAddCourse();
  };
  const open = (id) => onOpenCourse(id);
  const addPerson = () => {
    const name = nextMemberName(people);
    const p = { id: uid(), name, roleType: 'Other', color: roleColor('Other'), avatar: '' };
    onPeopleChange([...people, p]);
  };
  const updatePerson = (id, updates) => {
    onPeopleChange(
      people.map((p) =>
        p.id === id
          ? { ...p, ...updates, ...(updates.roleType ? { color: roleColor(updates.roleType) } : {}) }
          : p
      )
    );
  };
  const renamePerson = (id, name) => updatePerson(id, { name });
  const removePerson = (id) => {
    onPeopleChange(people.filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/80 border-b border-black/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500"/>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-semibold truncate">DART: Design and Development Accountability and Responsibility Tracker</div>
              <div className="text-sm text-black/60 truncate">Courses Hub</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEditTemplate} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"><CopyIcon size={16}/> Edit Template</button>
            <button
              onClick={undo}
              disabled={!history.length}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCcw size={16}/> Undo
            </button>
            <button
              onClick={handleAddCourse}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-black text-white shadow"
            >
              <Plus size={16}/> Add Course
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Team member management */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Team Members</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={addPerson}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"
              >
                <UserPlus size={16}/> Add Member
              </button>
              <button
                onClick={() => setMembersEditing(v => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"
              >
                {membersEditing ? 'Done' : 'Edit Members'}
              </button>
            </div>
          </div>
          {people.length === 0 ? (
            <div className="text-sm text-black/60">No team members</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...people]
                .sort((a, b) => {
                  const roleCmp = roleOrder.indexOf(a.roleType) - roleOrder.indexOf(b.roleType);
                  return roleCmp !== 0 ? roleCmp : a.name.localeCompare(b.name);
                })
                .map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl p-4 shadow border-2 flex flex-col items-center text-center"
                    style={{ borderColor: m.color, backgroundColor: `${m.color}20` }}
                  >
                    <Avatar
                      name={m.name}
                      roleType={m.roleType}
                      avatar={m.avatar}
                      className="w-12 h-12 text-2xl mb-2"
                    />
                    {membersEditing ? (
                      <>
                        <select
                          value={m.avatar}
                          onChange={(e) => updatePerson(m.id, { avatar: e.target.value })}
                          className="border rounded px-2 py-1 text-sm mb-2"
                        >
                          <option value="">None</option>
                          {AVATAR_CHOICES.map((e) => (
                            <option key={e} value={e}>
                              {e}
                            </option>
                          ))}
                        </select>
                        <InlineText
                          value={m.name}
                          onChange={(v) => renamePerson(m.id, v)}
                          className="font-medium leading-tight"
                        />
                        <select
                          value={m.roleType}
                          onChange={(e) => updatePerson(m.id, { roleType: e.target.value })}
                          className="mt-1 border rounded px-2 py-1 text-sm"
                        >
                          {Object.keys(rolePalette).map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => onOpenUser(m.id)}
                            className="text-sm px-2 py-1 rounded border border-black/10 bg-white hover:bg-slate-50"
                          >
                            Open
                          </button>
                          <button
                            onClick={() => removePerson(m.id)}
                            className="text-sm px-2 py-1 rounded border border-black/10 bg-white text-rose-600 hover:bg-rose-50"
                          >
                            Remove
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onOpenUser(m.id)}
                          className="font-medium leading-tight hover:underline"
                        >
                          {m.name}
                        </button>
                        <div className="text-sm text-black/60">{m.roleType}</div>
                      </>
                    )}
                  </div>
                ))}
            </div>
          )}
        </section>


        {/* Global schedule controls */}
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold flex items-center gap-2 text-indigo-900">
              <Calendar size={18}/> Workweek & Holidays
              <span className="text-sm font-normal text-indigo-700">(Global)</span>
            </h2>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-white p-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="font-medium">Workweek:</div>
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((label, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleWorkday(idx)}
                  className={`px-2 py-1 rounded-full border ${
                    schedule.workweek.includes(idx)
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-black/10"
                  }`}
                >
                  {label}
                </button>
              ))}
              <div className="ml-2 font-medium">Holidays:</div>
              <AddHoliday onAdd={addHoliday} />
              <div className="flex flex-wrap gap-2">
                {schedule.holidays.map((h) => (
                  <span
                    key={h}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200"
                  >
                    {h}
                    <button
                      className="text-rose-500 hover:text-rose-700"
                      onClick={() => removeHoliday(h)}
                      title="Remove holiday"
                      aria-label="Remove holiday"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">All Courses</h2>
          {courses.length === 0 ? (
            <div className="rounded-2xl border border-black/10 bg-white p-6 text-center">
              <div className="text-lg font-semibold mb-2">No courses yet</div>
              <p className="text-sm text-black/60 mb-4">Use your Course Template to spin up your first course.</p>
              <button onClick={onAddCourse} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-black text-white shadow"><Plus size={16}/> Add Course</button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => {
                const t = computeTotals(c);
                return (
                  <motion.div
                    key={c.id}
                    layout
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${c.course.name}`}
                    onClick={() => open(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') open(c.id);
                    }}
                    className="group rounded-2xl border border-black/10 bg-white p-4 shadow-sm cursor-pointer hover:ring-2 hover:ring-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><div className="font-semibold truncate">{c.course.name}</div><div className="text-sm text-black/60 truncate">{c.course.description}</div></div>
                    </div>
                    <div className="flex items-center gap-4 mt-3">
                      <Ring className="w-14 h-14 xs:w-16 xs:h-16" stroke={10} progress={t.pct} color="#10b981">
                        <div className="text-center">
                          <div className="text-sm font-semibold">{t.pct}%</div>
                          <div className="text-sm text-black/60">{t.done}/{t.total}</div>
                        </div>
                      </Ring>
                      <div className="text-sm space-y-1"><div>In progress: <b>{t.inprog}</b></div><div>To do: <b>{t.todo}</b></div><div>Next due: <b>{t.nextDue || '—'}</b></div></div>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <button onClick={(e)=>{ e.stopPropagation(); open(c.id); }} className="w-full sm:w-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm bg-slate-900 text-white shadow">Open</button>
                      <button onClick={(e)=>{ e.stopPropagation(); duplicateCourse(c.id); }} className="w-full sm:w-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"><CopyIcon size={16}/> Duplicate</button>
                      <button onClick={(e)=>{ e.stopPropagation(); if(confirm('Delete this course?')) removeCourse(c.id); }} className="w-full sm:w-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm bg-white border border-black/10 text-rose-600 shadow-sm hover:bg-rose-50"><Trash2 size={16}/> Delete</button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
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
  const [currentUserId, setCurrentUserId] = useState(null);
  const [people, setPeople] = useState(() => {
    const stored = loadPeople();
    if (stored.length) return stored;
    const courses = loadCourses();
    const map = new Map();
    courses.forEach((c) => c.team.forEach((m) => { if (!map.has(m.id)) map.set(m.id, m); }));
    const arr = Array.from(map.values());
    savePeople(arr);
    return arr;
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const stored = localStorage.getItem('soundEnabled');
    return stored !== 'false';
  });
  const toggleSound = () => setSoundEnabled(v => {
    const next = !v;
    localStorage.setItem('soundEnabled', next ? 'true' : 'false');
    return next;
  });
  const handlePeopleChange = (next) => {
    setPeople(next);
    savePeople(next);
    savePeopleRemote(next).catch(() => {});
    syncPeopleToCourses(next);
  };
  useEffect(() => {
    (async () => {
      const remote = await loadPeopleRemote();
      if (remote.length) {
        setPeople(remote);
        savePeople(remote);
        syncPeopleToCourses(remote);
      }
    })();
  }, []);
  const version = pkg.version;
  const openCourse = (id) => { setPrevView(view); setCurrentCourseId(id); setView("course"); };
  const openUser = (id) => { setPrevView(view); setCurrentUserId(id || null); setView("user"); };
  const editTemplate = async () => {
    setPrevView(view);
    const remoteTpl = await loadTemplateRemote();
    if (remoteTpl) saveTemplate(remoteTpl);
    setCurrentCourseId("__TEMPLATE__");
    setView("course");
  };
  const addCourse = async () => {
    const tpl = (await loadTemplateRemote()) || loadTemplate() || remapSeed(seed());
    const base = remapSeed(JSON.parse(JSON.stringify(tpl)));
    base.course = { ...base.course, id: uid(), name: base.course.name || "New Course" };
    const all = loadCourses();
    const next = [...all, base];
    saveCourses(next);
    saveCoursesRemote(next).catch(() => {});
    const merged = [...people];
    base.team.forEach((m) => { if (!merged.some((p) => p.id === m.id)) merged.push({ ...m }); });
    handlePeopleChange(merged);
    setPrevView(view);
    setCurrentCourseId(base.course.id); setView("course");
  };
  const onBack = () => { setView(prevView); setPrevView("hub"); setCurrentCourseId(null); };

  let content = null;
  if (view === "hub") {
    content = (
      <CoursesHub
        onOpenCourse={openCourse}
        onEditTemplate={editTemplate}
        onAddCourse={addCourse}
        onOpenUser={openUser}
        people={people}
        onPeopleChange={handlePeopleChange}
        onRemoveCourse={() => {}}
        onDuplicateCourse={() => {}}
      />
    );
  } else if (view === "user") {
    content = (
      <UserDashboard
        onOpenCourse={openCourse}
        initialUserId={currentUserId}
        onBack={() => { setView("hub"); setPrevView("hub"); setCurrentUserId(null); }}
      />
    );
  } else if (currentCourseId === "__TEMPLATE__") {
    // open template editor
    const tpl = loadTemplate() || remapSeed(seed());
    const boot = { ...remapSeed(JSON.parse(JSON.stringify(tpl))), schedule: loadGlobalSchedule() };
    const handleChange = (s) => { saveTemplate(s); saveTemplateRemote(s).catch(()=>{}); };
    content = <CoursePMApp boot={boot} isTemplateLabel={true} onBack={onBack} onStateChange={handleChange} people={people} onOpenUser={openUser} />;
  } else {
    // open selected course
    const courses = loadCourses();
    const course = courses.find((c)=>c.id===currentCourseId || c.course?.id===currentCourseId) || courses[0];
    const handleCourseChange = (s) => {
      const all = loadCourses();
      const idx = all.findIndex(
        (c) => c.id === currentCourseId || c.course?.id === currentCourseId
      );
      if (idx >= 0) all[idx] = s;
      else all.push(s);
      saveCourses(all);
    };
    content = <CoursePMApp boot={course} isTemplateLabel={false} onBack={onBack} onStateChange={handleCourseChange} people={people} onOpenUser={openUser} />;
  }
  return (
    <SoundContext.Provider value={soundEnabled}>
      {content}
      <button
        onClick={toggleSound}
        className="fixed bottom-2 left-2 z-50 inline-flex items-center justify-center w-8 h-8 rounded-full border border-black/10 bg-white text-slate-600 shadow"
        title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
      >
        {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
      </button>
      <div className="fixed bottom-2 right-2 z-50 px-2 py-1 rounded bg-black/70 text-white text-sm">v{version}</div>
    </SoundContext.Provider>
  );
}

// =====================================================
// Lightweight tests (console)
// =====================================================
