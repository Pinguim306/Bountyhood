import Link from "next/link";
import { shortAddress } from "@/lib/format";
import { Identicon } from "./Identicon";

/** A wallet address rendered as a link to its public profile. */
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
  if (!address) return <span className="text-zinc-500">—</span>;
  return (
    <Link
      href={`/profile/${address}`}
      className={`inline-flex items-center gap-1.5 font-mono transition hover:text-lime ${className}`}
    >
      {withIcon && <Identicon address={address} size={iconSize} />}
      {shortAddress(address)}
    </Link>
  );
}
