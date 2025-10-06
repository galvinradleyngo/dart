import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { uid, getAssigneeIds } from "./utils.js";

const MILESTONE_TPL_KEY = "healthPM:milestoneTemplates:v1";

const migrateTask = (t = {}) => {
  const assigneeIds = getAssigneeIds(t);
  return {
    id: t.id || uid(),
    title: t.title || "",
    details: t.details || "",
    note: t.note || "",
    links: Array.isArray(t.links) ? t.links : [],
    depTaskId: t.depTaskId ?? null,
    assigneeIds,
    assigneeId: assigneeIds[0] ?? null,
    status: t.status || "todo",
    startDate: t.startDate || "",
    workDays: Number.isFinite(t.workDays) ? t.workDays : 1,
    dueDate: t.dueDate || "",
    completedDate: t.completedDate || "",
  };
};

const templateTaskDefaults = () => migrateTask({
  title: "",
  details: "",
  note: "",
  links: [],
  status: "todo",
  workDays: 1,
});

const persistTemplates = (templates) => {
  saveMilestoneTemplates(templates);
  saveMilestoneTemplatesRemote(templates).catch(() => {});
  return templates;
};

const mutateTemplates = (mutator) => {
  const templates = loadMilestoneTemplates();
  const next = mutator(templates);
  return persistTemplates(next);
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
  return mutateTemplates((templates) => {
    const nextTemplate = {
      ...template,
      tasks: Array.isArray(template.tasks)
        ? template.tasks.map(migrateTask)
        : [],
    };
    return [...templates, nextTemplate];
  });
};

export const removeTemplate = (id) => {
  return mutateTemplates((templates) => templates.filter((t) => t.id !== id));
};

export const updateTemplate = (id, updates = {}) => {
  return mutateTemplates((templates) =>
    templates.map((tpl) =>
      tpl.id === id
        ? {
            ...tpl,
            ...updates,
            tasks: Array.isArray(updates.tasks)
              ? updates.tasks.map(migrateTask)
              : tpl.tasks,
          }
        : tpl
    )
  );
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
  const templateTasks = tasks.map(({ id, order, milestoneId, ...rest }) =>
    migrateTask(rest)
  );
  const template = { id: uid(), title: milestone.title, goal: milestone.goal, tasks: templateTasks };
  return addTemplate(template);
};

export const createEmptyTemplate = () => {
  const template = { id: uid(), title: "New template", goal: "", tasks: [] };
  return addTemplate(template);
};

export const addTaskToTemplate = (templateId) =>
  mutateTemplates((templates) =>
    templates.map((tpl) =>
      tpl.id === templateId
        ? { ...tpl, tasks: [...(tpl.tasks || []), templateTaskDefaults()] }
        : tpl
    )
  );

export const updateTaskInTemplate = (templateId, taskId, updates = {}) =>
  mutateTemplates((templates) =>
    templates.map((tpl) => {
      if (tpl.id !== templateId) return tpl;
      const tasks = Array.isArray(tpl.tasks) ? tpl.tasks : [];
      const nextTasks = tasks.map((task) =>
        task.id === taskId ? migrateTask({ ...task, ...updates, id: task.id }) : task
      );
      return { ...tpl, tasks: nextTasks };
    })
  );

export const removeTaskFromTemplate = (templateId, taskId) =>
  mutateTemplates((templates) =>
    templates.map((tpl) =>
      tpl.id === templateId
        ? { ...tpl, tasks: (tpl.tasks || []).filter((task) => task.id !== taskId) }
        : tpl
    )
  );

export const duplicateTaskInTemplate = (templateId, taskId) =>
  mutateTemplates((templates) =>
    templates.map((tpl) => {
      if (tpl.id !== templateId) return tpl;
      const tasks = Array.isArray(tpl.tasks) ? tpl.tasks : [];
      const target = tasks.find((task) => task.id === taskId);
      if (!target) return tpl;
      const duplicated = migrateTask({ ...target, id: null });
      const index = tasks.findIndex((task) => task.id === taskId);
      const nextTasks = [...tasks];
      nextTasks.splice(index + 1, 0, duplicated);
      return { ...tpl, tasks: nextTasks };
    })
  );

