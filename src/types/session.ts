export interface SessionParticipant {
  name: string;
  role: 'presenter' | 'viewer';
  sessionName?: string; // Only set by presenter in presence track payload
}

export interface SessionInfo {
  code: string;
  name: string;
  participantName: string;
  role: 'presenter' | 'viewer';
}

// Keys used in sessionStorage to persist session info across page navigation
export const SESSION_STORAGE_KEYS = {
  CODE: 'sms_session_code',
  NAME: 'sms_session_name',
  PARTICIPANT_NAME: 'sms_participant_name',
  ROLE: 'sms_session_role',
} as const;
