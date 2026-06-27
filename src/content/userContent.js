// User (homebrew) content persistence in IndexedDB.
//
// Homebrew lives in IndexedDB (db "dnd-content", store "userContent"), one record
// per content type: { type, files: [{ name, addedAt, items: [...] }] }. It's merged
// after SRD at load time, so a user id overrides the matching SRD id.

// Content types a user can extend, with display labels (for the homebrew UI).
export const CONTENT_TYPES = [
  ["races", "Races"],
  ["classes", "Classes"],
  ["skills", "Skills"],
  ["feats", "Feats"],
  ["weapons", "Weapons"],
  ["spells", "Spells"],
  ["invocations", "Invocations"],
  ["patrons", "Patrons"],
  ["pacts", "Pacts"],
];

const IDB_NAME = "dnd-content";
const IDB_STORE = "userContent";

function idbOpen() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { keyPath: "type" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const idbReq = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

// All user files for one type ([] when none, or IndexedDB is unavailable).
export async function getUserFiles(type) {
  try {
    const db = await idbOpen();
    const rec = await idbReq(db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(type));
    db.close();
    return rec && Array.isArray(rec.files) ? rec.files : [];
  } catch (e) {
    return [];
  }
}

// Add or replace (by name) one user file under a type. Read and write use separate
// transactions so we never touch a transaction that has gone inactive across an await.
export async function putUserFile(type, name, items) {
  const files = (await getUserFiles(type)).filter((f) => f.name !== name);
  files.push({ name, addedAt: Date.now(), items });
  const db = await idbOpen();
  await idbReq(db.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE).put({ type, files }));
  db.close();
}

// Remove one user file (by name) from a type.
export async function deleteUserFile(type, name) {
  const files = (await getUserFiles(type)).filter((f) => f.name !== name);
  const db = await idbOpen();
  await idbReq(db.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE).put({ type, files }));
  db.close();
}

// Basic schema check: a non-empty array of objects, each with a string id + name.
export function validateUserContent(parsed) {
  if (!Array.isArray(parsed)) return { ok: false, error: "Expected a JSON array of entries." };
  if (parsed.length === 0) return { ok: false, error: "That array is empty." };
  for (const item of parsed) {
    if (!item || typeof item !== "object" || Array.isArray(item))
      return { ok: false, error: "Every entry must be an object." };
    if (typeof item.id !== "string" || !item.id.trim())
      return { ok: false, error: 'Every entry needs a non-empty "id".' };
    if (typeof item.name !== "string" || !item.name.trim())
      return { ok: false, error: 'Every entry needs a non-empty "name".' };
  }
  return { ok: true, count: parsed.length };
}
