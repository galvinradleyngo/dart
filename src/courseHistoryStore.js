import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  doc,
} from 'firebase/firestore';
import { db } from './firebase.js';
import { uid } from './utils.js';

const FIRESTORE_PASSWORD_SENTINEL = 'passthesalt';
const COURSE_HISTORY_FETCH_LIMIT = 200;

const COURSE_HISTORY_CACHE_KEY = 'healthPM:courseHistoryCache:v1';
const COURSE_HISTORY_PENDING_KEY = 'healthPM:courseHistoryPending:v1';
const COURSE_HISTORY_LEGACY_KEY = 'healthPM:courseHistory:v1';

const courseHistoryCollectionRef = collection(db, 'courseHistory');

const cloneDeep = (value) => {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
};

const toMillis = (value, fallback) => {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return fallback;
};

const stringId = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const readLocalEntries = (key) => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalEntries = (key, entries) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(entries));
  } catch {}
};

const cloneIfObject = (value) => {
  if (!value || typeof value !== 'object') return null;
  return cloneDeep(value);
};

export const sanitizeCourseHistoryEntryData = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  const kind = entry.kind === 'backup' ? 'backup' : 'course';

  const createdAt = toMillis(entry.createdAt, Date.now());
  const expiresAt =
    entry.expiresAt == null
      ? null
      : toMillis(entry.expiresAt, Number.NEGATIVE_INFINITY);

  const providedId = stringId(entry.id);
  const providedClientId = stringId(entry.clientId);

  const sanitized = {
    id: providedId ?? uid(),
    kind,
    action: entry.action || (kind === 'course' ? 'delete' : null),
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
  };

  const clientId = providedClientId ?? sanitized.id;
  if (clientId) {
    sanitized.clientId = clientId;
  }

  if (Number.isFinite(expiresAt)) {
    sanitized.expiresAt = expiresAt;
  }

  if (kind === 'course') {
    const course = entry.course ? cloneDeep(entry.course) : null;
    const courseId =
      entry.courseId ?? course?.course?.id ?? course?.id ?? null;
    if (!course || !courseId) return null;
    sanitized.courseId = courseId;
    sanitized.course = course;
    sanitized.position =
      typeof entry.position === 'number' ? entry.position : null;
  } else {
    const snapshot = cloneIfObject(entry.snapshot);
    if (!snapshot) return null;
    sanitized.snapshot = snapshot;
    const summary = cloneIfObject(entry.summary);
    if (summary) sanitized.summary = summary;
    const metadata = cloneIfObject(entry.metadata);
    if (metadata) sanitized.metadata = metadata;
    const label = stringId(entry.label);
    if (label) sanitized.label = label;
  }

  return sanitized;
};

export const normalizeCourseHistoryEntryList = (entries = []) => {
  const now = Date.now();
  const sanitized = (entries || [])
    .map((entry) => sanitizeCourseHistoryEntryData(entry))
    .filter((entry) =>
      entry && (entry.expiresAt == null || entry.expiresAt > now)
    );

  sanitized.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const result = [];
  const seenIds = new Set();
  for (const entry of sanitized) {
    if (!entry.id) continue;
    if (seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);
    result.push(entry);
  }
  return result;
};

const loadCachedEntries = () =>
  normalizeCourseHistoryEntryList(readLocalEntries(COURSE_HISTORY_CACHE_KEY));

const loadPendingEntries = () =>
  normalizeCourseHistoryEntryList(readLocalEntries(COURSE_HISTORY_PENDING_KEY));

const saveCachedEntries = (entries) => {
  const normalized = normalizeCourseHistoryEntryList(entries);
  writeLocalEntries(COURSE_HISTORY_CACHE_KEY, normalized);
  return normalized;
};

const savePendingEntries = (entries) => {
  const normalized = normalizeCourseHistoryEntryList(entries);
  writeLocalEntries(COURSE_HISTORY_PENDING_KEY, normalized);
  return normalized;
};

const clearLegacyKey = () => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(COURSE_HISTORY_LEGACY_KEY);
  } catch {}
};

const migrateLegacyCourseHistory = () => {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(COURSE_HISTORY_LEGACY_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    clearLegacyKey();
    if (!Array.isArray(parsed) || parsed.length === 0) return;
    const legacy = normalizeCourseHistoryEntryList(parsed);
    if (!legacy.length) return;
    const pending = loadPendingEntries();
    const cache = loadCachedEntries();
    const pendingIds = new Set(pending.map((entry) => entry.id));
    const mergedPending = normalizeCourseHistoryEntryList([
      ...legacy.filter((entry) => !pendingIds.has(entry.id)),
      ...pending,
    ]);
    savePendingEntries(mergedPending);
    const cacheIds = new Set(cache.map((entry) => entry.id));
    const mergedCache = normalizeCourseHistoryEntryList([
      ...legacy.filter((entry) => !cacheIds.has(entry.id)),
      ...cache,
    ]);
    saveCachedEntries(mergedCache);
  } catch {
    clearLegacyKey();
  }
};

