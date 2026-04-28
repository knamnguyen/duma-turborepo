// Per-device pin/save preferences stored in localStorage

const PINNED_KEY = "buildstuffs:pinned";
const SAVED_KEY = "buildstuffs:saved";

function getSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSet(key: string, set: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

export function getPinnedPosts() {
  return getSet(PINNED_KEY);
}

export function togglePinPost(postId: string) {
  const set = getSet(PINNED_KEY);
  if (set.has(postId)) set.delete(postId);
  else set.add(postId);
  saveSet(PINNED_KEY, set);
  return set;
}

export function getSavedPosts() {
  return getSet(SAVED_KEY);
}

export function toggleSavePost(postId: string) {
  const set = getSet(SAVED_KEY);
  if (set.has(postId)) set.delete(postId);
  else set.add(postId);
  saveSet(SAVED_KEY, set);
  return set;
}
