'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { DropdownMenu } from 'radix-ui';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import type { PublicPlayer } from '@/lib/types';

export function UserMenu({ player }: { player: PublicPlayer | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState(false);

  if (!player) {
    return (
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" className="h-11">
          <Link href="/login">Log in</Link>
        </Button>
        <Button asChild className="h-11">
          <Link href="/register">Register</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="inline-flex h-11 items-center rounded-md border border-border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {player.displayName}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-50 min-w-44 rounded-md border border-border bg-popover p-1 text-sm shadow-lg"
            align="end"
            sideOffset={6}
          >
            <MenuLink href="/profile">Profile</MenuLink>
            <MenuLink href="/wallet">Wallet</MenuLink>
            <MenuLink href="/settings">Settings</MenuLink>
            <DropdownMenu.Item
              className="cursor-pointer rounded px-2 py-2 outline-none focus:bg-accent"
              onSelect={() => setConfirm(true)}
            >
              Log out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ConfirmDialog
        open={confirm}
        title="Log out?"
        body="This ends the session on this browser. Demo units stay on the ledger."
        confirmLabel="Log out"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          void api('/auth/logout', { method: 'POST' }).finally(async () => {
            setConfirm(false);
            await queryClient.invalidateQueries({ queryKey: ['me'] });
            router.push('/');
            router.refresh();
          });
        }}
      />
    </>
  );
}

function MenuLink({ href, children }: { href: string; children: string }) {
  return (
    <DropdownMenu.Item asChild>
      <Link href={href} className="block rounded px-2 py-2 outline-none focus:bg-accent">
        {children}
      </Link>
    </DropdownMenu.Item>
  );
}
