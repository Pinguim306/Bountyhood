"use client";

import { useMemo, useState } from "react";
import { BountyStatus } from "@/lib/contract";
import { CATEGORIES } from "@/lib/types";
import type { Bounty } from "@/lib/types";
import { BountyCard } from "./BountyCard";

type Filter = "all" | "open" | "paid";
type Sort = "newest" | "reward" | "ending";

export function BountyGrid({ bounties }: { bounties: Bounty[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    let rows = bounties;
    if (filter === "open") rows = rows.filter((b) => b.status === BountyStatus.Open);
    if (filter === "paid") rows = rows.filter((b) => b.status === BountyStatus.Paid);
    if (category !== "all") rows = rows.filter((b) => b.category === category);
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q)
      );
    }
    rows = [...rows];
    if (sort === "reward")
      rows.sort((a, b) => Number(BigInt(b.rewardWei) - BigInt(a.rewardWei)));
    if (sort === "ending") rows.sort((a, b) => a.deadline - b.deadline);
    if (sort === "newest") rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows;
  }, [bounties, filter, category, sort, query]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "open", "paid"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
                filter === f
                  ? "bg-lime text-ink-950"
                  : "bg-ink-800 text-zinc-400 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bounties…"
            className="w-44 rounded-lg border border-ink-700 bg-ink-900 px-3 py-1.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-lime/50"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-1.5 text-sm text-zinc-300 outline-none focus:border-lime/50"
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-1.5 text-sm text-zinc-300 outline-none focus:border-lime/50"
          >
            <option value="newest">Newest</option>
            <option value="reward">Highest reward</option>
            <option value="ending">Ending soon</option>
          </select>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-700 py-20 text-center text-zinc-500">
          No bounties match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((b) => (
            <BountyCard key={b.id} bounty={b} />
          ))}
        </div>
      )}
    </div>
  );
}
