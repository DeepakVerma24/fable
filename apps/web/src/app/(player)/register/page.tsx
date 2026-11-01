import { Suspense } from 'react';
import type { Metadata } from 'next';

import { AuthForm } from '@/components/auth/auth-form';
import { LoadingSkeleton } from '@/components/states';

export const metadata: Metadata = { title: 'Register' };

export default function RegisterPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={2} />}>
      <AuthForm mode="register" />
    </Suspense>
  );
}
