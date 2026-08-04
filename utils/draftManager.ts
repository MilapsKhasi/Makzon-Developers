// Draft Manager for form persistence across sessions and tab reopens

const DRAFT_PREFIX = 'zp_form_draft_';

export interface FormDraft {
  data: any;
  timestamp: number;
}

export function saveDraft(key: string, data: any): void {
  try {
    if (!key || !data) return;
    const storageKey = DRAFT_PREFIX + key;
    const draft: FormDraft = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(storageKey, JSON.stringify(draft));
  } catch (err) {
    console.warn('Failed to save form draft:', err);
  }
}

export function getDraft(key: string): any | null {
  try {
    if (!key) return null;
    const storageKey = DRAFT_PREFIX + key;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed: FormDraft = JSON.parse(raw);
    if (parsed && parsed.data) {
      return parsed.data;
    }
  } catch (err) {
    console.warn('Failed to parse form draft:', err);
  }
  return null;
}

export function clearDraft(key: string): void {
  try {
    if (!key) return;
    const storageKey = DRAFT_PREFIX + key;
    localStorage.removeItem(storageKey);
  } catch (err) {
    console.warn('Failed to clear form draft:', err);
  }
}

export function hasDraft(key: string): boolean {
  return getDraft(key) !== null;
}
