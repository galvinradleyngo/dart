export function applyLinkPatch(tasks, targetId, op, payload) {
  const src = tasks.find((t) => t.id === targetId);
  if (!src) return tasks;
  const milestoneId = src.milestoneId;
  return tasks.map((t) => {
    if (op === 'add') {
      if (t.milestoneId === milestoneId) {
        const links = Array.isArray(t.links) ? [...t.links] : [];
        if (!links.includes(payload)) links.push(payload);
        return { ...t, links };
      }
      return t;
    }
    if (op === 'remove') {
      if (t.id === targetId) {
        const links = Array.isArray(t.links) ? [...t.links] : [];
        links.splice(payload, 1);
        return { ...t, links };
      }
      return t;
    }
    return t;
  });
}
