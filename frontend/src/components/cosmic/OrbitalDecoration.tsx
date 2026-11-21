/** Tasteful orbit rings with small planets — purely decorative. */
export function OrbitalDecoration({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none ${className}`}>
      <div className="relative h-full w-full">
        <div className="absolute inset-0 rounded-full border border-dashed border-lavender-300/60" />
        <div className="absolute inset-[18%] rounded-full border border-dusty-200/70" />
        <div className="absolute inset-0 animate-orbit">
          <span className="absolute left-1/2 -top-2 h-4 w-4 -translate-x-1/2 rounded-full bg-gradient-to-br from-blush-200 to-lavender-300 shadow" />
        </div>
        <div className="absolute inset-[18%] animate-orbit [animation-direction:reverse] [animation-duration:26s]">
          <span className="absolute -left-1.5 top-1/2 h-3 w-3 rounded-full bg-mint-300" />
        </div>
      </div>
    </div>
  );
}

/** Small orbiting-planet loader with honest status text. */
export function CosmicLoader({ label = "Mapping research…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-10 text-sm text-navy-500">
      <span className="relative inline-block h-6 w-6">
        <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500" />
        <span className="absolute inset-0 animate-orbit-fast">
          <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-blush-300" />
        </span>
      </span>
      {label}
    </div>
  );
}
