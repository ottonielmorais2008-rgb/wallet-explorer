import { detectChain } from "../../../lib/address";
import { lookupEvm } from "../../../lib/evm";
import { allow } from "../../../lib/ratelimit";
import { lookupSolana } from "../../../lib/solana";
import type { LookupResult } from "../../../lib/types";

export const maxDuration = 30;

export async function GET(req: Request) {
  const address = (new URL(req.url).searchParams.get("address") ?? "").trim();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  if (!allow(ip)) {
    return Response.json({ error: "Too many lookups. Please wait a minute." }, { status: 429 });
  }

  const kind = detectChain(address);
  if (!kind) {
    return Response.json(
      { error: "Not a valid address. Paste an EVM address (0x… 40 hex characters) or a Solana address (base58)." },
      { status: 400 },
    );
  }

  const chains =
    kind === "evm"
      ? await Promise.all([lookupEvm(address, "ethereum"), lookupEvm(address, "base")])
      : [await lookupSolana(address)];

  const body: LookupResult = { address, kind, chains };
  return Response.json(body, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
}
