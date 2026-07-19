import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityFeed } from "@/components/ActivityFeed";
import { BountyCard } from "@/components/BountyCard";
import { Identicon } from "@/components/Identicon";
import { ProfileEditor } from "@/components/ProfileEditor";
import { StatTile } from "@/components/StatTile";
import { formatReward, shortAddress } from "@/lib/format";
import {
  activityFeed,
  bountiesBy,
  bountiesWonBy,
  profileStats,
} from "@/lib/reputation";
import { getAllSubmissions, getBounties, getProfile } from "@/lib/store";

export const dynamic = "force-dynamic";

const isAddress = (a: string) => /^0x[a-fA-F0-9]{40}$/.test(a);

export default async function ProfilePage({
  params,
}: {
  params: { address: string };
}) {
  const address = decodeURIComponent(params.address);
  if (!isAddress(address)) notFound();

  const [bounties, submissions, profile] = await Promise.all([
    getBounties(),
    getAllSubmissions(),
    getProfile(address),
  ]);

  const stats = profileStats(address, bounties, submissions);
  const created = bountiesBy(address, bounties);
  const won = bountiesWonBy(address, bounties);
  const feed = activityFeed(
    bounties,
    submissions.filter((s) => s.hunter.toLowerCase() === address.toLowerCase()),
    20
  ).filter((e) => e.actor.toLowerCase() === address.toLowerCase());

  const hasActivity = created.length > 0 || stats.submissions > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/leaderboard"
        className="text-sm text-zinc-500 transition hover:text-zinc-300"
      >
        ← Leaderboard
      </Link>

      {/* Identity */}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {profile?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt=""
            width={64}
            height={64}
            className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-white/10"
          />
        ) : (
          <Identicon address={address} size={64} />
        )}
        <div className="min-w-0 flex-1">
          <h1
            className={`truncate text-2xl font-bold text-white ${
              profile?.name ? "" : "font-mono"
            }`}
          >
            {profile?.name ?? shortAddress(address)}
          </h1>
          <div className="mt-1 truncate font-mono text-xs text-zinc-600">
            {address}
          </div>
          {stats.disputesLost > 0 && (
            <span
              title="Disputes where the arbiter ruled the hunter had delivered and this creator withheld payment"
              className="mt-2 inline-block rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-300"
            >
              ⚠ {stats.disputesLost} dispute
              {stats.disputesLost === 1 ? "" : "s"} lost as creator
            </span>
          )}
          {profile?.bio && (
            <p className="mt-2 max-w-xl text-sm text-zinc-400">{profile.bio}</p>
          )}
          {profile?.xHandle && (
            <a
              href={`https://x.com/${profile.xHandle}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs text-zinc-500 transition hover:text-lime"
            >
              𝕏 @{profile.xHandle}
            </a>
          )}
        </div>
        <ProfileEditor address={address} initial={profile ?? null} />
      </div>

      {!hasActivity && (
        <p className="mt-6 rounded-2xl border border-ink-800 bg-ink-900/60 p-6 text-sm text-zinc-500">
          No on-chain activity for this address yet.
        </p>
      )}

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Bounties won" value={String(stats.wins)} accent />
        <StatTile label="Total earned" value={formatReward(stats.earned)} accent />
        <StatTile label="Submissions" value={String(stats.submissions)} />
        <StatTile label="Bounties posted" value={String(stats.created)} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Open now" value={String(stats.createdOpen)} />
        <StatTile label="In escrow" value={formatReward(stats.escrowed)} />
        <StatTile label="Paid to hunters" value={formatReward(stats.paidOut)} />
        <StatTile
          label="Win rate"
          value={
            stats.submissions > 0
              ? `${Math.round((stats.wins / stats.submissions) * 100)}%`
              : "—"
          }
        />
      </div>

      {/* Won bounties */}
      {won.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-lg font-bold text-white">Bounties won</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {won.map((b) => (
              <BountyCard key={b.id} bounty={b} />
            ))}
          </div>
        </section>
      )}

      {/* Created bounties */}
      {created.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-lg font-bold text-white">
            Posted by this address
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {created.map((b) => (
              <BountyCard key={b.id} bounty={b} />
            ))}
          </div>
        </section>
      )}

      {/* Personal activity */}
      {feed.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-2 text-lg font-bold text-white">Recent activity</h2>
          <ActivityFeed events={feed} />
        </section>
      )}
    </div>
  );
}
