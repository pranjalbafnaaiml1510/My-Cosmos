import { Link } from "react-router-dom";
import { OrbitalDecoration } from "../components/cosmic/OrbitalDecoration";
import { GlassCard } from "../components/ui/primitives";

/** Placeholder for sections scheduled in later build stages. */
export function ComingSoonPage({ title, stage }: { title: string; stage: string }) {
  return (
    <div className="container-cosmos py-20">
      <GlassCard className="relative mx-auto max-w-xl overflow-hidden p-10 text-center">
        <OrbitalDecoration className="mx-auto mb-6 h-24 w-24" />
        <p className="eyebrow">{stage}</p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-3 text-navy-500">This part of the observatory is still being charted.</p>
        <Link to="/" className="mt-6 inline-block rounded-full bg-violet-500 px-5 py-2 text-white hover:bg-violet-600">Back to Explore</Link>
      </GlassCard>
    </div>
  );
}
