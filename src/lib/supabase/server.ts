import "server-only";

import {
  createClient,
  type SupabaseClient,
  type WebSocketLikeConstructor,
} from "@supabase/supabase-js";
import WebSocket from "ws";

import { getServerEnvironment } from "@/lib/env/server";
import type { Database } from "@/lib/supabase/database.types";

export type SupabaseServerClient = SupabaseClient<Database>;

let supabaseServerClient: SupabaseServerClient | undefined;
const nodeWebSocketTransport = WebSocket as unknown as WebSocketLikeConstructor;

const secretKeyFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  // New sb_secret keys authenticate through `apikey`; unlike legacy JWT keys,
  // they must not be forwarded as an Authorization bearer token.
  headers.delete("authorization");
  return fetch(input, { ...init, headers });
};

export function getSupabaseServerClient(): SupabaseServerClient {
  if (supabaseServerClient) {
    return supabaseServerClient;
  }

  const environment = getServerEnvironment();

  supabaseServerClient = createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SECRET_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      realtime: {
        // `ws` adds server-only overloads to the compatible client constructor.
        transport: nodeWebSocketTransport,
      },
      global: {
        fetch: secretKeyFetch,
      },
    },
  );

  return supabaseServerClient;
}
