import { ActivityFeed } from "@/components/ActivityFeed";
import { activityFeed } from "@/lib/reputation";
import { getAllSubmissions, getBounties } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const [bounties, submissions] = await Promise.all([
    getBounties(),
    getAllSubmissions(),
  ]);
  const events = activityFeed(bounties, submissions, 60);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight text-white">Activity</h1>
      <p className="mt-2 text-zinc-400">
        Every bounty posted, submitted to, won, and reclaimed — newest first.
      </p>
      <div className="mt-8">
        <ActivityFeed events={events} />
      </div>
    </div>
  );
}
