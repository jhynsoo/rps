export const NICKNAME_STORAGE_KEY = "rps:nickname";
export const MAX_NICKNAME_LENGTH = 12;

export function sanitizeNickname(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/\p{Cf}/gu, "")
    .replace(/\p{Cc}+/gu, " ")
    .replace(/[^\p{L}\p{N} _.-]+/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_NICKNAME_LENGTH);
}
