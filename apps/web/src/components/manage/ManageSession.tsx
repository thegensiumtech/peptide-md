'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'pmd_manage_session';

export interface ManageSession {
  email: string;
  /** Bearer token from the code check. Sent on every request. */
  token: string;
  expiresAt: string;
}

/** Why a session ended, so the gate can explain itself rather than just reappear. */
export type SessionEndReason = 'expired' | 'signed-out';

interface ManageSessionValue {
  session: ManageSession | null;
  /** False until sessionStorage has been read, so nothing flashes the wrong view. */
  ready: boolean;
  endedReason: SessionEndReason | null;
  open: (session: ManageSession) => void;
  close: (reason?: SessionEndReason) => void;
}

const ManageSessionContext = createContext<ManageSessionValue | null>(null);

function readStored(): ManageSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ManageSession>;
    if (!parsed.email || !parsed.token || !parsed.expiresAt) return null;

    // Do not restore a token the server would only reject. Checking here means
    // a returning tab shows the code form rather than a flash of failed calls.
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) return null;

    return parsed as ManageSession;
  } catch {
    return null;
  }
}

/**
 * The patient's proof, for the length of a tab.
 *
 * Held in sessionStorage rather than localStorage so a shared or borrowed
 * device forgets it when the tab closes, and it is short-lived at the server
 * end regardless. Nothing here grants access on its own — the token is signed
 * and re-verified on every request.
 */
export function ManageSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ManageSession | null>(null);
  const [ready, setReady] = useState(false);
  const [endedReason, setEndedReason] = useState<SessionEndReason | null>(null);

  useEffect(() => {
    setSession(readStored());
    setReady(true);
  }, []);

  const open = useCallback((next: ManageSession) => {
    setSession(next);
    setEndedReason(null);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Non-fatal: it still works for the life of the page.
    }
  }, []);

  const close = useCallback((reason: SessionEndReason = 'signed-out') => {
    setSession(null);
    setEndedReason(reason);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clear.
    }
  }, []);

  const value = useMemo(
    () => ({ session, ready, endedReason, open, close }),
    [session, ready, endedReason, open, close]
  );

  return <ManageSessionContext.Provider value={value}>{children}</ManageSessionContext.Provider>;
}

export function useManageSession(): ManageSessionValue {
  const context = useContext(ManageSessionContext);
  if (!context) throw new Error('useManageSession must be used inside ManageSessionProvider');
  return context;
}

/**
 * The session, or a throw.
 *
 * Screens behind the gate are only ever rendered with one, so this saves every
 * one of them a null check that could never fire.
 */
export function useRequiredSession(): ManageSession {
  const { session } = useManageSession();
  if (!session) throw new Error('This screen must be rendered inside ManageGate');
  return session;
}