export const loadCourseHistoryCache = () => {
  migrateLegacyCourseHistory();
  const pending = loadPendingEntries();
  const cached = loadCachedEntries();
  const pendingIds = new Set(pending.map((entry) => entry.id));
  const combined = normalizeCourseHistoryEntryList([
    ...pending,
    ...cached.filter((entry) => entry && !pendingIds.has(entry.id)),
  ]);
  return combined;
};

const buildRemotePayload = (entry) => {
  const payload = {
    password: FIRESTORE_PASSWORD_SENTINEL,
    kind: entry.kind,
    action: entry.action,
    clientId: entry.clientId ?? entry.id,
    createdAt: serverTimestamp(),
  };
  if (entry.kind === 'course') {
    payload.courseId = entry.courseId;
    payload.course = entry.course;
    payload.position = entry.position;
  } else if (entry.kind === 'backup') {
    payload.snapshot = entry.snapshot;
    if (entry.summary) payload.summary = entry.summary;
    if (entry.metadata) payload.metadata = entry.metadata;
    if (entry.label) payload.label = entry.label;
  }
  if (entry.expiresAt != null) {
    payload.expiresAt = entry.expiresAt;
  }
  return payload;
};

export const recordCourseHistoryEntry = async (entry) => {
  const sanitized = sanitizeCourseHistoryEntryData(entry);
  if (!sanitized) return null;
  const clientId = sanitized.clientId ?? sanitized.id;
  try {
    const ref = await addDoc(
      courseHistoryCollectionRef,
      buildRemotePayload({ ...sanitized, clientId })
    );
    const remoteEntry = {
      ...sanitized,
      id: ref.id,
      clientId,
    };
    finalizeCourseHistoryEntryLocal(sanitized.id, remoteEntry);
    return remoteEntry;
  } catch {
    return null;
  }
};

const finalizeCourseHistoryEntryLocal = (pendingId, entry) => {
  const sanitized = sanitizeCourseHistoryEntryData(entry);
  if (!sanitized) return null;
  const clientId = sanitized.clientId ?? sanitized.id;
  const pending = loadPendingEntries().filter((item) => {
    if (!item) return false;
    if (item.id === pendingId) return false;
    if (item.id === sanitized.id) return false;
    const itemClientId = item.clientId ?? item.id;
    return itemClientId !== clientId;
  });
  savePendingEntries(pending);
  const cache = loadCachedEntries().filter((item) => {
    if (!item) return false;
    if (item.id === pendingId) return false;
    if (item.id === sanitized.id) return false;
    const itemClientId = item.clientId ?? item.id;
    return itemClientId !== clientId;
  });
  saveCachedEntries([sanitized, ...cache]);
  return sanitized;
};

export const addCourseHistoryEntryLocal = (entry) => {
  const sanitized = sanitizeCourseHistoryEntryData(entry);
  if (!sanitized) return null;
  const clientId = sanitized.clientId ?? sanitized.id;
  const pending = loadPendingEntries().filter((item) => {
    if (!item) return false;
    if (item.id === sanitized.id) return false;
    const itemClientId = item.clientId ?? item.id;
    return itemClientId !== clientId;
  });
  savePendingEntries([sanitized, ...pending]);
  const cache = loadCachedEntries().filter((item) => {
    if (!item) return false;
    if (item.id === sanitized.id) return false;
    const itemClientId = item.clientId ?? item.id;
    return itemClientId !== clientId;
  });
  saveCachedEntries([sanitized, ...cache]);
  return sanitized;
};

export const removeCourseHistoryEntriesLocal = (ids = []) => {
  const list = Array.isArray(ids) ? ids : [ids];
  const idSet = new Set(list.filter(Boolean));
  if (!idSet.size) return;
  const pending = loadPendingEntries().filter((entry) => !idSet.has(entry.id));
  savePendingEntries(pending);
  const cache = loadCachedEntries().filter((entry) => !idSet.has(entry.id));
  saveCachedEntries(cache);
};

export const clearCourseHistoryLocal = () => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(COURSE_HISTORY_CACHE_KEY);
  } catch {}
  try {
    localStorage.removeItem(COURSE_HISTORY_PENDING_KEY);
  } catch {}
  clearLegacyKey();
};

