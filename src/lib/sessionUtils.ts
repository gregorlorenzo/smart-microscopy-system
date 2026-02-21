import { SessionInfo, SESSION_STORAGE_KEYS } from '@/types/session';

// Generate a 6-character uppercase alphanumeric code (e.g. "VAD0WT")
export function generateSessionCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

// Persist session info to sessionStorage (survives page navigation within same tab)
export function saveSessionInfo(info: SessionInfo): void {
  sessionStorage.setItem(SESSION_STORAGE_KEYS.CODE, info.code);
  sessionStorage.setItem(SESSION_STORAGE_KEYS.NAME, info.name);
  sessionStorage.setItem(SESSION_STORAGE_KEYS.PARTICIPANT_NAME, info.participantName);
  sessionStorage.setItem(SESSION_STORAGE_KEYS.ROLE, info.role);
}

// Read session info from sessionStorage
export function loadSessionInfo(): SessionInfo | null {
  const code = sessionStorage.getItem(SESSION_STORAGE_KEYS.CODE);
  const name = sessionStorage.getItem(SESSION_STORAGE_KEYS.NAME);
  const participantName = sessionStorage.getItem(SESSION_STORAGE_KEYS.PARTICIPANT_NAME);
  const role = sessionStorage.getItem(SESSION_STORAGE_KEYS.ROLE) as 'presenter' | 'viewer' | null;

  if (!code || !participantName || !role) return null;

  return {
    code,
    name: name || code, // Fall back to code if name not set yet
    participantName,
    role,
  };
}

export function clearSessionInfo(): void {
  Object.values(SESSION_STORAGE_KEYS).forEach(key => sessionStorage.removeItem(key));
}

// Build the join URL for sharing (e.g. https://example.com/session/VAD0WT)
export function buildJoinUrl(code: string): string {
  return `${window.location.origin}/session/${code}`;
}
