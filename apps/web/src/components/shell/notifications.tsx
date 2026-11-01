'use client';

import { Bell } from 'lucide-react';
import { Popover } from 'radix-ui';

const notices = [
  {
    id: 'mode',
    title: 'Demo mode',
    body: 'Balances are Fable demo units. They cannot be withdrawn or deposited.',
  },
  {
    id: 'odds',
    title: 'Fixture prices',
    body: 'Sports prices are written into the API. They are not a live feed.',
  },
  {
    id: 'games',
    title: 'Previews only',
    body: 'Casino tiles are original artwork. They do not launch a provider game.',
  },
];

export function Notifications() {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-md border border-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label="Notifications"
        >
          <Bell className="size-4" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-80 rounded-md border border-border bg-popover p-3 text-sm shadow-lg"
          align="end"
          sideOffset={8}
        >
          <p className="text-[11px] font-medium tracking-[0.16em] text-faint uppercase">Notices</p>
          <ul className="mt-2 space-y-3">
            {notices.map((notice) => (
              <li key={notice.id}>
                <p className="font-medium">{notice.title}</p>
                <p className="text-muted-foreground">{notice.body}</p>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
