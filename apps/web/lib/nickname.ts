export const NICKNAME_STORAGE_KEY = "rps:nickname";
export const MAX_NICKNAME_LENGTH = 12;

export function sanitizeNickname(raw: string): string {
  return raw.trim().slice(0, MAX_NICKNAME_LENGTH);
}
