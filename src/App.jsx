import React, { useEffect, useMemo, useState, useRef, Fragment, useCallback } from "react";
import { useIsMobile } from "./hooks/use-is-mobile.js";
import { useCompletionConfetti } from "./hooks/use-completion-confetti.js";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase.js";
import MilestoneCard from "./MilestoneCard.jsx";
import TeamMembersSection from "./components/TeamMembersSection.jsx";
import SectionCard from "./components/SectionCard.jsx";
import Avatar from "./components/Avatar.jsx";
import InlineText from "./components/InlineText.jsx";
import DuePill from "./components/DuePill.jsx";
import { LinkChips } from "./components/LinksEditor.jsx";
import DocumentInput from "./components/DocumentInput.jsx";
import AddHoliday from "./components/AddHoliday.jsx";
import DepPicker from "./components/DepPicker.jsx";
import CalendarView from "./components/CalendarView.jsx";
import TaskModal from "./components/TaskModal.jsx";
import TaskChecklist from "./components/TaskChecklist.jsx";
import TaskCard from "./TaskCard.jsx";
import LinkReminderModal from "./components/LinkReminderModal.jsx";
import BlockDialog from "./components/BlockDialog.jsx";
import { applyLinkPatch } from "./linkUtils.js";
import { SoundContext } from "./sound-context.js";
import pkg from "../package.json";
import defaultMilestoneTemplates from "../scripts/defaultMilestoneTemplates.json";
import {
  loadMilestoneTemplates,
  saveMilestoneTemplates,
  loadMilestoneTemplatesRemote,
  saveMilestoneTemplatesRemote,
  createTemplateFromMilestone,
  removeTemplate as removeMilestoneTemplateStore,
} from "./milestoneTemplatesStore.js";
import {
  X,
  Plus,
  Minus,
  Save,
  RotateCcw,
  Copy,
  History,
  Undo2,
  Trash2,
  StickyNote,
  BookOpen,
  Kanban,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  Pencil,
  Filter,
  Menu,
  Target,
  Loader2,
  ListChecks,
  AlarmClock,
  Home,
  GraduationCap,
  Flag,
  CalendarDays,
  Users,
  Upload,
  Download,
} from "lucide-react";
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
  addBusinessDays,
  normalizeUrl,
} from "./utils.js";
import { aggregateBlocksByCourse, applyBlockResolution } from "./blockUtils.js";

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
  "🐨","🐯","🦁","🐮","🐷","🐸","🐵","🦄","🐝","🐢",
  "🤖","👻","🦋","🐙","🦉","🦜","🦚","🦥","🦦","🦘",
  "🦨","🦩","🦢","🐳","🐬","🦈","🐊","🦀","🦂","🐞"
];

const mergeById = (base = [], extra = []) => {
  const map = new Map(base.map(t => [t.id, t]));
  extra.forEach(t => { if (!map.has(t.id)) map.set(t.id, t); });
  return Array.from(map.values());
};

const HISTORY_STACK_LIMIT = 20;

const cloneDeep = (value) => {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
};

const APP_SHELL_CLASS = "min-h-screen text-slate-900 bg-transparent";

