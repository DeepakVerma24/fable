'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/states';
import { TransactionTable } from '@/components/transaction-table';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import type { Page, WalletTransaction } from '@/lib/types';

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const transactions = useQuery({
    queryKey: ['transactions', page],
    queryFn: () => api<Page<WalletTransaction>>(`/wallet/transactions?page=${page}&pageSize=10`),
  });

  if (transactions.isLoading) return <LoadingSkeleton />;
  if (transactions.isError || !transactions.data) {
    return (
      <ErrorState
        body="Transactions could not be read."
        onRetry={() => void transactions.refetch()}
      />
    );
  }

  const data = transactions.data;

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[11px] font-medium tracking-[0.16em] text-faint uppercase">Ledger</p>
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each row is a posted journal. Amounts are the change in available demo units. Times are
          India Standard Time.
        </p>
      </header>
      {data.items.length === 0 ? (
        <EmptyState title="No journals yet" body="Registering creates the opening demo balance." />
      ) : (
        <TransactionTable rows={data.items} />
      )}
      <div className="flex items-center gap-2 text-sm">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={page <= 1}
          onClick={() => setPage((value) => value - 1)}
        >
          Previous
        </Button>
        <span>
          Page {data.page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}
        </span>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={page * data.pageSize >= data.total}
          onClick={() => setPage((value) => value + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
