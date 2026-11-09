/** Original decorative artwork; all game names and controls remain HTML. */
export function PreviewMark({ seed, label }: { seed: string; label: string }) {
  if (['paper-dice', 'fable-mines', 'fable-plinko', 'fable-limbo'].includes(seed)) {
    const symbols: Record<string, string> = {
      'paper-dice': '⚄',
      'fable-mines': '◇',
      'fable-plinko': '⠿',
      'fable-limbo': '↗',
    };
    return (
      <div
        className="game-art original-art"
        role={label ? 'img' : undefined}
        aria-label={label || undefined}
        aria-hidden={!label}
      >
        <span>{symbols[seed]}</span>
        <small>FABLE ORIGINALS</small>
      </div>
    );
  }
  const panel = seed.includes('roulette')
    ? 2
    : seed.includes('table')
      ? 1
      : seed.includes('northline')
        ? 0
        : 3;
  return (
    <div
      className="game-art"
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={!label}
      style={{
        backgroundImage: "url('/art/fable-casino-art.png')",
        backgroundSize: '400% 100%',
        backgroundPosition: `${(panel * 100) / 3}% center`,
      }}
    />
  );
}
