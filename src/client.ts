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
     * NOTE: it is recommended to use {@link withClient} or {@link getClient} instead, unless you have a specific reason not to.
     *
     * @returns A SupabaseClient wrapped as a successful Effect.
     */
    readonly _get: <D>() => Effect.Effect<SupabaseClient<D>>;
  }
>()("supabase-effect/Client") {}

/**
 * @since 0.1.0
 */
export namespace Client {
  /**
   * Create a SupabaseClient for use of SSR contexts.
   *
   * @example
   * ```typescript
   * Supabase.withClient<YourGeneratedSupabaseDatabaseType>(
   *   (c) => c.from('some-table').select('*')
   * ).pipe(
   *   Effect.provide(Supabase.Client.ssr(
   *     SUPABASE_URL,
   *     SUPABASE_KEY,
   *     {
   *       cookies: {
   *         getAll: () => ...,
   *         setAll: (cookies) => ...
   *       },
   *     }
   *   ))
   * );
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
      _get: <D>() =>
        Effect.succeed(
          createServerClient<D>(
            url,
            key,
            options
          ) as unknown as SupabaseClient<D>
        ),
    });

  /**
   * Create a SupabaseClient for use of browser contexts.
   *
   * @example
   * ```typescript
   * Supabase.withClient<YourGeneratedSupabaseDatabaseType>(
   *   (c) => c.from('some-table').select('*')
   * ).pipe(
   *   Effect.provide(Supabase.Client.browser(
   *     SUPABASE_URL,
   *     SUPABASE_ANON_KEY,
   *   ))
   * );
   * ```
   *
   * @constructor
   * @since 0.1.0
   */
  export const browser = (url: string, anon_key: string) =>
    Layer.succeed(Client, {
      _get: <D>() => Effect.succeed(createClient<D>(url, anon_key)),
    });
}

/**
 * Create an async effect that uses a `SupabaseClient`.
 *
 * @example
 * ```typescript
 * withClient<YourGeneratedSupabaseDatabaseType>()(
 *     (client) => client.from('some-table').select('*')
 * )
 * ```
 *
 * @param f a function that uses `SupabaseClient`
 * @returns an `Effect` that uses the `SupabaseClient`
 * @since 0.1.0
 */
export function withClient<D>(): <A>(
  f: (client: SupabaseClient<D>) => Promise<A>
) => Effect.Effect<A, never, Client> {
  return (f) =>
    Client.use((client) => client._get<D>()).pipe(
      Effect.flatMap((c) => Effect.promise(() => f(c)))
    );
}

/**
 * Get the current `SupabaseClient` in an effect context.
 *
 * @example
 * ```typescript
 * getClient<YourGeneratedSupabaseDatabaseType>().pipe(
 *   Effect.map((client) => client.from('some-table').select('*'))
 * )
 * ```
 *
 * @since 0.1.0
 */
export function getClient<D>(): Effect.Effect<
  SupabaseClient<D>,
  never,
  Client
> {
  return Client.use((client) => client._get<D>());
}
