"use client";

import Link from "next/link";
import { shortAddress } from "@/lib/format";
import { useProfile } from "@/lib/useProfile";
import { Identicon } from "./Identicon";

/**
 * A wallet address rendered as a link to its public profile. Resolves the
 * wallet's display name and avatar client-side (cached); falls back to the
 * identicon + short address until (or unless) a profile exists.
 */
export function AddressLink({
  address,
  withIcon = true,
  iconSize = 20,
  className = "",
}: {
  address?: string;
  withIcon?: boolean;
  iconSize?: number;
  className?: string;
}) {
  const { data: profile } = useProfile(address);
  if (!address) return <span className="text-zinc-500">—</span>;

  return (
    <Link
      href={`/profile/${address}`}
      className={`inline-flex min-w-0 items-center gap-1.5 transition hover:text-lime ${
        profile?.name ? "font-medium" : "font-mono"
      } ${className}`}
    >
      {withIcon &&
        (profile?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt=""
            width={iconSize}
            height={iconSize}
            className="shrink-0 rounded-full object-cover ring-1 ring-white/10"
            style={{ width: iconSize, height: iconSize }}
          />
        ) : (
          <Identicon address={address} size={iconSize} />
        ))}
      <span className="truncate">
        {profile?.name ?? shortAddress(address)}
      </span>
    </Link>
  );
}
