function buildDependencyMap(tasks) {
  const map = new Map();
  tasks.forEach((task) => {
    const parent = task?.depTaskId;
    if (typeof parent !== 'string' || !parent) return;
    if (!map.has(parent)) map.set(parent, new Set());
    map.get(parent).add(task.id);
  });
  return map;
}

function collectDependentTaskIds(dependencyMap, targetId) {
  const result = new Set();
  const queue = dependencyMap.has(targetId)
    ? [...dependencyMap.get(targetId)]
    : [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (result.has(current)) continue;
    result.add(current);
    const next = dependencyMap.get(current);
    if (next) queue.push(...next);
  }
  return result;
}

export function applyLinkPatch(tasks, targetId, op, payload) {
  const dependencyMap = buildDependencyMap(tasks);
  const dependentIds = collectDependentTaskIds(dependencyMap, targetId);

  return tasks.map((task) => {
    const isTarget = task.id === targetId;
    const shouldCascade = dependentIds.has(task.id);
    if (!isTarget && !shouldCascade) return task;

    const links = Array.isArray(task.links) ? [...task.links] : [];

    if (op === 'add') {
      if (typeof payload !== 'string' || !payload) return task;
      if (links.includes(payload)) return task;
      return { ...task, links: [...links, payload] };
    }

    if (op === 'remove') {
      const removalMeta =
        payload && typeof payload === 'object'
          ? payload
          : { index: payload, url: undefined };
      if (isTarget) {
        const { index, url } = removalMeta;
        const idx = typeof index === 'number' ? index : links.indexOf(url);
        if (idx >= 0 && idx < links.length) {
          const nextLinks = [...links];
          nextLinks.splice(idx, 1);
          return { ...task, links: nextLinks };
        }
        if (url) {
          const valueIdx = links.indexOf(url);
          if (valueIdx >= 0) {
            const nextLinks = [...links];
            nextLinks.splice(valueIdx, 1);
            return { ...task, links: nextLinks };
          }
        }
        return task;
      }

      const { url } = removalMeta || {};
      if (!url) return task;
      const idx = links.indexOf(url);
      if (idx === -1) return task;
      const nextLinks = [...links];
      nextLinks.splice(idx, 1);
      return { ...task, links: nextLinks };
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
        linkMap.set(url, {
          url,
          taskIds: new Set(),
          earliestTaskId: task.id,
          earliestOrder: tasksOrder.get(task.id) ?? Number.MAX_SAFE_INTEGER,
          latestTaskId: task.id,
          latestOrder: tasksOrder.get(task.id) ?? Number.MIN_SAFE_INTEGER,
        });
      }
      const entry = linkMap.get(url);
      entry.taskIds.add(task.id);
      const currentOrder = tasksOrder.get(task.id) ?? Number.MAX_SAFE_INTEGER;
      if (currentOrder < entry.earliestOrder) {
        entry.earliestOrder = currentOrder;
        entry.earliestTaskId = task.id;
      }
      if (currentOrder > entry.latestOrder) {
        entry.latestOrder = currentOrder;
        entry.latestTaskId = task.id;
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
    const preferredTaskId = data.latestTaskId ?? data.earliestTaskId ?? null;
    const representativeTaskId =
      existing?.taskId && data.taskIds.has(existing.taskId)
        ? existing.taskId
        : preferredTaskId || selectRepresentativeTaskId(data, tasksOrder);
    const representativeTask = milestoneTasks.find((task) => task.id === representativeTaskId) || null;
    const taskTitle = representativeTask && typeof representativeTask.title === 'string'
      ? representativeTask.title.trim()
      : '';
    const shouldUseTaskLabel = hasMultipleUniqueUrls && data.taskIds.size === 1 && taskTitle;
    const label = shouldUseTaskLabel ? `${baseLabel} - ${taskTitle}` : baseLabel;
    const pinned = existing?.pinned === true;

    return {
      id: existing?.id ?? uidFn(),
      label,
      url,
      milestoneId,
      taskId: representativeTaskId,
      source: 'task',
      pinned,
    };
  });

  newEntries.sort((a, b) => {
    const orderA = tasksOrder.get(linkMap.get(a.url)?.earliestTaskId ?? '') ?? Number.MAX_SAFE_INTEGER;
    const orderB = tasksOrder.get(linkMap.get(b.url)?.earliestTaskId ?? '') ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.label.localeCompare(b.label);
  });

  const newUrls = new Set(newEntries.map((entry) => entry.url));
  const dedupedPreserved = preserved.filter((entry) => {
    if (!newUrls.has(entry.url)) return true;
    if (!entry || typeof entry !== 'object') return true;
    return entry.source !== 'task';
  });

  return [...dedupedPreserved, ...newEntries];
}