const syncPendingCourseHistoryEntries = async () => {
  const pending = loadPendingEntries();
  if (!pending.length) return;
  const stillPending = [];
  for (const entry of pending) {
    try {
      const remote = await recordCourseHistoryEntry(entry);
      if (!remote) {
        stillPending.push(entry);
      }
    } catch {
      stillPending.push(entry);
    }
  }
  if (stillPending.length !== pending.length) {
    savePendingEntries(stillPending);
  }
};

const shouldRetryWithoutOrder = (error) => {
  if (!error) return false;
  if (error.code === 'failed-precondition') return true;
  if (typeof error.message === 'string') {
    const msg = error.message.toLowerCase();
    if (msg.includes('index') || msg.includes('requires an index')) return true;
  }
  return false;
};

const readRemoteCourseHistory = async () => {
  const orderedQuery = query(
    courseHistoryCollectionRef,
    where('password', '==', FIRESTORE_PASSWORD_SENTINEL),
    orderBy('createdAt', 'desc'),
    limit(COURSE_HISTORY_FETCH_LIMIT)
  );

  try {
    return await getDocs(orderedQuery);
  } catch (error) {
    if (!shouldRetryWithoutOrder(error)) {
      throw error;
    }
  }

  const fallbackQuery = query(
    courseHistoryCollectionRef,
    where('password', '==', FIRESTORE_PASSWORD_SENTINEL),
    limit(COURSE_HISTORY_FETCH_LIMIT)
  );
  return await getDocs(fallbackQuery);
};

export const loadCourseHistoryEntries = async () => {
  migrateLegacyCourseHistory();
  await syncPendingCourseHistoryEntries();
  const pending = loadPendingEntries();
  const cached = loadCachedEntries();
  const cachedCombined = normalizeCourseHistoryEntryList([
    ...pending,
    ...cached.filter((entry) => entry && !pending.some((p) => p.id === entry.id)),
  ]);

  try {
    const snapshot = await readRemoteCourseHistory();
    const remoteEntries = snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data?.() ?? docSnap.data;
        if (!data || typeof data !== 'object') return null;
        const kind = data.kind === 'backup' ? 'backup' : 'course';
        if (kind === 'course' && (!data.courseId || !data.course)) {
          return null;
        }
        if (kind === 'backup' && !data.snapshot) {
          return null;
        }
        return sanitizeCourseHistoryEntryData({
          ...data,
          kind,
          id: docSnap.id,
          createdAt: data.createdAt,
        });
      })
      .filter(Boolean);
    const normalizedRemote = normalizeCourseHistoryEntryList(remoteEntries);
    const remoteIds = new Set(normalizedRemote.map((entry) => entry.id));
    const remoteClientIds = new Set(
      normalizedRemote
        .map((entry) => entry.clientId)
        .filter((value) => typeof value === 'string' && value)
    );
    const unsyncedPending = pending.filter((entry) => {
      if (!entry) return false;
      if (remoteIds.has(entry.id)) return false;
      const entryClientId = entry.clientId ?? entry.id;
      return !remoteClientIds.has(entryClientId);
    });
    saveCachedEntries(normalizedRemote);
    savePendingEntries(unsyncedPending);
    const combined = normalizeCourseHistoryEntryList([
      ...normalizedRemote,
      ...unsyncedPending,
    ]);
    return combined;
  } catch {
    return cachedCombined;
  }
};

export const deleteCourseHistoryEntry = async (id) => {
  if (!id) return false;
  try {
    await deleteDoc(doc(courseHistoryCollectionRef, id));
    removeCourseHistoryEntriesLocal([id]);
    return true;
  } catch {
    return false;
  }
};

export const clearCourseHistoryEntries = async () => {
  try {
    const snapshot = await getDocs(
      query(
        courseHistoryCollectionRef,
        where('password', '==', FIRESTORE_PASSWORD_SENTINEL)
      )
    );
    if (!snapshot.empty) {
      const docs = snapshot.docs;
      const chunkSize = 400;
      for (let i = 0; i < docs.length; i += chunkSize) {
        const batch = writeBatch(db);
        docs.slice(i, i + chunkSize).forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }
    }
    clearCourseHistoryLocal();
    return true;
  } catch {
    return false;
  }
};

export const courseHistoryInternal = {
  COURSE_HISTORY_CACHE_KEY,
  COURSE_HISTORY_PENDING_KEY,
  COURSE_HISTORY_LEGACY_KEY,
  finalizeCourseHistoryEntryLocal,
  loadCachedEntries,
  loadPendingEntries,
  saveCachedEntries,
  savePendingEntries,
};
