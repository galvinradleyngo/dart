export function applyLinkPatch(tasks, targetId, op, payload) {
  return tasks.map((task) => {
    if (task.id !== targetId) return task;
    if (op === 'add') {
      if (typeof payload !== 'string') return task;
      const links = Array.isArray(task.links) ? [...task.links] : [];
      if (!links.includes(payload)) links.push(payload);
      return { ...task, links };
    }
    if (op === 'remove') {
      const links = Array.isArray(task.links) ? [...task.links] : [];
      links.splice(payload, 1);
      return { ...task, links };
    }
    return task;
  });
}

function getTaskOrder(task, index) {
  if (typeof task.order === 'number') return task.order;
  return index;
}

function normalizeLabelSource(title) {
  if (typeof title === 'string' && title.trim()) return title.trim();
  return 'Unassigned';
}

function selectRepresentativeTaskId(data, tasksOrder) {
  const ids = Array.from(data.taskIds);
  if (ids.length === 0) return null;
  let selected = ids[0];
  let bestOrder = tasksOrder.get(selected) ?? Number.MAX_SAFE_INTEGER;
  for (let i = 1; i < ids.length; i += 1) {
    const id = ids[i];
    const order = tasksOrder.get(id) ?? Number.MAX_SAFE_INTEGER;
    if (order < bestOrder) {
      selected = id;
      bestOrder = order;
    }
  }
  return selected;
}

export function syncLinkLibraryWithMilestone({
  tasks = [],
  library = [],
  milestoneId = null,
  milestoneTitle = '',
  uidFn = () => Math.random().toString(36).slice(2),
}) {
  const milestoneTasks = tasks.filter((task) => (task?.milestoneId ?? null) === milestoneId);
  const tasksOrder = new Map();
  tasks.forEach((task, index) => {
    tasksOrder.set(task.id, getTaskOrder(task, index));
  });

  const linkMap = new Map();
  milestoneTasks.forEach((task) => {
    const links = Array.isArray(task.links) ? task.links : [];
    links.forEach((raw) => {
      if (typeof raw !== 'string') return;
      const url = raw.trim();
      if (!url) return;
      if (!linkMap.has(url)) {
        linkMap.set(url, { url, taskIds: new Set(), firstTaskId: task.id });
      }
      const entry = linkMap.get(url);
      entry.taskIds.add(task.id);
      const firstOrder = tasksOrder.get(entry.firstTaskId) ?? Number.MAX_SAFE_INTEGER;
      const currentOrder = tasksOrder.get(task.id) ?? Number.MAX_SAFE_INTEGER;
      if (currentOrder < firstOrder) {
        entry.firstTaskId = task.id;
      }
    });
  });

  const urls = Array.from(linkMap.keys());
  const hasMultipleUniqueUrls = urls.length > 1;
  const baseLabel = normalizeLabelSource(milestoneTitle);

  const existingByUrl = new Map();
  (Array.isArray(library) ? library : []).forEach((entry) => {
    if (
      entry &&
      typeof entry === 'object' &&
      entry.source === 'task' &&
      (entry.milestoneId ?? null) === milestoneId &&
      typeof entry.url === 'string'
    ) {
      existingByUrl.set(entry.url, entry);
    }
  });

  const preserved = (Array.isArray(library) ? library : []).filter((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    if (entry.source === 'task' && (entry.milestoneId ?? null) === milestoneId) {
      return false;
    }
    return true;
  });

  if (urls.length === 0) {
    return preserved;
  }

  const newEntries = urls.map((url) => {
    const data = linkMap.get(url);
    const existing = existingByUrl.get(url);
    const representativeTaskId = existing?.taskId && data.taskIds.has(existing.taskId)
      ? existing.taskId
      : selectRepresentativeTaskId(data, tasksOrder);
    const representativeTask = milestoneTasks.find((task) => task.id === representativeTaskId) || null;
    const taskTitle = representativeTask && typeof representativeTask.title === 'string'
      ? representativeTask.title.trim()
      : '';
    const shouldUseTaskLabel = hasMultipleUniqueUrls && data.taskIds.size === 1 && taskTitle;
    const label = shouldUseTaskLabel ? `${baseLabel} - ${taskTitle}` : baseLabel;

    return {
      id: existing?.id ?? uidFn(),
      label,
      url,
      milestoneId,
      taskId: representativeTaskId,
      source: 'task',
    };
  });

  newEntries.sort((a, b) => {
    const orderA = tasksOrder.get(linkMap.get(a.url)?.firstTaskId ?? '') ?? Number.MAX_SAFE_INTEGER;
    const orderB = tasksOrder.get(linkMap.get(b.url)?.firstTaskId ?? '') ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.label.localeCompare(b.label);
  });

  return [...preserved, ...newEntries];
}
