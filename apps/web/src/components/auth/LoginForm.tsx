'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { SignInState } from '@/lib/auth/actions';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';

const INITIAL: SignInState = { error: null };

export function LoginForm({
  action,
  next,
  submitLabel,
}: {
  action: (prev: SignInState, formData: FormData) => Promise<SignInState>;
  next?: string;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, INITIAL);

  return (
    <form action={formAction} className="grid gap-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.error ? (
        <p
          role="alert"
          className="rounded border border-danger/25 bg-danger-tint px-4 py-3 text-micro leading-relaxed text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <Field label="Email" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field label="Password" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <SubmitButton label={submitLabel} />
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
      {pending ? 'Signing in…' : label}
    </Button>
  );
}
