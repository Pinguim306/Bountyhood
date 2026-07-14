"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount } from "wagmi";
import { isContractConfigured } from "@/lib/contract";
import { CATEGORIES } from "@/lib/types";

function defaultDeadline(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  // yyyy-MM-ddThh:mm for datetime-local
  return d.toISOString().slice(0, 16);
}

export default function CreatePage() {
  const router = useRouter();
  const { address } = useAccount();
  const [form, setForm] = useState({
    title: "",
    description: "",
    deliverables: "",
    category: CATEGORIES[0] as string,
    rewardEth: "0.1",
    deadline: defaultDeadline(),
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const deadlineSec = Math.floor(new Date(form.deadline).getTime() / 1000);
      const res = await fetch("/api/bounties", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          creator: address,
          deadline: deadlineSec,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create bounty");
      router.push(`/bounty/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-black tracking-tight text-white">
        Create a bounty
      </h1>
      <p className="mt-2 text-zinc-400">
        Describe the task and lock a reward. Funds are held in escrow until you
        approve a submission — or reclaim them after the deadline.
      </p>

      {!isContractConfigured && (
        <div className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          Preview mode: this creates a local demo bounty. Once the escrow
          contract is deployed, publishing will escrow real ETH on Robinhood
          Chain.
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <Field label="Title">
          <input
            required
            value={form.title}
            onChange={update("title")}
            placeholder="e.g. Build a Robinhood Chain price widget"
            className="input"
          />
        </Field>

        <Field label="Description">
          <textarea
            required
            value={form.description}
            onChange={update("description")}
            rows={4}
            placeholder="What needs to be done and why."
            className="input resize-y"
          />
        </Field>

        <Field label="Deliverables & acceptance criteria">
          <textarea
            value={form.deliverables}
            onChange={update("deliverables")}
            rows={3}
            placeholder="Exactly what a hunter must submit for you to approve."
            className="input resize-y"
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field label="Category">
            <select
              value={form.category}
              onChange={update("category")}
              className="input"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reward (ETH)">
            <input
              required
              type="number"
              min="0"
              step="0.001"
              value={form.rewardEth}
              onChange={update("rewardEth")}
              className="input font-mono"
            />
          </Field>
          <Field label="Deadline">
            <input
              required
              type="datetime-local"
              value={form.deadline}
              onChange={update("deadline")}
              className="input"
            />
          </Field>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-lime px-6 py-3 font-semibold text-ink-950 transition hover:bg-lime-bright disabled:opacity-60"
          >
            {submitting ? "Publishing…" : "Publish & escrow reward"}
          </button>
          <span className="text-xs text-zinc-500">
            The reward locks at publish and can’t be withdrawn while open. By
            publishing you agree to the{" "}
            <a
              href="/terms"
              className="text-zinc-400 underline underline-offset-2"
            >
              terms & content policy
            </a>
            .
          </span>
        </div>
      </form>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #232631;
          background: #0d0e12;
          padding: 0.65rem 0.85rem;
          font-size: 0.9rem;
          color: #fff;
          outline: none;
        }
        .input::placeholder {
          color: #52525b;
        }
        .input:focus {
          border-color: rgba(184, 255, 47, 0.5);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-300">
        {label}
      </span>
      {children}
    </label>
  );
}
