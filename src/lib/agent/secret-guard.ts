import { wordlist } from "@scure/bip39/wordlists/english.js";

const WORD_SET = new Set(wordlist);

const HEX_KEY = /(?:^|\s)(?:0x)?[a-fA-F0-9]{64}(?:\s|$)/;
const WIF = /(?:^|\s)[5KL][1-9A-HJ-NP-Za-km-z]{50,51}(?:\s|$)/;

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function looksLikeSecret(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (HEX_KEY.test(trimmed) || WIF.test(trimmed)) return true;

  const words = tokens(trimmed);
  if (words.length >= 11 && words.length <= 26) {
    const bip = words.filter((w) => WORD_SET.has(w));
    if (bip.length >= 11 && bip.length / words.length >= 0.8) return true;
  }

  const allWords = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  if (allWords.length >= 12 && allWords.length <= 24) {
    const bip = allWords.filter((w) => WORD_SET.has(w.toLowerCase()));
    if (bip.length >= 10) return true;
  }
  return false;
}

export const SECRET_BLOCK_MESSAGE =
  "That looks like a recovery phrase or private key. Cove will not send it to the assistant, and it must never be pasted into chat. Use the Secure Phrase Check tab — it runs only on this device.";
