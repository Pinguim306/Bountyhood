"use client";

import { shortAddress } from "@/lib/format";
import { useProfile } from "@/lib/useProfile";
import { Identicon } from "./Identicon";

/**
 * Non-link variant of AddressLink: avatar + display name (or short address).
 * For contexts already wrapped in a link, e.g. inside BountyCard.
 */
export function AddressChip({
  address,
  iconSize = 18,
  className = "",
}: {
  address?: string;
  iconSize?: number;
  className?: string;
}) {
  const { data: profile } = useProfile(address);
  if (!address) return <span className="text-zinc-500">—</span>;

  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      {profile?.avatarUrl ? (
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
      )}
      <span className={`truncate ${profile?.name ? "" : "font-mono"}`}>
        {profile?.name ?? shortAddress(address)}
      </span>
    </span>
  );
}
