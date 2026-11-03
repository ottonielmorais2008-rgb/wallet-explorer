/** Formats an integer amount in base units (wei, lamports, token units) with the given decimals. */
export function formatUnits(raw: string | bigint, decimals: number, maxFraction = 6): string {
  const value = typeof raw === "bigint" ? raw : BigInt(raw);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  let fraction = (abs % base).toString().padStart(decimals, "0").slice(0, maxFraction).replace(/0+$/, "");
  if (decimals === 0) fraction = "";
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${wholeStr}${fraction ? `.${fraction}` : ""}`;
}

export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  const prefix = address.startsWith("0x") ? chars + 2 : chars;
  return `${address.slice(0, prefix)}…${address.slice(-chars)}`;
}

export function timeAgo(date: Date, now: Date = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const EXPLORERS = {
  ethereum: { tx: (h: string) => `https://etherscan.io/tx/${h}`, address: (a: string) => `https://etherscan.io/address/${a}` },
  base: { tx: (h: string) => `https://basescan.org/tx/${h}`, address: (a: string) => `https://basescan.org/address/${a}` },
  solana: { tx: (h: string) => `https://solscan.io/tx/${h}`, address: (a: string) => `https://solscan.io/account/${a}` },
} as const;
