export type Section<T> = { ok: true; data: T } | { ok: false; error: string };

export type Tx = { hash: string; url: string; time: string | null; summary: string; failed: boolean };
export type Token = { name: string; symbol: string; amount: string; contract: string; url: string };
export type Nft = { name: string; tokenId: string; image: string | null; contract: string; url: string };

export type ChainResult = {
  chain: "ethereum" | "base" | "solana";
  label: string;
  symbol: string;
  addressUrl: string;
  balance: Section<string>;
  transactions: Section<Tx[]>;
  tokens: Section<Token[]>;
  nfts: Section<Nft[]>;
  note?: string;
};

export type LookupResult = { address: string; kind: "evm" | "solana"; chains: ChainResult[] };
