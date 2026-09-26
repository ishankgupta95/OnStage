"use client";

import { getBackend } from "./backend";
import { useQuery } from "./useQuery";

/** The signed-in account, or null. Backed by whatever `getBackend()` returns. */
export const useSession = () => useQuery("session", () => getBackend().getSession());
