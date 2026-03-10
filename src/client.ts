import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import * as Effect from "effect/Effect";
import * as ServiceMap from "effect/ServiceMap";
import * as Layer from "effect/Layer";

/**
 * A supabase client service.
 *
 * @since 0.1.0
 */
export class Client extends ServiceMap.Service<
  Client,
  {
    /**
     * @returns A SupabaseClient wrapped as a successful Effect.
     */
    readonly get: <D>() => Effect.Effect<SupabaseClient<D>>;
  }
>()("effect-supabase/Client") {}

/**
 * @since 0.1.0
 */
export namespace Client {
  /**
   * Create a SupabaseClient for use of SSR contexts.
   *
   * @example
   * ```typescript
   * Effect.gen(function* () {
   *     const clientService = yield* Supabase.Client.ssr(SUPABASE_URL, SUPABASE_KEY, { cookies });
   *     const c = yield* clientService.get<YourGeneratedSupabaseDatabaseType>();
   * })
   * ```
   *
   * @constructor
   * @since 0.1.0
   */
  export const ssr = (
    url: string,
    key: string,
    options: {
      cookies: {
        getAll: () => Array<{ name: string; value: string }>;
        setAll: (cookies: Array<{ name: string; value: string }>) => void;
      };
    }
  ) =>
    Layer.succeed(Client, {
      get: <D>() => Effect.succeed(createServerClient<D>(url, key, options)),
    });

  /**
   * Create a SupabaseClient for use of browser contexts.
   *
   * @example
   * ```typescript
   * Effect.gen(function* () {
   *     const clientService = yield* Supabase.Client.browser(SUPABASE_URL, SUPABASE_ANON_KEY);
   *     const c = yield* clientService.get<YourGeneratedSupabaseDatabaseType>();
   * })
   * ```
   *
   * @constructor
   * @since 0.1.0
   */
  export const browser = (url: string, anon_key: string) =>
    Layer.succeed(Client, {
      get: <D>() => Effect.succeed(createClient<D>(url, anon_key)),
    });
}
