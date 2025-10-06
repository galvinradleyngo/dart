import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { uid, getAssigneeIds } from "./utils.js";

const MILESTONE_TPL_KEY = "healthPM:milestoneTemplates:v1";

const migrateTask = (t = {}) => {
  const assigneeIds = getAssigneeIds(t);
  return {
    title: t.title || "",
    details: t.details || "",
    note: t.note || "",
    links: t.links || [],
    depTaskId: t.depTaskId ?? null,
    assigneeIds,
    assigneeId: assigneeIds[0] ?? null,
    status: t.status || "todo",
    startDate: t.startDate || "",
    workDays: t.workDays ?? 1,
    dueDate: t.dueDate || "",
    completedDate: t.completedDate || "",
  };
};

export const loadMilestoneTemplates = () => {
  try {
    const raw = localStorage.getItem(MILESTONE_TPL_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return arr.map((tpl) => ({ ...tpl, tasks: (tpl.tasks || []).map(migrateTask) }));
  } catch {
    return [];
  }
};

export const saveMilestoneTemplates = (arr) => {
  try {
    localStorage.setItem(MILESTONE_TPL_KEY, JSON.stringify(arr));
  } catch {}
};

export const loadMilestoneTemplatesRemote = async () => {
  try {
    const snap = await getDoc(doc(db, "app", "milestoneTemplates"));
    const data = snap.exists() ? snap.data().milestoneTemplates || [] : [];
    return data.map((tpl) => ({ ...tpl, tasks: (tpl.tasks || []).map(migrateTask) }));
  } catch {
    return [];
  }
};

export const saveMilestoneTemplatesRemote = async (arr) => {
  try {
    await setDoc(doc(db, "app", "milestoneTemplates"), { milestoneTemplates: arr });
  } catch {}
};

export const addTemplate = (template) => {
  const templates = loadMilestoneTemplates();
  const next = [...templates, template];
  saveMilestoneTemplates(next);
  saveMilestoneTemplatesRemote(next).catch(() => {});
  return next;
};

export const removeTemplate = (id) => {
  const templates = loadMilestoneTemplates().filter((t) => t.id !== id);
  saveMilestoneTemplates(templates);
  saveMilestoneTemplatesRemote(templates).catch(() => {});
  return templates;
};

export const updateTemplate = (id, updates = {}) => {
  const templates = loadMilestoneTemplates();
  const next = templates.map((tpl) =>
    tpl.id === id ? { ...tpl, ...updates } : tpl
  );
  saveMilestoneTemplates(next);
  saveMilestoneTemplatesRemote(next).catch(() => {});
  return next;
};

export const createTemplateFromMilestone = (milestone, tasks = []) => {
  const templateTasks = tasks.map(({ id, order, milestoneId, ...rest }) => ({ ...rest }));
  const template = { id: uid(), title: milestone.title, goal: milestone.goal, tasks: templateTasks };
  return addTemplate(template);
};

export const createEmptyTemplate = () => {
  const template = { id: uid(), title: "New template", goal: "", tasks: [] };
  return addTemplate(template);
};

