'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiBase, fetchHealth, fetchModules } from '@/lib/api';
import { useOperatorNote } from '@/lib/note-store';
import { operatorNoteSchema } from '@/lib/operator-note';

import { SafetyBanner } from './safety-banner';

export function FoundationConsole() {
  const note = useOperatorNote((state) => state.note);
  const setNote = useOperatorNote((state) => state.setNote);
  const clear = useOperatorNote((state) => state.clear);
  const form = useForm({
    resolver: zodResolver(operatorNoteSchema),
    defaultValues: { note: '' },
  });

  const health = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
  });
  const modules = useQuery({
    queryKey: ['modules'],
    queryFn: fetchModules,
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.22em] text-primary uppercase">Platform foundation</p>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="font-heading text-5xl tracking-tight sm:text-6xl"
            >
              FABLE
            </motion.h1>
          </div>
          <Badge variant="secondary">Dev shell</Badge>
        </div>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          This is the shell for the modular monolith. Identity, the ledger, casino, sportsbook, and
          provider adapters are separated here. Games, markets, and payments are not part of this
          build.
        </p>
        <SafetyBanner />
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>API health</CardTitle>
            <CardDescription>
              Liveness from {apiBase}/health. Postgres and Redis are optional for this probe.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {health.isPending ? (
              <p className="text-sm text-muted-foreground">Checking the API…</p>
            ) : null}
            {health.isError ? (
              <p className="text-sm text-destructive" role="alert">
                The API is not reachable. Start it with pnpm --filter @fable/api dev.{' '}
                {health.error.message}
              </p>
            ) : null}
            {health.data ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="font-medium text-primary">{health.data.status}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Real money</dt>
                  <dd className="font-medium">{health.data.realMoney ? 'enabled' : 'disabled'}</dd>
                </div>
              </dl>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operator note</CardTitle>
            <CardDescription>
              Kept in this browser session with Zustand. It never reaches the ledger.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-3"
              onSubmit={form.handleSubmit((values) => {
                setNote(values.note);
                form.reset({ note: '' });
              })}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="operator-note">Note</Label>
                <Textarea
                  id="operator-note"
                  placeholder="What should the next person remember about this environment?"
                  aria-invalid={Boolean(form.formState.errors.note)}
                  {...form.register('note')}
                />
                {form.formState.errors.note ? (
                  <p className="text-sm text-destructive" role="alert">
                    {form.formState.errors.note.message}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button type="submit">Save note</Button>
                <Button type="button" variant="outline" onClick={clear}>
                  Clear
                </Button>
              </div>
            </form>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              {note ? note : 'No note saved in this browser session.'}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-2xl">Module boundaries</h2>
        {modules.isPending ? (
          <p className="text-sm text-muted-foreground">Loading module boundaries…</p>
        ) : null}
        {modules.isError ? (
          <p className="text-sm text-destructive" role="alert">
            The module map is unavailable until the API responds. Casino and sportsbook still cannot
            change balances; only the ledger can.
          </p>
        ) : null}
        {modules.data ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {modules.data.map((mod) => (
              <li key={mod.name}>
                <Card size="sm">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="capitalize">{mod.name}</CardTitle>
                      <Badge variant={mod.mutatesBalances ? 'default' : 'outline'}>
                        {mod.mutatesBalances ? 'Writes journals' : 'No balance writes'}
                      </Badge>
                    </div>
                    <CardDescription>{mod.role}</CardDescription>
                  </CardHeader>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
