import { Badge } from '@/components/ui/badge';

export function SafetyBanner() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm leading-6 text-foreground">
        Simulated environment. No real-money transactions. The ledger is the only module allowed to
        record a balance change.
      </p>
      <Badge variant="outline" className="border-primary/50 text-primary">
        Simulated only
      </Badge>
    </div>
  );
}
