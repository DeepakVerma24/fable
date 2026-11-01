export function PreviewMark({ seed, label }: { seed: string; label: string }) {
  const bits = hash(seed);
  return (
    <div className="relative aspect-[16/9] overflow-hidden bg-[#101318]" aria-hidden>
      <div className="absolute inset-0 grid grid-cols-6 grid-rows-3 gap-1 p-3">
        {Array.from({ length: 18 }, (_, index) => {
          const on = ((bits >> (index % 24)) & 1) === 1;
          return (
            <span
              key={index}
              className="rounded-[2px]"
              style={{ background: on ? '#F7F8FA' : '#2B3038' }}
            />
          );
        })}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

function hash(seed: string): number {
  let value = 2166136261;
  for (const char of seed) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}
