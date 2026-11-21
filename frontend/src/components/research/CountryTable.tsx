import { Link } from "react-router-dom";
import { slug } from "../../lib/slug";
import type { CountrySummary } from "../../types";
import { Chip } from "../ui/primitives";

/** Country ranking with inline share bars. Horizontally scrollable on small screens. */
export function CountryTable({ countries, total }: { countries: CountrySummary[]; total: number }) {
  const max = Math.max(1, ...countries.map((c) => c.paper_count));
  return (
    <div className="glass overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">Papers by country of author affiliation</caption>
        <thead className="border-b border-lavender-100 text-xs uppercase tracking-wider text-navy-500">
          <tr>
            <th scope="col" className="px-5 py-3 font-semibold">Country</th>
            <th scope="col" className="px-5 py-3 font-semibold">Papers</th>
            <th scope="col" className="px-5 py-3 font-semibold">Share</th>
            <th scope="col" className="px-5 py-3 font-semibold">Top research areas</th>
            <th scope="col" className="px-5 py-3 text-right font-semibold">Orgs</th>
          </tr>
        </thead>
        <tbody>
          {countries.map((c) => (
            <tr key={c.id} className="border-b border-lavender-50 transition-colors last:border-0 hover:bg-lavender-50/60">
              <th scope="row" className="px-5 py-3 font-medium">
                <Link to={`/countries/${c.id}`} className="hover:text-violet-600"><span aria-hidden className="mr-2">{c.flag}</span>{c.name}</Link>
              </th>
              <td className="px-5 py-3 tabular-nums">{c.paper_count.toLocaleString()}</td>
              <td className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-24 rounded-full bg-lavender-100"><span className="block h-full rounded-full bg-dusty-300" style={{ width: `${(c.paper_count / max) * 100}%` }} /></span>
                  <span className="tabular-nums text-navy-500">{((c.paper_count / total) * 100).toFixed(1)}%</span>
                </div>
              </td>
              <td className="px-5 py-3"><div className="flex flex-wrap gap-1">{c.top_topics.map((t) => <Chip key={t} to={`/topics/${slug(t)}`}>{t}</Chip>)}</div></td>
              <td className="px-5 py-3 text-right tabular-nums">{c.organizations}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
