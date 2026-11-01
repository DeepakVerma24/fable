'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError, rememberCsrf } from '@/lib/api-client';

const password = z.string().min(10, 'Use at least 10 characters.').max(128);

const loginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password,
});

const registerSchema = loginSchema.extend({
  displayName: z.string().trim().min(1, 'Enter a display name.').max(40),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  if (mode === 'register') return <RegisterForm />;
  return <LoginForm />;
}

function LoginForm() {
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const { submit, formError } = useSubmit('/auth/login');
  return (
    <Shell
      title="Log in"
      footer={
        <Link href="/register" className="underline">
          Need an account?
        </Link>
      }
      error={formError}
      pending={form.formState.isSubmitting}
      onSubmit={form.handleSubmit((values) => submit(values))}
    >
      <Field id="email" label="Email" error={form.formState.errors.email?.message}>
        <Input
          id="email"
          className="h-11"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(form.formState.errors.email)}
          {...form.register('email')}
        />
      </Field>
      <Field id="password" label="Password" error={form.formState.errors.password?.message}>
        <Input
          id="password"
          className="h-11"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(form.formState.errors.password)}
          {...form.register('password')}
        />
      </Field>
    </Shell>
  );
}

function RegisterForm() {
  const form = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });
  const { submit, formError } = useSubmit('/auth/register');
  return (
    <Shell
      title="Create an account"
      footer={
        <Link href="/login" className="underline">
          Already registered?
        </Link>
      }
      error={formError}
      pending={form.formState.isSubmitting}
      onSubmit={form.handleSubmit((values) => submit(values))}
    >
      <Field
        id="display-name"
        label="Display name"
        error={form.formState.errors.displayName?.message}
      >
        <Input
          id="display-name"
          className="h-11"
          autoComplete="nickname"
          aria-invalid={Boolean(form.formState.errors.displayName)}
          {...form.register('displayName')}
        />
      </Field>
      <Field id="email" label="Email" error={form.formState.errors.email?.message}>
        <Input
          id="email"
          className="h-11"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(form.formState.errors.email)}
          {...form.register('email')}
        />
      </Field>
      <Field id="password" label="Password" error={form.formState.errors.password?.message}>
        <Input
          id="password"
          className="h-11"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(form.formState.errors.password)}
          {...form.register('password')}
        />
      </Field>
    </Shell>
  );
}

function useSubmit(path: '/auth/login' | '/auth/register') {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(values: LoginValues | RegisterValues) {
    setFormError(null);
    try {
      const result = await api<{ csrfToken: string }>(path, {
        method: 'POST',
        body: JSON.stringify(values),
      });
      rememberCsrf(result.csrfToken);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      const next = params.get('next');
      router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
      router.refresh();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'The request failed.');
    }
  }

  return { submit, formError };
}

function Shell({
  title,
  children,
  footer,
  error,
  pending,
  onSubmit,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
  error: string | null;
  pending: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sessions use an HttpOnly cookie. A new account receives 1,000.00 FBU demo units. They are
        not withdrawable.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {children}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending ? 'Working' : title}
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">{footer}</p>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
