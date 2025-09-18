const ensureArray = (value) => (Array.isArray(value) ? value : []);

const toDateValue = (value) => {
  if (!value) return 0;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : ts;
};

const buildMemberLookup = (courses = [], members = []) => {
  const lookup = new Map();
  ensureArray(members).forEach((member) => {
    if (member && member.id && !lookup.has(member.id)) {
      lookup.set(member.id, member);
    }
  });
  ensureArray(courses).forEach((course) => {
    ensureArray(course?.team).forEach((member) => {
      if (member && member.id && !lookup.has(member.id)) {
        lookup.set(member.id, member);
      }
    });
  });
  return lookup;
};

export const collectBlocks = (courses = [], members = []) => {
  const all = [];
  const memberLookup = buildMemberLookup(courses, members);

  ensureArray(courses).forEach((course) => {
    const courseMeta = course?.course ?? {};
    const courseId = courseMeta.id ?? course?.id ?? '';
    const courseName = courseMeta.name ?? 'Untitled course';
    const courseDescription = courseMeta.description ?? '';
    const courseCode = courseMeta.code ?? '';
    const milestoneLookup = new Map(
      ensureArray(course?.milestones).map((milestone) => [milestone.id, milestone])
    );

    ensureArray(course?.tasks).forEach((task) => {
      const milestone = task?.milestoneId ? milestoneLookup.get(task.milestoneId) ?? null : null;
      ensureArray(task?.blocks).forEach((block) => {
        if (!block || !block.id) return;
        const reporter = block.reportedBy ? memberLookup.get(block.reportedBy) ?? null : null;
        const resolver = block.resolvedBy ? memberLookup.get(block.resolvedBy) ?? null : null;
        const taggedMemberIds = Array.isArray(block.taggedMemberIds)
          ? Array.from(new Set(block.taggedMemberIds.filter(Boolean)))
          : [];
        const taggedMembers = taggedMemberIds
          .map((id) => memberLookup.get(id) ?? null)
          .filter(Boolean);

        all.push({
          id: block.id,
          blockId: block.id,
          courseId,
          course: {
            id: courseId,
            name: courseName,
            description: courseDescription,
            code: courseCode,
          },
          taskId: task?.id,
          task: {
            id: task?.id,
            title: task?.title ?? '',
            status: task?.status ?? '',
          },
          milestone: milestone
            ? {
                id: milestone.id,
                title: milestone.title ?? '',
                color: milestone.color,
              }
            : null,
          reportedAt: block.reportedAt ?? '',
          reportedAtValue: toDateValue(block.reportedAt),
          reportedBy: block.reportedBy ?? '',
          reporter,
          description: block.description ?? '',
          taggedMemberIds,
          taggedMembers,
          resolution: block.resolution ?? '',
          resolvedAt: block.resolvedAt ?? null,
          resolvedAtValue: block.resolvedAt ? toDateValue(block.resolvedAt) : 0,
          resolvedBy: block.resolvedBy ?? '',
          resolver,
        });
      });
    });
  });

  return all;
};

export const partitionBlocks = (blocks = []) => {
  const active = [];
  const resolved = [];

  ensureArray(blocks).forEach((entry) => {
    if (entry?.resolvedAt) {
      resolved.push(entry);
    } else {
      active.push(entry);
    }
  });

  active.sort((a, b) => b.reportedAtValue - a.reportedAtValue);
  resolved.sort(
    (a, b) =>
      b.resolvedAtValue - a.resolvedAtValue || b.reportedAtValue - a.reportedAtValue
  );

  return { active, resolved };
};

export const aggregateBlocksByCourse = (courses = [], members = []) => {
  const all = collectBlocks(courses, members);
  const { active, resolved } = partitionBlocks(all);
  const byCourse = new Map();

  all.forEach((entry) => {
    if (!entry?.courseId) return;
    if (!byCourse.has(entry.courseId)) {
      byCourse.set(entry.courseId, {
        course: entry.course,
        active: [],
        resolved: [],
      });
    }
    const group = byCourse.get(entry.courseId);
    (entry.resolvedAt ? group.resolved : group.active).push(entry);
  });

  byCourse.forEach((group) => {
    group.active.sort((a, b) => b.reportedAtValue - a.reportedAtValue);
    group.resolved.sort(
      (a, b) => b.resolvedAtValue - a.resolvedAtValue || b.reportedAtValue - a.reportedAtValue
    );
  });

  return { all, active, resolved, byCourse };
};

export const applyBlockResolution = (
  courses = [],
  { courseId, taskId, blockId, resolution, resolvedBy, resolvedAt }
) => {
  if (!courseId || !taskId || !blockId) return courses;
  let changed = false;

  const nextCourses = ensureArray(courses).map((course) => {
    const currentId = course?.course?.id ?? course?.id;
    if (currentId !== courseId) return course;

    const nextTasks = ensureArray(course?.tasks).map((task) => {
      if (task?.id !== taskId) return task;
      const nextBlocks = ensureArray(task?.blocks).map((block) => {
        if (!block || block.id !== blockId) return block;
        changed = true;
        return {
          ...block,
          resolution: resolution ?? '',
          resolvedBy: resolvedBy ?? '',
          resolvedAt: resolvedAt ?? '',
        };
      });
      if (!changed) return task;
      const hasActive = nextBlocks.some((block) => block && !block.resolvedAt);
      const nextStatus = !hasActive && task?.status === 'blocked' ? 'inprogress' : task?.status;
      return {
        ...task,
        blocks: nextBlocks,
        status: nextStatus,
      };
    });

    return changed ? { ...course, tasks: nextTasks } : course;
  });

  return changed ? nextCourses : courses;
};

