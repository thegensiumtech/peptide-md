'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface BookingSlot {
  startsAt: string;
  endsAt: string;
}

export interface BookingState {
  /** The booking record on the server, created when checkout starts. */
  bookingId: string | null;
  /**
   * Mirrors the server's payment state. Only ever set from an API response, * either the Stripe webhook has landed, or the server has asked Stripe
   * directly about the returning session. The browser never decides this.
   */
  paid: boolean;
  paymentReference: string | null;
  slot: BookingSlot | null;
  /** Proof this patient owns the held time. Required to confirm it. */
  holdToken: string | null;
  holdExpiresAt: string | null;
  /** The zone the patient picked their time in; every time is shown in it. */
  timezone: string;
  intakeComplete: boolean;
  bookingReference: string | null;
  patientName: string | null;
  /** Shown on confirmation so a typo is visible before the email is missed. */
  patientEmail: string | null;
  /**
   * ISO 3166 alpha-2 from the Stripe billing address, or null. Seeds the
   * default time zone on the slot screen and the phone dialling code on intake,
   * both of which the patient can still change.
   */
  patientCountry: string | null;
  doctorName: string | null;
}

const EMPTY: BookingState = {
  bookingId: null,
  paid: false,
  paymentReference: null,
  slot: null,
  holdToken: null,
  holdExpiresAt: null,
  timezone: 'Europe/London',
  intakeComplete: false,
  bookingReference: null,
  patientName: null,
  patientEmail: null,
  patientCountry: null,
  doctorName: null,
};

const STORAGE_KEY = 'pmd_booking';

interface BookingContextValue {
  state: BookingState;
  /** False until sessionStorage has been read, so guards do not fire early. */
  ready: boolean;
  update: (patch: Partial<BookingState>) => void;
  reset: () => void;
}

const BookingContext = createContext<BookingContextValue | null>(null);

/**
 * Booking flow state.
 *
 * Held in sessionStorage so a refresh mid-flow does not lose a paid booking,
 * and cleared when the flow completes. In production this state lives on the
 * booking record itself, the Stripe webhook is the only thing that can set
 * `paid`, exactly as the scope requires.
 */
export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BookingState>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...EMPTY, ...(JSON.parse(raw) as Partial<BookingState>) });
    } catch {
      // A malformed or unavailable store just means starting the flow again.
    }
    setReady(true);
  }, []);

  const update = useCallback((patch: Partial<BookingState>) => {
    setState((previous) => {
      const next = { ...previous, ...patch };
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Non-fatal: the flow still works for the life of the page.
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setState(EMPTY);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clear.
    }
  }, []);

  const value = useMemo(() => ({ state, ready, update, reset }), [state, ready, update, reset]);
  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking(): BookingContextValue {
  const context = useContext(BookingContext);
  if (!context) throw new Error('useBooking must be used inside BookingProvider');
  return context;
}

export const BOOKING_STEPS = [
  { id: 'details', label: 'Consult', href: '/book' },
  { id: 'payment', label: 'Pay', href: '/book/payment' },
  { id: 'slot', label: 'Time', href: '/book/slot' },
  { id: 'intake', label: 'Intake', href: '/book/intake' },
  { id: 'confirmed', label: 'Done', href: '/book/confirmed' },
] as const;

export type BookingStepId = (typeof BOOKING_STEPS)[number]['id'];

/**
 * The earliest step the patient is allowed to be on given what they have
 * completed. Deep-linking further ahead sends them here instead of rendering
 * a screen that cannot work.
 */
export function earliestIncompleteStep(state: BookingState): BookingStepId {
  if (!state.paid) return 'payment';
  if (!state.slot) return 'slot';
  if (!state.intakeComplete) return 'intake';
  return 'confirmed';
}

export function stepHref(id: BookingStepId): string {
  return BOOKING_STEPS.find((s) => s.id === id)!.href;
}
