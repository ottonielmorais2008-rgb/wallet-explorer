import { test } from "node:test";
import assert from "node:assert/strict";
import { base58Decode, detectChain, isSolanaAddress } from "../lib/address";
import { formatUnits, shortenAddress, timeAgo } from "../lib/format";
import { allow } from "../lib/ratelimit";

test("detects EVM addresses", () => {
  assert.equal(detectChain("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"), "evm");
  assert.equal(detectChain("  0xd8da6bf26964af9d7eed9e03e53415d37aa96045 "), "evm");
  assert.equal(detectChain("0x1234"), null);
  assert.equal(detectChain("0xZZdA6BF26964aF9D7eEd9e03E53415D37aA96045"), null);
});

test("detects Solana addresses", () => {
  assert.equal(detectChain("vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg"), "solana");
  assert.equal(detectChain("11111111111111111111111111111111"), "solana"); // System Program
  assert.equal(isSolanaAddress("vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKP0g"), false); // '0' is not base58
  assert.equal(isSolanaAddress("abc"), false);
  assert.equal(detectChain("hello world"), null);
});

test("base58 decoding", () => {
  assert.deepEqual(base58Decode("1"), Uint8Array.from([0]));
  assert.deepEqual(base58Decode("2g"), Uint8Array.from([97])); // "a"
  assert.equal(base58Decode("0OIl"), null);
});

test("formats units", () => {
  assert.equal(formatUnits("1000000000000000000", 18), "1");
  assert.equal(formatUnits("1234567890000000000000", 18), "1,234.56789");
  assert.equal(formatUnits(1500000000n, 9), "1.5");
  assert.equal(formatUnits("123456789", 6, 2), "123.45");
  assert.equal(formatUnits("0", 18), "0");
  assert.equal(formatUnits("7", 0), "7");
});

test("shortens addresses and formats time", () => {
  assert.equal(shortenAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"), "0xd8dA…6045");
  assert.equal(shortenAddress("vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg"), "vine…KPTg");
  const now = new Date("2026-01-01T12:00:00Z");
  assert.equal(timeAgo(new Date("2026-01-01T11:59:30Z"), now), "30s ago");
  assert.equal(timeAgo(new Date("2026-01-01T09:00:00Z"), now), "3h ago");
  assert.equal(timeAgo(new Date("2025-12-29T12:00:00Z"), now), "3d ago");
});

test("rate limiter blocks after the limit", () => {
  const t = 1_000_000;
  for (let i = 0; i < 3; i++) assert.equal(allow("ip-test", 3, 60_000, t + i), true);
  assert.equal(allow("ip-test", 3, 60_000, t + 10), false);
  assert.equal(allow("ip-test", 3, 60_000, t + 61_000), true);
});
