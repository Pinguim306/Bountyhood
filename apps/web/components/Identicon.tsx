/**
 * Deterministic gradient avatar for a wallet address. No network, no image —
 * two hues derived from the address hash so the same address always renders the
 * same blob across the app.
 */
export function Identicon({
  address,
  size = 32,
  className = "",
}: {
  address?: string;
  size?: number;
  className?: string;
}) {
  const seed = address ?? "0x0";
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const a = h % 360;
  const b = (a + 60 + ((h >> 8) % 180)) % 360;
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full ring-1 ring-white/10 ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${a} 70% 55%), hsl(${b} 70% 45%))`,
      }}
    />
  );
}
