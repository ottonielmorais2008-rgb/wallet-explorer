export type ChainKind = "evm" | "solana";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Decodes a base58 string to bytes, or returns null if it has invalid characters. */
export function base58Decode(input: string): Uint8Array | null {
  let value = 0n;
  for (const ch of input) {
    const digit = BASE58.indexOf(ch);
    if (digit < 0) return null;
    value = value * 58n + BigInt(digit);
  }
  const bytes: number[] = [];
  while (value > 0n) {
    bytes.unshift(Number(value % 256n));
    value /= 256n;
  }
  for (const ch of input) {
    if (ch !== "1") break;
    bytes.unshift(0); // leading '1's are leading zero bytes
  }
  return Uint8Array.from(bytes);
}

export function isEvmAddress(input: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(input);
}

/** A Solana public key is 32 bytes encoded in base58 (32-44 characters). */
export function isSolanaAddress(input: string): boolean {
  if (input.length < 32 || input.length > 44) return false;
  return base58Decode(input)?.length === 32;
}

export function detectChain(raw: string): ChainKind | null {
  const input = raw.trim();
  if (isEvmAddress(input)) return "evm";
  if (isSolanaAddress(input)) return "solana";
  return null;
}
