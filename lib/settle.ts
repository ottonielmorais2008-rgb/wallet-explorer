import type { Section } from "./types";

export async function section<T>(p: Promise<T>): Promise<Section<T>> {
  try {
    return { ok: true, data: await p };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unavailable" };
  }
}
