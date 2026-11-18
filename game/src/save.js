// save.js — localStorage persistence: story progress, cash and settings.
// Auto-saved after every mission and whenever the player banks cash.

import { SAVE_KEY } from './config.js';

export function defaultSave() {
  return { cash: 120, mission: 0, storyDone: false, muted: false, fares: 0, started: false };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    const base = defaultSave();
    for (const k of Object.keys(base)) if (data[k] !== undefined) base[k] = data[k];
    return base;
  } catch (err) {
    return defaultSave();
  }
}

export function storeSave(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (err) {
    // Storage can be unavailable (private mode); the game simply runs unsaved.
  }
}

export function wipeSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* ignore */ }
  return defaultSave();
}