const resetScrollPosition = () => {
  if (typeof window !== "undefined") {
    const { scrollTo } = window;
    if (typeof scrollTo === "function") {
      try {
        scrollTo({ top: 0, left: 0, behavior: "auto" });
      } catch {
        scrollTo(0, 0);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }

  if (typeof document !== "undefined") {
    const { scrollingElement, documentElement, body } = document;
    if (scrollingElement) scrollingElement.scrollTop = 0;
    if (documentElement) documentElement.scrollTop = 0;
    if (body) body.scrollTop = 0;
  }
};

const CoursesIcon = ({ className = "", ...props }) => (
  <GraduationCap
    aria-hidden="true"
    className={className ? `icon ${className}` : "icon"}
    {...props}
  />
);


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

const COURSE_HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const FIRESTORE_PASSWORD_SENTINEL = "passthesalt";
const courseHistoryCollectionRef = collection(db, 'courseHistory');

const toMillis = (value, fallback) => {
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return fallback;
};

const recordCourseHistoryEntry = async ({ courseId, course, action = 'delete', position = null }) => {
  try {
    const createdAtMs = Date.now();
    const expiresAtTs = Timestamp.fromMillis(createdAtMs + COURSE_HISTORY_RETENTION_MS);
    const payload = {
      password: FIRESTORE_PASSWORD_SENTINEL,
      courseId,
      course,
      action,
      position,
      createdAt: serverTimestamp(),
      expiresAt: expiresAtTs,
    };
    const ref = await addDoc(courseHistoryCollectionRef, payload);
    return {
      id: ref.id,
      courseId,
      course,
      action,
      position,
      createdAt: createdAtMs,
      expiresAt: toMillis(expiresAtTs, createdAtMs + COURSE_HISTORY_RETENTION_MS),
    };
  } catch {
    return null;
  }
};

const loadCourseHistoryEntries = async () => {
  try {
    const now = Date.now();
    const snapshot = await getDocs(
      query(
        courseHistoryCollectionRef,
        where('password', '==', FIRESTORE_PASSWORD_SENTINEL),
        orderBy('createdAt', 'desc'),
        limit(50)
      )
    );
    const rows = snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data?.() ?? docSnap.data;
        if (!data || !data.courseId || !data.course) return null;
        return {
          id: docSnap.id,
          courseId: data.courseId,
          course: data.course,
          action: data.action || 'delete',
          position: typeof data.position === 'number' ? data.position : null,
          createdAt: toMillis(data.createdAt, now),
          expiresAt: toMillis(data.expiresAt, now + COURSE_HISTORY_RETENTION_MS),
        };
      })
      .filter(Boolean);
    rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return rows;
  } catch {
    return [];
  }
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
// Link Library Store
// =====================================================
const LINK_LIBRARY_KEY = "healthPM:linkLibrary:v1";
const loadLinkLibrary = () => {
  try {
    const raw = localStorage.getItem(LINK_LIBRARY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const saveLinkLibrary = (links) => {
  try {
    localStorage.setItem(LINK_LIBRARY_KEY, JSON.stringify(links));
  } catch {}
};
const loadLinkLibraryRemote = async () => {
  try {
    const snap = await getDoc(doc(db, 'app', 'linkLibrary'));
    return snap.exists() ? snap.data().links || [] : null;
  } catch {
    return null;
  }
};
const saveLinkLibraryRemote = async (links) => {
  try {
    await setDoc(doc(db, 'app', 'linkLibrary'), { links });
  } catch {}
};

// =====================================================
// Seed + Migration
// =====================================================
const createSampleMilestones = (today) => ([
  { id: uid(), title: "A–D Blueprint Approved", start: today, goal: "Complete sections A–D of blueprint" },
  { id: uid(), title: "Section E Approved",     start: today, goal: "Finalize Section E (Assessments & Rubrics)" },
  { id: uid(), title: "Canvas Build",            start: today, goal: "Transfer & QA in LMS" },
]);

const createSampleTasks = (today) => ([
  { id: uid(), order: 0, title: "Draft course outcomes", details: "Bloom + alignment checks", note: "", links: [], blocks: [], assigneeId: null, milestoneId: 0, status: "todo",       startDate: "",      workDays: 3, dueDate: "",                          depTaskId: null, completedDate: "" },
  { id: uid(), order: 1, title: "Collect source materials", details: "Slides, readings, datasets", note: "", links: [], blocks: [], assigneeId: null, milestoneId: 0, status: "inprogress", startDate: today, workDays: 2, dueDate: addBusinessDays(today,2), depTaskId: null, completedDate: "" },
  { id: uid(), order: 2, title: "Storyboard videos",    details: "3 explainer videos", note: "", links: [], blocks: [], assigneeId: null, milestoneId: 2, status: "todo",       startDate: "",      workDays: 5, dueDate: "",                          depTaskId: null, completedDate: "" },
  { id: uid(), order: 3, title: "Build Canvas shell",   details: "Modules, pages, nav", note: "", links: [], blocks: [], assigneeId: null, milestoneId: 2, status: "todo",       startDate: "",      workDays: 4, dueDate: "",                          depTaskId: null, completedDate: "" },
  { id: uid(), order: 4, title: "SME review: A–D",      details: "Async comments", note: "", links: [], blocks: [], assigneeId: null, milestoneId: 0, status: "done",        startDate: today, workDays: 1, dueDate: addBusinessDays(today,1), depTaskId: null, completedDate: today },
]);

export const seed = ({ withSampleData = false } = {}) => {
  const base = {
    course: { id: uid(), name: "Intro to Learning Design", description: "From analysis to deployment, track the whole build.", accent: "from-fuchsia-500 via-pink-500 to-rose-500", courseLDIds: [], courseSMEIds: [] },
    schedule: { workweek: [1,2,3,4,5], holidays: [] }, // back-compat; overridden by global
    team: [
      { id: uid(), name: "Alex Cruz", roleType: "LD",  color: roleColor("LD"),  avatar: "" },
      { id: uid(), name: "Dr. Reyes", roleType: "SME", color: roleColor("SME"), avatar: "" },
      { id: uid(), name: "Pat Santos", roleType: "PM",  color: roleColor("PM"),  avatar: "" },
      { id: uid(), name: "Jae Lim", roleType: "MM",     color: roleColor("MM"),   avatar: "" },
      { id: uid(), name: "Rio Tan", roleType: "PA",     color: roleColor("PA"),   avatar: "" },
    ],
    milestones: [],
    tasks: [],
    linkLibrary: [],
  };

  if (!withSampleData) return base;

  const today = todayStr();
  return {
    ...base,
    milestones: createSampleMilestones(today),
    tasks: createSampleTasks(today),
  };
};

export const seedWithSampleData = () => seed({ withSampleData: true });

const remapSeed = (s) => {
  const msIds = s.milestones.map((m) => m.id);
  const msIdSet = new Set(msIds);
  s.schedule = s.schedule || { workweek: [1,2,3,4,5], holidays: [] };
  s.tasks = s.tasks.map((t) => {
    let milestoneId = t.milestoneId ?? null;
    if (typeof milestoneId === 'number') {
      milestoneId = msIds[milestoneId] ?? null;
    }
    if (milestoneId === '') milestoneId = null;
    if (milestoneId !== null && !msIdSet.has(milestoneId)) {
      milestoneId = null;
    }
    const workDays = t.workDays ?? t.estimateDays ?? 0;
    let startDate = t.startDate || "";
    let dueDate = t.dueDate || "";
    const links = Array.isArray(t.links) ? t.links : [];
    const note = t.note ?? "";
    const blocks = Array.isArray(t.blocks)
      ? t.blocks
          .map((block) => {
            if (!block || typeof block !== 'object') return null;
            const taggedMemberIds = Array.isArray(block.taggedMemberIds)
              ? block.taggedMemberIds.filter((id) => typeof id === 'string' && id)
              : [];
            const description =
              typeof block.description === 'string' ? block.description : '';
            const reportedAt =
              typeof block.reportedAt === 'string' && block.reportedAt
                ? block.reportedAt
                : todayStr();
            const reportedBy =
              typeof block.reportedBy === 'string' && block.reportedBy
                ? block.reportedBy
                : null;
            const resolvedAt =
              typeof block.resolvedAt === 'string' && block.resolvedAt
                ? block.resolvedAt
                : null;
            const resolvedBy =
              typeof block.resolvedBy === 'string' && block.resolvedBy
                ? block.resolvedBy
                : null;
            const resolution =
              typeof block.resolution === 'string' ? block.resolution : '';
            const id =
              typeof block.id === 'string' && block.id ? block.id : uid();
            return {
              id,
              reportedAt,
              reportedBy,
              description,
              taggedMemberIds,
              resolvedAt,
              resolvedBy,
              resolution,
            };
          })
          .filter(Boolean)
      : [];
    if (t.status === "todo") { startDate = ""; dueDate = ""; }
    if (!dueDate && startDate) dueDate = addBusinessDays(startDate, workDays, s.schedule.workweek, s.schedule.holidays);
    return { ...t, milestoneId, workDays, startDate, dueDate, links, note, blocks, depTaskId: t.depTaskId ?? null, completedDate: t.completedDate ?? (t.status === "done" ? todayStr() : "") };
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
  const sanitizedLinks = Array.isArray(s.linkLibrary)
    ? s.linkLibrary
        .map((link) => {
          if (!link || typeof link !== "object") return null;
          const url = typeof link.url === "string" ? link.url : "";
          if (!url) return null;
          const label =
            typeof link.label === "string" && link.label ? link.label : url;
          const id = typeof link.id === "string" && link.id ? link.id : uid();
          return { id, label, url };
        })
        .filter(Boolean)
    : [];
  s.linkLibrary = sanitizedLinks;
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
  const inset = Math.max(stroke, 8);
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
      <div
        className="absolute flex flex-col items-center justify-center rounded-full text-center select-none"
        style={{
          top: `${inset}px`,
          right: `${inset}px`,
          bottom: `${inset}px`,
          left: `${inset}px`,
          backgroundColor: "rgba(255, 255, 255, 0.96)",
          boxShadow: "inset 0 1px 4px rgba(15, 23, 42, 0.08)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function IconBadge({ children, className = "" }) {
  return (
    <span
      className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${className}`}
    >
      {children}
    </span>
  );
}

// =====================================================
// Course Dashboard (formerly default export)
// =====================================================
function CoursePMApp({ boot, isTemplateLabel = false, onBack, onStateChange, people = [], milestoneTemplates = [], onChangeMilestoneTemplates, onOpenUser }) {
  const [state, setCourseState] = useState(() => {
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
  const [view, setView] = useState("list");
  const [milestoneFilter, setMilestoneFilter] = useState("all");
  const [milestonesCollapsed, setMilestonesCollapsed] = useState(false);
  const [teamCollapsed, setTeamCollapsed] = useState(true);
  const [tasksCollapsed, setTasksCollapsed] = useState(true);
  const [selectedMilestoneTemplate, setSelectedMilestoneTemplate] = useState("");
  const [milestoneFilterOpen, setMilestoneFilterOpen] = useState(false);
  const [linkLibraryCollapsed, setLinkLibraryCollapsed] = useState(true);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [editingCourseLinkId, setEditingCourseLinkId] = useState(null);
  const [editingCourseLinkLabel, setEditingCourseLinkLabel] = useState("");
  const [editingCourseLinkUrl, setEditingCourseLinkUrl] = useState("");
  const [saveState, setSaveState] = useState('saved');
  const [history, setHistory] = useState([]);
  const firstRun = useRef(true);
  const milestoneFilterRef = useRef(null);

  const updateCourseState = useCallback((updater, options = {}) => {
    const { capture = true } = options;
    let applied = null;
    setCourseState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next === prev) return prev;
      if (capture) {
        const snapshot = JSON.parse(JSON.stringify(prev));
        setHistory((h) => [snapshot, ...h].slice(0, 10));
      }
      applied = next;
      return next;
    });
    return applied;
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      const [latest, ...rest] = h;
      setCourseState(latest);
      return rest;
    });
  }, []);

  const toggleLinkLibraryCollapsed = useCallback(() => {
    setLinkLibraryCollapsed((value) => !value);
  }, []);

  const persistCourseLinkLibrary = useCallback(
    (next) => {
      updateCourseState((s) => ({ ...s, linkLibrary: next }));
    },
    [updateCourseState]
  );

  const handleStartEditCourseLink = useCallback((link) => {
    setEditingCourseLinkId(link.id);
    setEditingCourseLinkLabel(link.label || "");
    setEditingCourseLinkUrl(link.url || "");
  }, []);

  const handleCancelEditCourseLink = useCallback(() => {
    setEditingCourseLinkId(null);
    setEditingCourseLinkLabel("");
    setEditingCourseLinkUrl("");
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
        const target = event.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo]);

  useEffect(() => {
    updateCourseState(
      (s) => ({
        ...s,
        team: s.team.map((m) => {
          const p = people.find((p) => p.id === m.id);
          return p ? { ...m, ...p } : m;
        }),
      }),
      { capture: false }
    );
  }, [people, updateCourseState]);

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

  useEffect(() => {
    if (milestoneFilter !== "all" && !state.milestones.some((m) => m.id === milestoneFilter)) {
      setMilestoneFilter("all");
    }
  }, [milestoneFilter, state.milestones]);

  useEffect(() => {
    if (!milestoneFilterOpen) return;
    const handleClickAway = (event) => {
      if (milestoneFilterRef.current && !milestoneFilterRef.current.contains(event.target)) {
        setMilestoneFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, [milestoneFilterOpen]);

  useEffect(() => {
    if (milestonesCollapsed) {
      setMilestoneFilterOpen(false);
    }
  }, [milestonesCollapsed]);

const handleSave = useCallback(async () => {
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
}, [state, onStateChange]);

useEffect(() => {
  if (saveState !== 'unsaved') return;
  const t = setTimeout(handleSave, 1500);
  return () => clearTimeout(t);
}, [saveState, handleSave]);

  // Listen for global schedule changes from other tabs
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === GLOBAL_SCHEDULE_KEY && e.newValue) {
        try {
          const sched = JSON.parse(e.newValue);
          updateCourseState((s) => {
            let tasks = s.tasks.map((t) => t.startDate ? { ...t, dueDate: addBusinessDays(t.startDate, t.workDays, sched.workweek, sched.holidays) } : t);
            tasks = propagateDependentForecasts(tasks, sched);
            return { ...s, schedule: sched, tasks };
          }, { capture: false });
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [updateCourseState]);

  // Capture current content once as initial template (only if not already captured)
  useEffect(() => { try { const flag = localStorage.getItem("healthPM:template:captured"); if (!flag) { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(state)); localStorage.setItem("healthPM:template:captured","1"); } } catch {} }, []);

  const team = state.team;
  const milestones = useMemo(
    () => [...state.milestones],
    [state.milestones]
  );
  const tasksRaw = state.tasks;
  const filteredTasks = useMemo(() => (milestoneFilter === "all" ? tasksRaw : tasksRaw.filter((t) => t.milestoneId === milestoneFilter)), [tasksRaw, milestoneFilter]);
  const groupedTasks = useMemo(() => {
    return filteredTasks.reduce((acc, t) => {
      (acc[t.milestoneId] ||= []).push(t);
      return acc;
    }, {});
  }, [filteredTasks]);
  const unassignedTasks = useMemo(() => {
    const validIds = new Set(milestones.map((m) => m.id));
    return tasksRaw.filter((t) => {
      const id = t.milestoneId;
      return id === null || id === undefined || id === "" || !validIds.has(id);
    });
  }, [tasksRaw, milestones]);
  const filteredMilestones = useMemo(() => {
    const base =
      milestoneFilter === "all"
        ? milestones
        : milestones.filter((m) => m.id === milestoneFilter);
    return [...base].sort((a, b) =>
      (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" })
    );
  }, [milestones, milestoneFilter]);
  const activeFilterLabel = useMemo(() => {
    if (milestoneFilter === "all") return "All milestones";
    const match = milestones.find((m) => m.id === milestoneFilter);
    return match ? match.title : "All milestones";
  }, [milestoneFilter, milestones]);

  const totals = useMemo(() => {
    const total = tasksRaw.length;
    const done = tasksRaw.filter((t) => t.status === "done").length;
    const inprog = tasksRaw.filter((t) => t.status === "inprogress").length;
    const blocked = tasksRaw.filter((t) => t.status === "blocked").length;
    const todo = tasksRaw.filter((t) => t.status === "todo").length;
    const overdue = tasksRaw.filter(
      (t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < new Date(todayStr())
    ).length;
    return {
      total,
      done,
      inprog,
      blocked,
      todo,
      overdue,
      pct: total ? Math.round((done / total) * 100) : 0,
    };
  }, [tasksRaw]);

  const linkLibrary = Array.isArray(state.linkLibrary) ? state.linkLibrary : [];

  const handleAddCourseLink = useCallback(
    (event) => {
      event.preventDefault();
      const label = newLinkLabel.trim();
      const rawUrl = newLinkUrl.trim();
      if (!rawUrl) return;
      const finalUrl = normalizeUrl(rawUrl);
      if (!finalUrl) return;
      const parsed = new URL(finalUrl);
      const entry = {
        id: uid(),
        label: label || parsed.hostname || finalUrl,
        url: finalUrl,
      };
      persistCourseLinkLibrary([...linkLibrary, entry]);
      setNewLinkLabel("");
      setNewLinkUrl("");
    },
    [linkLibrary, newLinkLabel, newLinkUrl, persistCourseLinkLibrary]
  );

  const handleRemoveCourseLink = useCallback(
    (id) => {
      if (editingCourseLinkId === id) {
        handleCancelEditCourseLink();
      }
      persistCourseLinkLibrary(linkLibrary.filter((link) => link.id !== id));
    },
    [editingCourseLinkId, linkLibrary, persistCourseLinkLibrary, handleCancelEditCourseLink]
  );

  const handleSubmitCourseLinkEdit = useCallback(
    (event) => {
      event.preventDefault();
      if (!editingCourseLinkId) return;
      const label = editingCourseLinkLabel.trim();
      const rawUrl = editingCourseLinkUrl.trim();
      if (!rawUrl) return;
      const finalUrl = normalizeUrl(rawUrl);
      if (!finalUrl) return;
      const parsed = new URL(finalUrl);
      persistCourseLinkLibrary(
        linkLibrary.map((link) =>
          link.id === editingCourseLinkId
            ? {
                ...link,
                label: label || parsed.hostname || finalUrl,
                url: finalUrl,
              }
            : link
        )
      );
      handleCancelEditCourseLink();
    },
    [
      editingCourseLinkId,
      editingCourseLinkLabel,
      editingCourseLinkUrl,
      linkLibrary,
      persistCourseLinkLibrary,
      handleCancelEditCourseLink,
    ]
  );


  const recomputeDue = (t, patch = {}) => { const start = patch.startDate ?? t.startDate; const work = patch.workDays ?? t.workDays; const due = start ? addBusinessDays(start, work, state.schedule.workweek, state.schedule.holidays) : ""; return { ...patch, dueDate: due }; };
  const propagateDependentForecasts = (tasks, schedule) => { const map = new Map(tasks.map((t)=>[t.id,t])); return tasks.map((t)=>{ if(!t.depTaskId || t.status==="done" || t.status==="skip") return t; const src = map.get(t.depTaskId); if(!src || src.status === "skip") return t; const startForecast = src.dueDate || ""; if (t.status !== "inprogress" && startForecast) { const due = addBusinessDays(startForecast, t.workDays, schedule.workweek, schedule.holidays); return { ...t, startDate: startForecast, dueDate: due }; } return t; }); };

  const updateTask = (id, patch) => {
    let nextState = null;
    updateCourseState((s) => {
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
      if (changedTo === "inprogress") tasks2 = tasks2.map((d) => (d.depTaskId === id && d.status !== "done" && d.status !== "skip" ? { ...d, status: "inprogress" } : d));
      if (changedTo === "done") {
        const doneDate = todayStr();
        tasks2 = tasks2.map((x) => (x.id === id ? { ...x, completedDate: x.completedDate || doneDate } : x));
        tasks2 = tasks2.map((d) => { if (d.depTaskId === id && d.status !== "done" && d.status !== "skip") { const start = doneDate; const due = addBusinessDays(start, d.workDays, s.schedule.workweek, s.schedule.holidays); return { ...d, status: "inprogress", startDate: start, dueDate: due }; } return d; });
      }
      if (changedTo === "skip") {
        const skipDate = todayStr();
        tasks2 = tasks2.map((d) => {
          if (d.depTaskId === id && d.status !== "done" && d.status !== "skip") {
            const start = skipDate;
            const due = addBusinessDays(start, d.workDays, s.schedule.workweek, s.schedule.holidays);
            return { ...d, status: "inprogress", startDate: start, dueDate: due };
          }
          return d;
        });
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

  const addTask = (milestoneId = null) =>
    updateCourseState((s) => {
      const desiredId = milestoneId ?? null;
      const validMilestoneId = desiredId && s.milestones.some((m) => m.id === desiredId) ? desiredId : null;
      return {
        ...s,
        tasks: [
          ...s.tasks,
          {
            id: uid(),
            order: s.tasks.length,
            title: "New Task",
            details: "",
            note: "",
            links: [],
            blocks: [],
            depTaskId: null,
            assigneeId: s.course.courseLDIds[0] || (s.team.find((m) => m.roleType === 'LD')?.id ?? null),
            milestoneId: validMilestoneId,
            status: "todo",
            startDate: "",
            workDays: 1,
            dueDate: "",
            completedDate: "",
          },
        ],
      };
    });
  const duplicateTask = (id) =>
    updateCourseState((s) => {
      const orig = s.tasks.find((t) => t.id === id);
      if (!orig) return s;
      const cloneStatus = orig.status === "done" ? "todo" : orig.status === "blocked" ? "blocked" : "todo";
      const clone = {
        ...orig,
        id: uid(),
        order: s.tasks.length,
        title: `${orig.title} (copy)`,
        status: cloneStatus,
        startDate: "",
        dueDate: "",
        completedDate: "",
        depTaskId: null,
        blocks: Array.isArray(orig.blocks) ? orig.blocks.map((b) => ({ ...b })) : [],
      };
      return { ...s, tasks: [...s.tasks, clone] };
    });
  const patchTaskLinks = (id, op, payload) =>
    updateCourseState((s) => ({
      ...s,
      tasks: applyLinkPatch(s.tasks, id, op, payload),
    }));
  const deleteTask = (id) => updateCourseState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  const handleDeleteUnassignedTasksClick = () => {
    if (!window.confirm("Delete all unassigned tasks? This action cannot be undone.")) return;
    updateCourseState((s) => {
      const validIds = new Set(s.milestones.map((m) => m.id));
      const remaining = s.tasks.filter((t) => {
        const id = t.milestoneId;
        return id !== null && id !== undefined && id !== "" && validIds.has(id);
      });
      return { ...s, tasks: remaining };
    });
  };

  const updateMilestone  = (id, patch) => updateCourseState((s)=>({ ...s, milestones: s.milestones.map((m)=>(m.id===id?{...m,...patch}:m)) }));
  const addMilestone = () =>
    updateCourseState((s) => ({
      ...s,
      milestones: [{ id: uid(), title: "New Milestone", start: todayStr(), goal: "" }, ...s.milestones],
    }));
  const addMilestoneFromTemplate = (tplId) =>
    updateCourseState((s) => {
      const tpl = milestoneTemplates.find((t) => t.id === tplId);
      if (!tpl) return s;
      const newMsId = uid();
      const newMs = { id: newMsId, title: tpl.title, start: todayStr(), goal: tpl.goal || "" };
      const ld = s.course.courseLDIds[0] || (s.team.find((m) => m.roleType === 'LD')?.id ?? null);
      const nextOrder = s.tasks.length;
      const clonedTasks = (tpl.tasks || []).map((t, i) => ({
        ...t,
        id: uid(),
        order: nextOrder + i,
        assigneeId: ld,
        milestoneId: newMsId,
        status: 'todo',
        startDate: '',
        dueDate: '',
        completedDate: '',
        blocks: Array.isArray(t.blocks) ? t.blocks.map((b) => ({ ...b })) : [],
      }));
      return { ...s, milestones: [newMs, ...s.milestones], tasks: [...s.tasks, ...clonedTasks] };
    });
  const deleteMilestone  = (id) =>
    updateCourseState((s) => {
      const removedTaskIds = new Set(
        s.tasks
          .filter((t) => t.milestoneId === id)
          .map((t) => t.id)
      );

      const remainingTasks = s.tasks
        .filter((t) => t.milestoneId !== id)
        .map((t) =>
          removedTaskIds.has(t.depTaskId)
            ? { ...t, depTaskId: null }
            : t
        );

      return {
        ...s,
        milestones: s.milestones.filter((m) => m.id !== id),
        tasks: remainingTasks,
      };
    });
  const duplicateMilestone = (id) =>
    updateCourseState((s) => {
      const src = s.milestones.find((m) => m.id === id);
      if (!src) return s;

      const newMilestoneId = uid();
      const newMs = {
        id: newMilestoneId,
        title: `${src.title} (copy)`,
        start: src.start,
        goal: src.goal,
      };

      const related = s.tasks.filter((t) => t.milestoneId === id);
      const sortedRelated = [...related].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const nextOrder = s.tasks.length;
      const idMap = new Map();

      const clonedTasks = sortedRelated.map((task, index) => {
        const newTaskId = uid();
        idMap.set(task.id, newTaskId);

        return {
          ...task,
          id: newTaskId,
          order: nextOrder + index,
          milestoneId: newMilestoneId,
          links: Array.isArray(task.links) ? [...task.links] : [],
        };
      }).map((task, index) => {
        const sourceDep = sortedRelated[index].depTaskId;
        if (sourceDep && idMap.has(sourceDep)) {
          return { ...task, depTaskId: idMap.get(sourceDep) };
        }
        return task;
      });

      return {
        ...s,
        milestones: [...s.milestones, newMs],
        tasks: [...s.tasks, ...clonedTasks],
      };
    });
  const saveMilestoneTemplate = (id) => {
    const src = state.milestones.find((m) => m.id === id);
    if (!src) return;
    const tasks = state.tasks.filter((t) => t.milestoneId === id);
    const next = createTemplateFromMilestone(src, tasks);
    onChangeMilestoneTemplates?.(next);
    setSelectedMilestoneTemplate("");
  };

  const removeMilestoneTemplate = (id) => {
    const next = removeMilestoneTemplateStore(id);
    onChangeMilestoneTemplates?.(next);
    setSelectedMilestoneTemplate("");
  };

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
    updateCourseState((s) => {
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
  const updateMember = (id, patch) => updateCourseState((s)=>({ ...s, team: s.team.map((m)=>{ if(m.id!==id) return m; const next={...m,...patch}; if(patch.roleType) next.color = roleColor(patch.roleType); return next; }) }));
  const addMember    = () => updateCourseState((s)=>({ ...s, team: [...s.team, { id: uid(), name: nextMemberName(s.team), roleType:"Other", color: roleColor("Other"), avatar: "" }] }));
  const addExistingMember = (pid) => updateCourseState((s)=>{
    if (s.team.some((m)=>m.id===pid)) return s;
    const person = people.find((p)=>p.id===pid);
    if (!person) return s;
    return { ...s, team: [...s.team, { ...person }] };
  });
  const deleteMember = (id) => updateCourseState((s)=>({ ...s, team: s.team.filter((m)=>m.id!==id), course: { ...s.course, courseLDIds: s.course.courseLDIds.filter((mId)=>mId!==id), courseSMEIds: s.course.courseSMEIds.filter((mId)=>mId!==id) }, tasks: s.tasks.map((t)=>(t.assigneeId===id?{...t, assigneeId:null}:t)) }));
  const toggleCourseWide = (kind, id) =>
    updateCourseState((s) => {
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

  const renderCourseRoleBadge = (id, label) => {
    const member = memberById(id);
    if (!member) return null;
    return (
      <span
        key={`${label}-${id}`}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-white"
        style={{ background: roleColor(member.roleType) }}
      >
        <Avatar
          name={member.name}
          roleType={member.roleType}
          avatar={member.avatar}
          className="w-6 h-6 text-sm"
        />
        <span>{label}</span>
      </span>
    );
  };

  const courseLeadBadges = state.course.courseLDIds.map((id) =>
    renderCourseRoleBadge(id, "LD")
  );
  const courseSmeBadges = state.course.courseSMEIds.map((id) =>
    renderCourseRoleBadge(id, "SME")
  );
  const hasCourseRoleBadges =
    courseLeadBadges.some(Boolean) || courseSmeBadges.some(Boolean);

  const ActionButtons = () => (
    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
      <button
        type="button"
        onClick={handleSave}
        className="glass-button inline-flex items-center gap-2"
        title="Save"
        aria-label="Save"
      >
        <Save className="icon" aria-hidden="true" />
        <span>Save</span>
      </button>
      <button
        type="button"
        onClick={undo}
        disabled={!history.length}
        className="glass-button inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Undo"
        aria-label="Undo"
      >
        <Undo2 className="icon" aria-hidden="true" />
        <span>Undo</span>
      </button>
      <span className="text-sm font-medium text-slate-600/90 whitespace-nowrap px-3 py-1 rounded-full bg-white/80 border border-white/60 shadow-sm">
        {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Unsaved'}
      </span>
      <button
        type="button"
        onClick={() => {
          if (confirm("Reset to fresh sample data?")) updateCourseState(remapSeed(seedWithSampleData()));
        }}
        className="glass-icon-button"
        title="Reset sample data"
        aria-label="Reset sample data"
      >
        <RotateCcw className="icon" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={async () => {
          saveTemplate(state);
          await saveTemplateRemote(state).catch(() => {});
        }}
        className="glass-icon-button"
        title="Save as template"
        aria-label="Save as template"
      >
        <Copy className="icon" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={async () => {
          const tpl = (await loadTemplateRemote()) || loadTemplate();
          if (tpl)
            updateCourseState({ ...remapSeed(tpl), schedule: loadGlobalSchedule() });
          else alert("No template saved yet.");
        }}
        className="glass-icon-button"
        title="Reset to saved template"
        aria-label="Reset to saved template"
      >
        <History className="icon" aria-hidden="true" />
      </button>
      {isTemplateLabel && (
        <>
          <label
            className="glass-button inline-flex items-center gap-2 cursor-pointer"
            title="Import JSON"
            aria-label="Import JSON"
          >
            <Upload className="icon" aria-hidden="true" />
            <span>Import JSON</span>
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
                      updateCourseState(() => ({
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
            type="button"
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
            className="glass-button inline-flex items-center gap-2"
            title="Export JSON"
            aria-label="Export JSON"
          >
            <Download className="icon" aria-hidden="true" />
            <span>Export JSON</span>
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className={APP_SHELL_CLASS}>
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/50 bg-white/70 supports-[backdrop-filter]:bg-white/30 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_16px_48px_rgba(15,23,42,0.12)]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 sm:flex-nowrap">
          {onBack && (
            <button
              onClick={onBack}
              className="glass-button-primary inline-flex items-center gap-2"
            >
              <CoursesIcon className="shrink-0" />
              <span>Back to Courses</span>
            </button>
          )}
          <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${state.course.accent} shadow-[0_12px_32px_rgba(15,23,42,0.2)]`} />
          {/* DART banner title */}
          <div className="hidden sm:block text-[15px] font-semibold text-slate-700/90 tracking-tight truncate">DART: Design and Development Accountability and Responsibility Tracker</div>
          <div className="flex-1" />
          <div className="w-full flex justify-end sm:w-auto">
            <div className="hidden sm:flex flex-wrap items-center gap-3">
              <ActionButtons />
            </div>
            <div className="relative sm:hidden">
              <button
                onClick={() => setActionsOpen((v) => !v)}
                className="glass-icon-button"
                aria-label="Toggle actions menu"
                aria-expanded={actionsOpen}
                aria-controls="actions-menu"
              >
                <Menu className="icon" />
              </button>
              {actionsOpen && (
                <div
                  id="actions-menu"
                  className="absolute right-0 mt-2 z-10 w-60 glass-surface p-3 flex flex-col gap-2"
                >
                  <ActionButtons />
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Secondary row: course title and template pill */}
        <div className="max-w-7xl mx-auto px-4 pb-4 -mt-1 space-y-2 sm:space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base sm:text-xl font-semibold leading-tight flex-1 min-w-0 text-slate-800"><InlineText className="break-words" value={state.course.name} onChange={(v)=>updateCourseState((s)=>({ ...s, course: { ...s.course, name: v } }))} /></h1>
            {isTemplateLabel && <span className="text-sm font-medium px-3 py-1 rounded-full bg-violet-100/80 text-violet-700 border border-violet-200/70 shadow-[0_10px_18px_rgba(79,70,229,0.18)] whitespace-nowrap">Course Template</span>}
          </div>
          <div className="flex flex-col gap-2 text-sm sm:mt-0 sm:flex-row sm:items-center sm:gap-4">
            <p className="text-slate-600/90 leading-snug sm:flex-1 sm:min-w-[280px]">
              <InlineText
                value={state.course.description}
                onChange={(v)=>updateCourseState((s)=>({ ...s, course: { ...s.course, description: v } }))}
              />
            </p>
            {hasCourseRoleBadges && (
              <div className="flex flex-wrap gap-2 text-slate-700">
                {courseLeadBadges}
                {courseSmeBadges}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        {/* Link Library */}
        <section className="glass-surface p-4 sm:p-6">
          <div className="flex flex-col gap-3">
            <div
              role="button"
              tabIndex={0}
              onClick={toggleLinkLibraryCollapsed}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
                  event.preventDefault();
                  if (!event.repeat) {
                    toggleLinkLibraryCollapsed();
                  }
                }
              }}
              aria-expanded={!linkLibraryCollapsed}
              aria-label={linkLibraryCollapsed ? 'Expand course link library' : 'Collapse course link library'}
              className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-2xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400"
            >
              <h2 className="text-lg font-semibold flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900/5 text-slate-600 shadow-[0_12px_28px_-20px_rgba(15,23,42,0.28)]">
                  <LinkIcon className="icon icon-lg" aria-hidden="true" />
                </span>
                <span className="flex items-baseline gap-2">
                  <span>Link Library</span>
                  <span className="text-sm font-normal text-slate-600/90">({linkLibrary.length})</span>
                </span>
              </h2>
              <div className="flex items-center gap-2">
                <span className="glass-icon-button w-9 h-9 sm:w-11 sm:h-11" aria-hidden="true">
                  {linkLibraryCollapsed ? <ChevronDown className="icon" /> : <ChevronUp className="icon" />}
                </span>
              </div>
            </div>
            {!linkLibraryCollapsed && (
              <div className="space-y-4">
                <form
                  className="glass-card p-4 space-y-3 sm:space-y-0 sm:flex sm:items-end sm:gap-3"
                  onSubmit={handleAddCourseLink}
                >
                  <label className="flex-1 text-sm text-slate-700">
                    <span className="font-medium">Label</span>
                    <input
                      type="text"
                      value={newLinkLabel}
                      onChange={(e) => setNewLinkLabel(e.target.value)}
                      placeholder="Resource name"
                      className="mt-1 w-full rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-sm shadow-sm"
                    />
                  </label>
                  <label className="flex-1 text-sm text-slate-700">
                    <span className="font-medium">URL</span>
                    <input
                      type="text"
                      inputMode="url"
                      autoComplete="url"
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      placeholder="example.com or https://example.com"
                      className="mt-1 w-full rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-sm shadow-sm"
                    />
                  </label>
                  <button type="submit" className="glass-button-primary whitespace-nowrap">
                    Add Link
                  </button>
                </form>
                {linkLibrary.length === 0 ? (
                  <div className="glass-card p-4 text-sm text-slate-600/90">
                    No links yet. Add your go-to resources above.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {linkLibrary.map((link) => (
                      <li
                        key={link.id}
                        className="glass-card p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        {editingCourseLinkId === link.id ? (
                          <form
                            className="w-full flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3"
                            onSubmit={handleSubmitCourseLinkEdit}
                          >
                            <label className="flex-1 text-sm text-slate-700">
                              <span className="font-medium">Label</span>
                              <input
                                type="text"
                                value={editingCourseLinkLabel}
                                onChange={(event) => setEditingCourseLinkLabel(event.target.value)}
                                className="mt-1 w-full rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-sm shadow-sm"
                              />
                            </label>
                            <label className="flex-1 text-sm text-slate-700">
                              <span className="font-medium">URL</span>
                              <input
                                type="text"
                                inputMode="url"
                                autoComplete="url"
                                value={editingCourseLinkUrl}
                                onChange={(event) => setEditingCourseLinkUrl(event.target.value)}
                                className="mt-1 w-full rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-sm shadow-sm"
                              />
                            </label>
                            <div className="flex items-center gap-2">
                              <button type="submit" className="glass-button-primary text-sm whitespace-nowrap">
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditCourseLink}
                                className="glass-button text-sm whitespace-nowrap"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="min-w-0 space-y-1">
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-slate-800 hover:underline break-words"
                              >
                                {link.label}
                              </a>
                              <div className="text-xs text-slate-600/80 break-all">{link.url}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="glass-button text-sm"
                              >
                                Open
                              </a>
                              <button
                                type="button"
                                onClick={() => handleStartEditCourseLink(link)}
                                className="glass-icon-button w-9 h-9 text-slate-600 hover:text-slate-700"
                                aria-label="Edit link"
                              >
                                <Pencil className="icon" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveCourseLink(link.id)}
                                className="glass-icon-button w-9 h-9 text-rose-500 hover:text-rose-600"
                                aria-label="Remove link"
                              >
                                <X className="icon" />
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Dashboard Rings */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardRing
            title="Course Progress"
            value={totals.pct}
            subtitle={`${totals.done}/${totals.total} done`}
            color="#10b981"
            icon={(
              <IconBadge className="bg-emerald-100 text-emerald-600 shadow-[0_16px_32px_-18px_rgba(16,185,129,0.55)]">
                <Target className="icon icon-lg" />
              </IconBadge>
            )}
          />
          <DashboardRing
            title="In Progress"
            value={totals.inprog}
            subtitle="tasks"
            color="#6366f1"
            mode="count"
            icon={(
              <IconBadge className="bg-indigo-100 text-indigo-600 shadow-[0_16px_32px_-18px_rgba(99,102,241,0.55)]">
                <Loader2 className="icon icon-lg" />
              </IconBadge>
            )}
          />
          <DashboardRing
            title="To Do"
            value={totals.todo}
            subtitle="tasks"
            color="#0ea5e9"
            mode="count"
            icon={(
              <IconBadge className="bg-sky-100 text-sky-600 shadow-[0_16px_32px_-18px_rgba(14,165,233,0.55)]">
                <ListChecks className="icon icon-lg" />
              </IconBadge>
            )}
          />
          <DashboardRing
            title="Overdue"
            value={totals.overdue}
            subtitle="needs attention"
            color="#ef4444"
            mode="count"
            icon={(
              <IconBadge className="bg-red-100 text-red-600 shadow-[0_16px_32px_-18px_rgba(239,68,68,0.55)]">
                <AlarmClock className="icon icon-lg" />
              </IconBadge>
            )}
          />
        </section>

        {/* Team Members */}
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
          collapsed={teamCollapsed}
          onToggle={() => setTeamCollapsed((v) => !v)}
        />
        {/* Milestones */}
          <section className="-mx-4 sm:mx-0 glass-surface p-4 sm:p-6 text-sm sm:text-[14px]">
            <div
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2 px-1 cursor-pointer"
              onClick={() => setMilestonesCollapsed(v => !v)}
            >
              <h2 className="font-semibold flex items-center gap-2">
                Milestones
              </h2>
              <div
                className="flex flex-wrap items-center gap-2 w-full sm:w-auto"
                onClick={e => e.stopPropagation()}
              >
                {!milestonesCollapsed && (
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <div className="relative" ref={milestoneFilterRef}>
                      <button
                        type="button"
                        onClick={() => setMilestoneFilterOpen((v) => !v)}
                        aria-haspopup="menu"
                        aria-expanded={milestoneFilterOpen}
                        className="glass-button"
                      >
                        <Filter className="icon text-slate-500" />
                        <span className="max-w-[10rem] truncate">{activeFilterLabel}</span>
                      </button>
                      {milestoneFilterOpen && (
                        <div className="absolute left-4 right-4 sm:left-auto sm:right-0 mt-2 max-h-[70vh] sm:max-h-none overflow-y-auto glass-surface p-2 z-20 flex flex-col gap-1 w-auto sm:w-60">
                          <button
                            type="button"
                            onClick={() => { setMilestoneFilter('all'); setMilestoneFilterOpen(false); }}
                            className={`w-full px-3 py-2 text-left text-sm rounded-xl transition ${milestoneFilter === 'all' ? 'bg-slate-100/80 font-medium text-slate-900' : 'text-slate-700 hover:bg-slate-100/80'}`}
                          >
                            All milestones
                          </button>
                          {milestones.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => { setMilestoneFilter(m.id); setMilestoneFilterOpen(false); }}
                              className={`w-full px-3 py-2 text-left text-sm rounded-xl transition ${milestoneFilter === m.id ? 'bg-slate-100/80 font-medium text-slate-900' : 'text-slate-700 hover:bg-slate-100/80'}`}
                            >
                              {m.title}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {milestoneTemplates.length > 0 && (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <select
                          value={selectedMilestoneTemplate}
                          onChange={(e) => setSelectedMilestoneTemplate(e.target.value)}
                          className="text-sm rounded-2xl border border-white/60 bg-white/80 px-3 py-2 shadow-sm w-full sm:w-auto backdrop-blur"
                        >
                          <option value="">Select template</option>
                          {milestoneTemplates.map((mt) => (
                            <option key={mt.id} value={mt.id}>{mt.title}</option>
                          ))}
                        </select>
                        {selectedMilestoneTemplate && (
                          <>
                            <button
                              onClick={() => { addMilestoneFromTemplate(selectedMilestoneTemplate); setSelectedMilestoneTemplate(''); }}
                              className="glass-button"
                            >
                              Add from Template
                            </button>
                            <button
                              onClick={() => removeMilestoneTemplate(selectedMilestoneTemplate)}
                              className="glass-icon-button w-10 h-10"
                              title="Delete template"
                              aria-label="Delete template"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => addMilestone()}
                      className="glass-button w-full sm:w-auto"
                    >
                      Add Milestone
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setMilestonesCollapsed(v => !v)}
                  title={milestonesCollapsed ? 'Expand Milestones' : 'Collapse Milestones'}
                  aria-label={milestonesCollapsed ? 'Expand milestones' : 'Collapse milestones'}
                  aria-expanded={!milestonesCollapsed}
                  className="glass-icon-button w-9 h-9 sm:w-11 sm:h-11"
                >
                  {milestonesCollapsed ? (
                    <ChevronDown className="icon" />
                  ) : (
                    <ChevronUp className="icon" />
                  )}
                </button>
            </div>
          </div>
          <p className="text-sm text-slate-500/90 mt-1">
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
                      onSaveAsTemplate={saveMilestoneTemplate}
                      onAddTask={addTask}
                      onAddLink={(id, url) => patchTaskLinks(id, 'add', url)}
                      onRemoveLink={(id, idx) => patchTaskLinks(id, 'remove', idx)}
                      reporter={null}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
              {dragMilestoneOverId === null && dragMilestoneId.current && (
                <div className="h-2 rounded border-2 border-dashed border-indigo-400"></div>
              )}
              {milestoneFilter === "all" && unassignedTasks.length > 0 && (
                <div className="mt-6">
                  <div className="glass-card border border-dashed border-indigo-200/70 bg-indigo-50/40 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-800">Unassigned tasks</h3>
                        <p className="text-sm text-slate-600">
                          Assign these tasks to a milestone to track progress alongside the rest of your plan.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleDeleteUnassignedTasksClick}
                        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
                      >
                        <Trash2 className="icon" />
                        Delete all
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {unassignedTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          tasks={tasksRaw}
                          team={team}
                          milestones={milestones}
                          onUpdate={updateTask}
                          onDelete={deleteTask}
                          onDuplicate={duplicateTask}
                          onAddLink={(id, url) => patchTaskLinks(id, 'add', url)}
                          onRemoveLink={(id, idx) => patchTaskLinks(id, 'remove', idx)}
                          reporter={null}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </section>

        {/* Tasks */}
        <section className="-mx-4 sm:mx-0 glass-surface p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
            <h2 className="font-semibold flex items-center gap-2">☑ Course Tasks</h2>
            <div className="flex items-center gap-2">
              <Toggle
                value={view}
                onChange={setView}
                options={[
                  { id: "list", label: "☰ List" },
                  { id: "board", label: "⎘ Board" },
                  { id: "calendar", label: "📅︎ Calendar" },
                ]}
              />
              <button
                onClick={() => addTask(milestoneFilter !== "all" ? milestoneFilter : undefined)}
                className="glass-button-primary"
              >
                Add Task
              </button>
              <button
                onClick={() => setTasksCollapsed((v) => !v)}
                title={tasksCollapsed ? "Expand Course Tasks" : "Collapse Course Tasks"}
                aria-label={tasksCollapsed ? "Expand course tasks" : "Collapse course tasks"}
                aria-expanded={!tasksCollapsed}
                className="glass-icon-button w-9 h-9 sm:w-11 sm:h-11"
              >
                {tasksCollapsed ? (
                  <ChevronDown className="icon" />
                ) : (
                  <ChevronUp className="icon" />
                )}
              </button>
            </div>
          </div>
          <motion.div
            initial={false}
            animate={tasksCollapsed ? "collapsed" : "open"}
            variants={{
              open: { height: "auto", opacity: 1 },
              collapsed: { height: 0, opacity: 0 },
            }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
            aria-hidden={tasksCollapsed}
          >
            <div>
              {view === "list" ? (
                <TaskChecklist
                  tasks={filteredTasks}
                  team={team}
                  milestones={milestones}
                  onUpdate={(id, patch) => updateTask(id, patch)}
                  onEdit={(id) => setEditing({ courseId: state.course.id, taskId: id })}
                />
              ) : view === "board" ? (
                <BoardView
                  tasks={filteredTasks}
                  team={team}
                  milestones={milestones}
                  onUpdate={updateTask}
                  onDelete={deleteTask}
                  onDragStart={onDragStart}
                  onDragOverCol={onDragOverCol}
                  onDropToCol={onDropToCol}
                  onAddLink={(id, url) => patchTaskLinks(id, 'add', url)}
                  onRemoveLink={(id, idx) => patchTaskLinks(id, 'remove', idx)}
                  onDuplicate={duplicateTask}
                  reporter={null}
                />
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
            </div>
          </motion.div>
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
          reporter={null}
        />
      )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 pb-10 text-sm text-slate-500/80">Tip: ⌘/Ctrl + Enter to commit multiline edits. Data auto-saves to your browser.</footer>
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
    <div className="glass-card flex items-center gap-4 p-4">
      <Ring
        className="w-16 h-16 xs:w-20 xs:h-20 sm:w-24 sm:h-24"
        stroke={10}
        progress={pct ?? 100}
        color={color}
      >
        <div className="text-center">
          <div className="text-[14px] font-semibold leading-none">{display}</div>
          <div className="text-sm text-slate-600/90">
            {mode === "percent" ? "Progress" : "Count"}
          </div>
        </div>
      </Ring>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-600/90 flex items-center gap-2">
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <span>{title}</span>
        </div>
        <div className="text-sm font-medium truncate">{subtitle}</div>
      </div>
    </div>
  );
}
function Toggle({ value, onChange, options }) {
  return (
    <div className="inline-flex gap-1 rounded-3xl border border-white/60 bg-white/70 p-1 shadow-[0_12px_28px_-18px_rgba(15,23,42,0.45)] backdrop-blur">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 text-sm rounded-2xl transition ${
            value === o.id
              ? 'bg-slate-900 text-white shadow-[0_18px_36px_-18px_rgba(15,23,42,0.6)]'
              : 'text-slate-600 hover:bg-white/80'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function BoardView({ tasks, team, milestones, onUpdate, onDelete, onDragStart, onDragOverCol, onDropToCol, onAddLink, onRemoveLink, onDuplicate, reporter = null }) {
  const cols = [
    { id: "todo", title: "To Do" },
    { id: "inprogress", title: "In Progress" },
    { id: "blocked", title: "Blocked" },
    { id: "done", title: "Done" },
    { id: "skip", title: "Skipped" },
  ];
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
  const { fireOnDone } = useCompletionConfetti();
  const [statusOpenId, setStatusOpenId] = React.useState(null);
  const [blockDialog, setBlockDialog] = React.useState(null);
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
  const statusPillClass = (status) => {
    if (status === "done") return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (status === "skip") return "bg-pink-100 text-pink-800 border-pink-200";
    if (status === "blocked") return "bg-orange-100 text-orange-800 border-orange-200";
    if (status === "inprogress") return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-sky-100 text-sky-800 border-sky-200";
  };
  const columnBackground = {
    todo: 'bg-sky-50',
    inprogress: 'bg-amber-50',
    blocked: 'bg-orange-50',
    done: 'bg-emerald-50',
    skip: 'bg-pink-50',
  };
  const cardBackground = {
    todo: 'bg-sky-50',
    inprogress: 'bg-amber-50',
    blocked: 'bg-orange-50',
    done: 'bg-emerald-50',
    skip: 'bg-pink-50',
  };
  const statusLabel = { todo: 'To Do', inprogress: 'In Progress', blocked: 'Blocked', done: 'Done', skip: 'Skipped' };
  const renderStatusControl = (task) => {
    if (!isMobile) {
      return (
        <select
          aria-label="Status"
          value={task.status}
          onChange={(e) => {
            const nextStatus = e.target.value;
            if (nextStatus === "blocked") {
              setBlockDialog({ taskId: task.id, prevStatus: task.status });
              return;
            }
            fireOnDone(task.status, nextStatus);
            onUpdate(task.id, { status: nextStatus });
          }}
          className={`px-2 py-1 rounded-full border font-semibold text-sm ${statusPillClass(task.status)}`}
        >
          <option value="todo">To Do</option>
          <option value="inprogress">In Progress</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
          <option value="skip">Skipped</option>
        </select>
      );
    }
    const open = statusOpenId === task.id;
    return open ? (
      <select
        aria-label="Status"
        value={task.status}
        onChange={(e) => {
          const nextStatus = e.target.value;
          if (nextStatus === "blocked") {
            setBlockDialog({ taskId: task.id, prevStatus: task.status });
            setStatusOpenId(null);
            return;
          }
          fireOnDone(task.status, nextStatus);
          onUpdate(task.id, { status: nextStatus });
          setStatusOpenId(null);
        }}
        onBlur={() => setStatusOpenId(null)}
        className={`px-2 py-1 rounded-full border font-semibold text-sm ${statusPillClass(task.status)}`}
        autoFocus
      >
        <option value="todo">To Do</option>
        <option value="inprogress">In Progress</option>
        <option value="blocked">Blocked</option>
        <option value="done">Done</option>
        <option value="skip">Skipped</option>
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {cols.map((c) => (
          <div key={c.id} className={`rounded-xl border border-black/10 p-3 ${columnBackground[c.id] || 'bg-white/60'}`} onDragOver={onDragOverCol} onDrop={onDropToCol(c.id)}>
            <div className="flex items-center justify-between mb-2"><div className="text-sm font-medium text-black/70">{c.title}</div></div>
            <div className="space-y-2 min-h-[140px]">
              {byCol(c.id).map((t) => { const a = team.find((m)=>m.id===t.assigneeId); const collapsed = isCollapsed(t.id); return (
                  <motion.div
                    key={t.id}
                    data-testid="task-card"
                    className={`rounded-lg border border-black/10 p-2 sm:p-3 shadow-sm text-sm sm:text-[14px] ${cardBackground[c.id] || 'bg-white'}`}
                    draggable={!isMobile}
                    onDragStart={!isMobile ? onDragStart(t.id) : undefined}
                    style={isMobile ? { touchAction: 'pan-y' } : undefined}
                    whileTap={{ scale: 0.98 }}
                  >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1"><div className="text-[15px] sm:text-[14px] font-semibold leading-tight truncate"><InlineText value={t.title} onChange={(v)=>onUpdate(t.id,{ title:v })} /></div></div>
                    <div className="flex items-center gap-1 flex-shrink-0"><button onClick={()=>toggleCollapse(t.id)} className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-black/10 bg-slate-100 text-slate-600 hover:bg-slate-200" title={collapsed?'Expand':'Collapse'} aria-label={collapsed?'Expand':'Collapse'}>{collapsed ? <Plus className="icon" /> : <Minus className="icon" />}</button><button onClick={()=>onDuplicate(t.id)} className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-black/10 bg-slate-100 text-slate-600 hover:bg-slate-200" title="Duplicate" aria-label="Duplicate"><Copy className="icon" /></button><button onClick={()=>onDelete(t.id)} className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-black/10 bg-slate-100 text-slate-600 hover:bg-slate-200" title="Delete" aria-label="Delete"><Trash2 className="icon" /></button></div>
                  </div>
                  {collapsed ? (
                    <>
                      <div className="mt-1">{renderStatusControl(t)}</div>
                      <div className="text-sm text-slate-600/90 mt-1 truncate"><InlineText value={t.details} onChange={(v)=>onUpdate(t.id,{ details:v })} placeholder="Details…" /></div>
                      {t.note && <div className="text-sm text-slate-600 mt-1 flex items-center gap-1 truncate"><StickyNote className="icon flex-shrink-0 text-amber-500" />{t.note}</div>}
                      <div className="mt-2 flex items-center justify-between text-sm"><div className="flex items-center gap-2 min-w-0">{a ? <Avatar name={a.name} roleType={a.roleType} avatar={a.avatar} /> : <span className="text-black/40 text-sm">—</span>}<span className="truncate">{a ? `${a.name} (${a.roleType})` : 'Unassigned'}</span></div><div className="flex items-center gap-2"><DuePill date={t.dueDate} status={t.status} />{t.status === "done" && <span className="text-slate-500">Completed: {t.completedDate || "—"}</span>}</div></div>
                    </>
                  ) : (
                    <>
                      <div className="mt-1">{renderStatusControl(t)}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        <select
                          value={t.milestoneId ?? ""}
                          onChange={(e) => onUpdate(t.id, { milestoneId: e.target.value || null })}
                          className="border rounded px-1.5 py-1"
                        >
                          <option value="">Unassigned</option>
                          {milestones.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.title}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1">{a ? <Avatar name={a.name} roleType={a.roleType} avatar={a.avatar} /> : <span className="text-black/40 text-sm">—</span>}<select value={t.assigneeId || ""} onChange={(e)=>onUpdate(t.id,{ assigneeId:e.target.value || null })} className="border rounded px-1.5 py-1"><option value="">Unassigned</option>{taskAssignableMembers.map((m)=>(<option key={m.id} value={m.id}>{m.name} ({m.roleType})</option>))}</select></div>
                        <div className="flex items-center gap-2"><span>Start</span><input type="date" value={t.startDate || ""} onChange={(e)=>{ const patch = { startDate: e.target.value }; if (t.status === 'todo') patch.status = 'inprogress'; onUpdate(t.id, patch); }} className="border rounded px-1.5 py-1" /></div>
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
      <BlockDialog
        open={!!blockDialog}
        task={blockDialog ? tasks.find((t) => t.id === blockDialog.taskId) : null}
        team={team}
        reporter={reporter}
        onSubmit={(entry) => {
          if (!blockDialog) return;
          const target = tasks.find((t) => t.id === blockDialog.taskId);
          if (!target) {
            setBlockDialog(null);
            return;
          }
          const blocks = Array.isArray(target.blocks) ? target.blocks : [];
          fireOnDone(blockDialog.prevStatus, "blocked");
          onUpdate(blockDialog.taskId, { status: "blocked", blocks: [...blocks, entry] });
          setBlockDialog(null);
        }}
        onCancel={() => {
          setBlockDialog(null);
        }}
      />
    </div>
  );
}

// =====================================================
// User Dashboard (NEW)
// =====================================================
export const UPCOMING_DAYS = 15;

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const courseIdOf = (course) => course?.course?.id ?? course?.id ?? null;

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

  const [saveState, setSaveState] = useState('saved');
  const [history, setHistory] = useState([]);
  const [courseQuery, setCourseQuery] = useState('');
  const [activeTab, setActiveTab] = useState(() => {
    const stored = localStorage.getItem('userTab');
    const validTabs = new Set(['deadlines','courses','milestones','board','calendar']);
    return stored && validTabs.has(stored) ? stored : 'deadlines';
  });
  const [milestoneSort, setMilestoneSort] = useState('status');
  const { fireOnDone } = useCompletionConfetti();

  useEffect(() => {
    resetScrollPosition();
  }, [activeTab]);

  const [calMonth, setCalMonth] = useState(() => new Date());
  const [editing, setEditing] = useState(null);
  const [linkPrompt, setLinkPrompt] = useState(null);
  const [blockDialogRequest, setBlockDialogRequest] = useState(null);
  const [resolveBlockRequest, setResolveBlockRequest] = useState(null);
  const [blocksCollapsed, setBlocksCollapsed] = useState(true);
  const [blocksTab, setBlocksTab] = useState("active");

  const updateCourses = useCallback((updater, options = {}) => {
    const { capture = true } = options;
    let applied = null;
    setCourses((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next === prev) return prev;
      if (capture) {
        const snapshot = JSON.parse(JSON.stringify(prev));
        setHistory((h) => [snapshot, ...h].slice(0, 10));
      }
      applied = next;
      return next;
    });
    return applied;
  }, []);

  const dashboardTabs = [
    { id: 'deadlines', label: 'Overview', Icon: Home },
    { id: 'courses', label: 'Courses', Icon: GraduationCap },
    { id: 'milestones', label: 'Milestones', Icon: Flag },
    { id: 'board', label: 'Board View', Icon: Kanban },
    { id: 'calendar', label: 'Calendar', Icon: CalendarDays },
  ];

  const recomputeDue = (t, patch = {}, schedule) => {
    const start = patch.startDate ?? t.startDate;
    const work = patch.workDays ?? t.workDays;
    const due = start ? addBusinessDays(start, work, schedule.workweek || [1,2,3,4,5], schedule.holidays || []) : "";
    return { ...patch, dueDate: due };
  };

  const propagateDependentForecasts = (tasks, schedule) => {
    const map = new Map(tasks.map((x) => [x.id, x]));
    return tasks.map((t) => {
      if (!t.depTaskId || t.status === 'done' || t.status === 'skip') return t;
      const src = map.get(t.depTaskId);
      if (!src || src.status === 'skip') return t;
      const startForecast = src.dueDate || '';
      if (t.status !== 'inprogress' && startForecast) {
        const due = addBusinessDays(startForecast, t.workDays, schedule.workweek || [1,2,3,4,5], schedule.holidays || []);
        return { ...t, startDate: startForecast, dueDate: due };
      }
      return t;
    });
  };

  const updateTask = (courseId, taskId, patch) => {
    updateCourses((cs) => {
      return cs.map((course) => {
        const currentId = courseIdOf(course);
        if (currentId !== courseId) return course;
        const sched = course.schedule || loadGlobalSchedule();
        let changedTo = null;
        const tasks1 = ensureArray(course.tasks).map((task) => {
          if (task.id !== taskId) return task;
          let adjusted = { ...patch };
          if (patch.status && patch.status !== task.status) {
            changedTo = patch.status;
            if (patch.status === 'inprogress') {
              if (!task.startDate && !patch.__skipAutoStart) adjusted.startDate = todayStr();
            }
            if (patch.status === 'todo') {
              adjusted.startDate = '';
              adjusted.dueDate = '';
              adjusted.completedDate = '';
            }
            if (patch.status === 'done') {
              adjusted.completedDate = todayStr();
            }
          }
          if ('startDate' in adjusted || 'workDays' in adjusted) {
            adjusted = recomputeDue({ ...task, ...adjusted }, adjusted, sched);
          }
          return { ...task, ...adjusted };
        });
        let tasks2 = tasks1;
        if (changedTo === 'inprogress') {
          tasks2 = tasks2.map((item) =>
            item.depTaskId === taskId && item.status !== 'done' && item.status !== 'skip'
              ? { ...item, status: 'inprogress' }
              : item
          );
        }
        if (changedTo === 'done') {
          const doneDate = todayStr();
          tasks2 = tasks2.map((item) =>
            item.id === taskId ? { ...item, completedDate: item.completedDate || doneDate } : item
          );
          tasks2 = tasks2.map((item) => {
            if (item.depTaskId === taskId && item.status !== 'done' && item.status !== 'skip') {
              const start = doneDate;
              const due = addBusinessDays(start, item.workDays, sched.workweek || [1, 2, 3, 4, 5], sched.holidays || []);
              return { ...item, status: 'inprogress', startDate: start, dueDate: due };
            }
            return item;
          });
        }
        if (changedTo === 'skip') {
          const skipDate = todayStr();
          tasks2 = tasks2.map((item) => {
            if (item.depTaskId === taskId && item.status !== 'done' && item.status !== 'skip') {
              const start = skipDate;
              const due = addBusinessDays(start, item.workDays, sched.workweek || [1, 2, 3, 4, 5], sched.holidays || []);
              return { ...item, status: 'inprogress', startDate: start, dueDate: due };
            }
            return item;
          });
        }
        const tasks3 = propagateDependentForecasts(tasks2, sched);
        return { ...course, tasks: tasks3 };
      });
    });
    setSaveState('unsaved');
  };

  const updateTaskStatus = (courseId, taskId, status) => {
    const courseEntry = courses.find((entry) => courseIdOf(entry) === courseId);
    const task = ensureArray(courseEntry?.tasks).find((item) => item.id === taskId);
    if (status === 'blocked') {
      if (!courseEntry || !task) return;
      setBlockDialogRequest({
        courseId,
        taskId,
        previousStatus: task.status,
        reporter: user || null,
      });
      return;
    }
    if (status === 'done' && (!task?.links || task.links.length === 0)) {
      setLinkPrompt({ courseId, taskId });
      return;
    }
    if (task) {
      fireOnDone(task.status, status);
    }
    updateTask(courseId, taskId, { status });
  };

  const handleBlockDialogSubmit = (entry) => {
    if (!blockDialogRequest) return;
    const { courseId, taskId, previousStatus } = blockDialogRequest;
    const course = courses.find((entry) => courseIdOf(entry) === courseId);
    const task = ensureArray(course?.tasks).find((item) => item.id === taskId);
    if (!course || !task) {
      setBlockDialogRequest(null);
      return;
    }
    const blocks = Array.isArray(task.blocks) ? task.blocks : [];
    fireOnDone(previousStatus, 'blocked');
    updateTask(courseId, taskId, { status: 'blocked', blocks: [...blocks, entry] });
    setBlockDialogRequest(null);
  };

  const handleBlockDialogCancel = () => {
    if (blockDialogRequest) {
      const { courseId, taskId, previousStatus } = blockDialogRequest;
      const course = courses.find((entry) => courseIdOf(entry) === courseId);
      const task = ensureArray(course?.tasks).find((item) => item.id === taskId);
      if (task && task.status !== previousStatus) {
        updateTask(courseId, taskId, { status: previousStatus, __skipAutoStart: true });
      }
    }
    setBlockDialogRequest(null);
  };

  const patchTaskLinks = (courseId, id, op, payload) => {
    updateCourses((cs) =>
      cs.map((course) => {
        if (courseIdOf(course) !== courseId) return course;
        return {
          ...course,
          tasks: applyLinkPatch(ensureArray(course.tasks), id, op, payload),
        };
      })
    );
    setSaveState('unsaved');
  };

  const duplicateTask = (courseId, id) => {
    updateCourses((cs) =>
      cs.map((course) => {
        if (courseIdOf(course) !== courseId) return course;
        const tasks = ensureArray(course.tasks);
        const orig = tasks.find((task) => task.id === id);
        if (!orig) return course;
        const cloneStatus = orig.status === 'done' ? 'todo' : orig.status === 'blocked' ? 'blocked' : 'todo';
        const clone = {
          ...orig,
          id: uid(),
          title: `${orig.title} (copy)`,
          status: cloneStatus,
          startDate: '',
          dueDate: '',
          completedDate: '',
          depTaskId: null,
          blocks: Array.isArray(orig.blocks) ? orig.blocks.map((b) => ({ ...b })) : [],
        };
        return { ...course, tasks: [...tasks, clone] };
      })
    );
    setSaveState('unsaved');
  };

  const deleteTask = (courseId, id) => {
    updateCourses((cs) =>
      cs.map((course) =>
        courseIdOf(course) === courseId
          ? { ...course, tasks: ensureArray(course.tasks).filter((task) => task.id !== id) }
          : course
      )
    );
    setSaveState('unsaved');
  };
  const changeTaskCourse = (fromCourseId, taskId, toCourseId) => {
    updateCourses((cs) => {
      const from = cs.find((course) => courseIdOf(course) === fromCourseId);
      const to = cs.find((course) => courseIdOf(course) === toCourseId);
      if (!from || !to) return cs;
      const fromTasks = ensureArray(from.tasks);
      const task = fromTasks.find((item) => item.id === taskId);
      if (!task) return cs;
      return cs.map((course) => {
        const currentId = courseIdOf(course);
        if (currentId === fromCourseId) {
          return {
            ...course,
            tasks: ensureArray(course.tasks).filter((item) => item.id !== taskId),
          };
        }
        if (currentId === toCourseId) {
          return {
            ...course,
            tasks: [...ensureArray(course.tasks), task],
          };
        }
        return course;
      });
    });
    setEditing({ courseId: toCourseId, taskId });
    setSaveState('unsaved');
  };
  const handleNewTask = () => {
    if (myCoursesAll.length === 0) return;
    const firstCourse = myCoursesAll[0];
    const cid = courseIdOf(firstCourse);
    if (!cid) return;
    const targetCourse = courses.find((course) => courseIdOf(course) === cid);
    if (!targetCourse) return;
    const existingTasks = ensureArray(targetCourse.tasks);
    const newTask = {
      id: uid(),
      order: existingTasks.length,
      title: '',
      details: '',
      note: '',
      links: [],
      blocks: [],
      assigneeId: userId || null,
      milestoneId: null,
      status: 'todo',
      startDate: '',
      workDays: 0,
      dueDate: '',
      depTaskId: null,
      completedDate: '',
    };
    updateCourses((cs) =>
      cs.map((course) =>
        courseIdOf(course) === cid
          ? { ...course, tasks: [...ensureArray(course.tasks), newTask] }
          : course
      )
    );
    setEditing({ courseId: cid, taskId: newTask.id });
    setSaveState('unsaved');
  };
  const handleSave = useCallback(async () => {
    setSaveState('saving');
    saveCourses(courses);
    await saveCoursesRemote(courses);
    localStorage.setItem('userTab', activeTab);
    setSaveState('saved');
  }, [courses, activeTab]);
  useEffect(() => {
    if (saveState !== 'unsaved') return;
    const t = setTimeout(handleSave, 1500);
    return () => clearTimeout(t);
  }, [saveState, handleSave]);
  const cycleStatus = (s) =>
    s === 'todo' ? 'inprogress' : s === 'inprogress' ? 'blocked' : s === 'blocked' ? 'done' : 'todo';
  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      const [latest, ...rest] = h;
      setCourses(latest);
      setEditing(null);
      setLinkPrompt(null);
      setSaveState('unsaved');
      return rest;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
        const target = event.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo]);
  const statusPriority = { inprogress: 0, blocked: 1, todo: 2, done: 3, skip: 4 };
  const milestoneStatusPriority = { blocked: 0, inprogress: 1, todo: 2, done: 3, skip: 4 };
  const statusLabel = { todo: 'To Do', inprogress: 'In Progress', blocked: 'Blocked', done: 'Done', skip: 'Skipped' };
  const statusListClasses = {
    todo: 'bg-sky-50/80 border-sky-200/80 text-sky-700',
    inprogress: 'bg-amber-50/80 border-amber-200/80 text-amber-700',
    blocked: 'bg-orange-50/80 border-orange-200/80 text-orange-700',
    done: 'bg-emerald-50/80 border-emerald-200/80 text-emerald-700',
    skip: 'bg-pink-50/80 border-pink-200/80 text-pink-700',
  };
  const statusBadgeClasses = {
    todo: 'bg-sky-100/80 text-sky-700 border-sky-200/80',
    inprogress: 'bg-amber-100/80 text-amber-700 border-amber-200/80',
    blocked: 'bg-orange-100/80 text-orange-700 border-orange-200/80',
    done: 'bg-emerald-100/80 text-emerald-700 border-emerald-200/80',
    skip: 'bg-pink-100/80 text-pink-700 border-pink-200/80',
  };
  const parseDateToMs = (value) => {
    if (!value) return null;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
  };

  const members = useMemo(() => {
    const map = new Map();
    ensureArray(courses).forEach((course) => {
      ensureArray(course?.team).forEach((member) => {
        if (!member || !member.id || map.has(member.id)) return;
        map.set(member.id, member);
      });
    });
    return Array.from(map.values());
  }, [courses]);

  const openResolveBlock = useCallback((entry) => {
    setResolveBlockRequest(entry);
  }, []);

  const resolveBlockContext = useMemo(() => {
    if (!resolveBlockRequest) return null;
    const course = courses.find(
      (item) => (item.course?.id ?? item.id) === resolveBlockRequest.courseId
    );
    if (!course) return null;
    const task = Array.isArray(course.tasks)
      ? course.tasks.find((t) => t.id === resolveBlockRequest.taskId)
      : null;
    if (!task) return null;
    const block = Array.isArray(task.blocks)
      ? task.blocks.find((b) => b.id === resolveBlockRequest.blockId)
      : null;
    if (!block) return null;
    return { course, task, block };
  }, [resolveBlockRequest, courses]);

  const handleResolveBlock = useCallback(
    ({ resolution, resolvedBy, resolvedAt }) => {
      if (!resolveBlockRequest) return;
      let changed = false;
      updateCourses((prev) => {
        const next = applyBlockResolution(prev, {
          courseId: resolveBlockRequest.courseId,
          taskId: resolveBlockRequest.taskId,
          blockId: resolveBlockRequest.blockId,
          resolution,
          resolvedBy,
          resolvedAt,
        });
        if (next !== prev) {
          changed = true;
          return next;
        }
        return prev;
      });
      if (changed) {
        setSaveState("unsaved");
      }
      setResolveBlockRequest(null);
    },
    [resolveBlockRequest, updateCourses, setSaveState]
  );

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

  const blockAggregatesDashboard = useMemo(
    () => aggregateBlocksByCourse(courses, members),
    [courses, members]
  );
  const activeBlocks = blockAggregatesDashboard.active;
  const resolvedBlocks = blockAggregatesDashboard.resolved;
  const myActiveBlocks = useMemo(
    () =>
      activeBlocks.filter((block) => block.reportedBy && block.reportedBy === userId),
    [activeBlocks, userId]
  );
  const assistBlocks = useMemo(
    () =>
      activeBlocks.filter((block) => {
        if (!Array.isArray(block.taggedMemberIds)) return false;
        if (block.reportedBy && block.reportedBy === userId) return false;
        return block.taggedMemberIds.includes(userId);
      }),
    [activeBlocks, userId]
  );
  const resolvedHistory = useMemo(
    () =>
      resolvedBlocks.filter((block) => {
        if (block.reportedBy === userId) return true;
        if (!Array.isArray(block.taggedMemberIds)) return false;
        return block.taggedMemberIds.includes(userId);
      }),
    [resolvedBlocks, userId]
  );

  const myCoursesAll = useMemo(
    () =>
      ensureArray(courses).filter((course) => {
        const courseId = courseIdOf(course);
        if (!courseId) return false;
        return ensureArray(course?.team).some((member) => member?.id === userId);
      }),
    [courses, userId]
  );
  const myCourses = useMemo(
    () =>
      myCoursesAll.filter((course) =>
        (course.course?.name || "")
          .toLowerCase()
          .includes(courseQuery.toLowerCase())
      ),
    [myCoursesAll, courseQuery]
  );
  const myTasks = useMemo(() => {
    const arr = [];
    ensureArray(courses).forEach((course) => {
      const courseId = courseIdOf(course);
      if (!courseId) return;
      const courseName = course?.course?.name ?? course?.name ?? "Untitled course";
      const milestones = ensureArray(course?.milestones);
      ensureArray(course?.tasks).forEach((task) => {
        if (!task || task.assigneeId !== userId || task.status === 'skip') return;
        const milestoneName =
          milestones.find((m) => m.id === task.milestoneId)?.title || "";
        arr.push({
          ...task,
          courseId,
          courseName,
          milestoneName,
        });
      });
    });
    return arr.sort((a, b) => {
      const nameCmp = (a.courseName || "").localeCompare(b.courseName || "");
      if (nameCmp !== 0) return nameCmp;
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return da - db;
    });
  }, [courses, userId]);
  const groupedTasks = useMemo(() => {
    const g = { todo: [], inprogress: [], blocked: [], done: [], skip: [] };
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
      const tasksOnDate = myTasks.filter((t) => t.dueDate === ds && t.status !== 'done' && t.status !== 'skip');
      return { date: d, tasks: tasksOnDate };
    });
  }, [myTasks]);
  const today = fmt(new Date());
  const hasUpcomingTasks = upcoming.some(({ tasks }) => tasks.length > 0);
  const renderUpcomingTask = (t) => {
    const isOverdue = t.dueDate < today;
    const isDueToday = t.dueDate === today;
    const containerTone = isOverdue
      ? 'border-red-200/80 bg-red-50/70 text-red-700/90'
      : isDueToday
      ? 'border-amber-200/80 bg-amber-50/70 text-amber-700/90'
      : 'border-white/60 bg-white/80 text-slate-700';
    const pillTone = isOverdue
      ? 'bg-red-100/80 text-red-700 border-red-200/80'
      : isDueToday
      ? 'bg-amber-100/80 text-amber-700 border-amber-200/80'
      : 'bg-white/80 text-slate-600 border-white/60';
    const pillLabel = isOverdue ? 'Overdue' : isDueToday ? 'Today' : 'Scheduled';
    return (
      <li key={t.id}>
        <div
          className={`flex items-center gap-3 rounded-3xl border px-4 py-3 shadow-[0_18px_32px_-20px_rgba(15,23,42,0.45)] backdrop-blur transition-all ${containerTone}`}
        >
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300 text-emerald-500 focus:ring-2 focus:ring-emerald-300"
            aria-label={`${t.title} for ${t.milestoneName} in ${t.courseName}`}
            checked={t.status === 'done'}
            onChange={(e) =>
              updateTaskStatus(
                t.courseId,
                t.id,
                e.target.checked ? 'done' : 'todo'
              )
            }
          />
          <button
            onClick={() => setEditing({ courseId: t.courseId, taskId: t.id })}
            className="flex-1 min-w-0 text-left"
            title={`${t.title} – ${t.milestoneName} – ${t.courseName}`}
            aria-label={`${t.title} for ${t.milestoneName} in ${t.courseName}`}
          >
            <div className="truncate text-[15px] font-medium leading-tight">
              {t.title || 'Untitled task'}
            </div>
            <div className="mt-0.5 truncate text-xs text-slate-600/80">
              for {t.milestoneName} • {t.courseName}
            </div>
          </button>
          <span className={`self-start rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide shadow-sm backdrop-blur ${pillTone}`}>
            {pillLabel}
          </span>
        </div>
      </li>
    );
  };

  return (
    <div className={APP_SHELL_CLASS}>
      <header className="sticky top-0 z-20 border-b border-white/50 bg-white/70 supports-[backdrop-filter]:bg-white/30 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_16px_48px_rgba(15,23,42,0.12)]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="glass-button-primary inline-flex items-center gap-2"
              >
                <CoursesIcon className="shrink-0" />
                <span>Back to Courses</span>
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-sm sm:text-[15px] font-semibold text-slate-700/90 truncate flex items-center gap-2">
                <Home className="icon shrink-0" aria-hidden="true" />
                <span className="truncate">User Dashboard</span>
              </h1>
              {user && <div className="text-sm text-slate-600/90 truncate">{user.name}</div>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && <Avatar name={user.name} roleType={user.roleType} avatar={user.avatar} className="w-8 h-8 text-[14px]" />}
            <select value={userId} onChange={(e)=>setUserId(e.target.value)} className="text-sm rounded-2xl border border-white/60 bg-white/80 px-3 py-1.5 shadow-sm">
              {members.map((m)=> (<option key={m.id} value={m.id}>{m.name} ({m.roleType})</option>))}
            </select>
            <button
              onClick={undo}
              disabled={!history.length}
              className="glass-button disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Undo
            </button>
            <button
              onClick={handleSave}
              className="glass-button"
            >
              Save
            </button>
            <span className="text-sm text-slate-600/90">
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Unsaved'}
            </span>
          </div>
        </div>
      </header>

        <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {user && (
            <h2 className="text-lg font-semibold mb-4">
              Welcome, {user.name}!
            </h2>
          )}
        <div className="mb-4 flex flex-wrap gap-2">
          {dashboardTabs.map(({ id, label, Icon }) => {
            const ButtonIcon = Icon;
            const cls = activeTab === id ? 'glass-button-primary' : 'glass-button';
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`${cls} min-w-[10rem] justify-center`}
              >
                <ButtonIcon className="icon" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-1 gap-6">
          {activeTab === 'deadlines' && (
            <>
              <SectionCard title="Upcoming Deadlines">
                {!hasUpcomingTasks ? (
                  <div className="text-sm text-slate-600/90">No tasks due in the next 2 weeks.</div>
                ) : (
                  <ul className="space-y-3">
                    {upcoming
                      .filter(({ tasks }) => tasks.length > 0)
                      .map(({ date, tasks }) => (
                        <li
                          key={fmt(date)}
                          className="glass-card p-4"
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-800">
                              {date.toLocaleDateString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                            <div className="text-xs font-medium text-slate-500/80">
                              {tasks.length} task{tasks.length === 1 ? '' : 's'}
                            </div>
                          </div>
                          <ul className="mt-3 space-y-2">
                            {tasks.map((t) => renderUpcomingTask(t))}
                          </ul>
                        </li>
                      ))}
                  </ul>
                )}
              </SectionCard>
              <SectionCard
                title="Blocks"
                actions={
                  <button
                    onClick={() => setBlocksCollapsed((value) => !value)}
                    className="glass-button"
                  >
                    {blocksCollapsed ? 'Show' : 'Hide'}
                  </button>
                }
              >
                {blocksCollapsed ? (
                  <div className="text-sm text-slate-600/90">Panel collapsed. Select “Show” to review blocks.</div>
                ) : !userId ? (
                  <div className="text-sm text-slate-600/90">Select a user to view block assignments.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`${
                          blocksTab === 'active' ? 'glass-button-primary' : 'glass-button'
                        } min-w-[6rem] justify-center`}
                        onClick={() => setBlocksTab('active')}
                      >
                        Active ({myActiveBlocks.length + assistBlocks.length})
                      </button>
                      <button
                        type="button"
                        className={`${
                          blocksTab === 'resolved' ? 'glass-button-primary' : 'glass-button'
                        } min-w-[6rem] justify-center`}
                        onClick={() => setBlocksTab('resolved')}
                      >
                        Resolved ({resolvedHistory.length})
                      </button>
                    </div>
                    {blocksTab === 'active' ? (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-700/90">My Blocks</h3>
                          {myActiveBlocks.length === 0 ? (
                            <div className="mt-2 rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-slate-600/90">
                              All clear! You haven’t reported any active blocks.
                            </div>
                          ) : (
                            <ul className="mt-2 space-y-3">
                              {myActiveBlocks.map((block) => {
                                const milestoneTitle = block.milestone?.title || 'No milestone';
                                const tagNames = block.taggedMembers?.length
                                  ? block.taggedMembers.map((member) => member.name)
                                  : block.taggedMemberIds;
                                return (
                                  <li
                                    key={block.id}
                                    className="rounded-xl border border-orange-200/70 bg-white/85 p-3 shadow-sm"
                                  >
                                    <div className="text-sm font-semibold text-slate-800">
                                      {block.task.title || 'Untitled task'}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {block.course.name} · {milestoneTitle} · Reported {block.reportedAt || '—'}
                                    </div>
                                    <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                                      {block.description}
                                    </div>
                                    {tagNames && tagNames.length > 0 && (
                                      <div className="mt-2 text-xs text-slate-500">
                                        Tagged: {tagNames.join(', ')}
                                      </div>
                                    )}
                                    <div className="mt-3 flex justify-end">
                                      <button
                                        type="button"
                                        className="glass-button-success"
                                        onClick={() => openResolveBlock(block)}
                                      >
                                        Resolve
                                      </button>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-700/90">Blocks I Can Help Address</h3>
                          {assistBlocks.length === 0 ? (
                            <div className="mt-2 rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-slate-600/90">
                              No blocks are currently tagging you.
                            </div>
                          ) : (
                            <ul className="mt-2 space-y-3">
                              {assistBlocks.map((block) => {
                                const milestoneTitle = block.milestone?.title || 'No milestone';
                                const reporterName = block.reporter?.name || 'Unknown';
                                const tagNames = block.taggedMembers?.length
                                  ? block.taggedMembers.map((member) => member.name)
                                  : block.taggedMemberIds;
                                return (
                                  <li
                                    key={block.id}
                                    className="rounded-xl border border-sky-200/70 bg-white/85 p-3 shadow-sm"
                                  >
                                    <div className="text-sm font-semibold text-slate-800">
                                      {block.task.title || 'Untitled task'}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {block.course.name} · {milestoneTitle}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      Reported by {reporterName}{block.reportedAt ? ` on ${block.reportedAt}` : ''}
                                    </div>
                                    <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                                      {block.description}
                                    </div>
                                    {tagNames && tagNames.length > 0 && (
                                      <div className="mt-2 text-xs text-slate-500">
                                        Tagged members: {tagNames.join(', ')}
                                      </div>
                                    )}
                                    <div className="mt-3 flex justify-end">
                                      <button
                                        type="button"
                                        className="glass-button-success"
                                        onClick={() => openResolveBlock(block)}
                                      >
                                        Resolve
                                      </button>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                    ) : resolvedHistory.length === 0 ? (
                      <div className="rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-slate-600/90">
                        No resolved blocks tracked yet.
                      </div>
                    ) : (
                      <ul className="space-y-3">
                        {resolvedHistory.map((block) => {
                          const milestoneTitle = block.milestone?.title || 'No milestone';
                          const resolverName = block.resolver?.name || 'Unknown';
                          const reporterName = block.reporter?.name || 'Unknown';
                          const tagNames = block.taggedMembers?.length
                            ? block.taggedMembers.map((member) => member.name)
                            : block.taggedMemberIds;
                          return (
                            <li
                              key={block.id}
                              className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 shadow-sm"
                            >
                              <div className="text-sm font-semibold text-emerald-900">
                                {block.task.title || 'Untitled task'}
                              </div>
                              <div className="mt-1 text-xs text-emerald-900/70">
                                {block.course.name} · {milestoneTitle}
                              </div>
                              <div className="mt-1 text-xs text-emerald-900/70">
                                Reported by {reporterName}
                                {block.reportedAt ? ` on ${block.reportedAt}` : ''}
                              </div>
                              <div className="mt-1 text-xs text-emerald-900/70">
                                Resolved by {resolverName}
                                {block.resolvedAt ? ` on ${block.resolvedAt}` : ''}
                              </div>
                              <div className="mt-2 whitespace-pre-wrap text-sm text-emerald-900/90">
                                {block.description}
                              </div>
                              {tagNames && tagNames.length > 0 && (
                                <div className="mt-1 text-xs text-emerald-900/70">
                                  Tagged members: {tagNames.join(', ')}
                                </div>
                              )}
                              {block.resolution && (
                                <div className="mt-2 rounded-lg bg-white/80 p-2 text-sm text-emerald-900">
                                  <span className="font-medium">Resolution:</span> {block.resolution}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </SectionCard>
            </>
          )}

          {activeTab === 'courses' && (
            <SectionCard
              title={(
                <span className="inline-flex items-center gap-2">
                  <CoursesIcon className="shrink-0" />
                  <span>My Courses</span>
                </span>
              )}
            >
              {myCourses.length === 0 ? (
                <div className="text-sm text-slate-600/90">No courses</div>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {myCourses.map((c, index) => {
                    const tasks = ensureArray(c?.tasks);
                    const courseId = c?.course?.id ?? c?.id ?? '';
                    const courseName = c?.course?.name ?? c?.name ?? 'Untitled course';
                    const tTotal = tasks.filter((t) => t?.assigneeId === userId).length;
                    const tDone = tasks.filter(
                      (t) =>
                        t?.assigneeId === userId &&
                        (t?.status === 'done' || t?.status === 'skip')
                    ).length;
                    const pct = tTotal ? Math.round((tDone / tTotal) * 100) : 0;
                    return (
                      <li key={courseId || index} className="glass-card p-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{courseName}</div>
                            <div className="text-sm text-slate-600/90 truncate">{tTotal} task{tTotal!==1?'s':''}</div>
                          </div>
                          <button
                            onClick={() => courseId && onOpenCourse(courseId)}
                            className="glass-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!courseId}
                          >
                            Open
                          </button>
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
            <SectionCard
              title="My Milestones"
              actions={
                myCourses.length > 0 ? (
                  <label className="text-sm text-slate-600 flex items-center gap-2">
                    <span className="hidden sm:inline">Sort by</span>
                    <select
                      value={milestoneSort}
                      onChange={(event) => setMilestoneSort(event.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      aria-label="Sort milestones"
                    >
                      <option value="status">Status</option>
                      <option value="recent">Most Recent</option>
                    </select>
                  </label>
                ) : null
              }
            >
              {myCourses.length === 0 ? (
                <div className="text-sm text-slate-600/90">No milestones</div>
              ) : (
                <div className="space-y-4">
                  {myCourses.map((c, index) => {
                    const courseId = courseIdOf(c) || '';
                    const courseName = c?.course?.name ?? c?.name ?? 'Untitled course';
                    const courseTasks = ensureArray(c?.tasks);
                    const milestones = ensureArray(c?.milestones);
                    const milestoneEntries = milestones.map((m) => {
                      const tasksForMilestone = courseTasks.filter(
                        (t) => t?.milestoneId === m.id && t?.assigneeId === userId
                      );
                      const sortedTasks = [...tasksForMilestone].sort((a, b) => {
                        const statusDiff =
                          (statusPriority[a?.status] ?? 1) - (statusPriority[b?.status] ?? 1);
                        if (statusDiff !== 0) return statusDiff;
                        const da = a?.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                        const db = b?.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                        return da - db;
                      });
                      const counts = sortedTasks.reduce(
                        (acc, task) => {
                          const key = task?.status;
                          if (acc[key] !== undefined) acc[key] += 1;
                          else acc.todo += 1;
                          return acc;
                        },
                        { todo: 0, inprogress: 0, blocked: 0, done: 0, skip: 0 }
                      );
                      const total =
                        counts.todo + counts.inprogress + counts.blocked + counts.done + counts.skip;
                      const completedCount = counts.done + counts.skip;
                      const pct = total ? Math.round((completedCount / total) * 100) : 0;
                      const progressColor = `hsl(${210 + (pct / 100) * (140 - 210)}, 70%, 50%)`;
                      const milestoneStatus =
                        counts.blocked > 0
                          ? 'blocked'
                          : counts.inprogress > 0
                          ? 'inprogress'
                          : counts.todo > 0
                          ? 'todo'
                          : completedCount > 0
                          ? 'done'
                          : 'todo';
                      const statusRank =
                        milestoneStatusPriority[milestoneStatus] ?? milestoneStatusPriority.todo;
                      const dateCandidates = [
                        parseDateToMs(m?.start),
                        parseDateToMs(m?.dueDate),
                        parseDateToMs(m?.completedDate),
                        parseDateToMs(m?.updatedAt),
                      ];
                      sortedTasks.forEach((task) => {
                        dateCandidates.push(parseDateToMs(task?.dueDate));
                        dateCandidates.push(parseDateToMs(task?.completedDate));
                        dateCandidates.push(parseDateToMs(task?.startDate));
                      });
                      const validDates = dateCandidates.filter((value) => typeof value === 'number');
                      const mostRecent = validDates.length ? Math.max(...validDates) : null;
                      return {
                        milestone: m,
                        sortedTasks,
                        counts,
                        pct,
                        progressColor,
                        statusRank,
                        mostRecent,
                      };
                    });
                    const sortedMilestones = [...milestoneEntries].sort((a, b) => {
                      if (milestoneSort === 'status') {
                        if (a.statusRank !== b.statusRank) return a.statusRank - b.statusRank;
                        if (b.pct !== a.pct) return b.pct - a.pct;
                      } else if (milestoneSort === 'recent') {
                        const aDate = a.mostRecent ?? 0;
                        const bDate = b.mostRecent ?? 0;
                        if (aDate !== bDate) return bDate - aDate;
                      }
                      const aTitle = a.milestone?.title || '';
                      const bTitle = b.milestone?.title || '';
                      return aTitle.localeCompare(bTitle, undefined, { sensitivity: 'base' });
                    });
                    return (
                      <details key={courseId || index} className="group glass-card">
                        <summary className="cursor-pointer select-none p-4 flex items-center justify-between gap-2 list-none [&::-webkit-details-marker]:hidden">
                          <div className="flex items-center gap-2">
                            <ChevronDown className="icon transition-transform group-open:rotate-180" />
                            <div className="font-medium">{courseName}</div>
                          </div>
                        </summary>
                        <div className="p-4 space-y-2">
                          {sortedMilestones.map((entry) => {
                            const { milestone: m, sortedTasks, counts, pct, progressColor } = entry;
                            return (
                              <details key={m.id} className="group glass-card">
                                <summary className="cursor-pointer select-none p-4 flex items-center justify-between gap-2 list-none [&::-webkit-details-marker]:hidden">
                                  <div className="flex items-center gap-2">
                                    <ChevronDown className="icon transition-transform group-open:rotate-180" />
                                    <div>
                                      <div className="font-medium">{m.title}</div>
                                      <div className="text-xs text-slate-600/80">
                                        {counts.inprogress} in progress • {counts.blocked} blocked • {counts.todo} to do • {counts.done} done • {counts.skip} skipped
                                      </div>
                                      <div className="h-2 bg-black/10 rounded-full mt-1 overflow-hidden">
                                        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: progressColor }} />
                                      </div>
                                    </div>
                                  </div>
                                </summary>
                                <div className="p-4 space-y-3">
                                  {m.goal && <p className="text-sm text-slate-600/90">{m.goal}</p>}
                                  {sortedTasks.length === 0 ? (
                                    <div className="text-sm text-slate-600/90">No tasks assigned to you.</div>
                                  ) : (
                                    <ul className="space-y-2">
                                      {sortedTasks.map((t) => (
                                        <li
                                          key={t.id}
                                          className={`rounded-xl border px-3 py-2 ${statusListClasses[t?.status] || statusListClasses.todo}`}
                                        >
                                          <button
                                            type="button"
                                            onClick={() =>
                                              courseId &&
                                              setEditing({ courseId, taskId: t.id })
                                            }
                                            className="flex w-full items-center justify-between gap-3 text-left"
                                          >
                                            <div className="min-w-0">
                                              <div className="font-medium truncate">{t?.title || 'Untitled task'}</div>
                                              <div className="text-xs text-slate-600/80 truncate">
                                                {t?.dueDate
                                                  ? `Due ${new Date(t.dueDate).toLocaleDateString(undefined, {
                                                      month: 'short',
                                                      day: 'numeric',
                                                    })}`
                                                  : 'No due date'}
                                              </div>
                                            </div>
                                            <span
                                              className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBadgeClasses[t?.status] || statusBadgeClasses.todo}`}
                                            >
                                              {statusLabel[t?.status] || t?.status || 'Unknown'}
                                            </span>
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                )}
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}
                </div>
              )}
            </SectionCard>
          )}

          {activeTab === 'board' && (
            <SectionCard title="☑ My Tasks – Board View" actions={<button onClick={handleNewTask} className="glass-button">New Task</button>}>
              {myTasks.length === 0 ? (
                <div className="text-sm text-slate-600/90">No tasks assigned.</div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { id: 'todo', label: 'To Do' },
                      { id: 'inprogress', label: 'In Progress' },
                      { id: 'blocked', label: 'Blocked' },
                      { id: 'done', label: 'Done' },
                    ].map(({ id, label }) => (
                      <div
                        key={id}
                        className={`glass-card p-3 ${
                          id === 'inprogress'
                            ? 'ring-1 ring-emerald-200/70'
                            : id === 'blocked'
                            ? 'ring-1 ring-orange-200/70'
                            : ''
                        }`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          const tid = e.dataTransfer.getData('text/task');
                          const cid = e.dataTransfer.getData('text/course');
                          if (tid && cid) updateTaskStatus(cid, tid, id);
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium text-slate-700/90">{label} ({groupedTasks[id].length})</div>
                        </div>
                        <div className="space-y-2 min-h-[140px]">
                          {groupedTasks[id].map((t) => {
                            const courseEntry = courses.find((x) => courseIdOf(x) === t.courseId);
                            if (!courseEntry) return null;
                            const courseId = courseIdOf(courseEntry);
                            if (!courseId) return null;
                            return (
                              <TaskCard
                                key={t.id}
                                task={t}
                                tasks={ensureArray(courseEntry?.tasks)}
                                team={ensureArray(courseEntry?.team)}
                                milestones={ensureArray(courseEntry?.milestones)}
                                onUpdate={(tid, patch) => updateTask(courseId, tid, patch)}
                                onDelete={(tid) => deleteTask(courseId, tid)}
                                onDuplicate={(tid) => duplicateTask(courseId, tid)}
                                onAddLink={(tid, url) =>
                                  patchTaskLinks(courseId, tid, 'add', url)
                                }
                                onRemoveLink={(tid, idx) =>
                                  patchTaskLinks(courseId, tid, 'remove', idx)
                                }
                                dragHandlers={{
                                  draggable: true,
                                  onDragStart: (e) => {
                                    e.dataTransfer.setData('text/task', t.id);
                                    e.dataTransfer.setData('text/course', t.courseId);
                                  },
                                }}
                                reporter={user || null}
                                variant="user-board"
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
              )}
            </SectionCard>
          )}

          {activeTab === 'calendar' && (
            <SectionCard title="☑ My Tasks – Calendar View" actions={<button onClick={handleNewTask} className="glass-button">New Task</button>}>
              {myTasks.length === 0 ? (
                <div className="text-sm text-slate-600/90">No tasks assigned.</div>
              ) : (
                <CalendarView
                  monthDate={calMonth}
                  tasks={myTasks}
                  milestones={[]}
                  team={[]}
                  onPrev={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
                  onNext={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
                  onToday={() => setCalMonth(new Date())}
                  schedule={loadGlobalSchedule()}
                  onTaskClick={(t) => setEditing({ courseId: t.courseId, taskId: t.id })}
                />
              )}
            </SectionCard>
          )}
        </div>
        {editing && (() => {
          const courseEntry = courses.find((x) => courseIdOf(x) === editing.courseId);
          const courseId = courseIdOf(courseEntry);
          const task = ensureArray(courseEntry?.tasks).find((item) => item.id === editing.taskId);
          if (!courseEntry || !task || !courseId) return null;
          return (
            <TaskModal
              task={task}
              courseId={courseId}
              courses={myCoursesAll}
              onChangeCourse={(toId) => changeTaskCourse(courseId, task.id, toId)}
              tasks={ensureArray(courseEntry.tasks)}
              team={ensureArray(courseEntry.team)}
              milestones={ensureArray(courseEntry.milestones)}
              onUpdate={(id, patch) => updateTask(courseId, id, patch)}
              onDelete={(id) => {
                deleteTask(courseId, id);
                setEditing(null);
              }}
              onAddLink={(id, url) => patchTaskLinks(courseId, id, 'add', url)}
              onRemoveLink={(id, idx) => patchTaskLinks(courseId, id, 'remove', idx)}
              onClose={() => setEditing(null)}
              reporter={user || null}
            />
          );
        })()}
        {linkPrompt && (
          <LinkReminderModal
            onOkay={() => {
              setLinkPrompt(null);
              setEditing({ courseId: linkPrompt.courseId, taskId: linkPrompt.taskId });
            }}
            onNoLink={() => {
              const course = courses.find((entry) => courseIdOf(entry) === linkPrompt.courseId);
              const task = ensureArray(course?.tasks).find((item) => item.id === linkPrompt.taskId);
              if (task) {
                fireOnDone(task.status, 'done');
              }
              updateTask(linkPrompt.courseId, linkPrompt.taskId, { status: 'done' });
              setLinkPrompt(null);
            }}
          />
        )}
        {resolveBlockContext && (
          <BlockDialog
            open
            mode="resolve"
            task={resolveBlockContext.task}
            team={resolveBlockContext.course?.team ?? []}
            reporter={resolveBlockRequest?.reporter ?? null}
            resolver={resolveBlockRequest?.resolver ?? null}
            block={resolveBlockContext.block}
            onResolve={handleResolveBlock}
            onCancel={() => setResolveBlockRequest(null)}
          />
        )}
        {blockDialogRequest && (() => {
          const course = courses.find((c) => courseIdOf(c) === blockDialogRequest.courseId);
          const task = ensureArray(course?.tasks).find((t) => t.id === blockDialogRequest.taskId) || null;
          const team = ensureArray(course?.team);
          return (
            <BlockDialog
              open
              task={task}
              team={team}
              reporter={blockDialogRequest.reporter}
              onSubmit={handleBlockDialogSubmit}
              onCancel={handleBlockDialogCancel}
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
  const tasks = state.tasks || [];
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const inprog = tasks.filter((t) => t.status === "inprogress").length;
  const blocked = tasks.filter((t) => t.status === "blocked").length;
  const todo = tasks.filter((t) => t.status === "todo").length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const nextDue =
    tasks
      .filter((t) => t.status !== "done" && t.dueDate)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0]?.dueDate || null;
  return { total, done, inprog, blocked, todo, pct, nextDue };
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
  const [linkLibrary, setLinkLibrary] = useState(() => loadLinkLibrary());
  const [linkLibraryCollapsed, setLinkLibraryCollapsed] = useState(true);
  const [workweekCollapsed, setWorkweekCollapsed] = useState(true);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [editingLinkId, setEditingLinkId] = useState(null);
  const [editingLinkLabel, setEditingLinkLabel] = useState("");
  const [editingLinkUrl, setEditingLinkUrl] = useState("");
  const [membersEditing, setMembersEditing] = useState(false);
  const [history, setHistory] = useState([]);
  const [courseHistoryEntries, setCourseHistoryEntries] = useState([]);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [courseHistoryLoading, setCourseHistoryLoading] = useState(true);
  const [blockPanels, setBlockPanels] = useState({});
  const [blockTabs, setBlockTabs] = useState({});
  const [resolveRequest, setResolveRequest] = useState(null);

  const pruneExpiredCourseHistory = useCallback((entries) => {
    const now = Date.now();
    return (entries || []).filter((entry) => {
      if (!entry || !entry.course || !entry.courseId) return false;
      return (entry.expiresAt ?? 0) > now;
    });
  }, []);

  const upsertCourseHistoryEntry = useCallback(
    (entry, options = {}) => {
      if (!entry || !entry.course || !entry.courseId) return;
      const { removeIds = [] } = options;
      setCourseHistoryLoading(false);
      setCourseHistoryEntries((prev) => {
        const filtered = prev.filter((item) => !removeIds.includes(item.id) && item.id !== entry.id);
        const next = pruneExpiredCourseHistory([entry, ...filtered]);
        next.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return next;
      });
    },
    [pruneExpiredCourseHistory]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCourseHistoryLoading(true);
      try {
        const remote = await loadCourseHistoryEntries();
        if (cancelled) return;
        const sanitized = pruneExpiredCourseHistory(remote);
        sanitized.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setCourseHistoryEntries(sanitized);
      } finally {
        if (!cancelled) setCourseHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pruneExpiredCourseHistory]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const interval = window.setInterval(() => {
      setCourseHistoryEntries((prev) => {
        const pruned = pruneExpiredCourseHistory(prev);
        if (pruned.length === prev.length) return prev;
        pruned.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return pruned;
      });
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [pruneExpiredCourseHistory]);

  const toggleLinkLibraryCollapsed = useCallback(() => {
    setLinkLibraryCollapsed((value) => !value);
  }, [setLinkLibraryCollapsed]);

  const toggleWorkweekCollapsed = useCallback(() => {
    setWorkweekCollapsed((value) => !value);
  }, []);

  const pushHistory = useCallback((entry) => {
    if (!entry) return;
    const normalized = {
      id: entry.id ?? uid(),
      type: entry.type ?? 'course',
      action: entry.action ?? null,
      courseId: entry.courseId ?? null,
      position: typeof entry.position === 'number' ? entry.position : null,
      courseBefore: entry.courseBefore ? cloneDeep(entry.courseBefore) : null,
      courseAfter: entry.courseAfter ? cloneDeep(entry.courseAfter) : null,
      snapshot: entry.snapshot ? cloneDeep(entry.snapshot) : null,
      createdAt: entry.createdAt ?? Date.now(),
    };
    setHistory((h) => [normalized, ...h].slice(0, HISTORY_STACK_LIMIT));
  }, []);

  const applyUndoEntry = useCallback((entry, prevCourses) => {
    if (!entry) return prevCourses;
    if (entry.type === 'bulk' && entry.snapshot) {
      return cloneDeep(entry.snapshot);
    }
    if (entry.type === 'course') {
      if (entry.action === 'delete' && entry.courseBefore) {
        const next = [...prevCourses];
        const insertion = cloneDeep(entry.courseBefore);
        const insertAt = typeof entry.position === 'number'
          ? Math.min(Math.max(entry.position, 0), next.length)
          : next.length;
        next.splice(insertAt, 0, insertion);
        return next;
      }
      if (entry.action === 'update' && entry.courseBefore) {
        const next = [...prevCourses];
        const idx = next.findIndex((item) => (item.course?.id ?? item.id) === entry.courseId);
        if (idx >= 0) {
          next[idx] = cloneDeep(entry.courseBefore);
          return next;
        }
        const insertAt = typeof entry.position === 'number'
          ? Math.min(Math.max(entry.position, 0), next.length)
          : next.length;
        next.splice(insertAt, 0, cloneDeep(entry.courseBefore));
        return next;
      }
      if (entry.action === 'create') {
        return prevCourses.filter((item) => (item.course?.id ?? item.id) !== entry.courseId);
      }
    }
    return prevCourses;
  }, []);

  const persistLinkLibrary = useCallback((next) => {
    setLinkLibrary(next);
    saveLinkLibrary(next);
    saveLinkLibraryRemote(next).catch(() => {});
  }, []);

  const handleStartEditLink = useCallback((link) => {
    setEditingLinkId(link.id);
    setEditingLinkLabel(link.label || "");
    setEditingLinkUrl(link.url || "");
  }, []);

  const handleCancelEditLink = useCallback(() => {
    setEditingLinkId(null);
    setEditingLinkLabel("");
    setEditingLinkUrl("");
  }, []);

  const handleAddLink = useCallback(
    (event) => {
      event.preventDefault();
      const label = newLinkLabel.trim();
      const rawUrl = newLinkUrl.trim();
      if (!rawUrl) return;
      const finalUrl = normalizeUrl(rawUrl);
      if (!finalUrl) return;
      const parsed = new URL(finalUrl);
      const entry = {
        id: uid(),
        label: label || parsed.hostname || finalUrl,
        url: finalUrl,
      };
      persistLinkLibrary([...linkLibrary, entry]);
      setNewLinkLabel("");
      setNewLinkUrl("");
    },
    [linkLibrary, newLinkLabel, newLinkUrl, persistLinkLibrary]
  );

  const handleRemoveLink = useCallback(
    (id) => {
      if (editingLinkId === id) {
        handleCancelEditLink();
      }
      persistLinkLibrary(linkLibrary.filter((link) => link.id !== id));
    },
    [editingLinkId, linkLibrary, persistLinkLibrary, handleCancelEditLink]
  );

  const handleSubmitEditLink = useCallback(
    (event) => {
      event.preventDefault();
      if (!editingLinkId) return;
      const label = editingLinkLabel.trim();
      const rawUrl = editingLinkUrl.trim();
      if (!rawUrl) return;
      const finalUrl = normalizeUrl(rawUrl);
      if (!finalUrl) return;
      const parsed = new URL(finalUrl);
      persistLinkLibrary(
        linkLibrary.map((link) =>
          link.id === editingLinkId
            ? {
                ...link,
                label: label || parsed.hostname || finalUrl,
                url: finalUrl,
              }
            : link
        )
      );
      handleCancelEditLink();
    },
    [
      editingLinkId,
      editingLinkLabel,
      editingLinkUrl,
      linkLibrary,
      persistLinkLibrary,
      handleCancelEditLink,
    ]
  );

  const blockAggregates = useMemo(
    () => aggregateBlocksByCourse(courses, people),
    [courses, people]
  );

  const toggleCourseBlockPanel = useCallback((courseId) => {
    setBlockPanels((prev) => ({ ...prev, [courseId]: !prev[courseId] }));
  }, []);

  const setCourseBlockTab = useCallback((courseId, tab) => {
    setBlockTabs((prev) => ({ ...prev, [courseId]: tab }));
  }, []);

  const openResolveBlock = useCallback((entry) => {
    setResolveRequest({
      courseId: entry.courseId,
      taskId: entry.taskId,
      blockId: entry.id,
      context: entry,
    });
  }, []);

  const resolveContext = useMemo(() => {
    if (!resolveRequest) return null;
    const course = courses.find(
      (item) => (item.course?.id ?? item.id) === resolveRequest.courseId
    );
    if (!course) return null;
    const task = Array.isArray(course.tasks)
      ? course.tasks.find((t) => t.id === resolveRequest.taskId)
      : null;
    if (!task) return null;
    const block = Array.isArray(task.blocks)
      ? task.blocks.find((b) => b.id === resolveRequest.blockId)
      : null;
    if (!block) return null;
    const milestone = Array.isArray(course.milestones)
      ? course.milestones.find((m) => m.id === task.milestoneId) ?? null
      : null;
    return { course, task, block, milestone };
  }, [resolveRequest, courses]);

  const handleResolveBlock = useCallback(
    ({ resolution, resolvedBy, resolvedAt }) => {
      if (!resolveRequest) return;
      const targetIdx = courses.findIndex(
        (item) => (item.course?.id ?? item.id) === resolveRequest.courseId
      );
      const previousCourse = targetIdx >= 0 ? cloneDeep(courses[targetIdx]) : null;
      const next = applyBlockResolution(courses, {
        courseId: resolveRequest.courseId,
        taskId: resolveRequest.taskId,
        blockId: resolveRequest.blockId,
        resolution,
        resolvedBy,
        resolvedAt,
      });
      if (next === courses) {
        setResolveRequest(null);
        return;
      }
      if (previousCourse) {
        pushHistory({
          type: 'course',
          action: 'update',
          courseId: resolveRequest.courseId,
          position: targetIdx,
          courseBefore: previousCourse,
        });
      }
      saveCourses(next);
      saveCoursesRemote(next).catch(() => {});
      setCourses(next);
      setResolveRequest(null);
    },
    [resolveRequest, courses, pushHistory]
  );

  const undo = useCallback(() => {
    setHistory((stack) => {
      if (!stack.length) return stack;
      const [latest, ...rest] = stack;
      setCourses((prev) => {
        const next = applyUndoEntry(latest, prev);
        if (next === prev) return prev;
        saveCourses(next);
        saveCoursesRemote(next).catch(() => {});
        return next;
      });
      return rest;
    });
  }, [applyUndoEntry]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
        const target = event.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo]);

  useEffect(() => {
    const onSchedStorage = (e) => {
      if (e.key === GLOBAL_SCHEDULE_KEY) {
        if (e.newValue) {
          try { setSchedule(JSON.parse(e.newValue)); } catch {}
        }
      }
      if (e.key === LINK_LIBRARY_KEY) {
        if (e.newValue) {
          try { setLinkLibrary(JSON.parse(e.newValue)); } catch {}
        } else {
          setLinkLibrary([]);
        }
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
      const remoteLinks = await loadLinkLibraryRemote();
      if (remoteLinks) {
        saveLinkLibrary(remoteLinks);
        setLinkLibrary(remoteLinks);
      } else {
        const localLinks = loadLinkLibrary();
        setLinkLibrary(localLinks);
        if (localLinks.length) saveLinkLibraryRemote(localLinks).catch(() => {});
      }
      const remoteTpl = await loadTemplateRemote();
      if (remoteTpl) saveTemplate(remoteTpl);
    })();
  }, []);

  const propagateDependentForecasts = (tasks, sched) => {
    const map = new Map(tasks.map((t) => [t.id, t]));
    return tasks.map((t) => {
      if (!t.depTaskId || t.status === 'done' || t.status === 'skip') return t;
      const src = map.get(t.depTaskId);
      if (!src || src.status === 'skip') return t;
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
      pushHistory({ type: 'bulk', snapshot: loadCourses() });
      applySchedule(next);
      return next;
    });
  };

  const addHoliday = (dateStr) => {
    if (!dateStr) return;
    setSchedule((s) => {
      const holidays = Array.from(new Set([...s.holidays, dateStr])).sort();
      const next = { ...s, holidays };
      pushHistory({ type: 'bulk', snapshot: loadCourses() });
      applySchedule(next);
      return next;
    });
  };

  const removeHoliday = (dateStr) => {
    setSchedule((s) => {
      const next = { ...s, holidays: s.holidays.filter((h) => h !== dateStr) };
      pushHistory({ type: 'bulk', snapshot: loadCourses() });
      applySchedule(next);
      return next;
    });
  };

  const removeCourse = (courseId) => {
    const index = courses.findIndex((c) => (c.course?.id ?? c.id) === courseId);
    if (index < 0) return;
    const removedCourse = cloneDeep(courses[index]);
    pushHistory({
      type: 'course',
      action: 'delete',
      courseId,
      position: index,
      courseBefore: removedCourse,
    });
    const next = courses.filter((c, idx) => idx !== index);
    saveCourses(next);
    saveCoursesRemote(next).catch(() => {});
    setCourses(next);
    const fallbackId = uid();
    const fallbackEntry = {
      id: fallbackId,
      courseId,
      course: removedCourse,
      action: 'delete',
      position: index,
      createdAt: Date.now(),
      expiresAt: Date.now() + COURSE_HISTORY_RETENTION_MS,
    };
    upsertCourseHistoryEntry(fallbackEntry);
    recordCourseHistoryEntry({ courseId, course: removedCourse, action: 'delete', position: index })
      .then((entry) => {
        if (entry) {
          upsertCourseHistoryEntry(entry, { removeIds: [fallbackId] });
        }
      })
      .catch(() => {});
    onRemoveCourse && onRemoveCourse(courseId);
  };
  const duplicateCourse = (courseId) => {
    const srcIndex = courses.findIndex((c) => (c.course?.id ?? c.id) === courseId);
    if (srcIndex < 0) return;
    const src = courses[srcIndex];
    const copy = cloneDeep(src);
    copy.id = uid();
    copy.course = {
      ...(copy.course ?? {}),
      id: copy.id,
      name: `${src.course.name} (copy)`,
    };
    pushHistory({
      type: 'course',
      action: 'create',
      courseId: copy.course?.id ?? copy.id,
      position: courses.length,
      courseAfter: copy,
    });
    const next = [...courses, copy];
    saveCourses(next);
    saveCoursesRemote(next).catch(() => {});
    setCourses(next);
    onDuplicateCourse && onDuplicateCourse(copy.course?.id ?? copy.id);
  };
  const formatHistoryTimestamp = (value) => {
    if (!value) return 'Unknown';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return 'Unknown';
    }
  };
  const handleRetrieveHistoryEntry = useCallback(
    (entry) => {
      if (!entry || !entry.course) return;
      setCourses((prev) => {
        const filtered = prev.filter((item) => (item.course?.id ?? item.id) !== entry.courseId);
        const next = [...filtered];
        const insertAt = typeof entry.position === 'number'
          ? Math.min(Math.max(entry.position, 0), next.length)
          : next.length;
        const insertion = cloneDeep(entry.course);
        next.splice(insertAt, 0, insertion);
        pushHistory({
          type: 'course',
          action: 'create',
          courseId: entry.courseId,
          position: insertAt,
          courseAfter: insertion,
        });
        saveCourses(next);
        saveCoursesRemote(next).catch(() => {});
        return next;
      });
      setHistoryModalOpen(false);
    },
    [pushHistory]
  );
  const handleAddCourse = () => {
    pushHistory({ type: 'bulk', snapshot: courses });
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
    <div className={APP_SHELL_CLASS}>
      <header className="sticky top-0 z-20 border-b border-white/50 bg-white/70 supports-[backdrop-filter]:bg-white/30 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_16px_48px_rgba(15,23,42,0.12)]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 shadow-[0_12px_32px_rgba(15,23,42,0.18)]"/>
            <div className="min-w-0">
              <div className="text-sm sm:text-[15px] font-semibold text-slate-700/90 truncate">DART: Design and Development Accountability and Responsibility Tracker</div>
              <div className="text-sm text-slate-600/90 truncate flex items-center gap-2">
                <CoursesIcon className="shrink-0" />
                <span className="truncate">Courses Hub</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onEditTemplate} className="glass-button">Edit Template</button>
            <button
              onClick={() => setHistoryModalOpen(true)}
              className="glass-button flex items-center gap-2"
            >
              <History className="icon" />
              <span className="hidden sm:inline">Version history</span>
              <span className="sm:hidden">History</span>
            </button>
            <button
              onClick={undo}
              disabled={!history.length}
              className="glass-button disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Undo
            </button>
            <button
              onClick={handleAddCourse}
              className="glass-button-primary"
            >
              Add Course
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Team member management */}
        <section className="glass-surface p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900/5 text-slate-600 shadow-[0_12px_28px_-20px_rgba(15,23,42,0.28)]">
                <Users className="icon icon-lg" aria-hidden="true" />
              </span>
              <span>Team Members</span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={addPerson}
                className="glass-button"
              >
                Add Member
              </button>
              <button
                onClick={() => setMembersEditing(v => !v)}
                className="glass-button"
              >
                {membersEditing ? 'Done' : 'Edit Members'}
              </button>
            </div>
          </div>
          {people.length === 0 ? (
            <div className="text-sm text-slate-600/90">No team members</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...people]
                .sort((a, b) => {
                  const roleCmp = roleOrder.indexOf(a.roleType) - roleOrder.indexOf(b.roleType);
                  return roleCmp !== 0 ? roleCmp : a.name.localeCompare(b.name);
                })
                .map((m) => {
                  const interactive = !membersEditing;
                  const cardProps = interactive
                    ? {
                        role: "button",
                        tabIndex: 0,
                        onClick: () => onOpenUser(m.id),
                        onKeyDown: (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onOpenUser(m.id);
                          }
                        },
                        "aria-label": `Open ${m.name}`,
                      }
                    : {};
                return (
                  <div
                    key={m.id}
                    className={`group glass-card p-4 flex flex-col items-center text-center border-2 ${
                      interactive
                        ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400"
                        : ""
                    }`}
                    style={{ borderColor: m.color, backgroundColor: `${m.color}20` }}
                    {...cardProps}
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
                            className="mb-2 rounded-2xl border border-white/60 bg-white/80 px-3 py-1.5 text-sm shadow-sm"
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
                            className="mt-1 rounded-2xl border border-white/60 bg-white/80 px-3 py-1.5 text-sm shadow-sm"
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
                              className="glass-button text-sm px-3 py-1.5"
                            >
                              Open
                            </button>
                            <button
                              onClick={() => removePerson(m.id)}
                              className="glass-button text-sm px-3 py-1.5 text-rose-600 hover:text-rose-700"
                            >
                              Remove
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-medium leading-tight group-hover:underline">{m.name}</div>
                          <div className="text-sm text-slate-600/90">{m.roleType}</div>
                        </>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        {/* Link Library */}
        <section className="glass-surface p-4 sm:p-6">
          <div className="flex flex-col gap-3">
            <div
              role="button"
              tabIndex={0}
              onClick={toggleLinkLibraryCollapsed}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
                  event.preventDefault();
                  if (!event.repeat) {
                    toggleLinkLibraryCollapsed();
                  }
                }
              }}
              aria-expanded={!linkLibraryCollapsed}
              aria-label={linkLibraryCollapsed ? 'Expand link library' : 'Collapse link library'}
              className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-2xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400"
            >
              <h2 className="text-lg font-semibold flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900/5 text-slate-600 shadow-[0_12px_28px_-20px_rgba(15,23,42,0.28)]">
                  <LinkIcon className="icon icon-lg" aria-hidden="true" />
                </span>
                <span className="flex items-baseline gap-2">
                  <span>Link Library</span>
                  <span className="text-sm font-normal text-slate-600/90">({linkLibrary.length})</span>
                </span>
              </h2>
              <div className="flex items-center gap-2">
                <span className="glass-icon-button w-9 h-9 sm:w-11 sm:h-11" aria-hidden="true">
                  {linkLibraryCollapsed ? <ChevronDown className="icon" /> : <ChevronUp className="icon" />}
                </span>
              </div>
            </div>
            {!linkLibraryCollapsed && (
              <div className="space-y-4">
                <form
                  className="glass-card p-4 space-y-3 sm:space-y-0 sm:flex sm:items-end sm:gap-3"
                  onSubmit={handleAddLink}
                >
                  <label className="flex-1 text-sm text-slate-700">
                    <span className="font-medium">Label</span>
                    <input
                      type="text"
                      value={newLinkLabel}
                      onChange={(e) => setNewLinkLabel(e.target.value)}
                      placeholder="Resource name"
                      className="mt-1 w-full rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-sm shadow-sm"
                    />
                  </label>
                  <label className="flex-1 text-sm text-slate-700">
                    <span className="font-medium">URL</span>
                    <input
                      type="text"
                      inputMode="url"
                      autoComplete="url"
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      placeholder="example.com or https://example.com"
                      className="mt-1 w-full rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-sm shadow-sm"
                    />
                  </label>
                  <button type="submit" className="glass-button-primary whitespace-nowrap">
                    Add Link
                  </button>
                </form>
                {linkLibrary.length === 0 ? (
                  <div className="glass-card p-4 text-sm text-slate-600/90">
                    No links yet. Add your go-to resources above.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {linkLibrary.map((link) => (
                      <li
                        key={link.id}
                        className="glass-card p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        {editingLinkId === link.id ? (
                          <form
                            className="w-full flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3"
                            onSubmit={handleSubmitEditLink}
                          >
                            <label className="flex-1 text-sm text-slate-700">
                              <span className="font-medium">Label</span>
                              <input
                                type="text"
                                value={editingLinkLabel}
                                onChange={(event) => setEditingLinkLabel(event.target.value)}
                                className="mt-1 w-full rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-sm shadow-sm"
                              />
                            </label>
                            <label className="flex-1 text-sm text-slate-700">
                              <span className="font-medium">URL</span>
                              <input
                                type="text"
                                inputMode="url"
                                autoComplete="url"
                                value={editingLinkUrl}
                                onChange={(event) => setEditingLinkUrl(event.target.value)}
                                className="mt-1 w-full rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-sm shadow-sm"
                              />
                            </label>
                            <div className="flex items-center gap-2">
                              <button type="submit" className="glass-button-primary text-sm whitespace-nowrap">
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditLink}
                                className="glass-button text-sm whitespace-nowrap"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="min-w-0 space-y-1">
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-slate-800 hover:underline break-words"
                              >
                                {link.label}
                              </a>
                              <div className="text-xs text-slate-600/80 break-all">{link.url}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="glass-button text-sm"
                              >
                                Open
                              </a>
                              <button
                                type="button"
                                onClick={() => handleStartEditLink(link)}
                                className="glass-icon-button w-9 h-9 text-slate-600 hover:text-slate-700"
                                aria-label="Edit link"
                              >
                                <Pencil className="icon" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveLink(link.id)}
                                className="glass-icon-button w-9 h-9 text-rose-500 hover:text-rose-600"
                                aria-label="Remove link"
                              >
                                <X className="icon" />
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <CoursesIcon className="shrink-0" />
            <span>All Courses</span>
          </h2>
          {courses.length === 0 ? (
            <div className="glass-card p-6 text-center">
              <div className="text-lg font-semibold mb-2">No courses yet</div>
              <p className="text-sm text-slate-600/90 mb-4">Use your Course Template to spin up your first course.</p>
              <button onClick={onAddCourse} className="glass-button-primary">Add Course</button>
            </div>
          ) : (
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => {
                const courseId = c.course?.id ?? c.id;
                const t = computeTotals(c);
                const blockGroup = blockAggregates.byCourse.get(courseId) ?? {
                  active: [],
                  resolved: [],
                };
                const panelOpen = blockPanels[courseId] ?? false;
                const activeBlocks = blockGroup.active;
                const resolvedBlocks = blockGroup.resolved;
                const blockTab = blockTabs[courseId] ?? "active";
                return (
                  <motion.div
                    key={courseId}
                    layout
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${c.course.name}`}
                    onClick={() => open(courseId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') open(courseId);
                    }}
                    className="group w-full glass-card p-4 cursor-pointer hover:ring-2 hover:ring-indigo-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><div className="font-semibold truncate text-slate-800">{c.course.name}</div><div className="text-sm text-slate-600/90 truncate">{c.course.description}</div></div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-3">
                      <Ring className="w-14 h-14 xs:w-16 xs:h-16" stroke={10} progress={t.pct} color="#10b981">
                        <div className="text-center">
                          <div className="text-sm font-semibold">{t.pct}%</div>
                          <div className="text-sm text-slate-600/90">{t.done}/{t.total}</div>
                        </div>
                      </Ring>
                      <div className="text-sm space-y-1"><div>In progress: <b>{t.inprog}</b></div><div>To do: <b>{t.todo}</b></div><div>Next due: <b>{t.nextDue || '—'}</b></div></div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); open(courseId); }}
                        className="glass-icon-button w-11 h-11 text-slate-700"
                        aria-label="Open course"
                      >
                        <BookOpen className="icon" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); duplicateCourse(courseId); }}
                        className="glass-icon-button w-11 h-11"
                        aria-label="Duplicate course"
                      >
                        <Copy className="icon" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm('Delete this course?')) removeCourse(courseId); }}
                        className="glass-icon-button w-11 h-11 text-rose-500 hover:text-rose-600"
                        aria-label="Delete course"
                      >
                        <Trash2 className="icon" />
                      </button>
                    </div>
                    <div className="mt-4 border-t border-white/60 pt-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleCourseBlockPanel(courseId);
                        }}
                        className="glass-button w-full justify-between"
                        aria-expanded={panelOpen}
                      >
                        <span className="font-semibold text-slate-700">Blocks</span>
                        <span className="text-xs text-slate-500">
                          Active {activeBlocks.length} · Resolved {resolvedBlocks.length}
                        </span>
                      </button>
                      {panelOpen && (
                        <div className="mt-3 space-y-3" onClick={(event) => event.stopPropagation()}>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={`${
                                blockTab === "active" ? "glass-button-primary" : "glass-button"
                              } min-w-[6rem] justify-center`}
                              onClick={() => setCourseBlockTab(courseId, "active")}
                            >
                              Active ({activeBlocks.length})
                            </button>
                            <button
                              type="button"
                              className={`${
                                blockTab === "resolved" ? "glass-button-primary" : "glass-button"
                              } min-w-[6rem] justify-center`}
                              onClick={() => setCourseBlockTab(courseId, "resolved")}
                            >
                              Resolved ({resolvedBlocks.length})
                            </button>
                          </div>
                          {blockTab === "active" ? (
                            activeBlocks.length === 0 ? (
                              <div className="rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-slate-600/90">
                                No active blocks for this course.
                              </div>
                            ) : (
                              <ul className="space-y-3">
                                {activeBlocks.map((block) => {
                                  const reporterName = block.reporter?.name || "Unknown";
                                  const milestoneTitle = block.milestone?.title || "No milestone";
                                  const tagNames = block.taggedMembers?.length
                                    ? block.taggedMembers.map((member) => member.name)
                                    : block.taggedMemberIds;
                                  return (
                                    <li
                                      key={block.id}
                                      className="rounded-xl border border-emerald-100 bg-white/80 p-3 shadow-sm"
                                    >
                                      <div className="text-sm font-semibold text-slate-800">
                                        {block.task.title || "Untitled task"}
                                      </div>
                                      <div className="mt-1 text-xs text-slate-500">
                                        {milestoneTitle} · Reported by {reporterName}
                                        {block.reportedAt ? ` on ${block.reportedAt}` : ""}
                                      </div>
                                      <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                                        {block.description}
                                      </div>
                                      {tagNames && tagNames.length > 0 && (
                                        <div className="mt-2 text-xs text-slate-500">
                                          Tagged: {tagNames.join(", ")}
                                        </div>
                                      )}
                                      <div className="mt-3 flex justify-end">
                                        <button
                                          type="button"
                                          className="glass-button-success"
                                          onClick={() => openResolveBlock(block)}
                                        >
                                          Resolve
                                        </button>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            )
                          ) : resolvedBlocks.length === 0 ? (
                            <div className="rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-slate-600/90">
                              No resolved blocks yet.
                            </div>
                          ) : (
                            <ul className="space-y-3">
                              {resolvedBlocks.map((block) => {
                                const reporterName = block.reporter?.name || "Unknown";
                                const resolverName = block.resolver?.name || "Unknown";
                                const milestoneTitle = block.milestone?.title || "No milestone";
                                return (
                                  <li
                                    key={block.id}
                                    className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 shadow-sm"
                                  >
                                    <div className="text-sm font-semibold text-emerald-900">
                                      {block.task.title || "Untitled task"}
                                    </div>
                                    <div className="mt-1 text-xs text-emerald-900/70">
                                      {milestoneTitle} · Reported by {reporterName}
                                      {block.reportedAt ? ` on ${block.reportedAt}` : ""}
                                    </div>
                                    <div className="mt-1 text-xs text-emerald-900/70">
                                      Resolved by {resolverName}
                                      {block.resolvedAt ? ` on ${block.resolvedAt}` : ""}
                                    </div>
                                    <div className="mt-2 whitespace-pre-wrap text-sm text-emerald-900/90">
                                      {block.description}
                                    </div>
                                    {block.resolution && (
                                      <div className="mt-2 rounded-lg bg-white/80 p-2 text-sm text-emerald-900">
                                        <span className="font-medium">Resolution:</span> {block.resolution}
                                      </div>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* Global schedule controls */}
        <section className="glass-surface p-4 sm:p-6">
          <button
            type="button"
            id="global-workweek-toggle"
            onClick={toggleWorkweekCollapsed}
            className="group mb-2 flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition-colors hover:bg-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            aria-expanded={!workweekCollapsed}
            aria-controls="global-workweek-panel"
          >
            <span className="flex items-center gap-2 font-semibold text-indigo-900">
              <span className="text-base sm:text-lg">Workweek & Holidays</span>
              <span className="text-sm font-normal text-indigo-700">(Global)</span>
            </span>
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-indigo-800 shadow-sm transition-transform duration-200 ${
                workweekCollapsed ? '' : 'rotate-180'
              }`}
              aria-hidden="true"
            >
              <ChevronDown className="icon" />
            </span>
          </button>
          {!workweekCollapsed && (
            <div
              className="glass-card p-4 text-sm"
              id="global-workweek-panel"
              role="region"
              aria-labelledby="global-workweek-toggle"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="font-medium">Workweek:</div>
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((label, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleWorkday(idx)}
                    className={`px-3 py-1.5 rounded-full text-sm transition ${
                      schedule.workweek.includes(idx)
                        ? 'bg-slate-900 text-white shadow-[0_14px_30px_-12px_rgba(15,23,42,0.6)] border border-slate-900'
                        : 'border border-white/60 bg-white/75 text-slate-600 shadow-sm backdrop-blur'
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
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-rose-200/80 bg-rose-50/70 text-rose-600 shadow-sm backdrop-blur"
                    >
                      {h}
                      <button
                        onClick={() => removeHoliday(h)}
                        title="Remove holiday"
                        aria-label="Remove holiday"
                      >
                        <X className="icon text-rose-500 hover:text-rose-700" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

      <BlockDialog
        open={!!resolveContext}
        mode="resolve"
        task={resolveContext?.task ?? null}
        team={resolveContext?.course?.team ?? []}
        reporter={resolveRequest?.context?.reporter ?? null}
        resolver={resolveRequest?.context?.resolver ?? null}
        block={resolveContext?.block ?? null}
        onResolve={handleResolveBlock}
        onCancel={() => setResolveRequest(null)}
      />
    </main>
      {historyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Course version history"
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4"
        >
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-xl p-6 max-h-[85vh] overflow-hidden">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-800">Course version history</h2>
                <p className="text-sm text-slate-600/90">
                  Recently deleted courses remain available for seven days.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="glass-icon-button w-10 h-10 text-slate-600 hover:text-slate-800"
                aria-label="Close version history"
              >
                <X className="icon" />
              </button>
            </div>
            <div className="mt-4 overflow-y-auto max-h-[60vh]">
              {courseHistoryLoading ? (
                <div className="py-10 text-center text-sm text-slate-600/90">
                  Loading recent history…
                </div>
              ) : courseHistoryEntries.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-600/90">
                  No course deletions in the last seven days.
                </div>
              ) : (
                <ul className="space-y-3">
                  {courseHistoryEntries.map((entry) => {
                    const courseMeta = entry.course?.course || entry.course;
                    const courseName = courseMeta?.name || 'Untitled course';
                    const description = courseMeta?.description || '';
                    return (
                      <li
                        key={entry.id}
                        className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 space-y-1">
                            <div className="text-sm font-semibold text-slate-800 truncate">
                              {courseName}
                            </div>
                            <div className="text-xs text-slate-500">
                              Removed {formatHistoryTimestamp(entry.createdAt)}
                            </div>
                            <div className="text-xs text-slate-500">Course ID: {entry.courseId}</div>
                            {typeof entry.position === 'number' && (
                              <div className="text-xs text-slate-500">
                                Original position: {entry.position + 1}
                              </div>
                            )}
                            {description ? (
                              <div className="text-sm text-slate-600/90 whitespace-pre-wrap break-words">
                                {description}
                              </div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRetrieveHistoryEntry(entry)}
                            className="glass-button-primary whitespace-nowrap"
                          >
                            Retrieve
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// Root App – switches between Hub and Course Dashboard
// =====================================================
export { CoursePMApp };

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
  const [milestoneTemplates, setMilestoneTemplates] = useState(() => {
    const stored = loadMilestoneTemplates();
    const merged = mergeById(stored, defaultMilestoneTemplates);
    if (merged.length !== stored.length) saveMilestoneTemplates(merged);
    return merged;
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
  const handleMilestoneTemplatesChange = (next) => {
    setMilestoneTemplates(next);
  };
  useEffect(() => {
    (async () => {
      const remote = await loadMilestoneTemplatesRemote();
      if (remote.length) {
        setMilestoneTemplates((prev) => {
          const merged = mergeById(prev, remote);
          if (merged.length !== prev.length) saveMilestoneTemplates(merged);
          return merged;
        });
      } else {
        saveMilestoneTemplatesRemote(milestoneTemplates).catch(() => {});
      }
    })();
  }, []);
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

  useEffect(() => {
    resetScrollPosition();
  }, [view, currentCourseId, currentUserId]);

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
    content = <CoursePMApp boot={boot} isTemplateLabel={true} onBack={onBack} onStateChange={handleChange} people={people} milestoneTemplates={milestoneTemplates} onChangeMilestoneTemplates={handleMilestoneTemplatesChange} onOpenUser={openUser} />;
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
    content = <CoursePMApp boot={course} isTemplateLabel={false} onBack={onBack} onStateChange={handleCourseChange} people={people} milestoneTemplates={milestoneTemplates} onChangeMilestoneTemplates={handleMilestoneTemplatesChange} onOpenUser={openUser} />;
  }
  return (
    <SoundContext.Provider value={soundEnabled}>
      {content}
      <button
        onClick={toggleSound}
        className="fixed bottom-2 left-2 z-50 inline-flex items-center justify-center w-8 h-8 rounded-full border border-black/10 bg-white text-slate-600 shadow"
        title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
      >
        {soundEnabled ? '🔊' : '🔇'}
      </button>
      <div className="fixed bottom-2 right-2 z-50 px-2 py-1 rounded bg-black/70 text-white text-sm">v{version}</div>
    </SoundContext.Provider>
  );
}

// =====================================================
// Lightweight tests (console)
// =====================================================
