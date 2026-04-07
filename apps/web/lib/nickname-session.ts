import { NICKNAME_STORAGE_KEY, sanitizeNickname } from "@/lib/nickname";

export type StoredNicknameResolution = {
  nickname: string | null;
  shouldClear: boolean;
  shouldRedirectHome: boolean;
};

export function resolveStoredNickname(raw: string | null | undefined): StoredNicknameResolution {
  const nickname = sanitizeNickname(raw ?? "");
  const hasNickname = nickname.length > 0;

  return {
    nickname: hasNickname ? nickname : null,
    shouldClear: Boolean(raw) && !hasNickname,
    shouldRedirectHome: !hasNickname,
  };
}

export function readStoredNicknameResolution(): StoredNicknameResolution {
  return resolveStoredNickname(window.localStorage.getItem(NICKNAME_STORAGE_KEY));
}
