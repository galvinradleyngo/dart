const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const cloneValue = (value) => {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
};

const hasMeaningfulValue = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return Object.keys(value).length > 0;
  return true;
};

const toTimestamp = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value);
  return null;
};

const mergeById = (localItems = [], remoteItems = []) => {
  const merged = new Map();
  for (const item of [...localItems, ...remoteItems]) {
    if (!item || typeof item !== 'object') continue;
    const itemId = item.id ?? item.course?.id;
    if (!itemId) continue;
    const existing = merged.get(itemId);
    merged.set(itemId, existing ? mergeValues(existing, item) : cloneValue(item));
  }
  return Array.from(merged.values());
};

const mergeValues = (localValue, remoteValue) => {
  if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
    return mergeById(localValue, remoteValue);
  }

  if (isPlainObject(localValue) && isPlainObject(remoteValue)) {
    const localUpdatedAt = toTimestamp(localValue.updatedAt);
    const remoteUpdatedAt = toTimestamp(remoteValue.updatedAt);
    const preferRemote = remoteUpdatedAt != null && (localUpdatedAt == null || remoteUpdatedAt > localUpdatedAt);

    const merged = {};
    const keys = new Set([...Object.keys(localValue), ...Object.keys(remoteValue)]);

    for (const key of keys) {
      const localEntry = localValue[key];
      const remoteEntry = remoteValue[key];

      if (key === 'updatedAt' || key === 'createdAt') {
        const nextValue = preferRemote ? remoteEntry : localEntry;
        if (hasMeaningfulValue(nextValue)) {
          merged[key] = cloneValue(nextValue);
        }
        continue;
      }

      if (Array.isArray(localEntry) && Array.isArray(remoteEntry)) {
        merged[key] = mergeById(localEntry, remoteEntry);
      } else if (isPlainObject(localEntry) && isPlainObject(remoteEntry)) {
        merged[key] = mergeValues(localEntry, remoteEntry);
      } else {
        const prefersLocal = hasMeaningfulValue(localEntry) && (!hasMeaningfulValue(remoteEntry) || !preferRemote);
        merged[key] = prefersLocal ? cloneValue(localEntry) : cloneValue(remoteEntry);
      }
    }

    return merged;
  }

  return hasMeaningfulValue(localValue) && (!hasMeaningfulValue(remoteValue) || !toTimestamp(remoteValue?.updatedAt))
    ? cloneValue(localValue)
    : cloneValue(remoteValue);
};

export const mergeCourseSnapshots = (localCourses = [], remoteCourses = []) => {
  const courseMap = new Map();

  for (const course of [...localCourses, ...remoteCourses]) {
    if (!course || typeof course !== 'object') continue;
    const id = course.id ?? course.course?.id;
    if (!id) continue;

    const existing = courseMap.get(id);
    courseMap.set(id, existing ? mergeValues(existing, course) : cloneValue(course));
  }

  return Array.from(courseMap.values());
};
