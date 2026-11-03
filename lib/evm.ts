import { EXPLORERS, formatUnits } from "./format";
import { fetchJson, rpc } from "./http";
import { section } from "./settle";
import type { ChainResult, Nft, Token, Tx } from "./types";

const CHAINS = {
  ethereum: {
    label: "Ethereum",
    rpcs: ["https://ethereum-rpc.publicnode.com", "https://eth.llamarpc.com"],
    blockscout: "https://eth.blockscout.com",
  },
  base: {
    label: "Base",
    rpcs: ["https://mainnet.base.org", "https://base-rpc.publicnode.com"],
    blockscout: "https://base.blockscout.com",
  },
} as const;

type BsTx = { hash: string; timestamp: string | null; value: string; method: string | null; status: string | null; from: { hash: string }; to: { hash: string } | null };
type BsToken = { value: string; token: { name: string | null; symbol: string | null; decimals: string | null; address_hash?: string; address?: string } };
type RsHolding = { tokenAddress: string; tokenName: string; tokenSymbol: string; tokenDecimals: number; tokenQuantity: string };
type BsNft = { id: string; image_url: string | null; metadata: { name?: string; image?: string } | null; token: { name: string | null; address_hash?: string; address?: string } };

export async function lookupEvm(address: string, chain: keyof typeof CHAINS): Promise<ChainResult> {
  const c = CHAINS[chain];
  const ex = EXPLORERS[chain];
  const lower = address.toLowerCase();

  const balance = section(rpc<string>([...c.rpcs], "eth_getBalance", [address, "latest"]).then((hex) => formatUnits(BigInt(hex), 18)));

  const transactions = section(
    fetchJson<{ items: BsTx[] }>(`${c.blockscout}/api/v2/addresses/${address}/transactions`).then((r) =>
      r.items.slice(0, 10).map<Tx>((t) => {
        const outgoing = t.from.hash.toLowerCase() === lower;
        const value = BigInt(t.value ?? "0") > 0n ? `${formatUnits(t.value, 18, 5)} ETH` : t.method ?? "contract call";
        return {
          hash: t.hash,
          url: ex.tx(t.hash),
          time: t.timestamp,
          summary: `${outgoing ? "Out" : "In"} · ${value}`,
          failed: t.status === "error",
        };
      }),
    ),
  );

  // Ethereum: Routescan's keyless holdings endpoint is much faster than Blockscout for large wallets.
  const routescanTokens = () =>
    fetchJson<{ items: RsHolding[] }>(
      `https://api.routescan.io/v2/network/mainnet/evm/1/address/${address}/erc20-holdings?limit=15`,
    ).then((r) =>
      r.items.map<Token>((t) => ({
        name: t.tokenName,
        symbol: t.tokenSymbol,
        amount: formatUnits(t.tokenQuantity, t.tokenDecimals, 4),
        contract: t.tokenAddress,
        url: ex.address(t.tokenAddress),
      })),
    );
  const blockscoutTokens = () =>
    fetchJson<{ items: BsToken[] }>(`${c.blockscout}/api/v2/addresses/${address}/tokens?type=ERC-20`, {}, 60_000, 12_000).then((r) =>
      r.items.slice(0, 15).map<Token>((t) => {
        const contract = t.token.address_hash ?? t.token.address ?? "";
        return {
          name: t.token.name ?? "Unknown token",
          symbol: t.token.symbol ?? "?",
          amount: formatUnits(t.value, Number(t.token.decimals ?? 0), 4),
          contract,
          url: ex.address(contract),
        };
      }),
    );
  const tokens = section(chain === "ethereum" ? routescanTokens().catch(blockscoutTokens) : blockscoutTokens());

  const nfts = section(
    fetchJson<{ items: BsNft[] }>(`${c.blockscout}/api/v2/addresses/${address}/nft?type=ERC-721,ERC-1155`, {}, 60_000, 15_000).then((r) =>
      r.items.slice(0, 12).map<Nft>((n) => {
        const contract = n.token.address_hash ?? n.token.address ?? "";
        const image = n.image_url ?? n.metadata?.image ?? null;
        return {
          name: n.metadata?.name ?? `${n.token.name ?? "NFT"} #${n.id.slice(0, 10)}`,
          tokenId: n.id,
          image: image && image.startsWith("http") ? image : null,
          contract,
          url: ex.address(contract),
        };
      }),
    ),
  );

  const [b, t, tk, n] = await Promise.all([balance, transactions, tokens, nfts]);
  const blocked = chain === "base" && !t.ok && !tk.ok && !n.ok;
  return {
    chain,
    label: c.label,
    symbol: "ETH",
    addressUrl: ex.address(address),
    balance: b,
    transactions: t,
    tokens: tk,
    nfts: n,
    note: blocked
      ? "Base history, tokens and NFTs come from the public Base Blockscout API, which sometimes refuses requests from cloud servers. Use the explorer link above for the full history."
      : undefined,
  };
}
