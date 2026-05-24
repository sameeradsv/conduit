import { getAuthToken, setAuthToken as cortexSet } from "@shared/cortex";

const TOKEN_KEY = "conduit_auth_token";

export function getToken() {
  return getAuthToken(TOKEN_KEY);
}

export function setToken(t: string | null) {
  cortexSet(TOKEN_KEY, t);
}
