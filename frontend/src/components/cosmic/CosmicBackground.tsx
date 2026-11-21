import { useMemo } from "react";

/** Fixed, decorative backdrop: soft nebula gradients + a light star field. */
export function CosmicBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 -left-32 h-[36rem] w-[36rem] rounded-full bg-lavender-200/50 blur-3xl" />
      <div className="absolute top-1/3 -right-40 h-[32rem] w-[32rem] rounded-full bg-blush-100/70 blur-3xl" />
      <div className="absolute bottom-0 left-1/4 h-[28rem] w-[28rem] rounded-full bg-mint-100/60 blur-3xl" />
      <StarField count={70} />
    </div>
  );
}

export function StarField({ count = 50 }: { count?: number }) {
  const stars = useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      x: (i * 73.13) % 100, y: (i * 41.71) % 100, s: (i % 3) + 1, d: (i % 7) * 0.6,
    })),
    [count],
  );
  return (
    <div className="absolute inset-0">
      {stars.map((st, i) => (
        <span key={i} className="absolute rounded-full bg-violet-500/40 animate-twinkle"
          style={{ left: `${st.x}%`, top: `${st.y}%`, width: st.s, height: st.s, animationDelay: `${st.d}s` }} />
      ))}
    </div>
  );
}
