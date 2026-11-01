'use client';

import { ErrorState } from '@/components/states';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      title="This page hit an error"
      body="The lobby could not finish rendering. Demo data is unchanged."
      onRetry={reset}
    />
  );
}
