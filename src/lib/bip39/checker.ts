import { validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

const WORD_SET = new Set(wordlist);
const MAX_LEN = Math.max(...wordlist.map((w) => w.length));

export type WordStatus = "ok" | "unknown" | "empty";

export type PhraseReport = {
  raw: string;
  words: Array<{ index: number; word: string; status: WordStatus }>;
  count: number;
  expectedCounts: number[];
  countOk: boolean;
  unknown: string[];
  concatenated: Array<{ blob: string; parts: string[] }>;
  checksumOk: boolean | null;
  notes: string[];
};

function normalize(input: string): string {
  return input.trim().toLowerCase().replace(/[,;|/]+/g, " ").replace(/\s+/g, " ");
}

function segment(blob: string): string[] | null {
  const s = blob.toLowerCase();
  const n = s.length;
  const dp: Array<string[] | null> = Array.from({ length: n + 1 }, () => null);
  dp[0] = [];
  for (let i = 0; i < n; i++) {
    if (!dp[i]) continue;
    for (let len = 3; len <= MAX_LEN && i + len <= n; len++) {
      const piece = s.slice(i, i + len);
      if (WORD_SET.has(piece)) {
        const next = i + len;
        if (!dp[next] || dp[i]!.length + 1 < dp[next]!.length) {
          dp[next] = [...dp[i]!, piece];
        }
      }
    }
  }
  return dp[n];
}

export function inspectPhrase(input: string): PhraseReport {
  const raw = input;
  const notes: string[] = [];
  const normalized = normalize(input);
  const split = normalized ? normalized.split(" ") : [];
  const concatenated: Array<{ blob: string; parts: string[] }> = [];

  const expanded: string[] = [];
  for (const token of split) {
    if (WORD_SET.has(token)) {
      expanded.push(token);
      continue;
    }
    if (token.length > 8) {
      const parts = segment(token);
      if (parts && parts.length >= 2) {
        concatenated.push({ blob: token, parts });
        expanded.push(...parts);
        notes.push(`Split concatenated token “${token}” into ${parts.join(" + ")}.`);
        continue;
      }
    }
    expanded.push(token);
  }

  const words = expanded.map((word, index) => ({
    index: index + 1,
    word,
    status: (!word ? "empty" : WORD_SET.has(word) ? "ok" : "unknown") as WordStatus,
  }));

  const unknown = words.filter((w) => w.status === "unknown").map((w) => w.word);
  const expectedCounts = [12, 15, 18, 21, 24];
  const count = words.length;
  const countOk = expectedCounts.includes(count);

  let checksumOk: boolean | null = null;
  if (countOk && unknown.length === 0) {
    checksumOk = validateMnemonic(words.map((w) => w.word).join(" "), wordlist);
  } else {
    checksumOk = null;
    if (!countOk && count > 0) {
      notes.push("BIP-39 phrases are 12, 15, 18, 21, or 24 words. This tool will not guess missing words.");
    }
    if (unknown.length) {
      notes.push("One or more words are not in the English BIP-39 list. They are flagged below — nothing was transmitted.");
    }
  }

  if (checksumOk === false) {
    notes.push("Words are in the list, but the checksum is invalid. The phrase is not a valid BIP-39 mnemonic. This tool does not brute-force corrections.");
  }
  if (checksumOk === true) {
    notes.push("Checksum is valid for the English BIP-39 word list. Keep this phrase offline. Cove never stores it.");
  }

  return {
    raw,
    words,
    count,
    expectedCounts,
    countOk,
    unknown,
    concatenated,
    checksumOk,
    notes,
  };
}
