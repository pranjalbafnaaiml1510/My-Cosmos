/** URL id for a label. Must match backend/app/corpus.py:slug. */
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
