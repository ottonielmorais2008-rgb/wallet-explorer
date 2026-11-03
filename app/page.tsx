"use client";

import { useState } from "react";
import { detectChain } from "../lib/address";
import { shortenAddress, timeAgo } from "../lib/format";
import type { ChainResult, LookupResult, Section } from "../lib/types";

const EXAMPLES = [
  { label: "vitalik.eth (EVM)", address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
  { label: "Solana docs example wallet", address: "vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg" },
  { label: "Active Solana wallet", address: "86xCnPeV69n6t3DnyGvkKobf9FdN2H9oiVDdaMpo2MMY" },
];

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);
  const kind = detectChain(input);

  async function lookup(address: string) {
    setInput(address);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/lookup?address=${encodeURIComponent(address.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lookup failed.");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Wallet Explorer</h1>
      <p className="mt-2 text-slate-400">
        Paste any public address. The chain is detected automatically: EVM addresses are looked up on Ethereum and
        Base, base58 addresses on Solana. Read-only: no wallet connection, no signing.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookup(input);
        }}
        className="mt-6 flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="0x… or Solana address"
          spellCheck={false}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm focus:border-indigo-400 focus:outline-none"
        />
        <button
          disabled={loading || !kind}
          className="rounded-lg bg-indigo-500 px-5 py-2 font-medium hover:bg-indigo-400 disabled:opacity-40"
        >
          {loading ? "Loading…" : "Explore"}
        </button>
      </form>
      <p className="mt-1 h-5 text-xs text-slate-500">
        {input && (kind ? `Detected: ${kind === "evm" ? "EVM (Ethereum + Base)" : "Solana"}` : "Not a valid EVM or Solana address")}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.address}
            onClick={() => lookup(ex.address)}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-indigo-400"
          >
            {ex.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-6 rounded-lg bg-rose-950 p-3 text-rose-300">{error}</p>}
      {result && (
        <div className="mt-8 flex flex-col gap-6">
          {result.chains.map((c) => (
            <ChainCard key={c.chain} c={c} />
          ))}
        </div>
      )}

      <footer className="mt-12 text-center text-xs text-slate-500">
        Data from free public RPCs and Blockscout. Not financial advice.{" "}
        <a className="underline" href="https://github.com/ottonielmorais2008-rgb/wallet-explorer">Source code</a>
      </footer>
    </main>
  );
}

function Unavailable({ s }: { s: Section<unknown> }) {
  return !s.ok ? <p className="text-sm text-amber-400">Unavailable right now ({s.error}).</p> : null;
}

function ChainCard({ c }: { c: ChainResult }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">{c.label}</h2>
        <a href={c.addressUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-300 underline">
          View on explorer
        </a>
      </div>
      <div className="mt-2">
        {c.balance.ok ? (
          <p className="text-3xl font-bold">
            {c.balance.data} <span className="text-lg text-slate-400">{c.symbol}</span>
          </p>
        ) : (
          <Unavailable s={c.balance} />
        )}
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="mb-2 font-medium text-slate-300">Recent transactions</h3>
          <Unavailable s={c.transactions} />
          {c.transactions.ok && c.transactions.data.length === 0 && <p className="text-sm text-slate-500">None found.</p>}
          {c.transactions.ok && (
            <ul className="flex flex-col gap-1 text-sm">
              {c.transactions.data.map((t) => (
                <li key={t.hash} className="flex justify-between gap-2">
                  <a href={t.url} target="_blank" rel="noreferrer" className="font-mono text-indigo-300 underline">
                    {shortenAddress(t.hash, 6)}
                  </a>
                  <span className={t.failed ? "text-rose-400" : "text-slate-400"}>
                    {t.failed ? "failed · " : ""}
                    {t.summary}
                    {t.time ? ` · ${timeAgo(new Date(t.time))}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-2 font-medium text-slate-300">Tokens</h3>
          <Unavailable s={c.tokens} />
          {c.tokens.ok && c.tokens.data.length === 0 && <p className="text-sm text-slate-500">None found.</p>}
          {c.tokens.ok && (
            <ul className="flex flex-col gap-1 text-sm">
              {c.tokens.data.map((t) => (
                <li key={t.contract} className="flex justify-between gap-2">
                  <a href={t.url} target="_blank" rel="noreferrer" className="truncate underline decoration-slate-600">
                    {t.name === "SPL token" ? shortenAddress(t.contract) : `${t.name} (${t.symbol})`}
                  </a>
                  <span className="font-mono text-slate-400">{t.amount}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <h3 className="mb-2 mt-5 font-medium text-slate-300">NFTs</h3>
      <Unavailable s={c.nfts} />
      {c.nfts.ok && c.nfts.data.length === 0 && <p className="text-sm text-slate-500">None found.</p>}
      {c.nfts.ok && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {c.nfts.data.map((n) => (
            <a key={`${n.contract}-${n.tokenId}`} href={n.url} target="_blank" rel="noreferrer" className="text-xs">
              {n.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={n.image} alt={n.name} loading="lazy" className="aspect-square w-full rounded-md bg-slate-800 object-cover" />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-md bg-slate-800 text-slate-500">
                  {shortenAddress(n.contract, 3)}
                </div>
              )}
              <p className="mt-1 truncate text-slate-400">{n.name}</p>
            </a>
          ))}
        </div>
      )}
      {c.note && <p className="mt-4 text-xs text-slate-500">{c.note}</p>}
    </section>
  );
}
