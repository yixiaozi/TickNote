export type Session = {
  id: string;
  note: string;
  rounds: number;
  minutes: number;
  device: string;
  startedAt: string | null;
  endedAt: string | null;
  updatedAt: string | null;
  deleted?: boolean;
};

export type AuthUser = {
  id: number;
  username: string;
  displayName?: string;
};

export type AuthState = {
  token: string;
  user: AuthUser;
  apiBase: string;
};
