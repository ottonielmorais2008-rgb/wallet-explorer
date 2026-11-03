import { EXPLORERS, formatUnits } from "./format";
import { rpc } from "./http";
import { section } from "./settle";
import type { ChainResult, Nft, Token, Tx } from "./types";

const RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];
const TOKEN_PROGRAMS = ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"];

type Sig = { signature: string; blockTime: number | null; err: unknown; memo: string | null };
type TokenAccount = { account: { data: { parsed: { info: { mint: string; tokenAmount: { amount: string; decimals: number } } } } } };

export async function lookupSolana(address: string): Promise<ChainResult> {
  const ex = EXPLORERS.solana;
  const balance = section(rpc<{ value: number }>(RPCS, "getBalance", [address]).then((r) => formatUnits(BigInt(r.value), 9)));

  const transactions = section(
    rpc<Sig[]>(RPCS, "getSignaturesForAddress", [address, { limit: 10 }]).then((sigs) =>
      sigs.map<Tx>((s) => ({
        hash: s.signature,
        url: ex.tx(s.signature),
        time: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null,
        summary: s.memo ? `Memo: ${s.memo.slice(0, 40)}` : "Transaction",
        failed: s.err != null,
      })),
    ),
  );

  // SPL Token + Token-2022 accounts. Accounts with 0 decimals and amount 1 are likely NFTs
  // (no keyless source for NFT metadata, so only the mint address is shown).
  const accounts = Promise.all(
    TOKEN_PROGRAMS.map((programId) =>
      rpc<{ value: TokenAccount[] }>(RPCS, "getTokenAccountsByOwner", [address, { programId }, { encoding: "jsonParsed" }]),
    ),
  ).then((rs) => rs.flatMap((r) => r.value.map((a) => a.account.data.parsed.info)).filter((i) => i.tokenAmount.amount !== "0"));

  const tokens = section(
    accounts.then((list) =>
      list
        .filter((i) => !(i.tokenAmount.decimals === 0 && i.tokenAmount.amount === "1"))
        .slice(0, 15)
        .map<Token>((i) => ({
          name: "SPL token",
          symbol: i.mint.slice(0, 4),
          amount: formatUnits(i.tokenAmount.amount, i.tokenAmount.decimals, 4),
          contract: i.mint,
          url: ex.address(i.mint),
        })),
    ),
  );

  const nfts = section(
    accounts.then((list) =>
      list
        .filter((i) => i.tokenAmount.decimals === 0 && i.tokenAmount.amount === "1")
        .slice(0, 12)
        .map<Nft>((i) => ({ name: "Possible NFT", tokenId: i.mint, image: null, contract: i.mint, url: ex.address(i.mint) })),
    ),
  );

  return {
    chain: "solana",
    label: "Solana",
    symbol: "SOL",
    addressUrl: ex.address(address),
    balance: await balance,
    transactions: await transactions,
    tokens: await tokens,
    nfts: await nfts,
    note: "Token names and NFT metadata need a paid indexer, so mint addresses are shown instead.",
  };
}
