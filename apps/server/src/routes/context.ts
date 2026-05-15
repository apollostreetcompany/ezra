import type { InMemorySyncStore } from "../services/sync.js";

export interface ServerRouteContext {
  store: InMemorySyncStore;
  tokenPepper: string;
  now: () => string;
}
