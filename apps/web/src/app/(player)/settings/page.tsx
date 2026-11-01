'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/components/shell/use-session';
import { ErrorState, LoadingSkeleton } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api-client';

export default function SettingsPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const [name, setName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (session.isLoading) return <LoadingSkeleton rows={2} />;
  if (!session.data?.player) return <ErrorState body="Sign in to change account settings." />;

  const displayName = name ?? session.data.player.displayName;

  return (
    <div className="max-w-md space-y-4">
      <header>
        <p className="text-[11px] font-medium tracking-[0.16em] text-faint uppercase">Account</p>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setMessage(null);
          void api('/auth/profile', {
            method: 'PATCH',
            body: JSON.stringify({ displayName: displayName.trim() }),
          })
            .then(async () => {
              await queryClient.invalidateQueries({ queryKey: ['me'] });
              setMessage('Display name saved.');
            })
            .catch((reason: unknown) => {
              setError(reason instanceof ApiError ? reason.message : 'Could not save.');
            });
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="display-name">Display name</Label>
          <Input
            id="display-name"
            className="h-11"
            value={displayName}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <p className="text-xs text-faint">
          Email stays {session.data.player.email}. Password changes are not offered in this phase.
        </p>
        {message ? (
          <p role="status" className="text-sm text-success">
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="h-11">
          Save
        </Button>
      </form>
    </div>
  );
}
