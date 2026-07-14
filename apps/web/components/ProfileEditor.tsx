"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useAuth } from "@/lib/useAuth";
import type { Profile } from "@/lib/types";

/**
 * "Edit profile" flow, shown only to the profile's owner. First save requires
 * a one-time wallet signature (SIWE) proving ownership — free, no transaction.
 */
export function ProfileEditor({
  address,
  initial,
}: {
  address: string;
  initial: Profile | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { address: connected } = useAccount();
  const { isSignedIn, signIn } = useAuth();

  const isOwner = connected?.toLowerCase() === address.toLowerCase();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatarUrl ?? "");
  const [xHandle, setXHandle] = useState(initial?.xHandle ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOwner) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-ink-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-lime/50 hover:text-lime"
      >
        {initial ? "Edit profile" : "Set up your profile"}
      </button>
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (!isSignedIn) await signIn(); // one-time wallet signature
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, bio, avatarUrl, xHandle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      await queryClient.invalidateQueries({
        queryKey: ["profile", address.toLowerCase()],
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="w-full max-w-lg rounded-2xl border border-ink-800 bg-ink-900/60 p-5"
    >
      <div className="text-sm font-semibold text-white">Your profile</div>
      {!isSignedIn && (
        <p className="mt-1 text-xs text-zinc-500">
          Saving asks your wallet for one free signature to prove ownership —
          no transaction, no gas.
        </p>
      )}

      <label className="mt-4 block text-xs text-zinc-500">Display name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. arrow_hunter"
        maxLength={32}
        className="mt-1 w-full rounded-xl border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-lime/50"
      />

      <label className="mt-3 block text-xs text-zinc-500">Bio</label>
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        rows={2}
        maxLength={280}
        placeholder="What do you hunt? What do you build?"
        className="mt-1 w-full resize-y rounded-xl border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-lime/50"
      />

      <label className="mt-3 block text-xs text-zinc-500">
        Avatar URL (https)
      </label>
      <input
        value={avatarUrl}
        onChange={(e) => setAvatarUrl(e.target.value)}
        placeholder="https://…/you.png"
        className="mt-1 w-full rounded-xl border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-lime/50"
      />

      <label className="mt-3 block text-xs text-zinc-500">X handle</label>
      <input
        value={xHandle}
        onChange={(e) => setXHandle(e.target.value)}
        placeholder="@you"
        maxLength={16}
        className="mt-1 w-full rounded-xl border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-lime/50"
      />

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-lime px-5 py-2 text-sm font-semibold text-ink-950 transition hover:bg-lime-bright disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save profile"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-zinc-500 hover:text-zinc-300"
        >
          Cancel
        </button>
      </div>
      {error && (
        <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </form>
  );
}
