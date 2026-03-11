import * as ServiceMap from "effect/ServiceMap";
import type {
  Session,
  User as SupabaseUser,
  WeakPassword,
} from "@supabase/supabase-js";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { AuthError } from "./auth-error";
import { Client } from "./client";

/**
 * Authentication service for Supabase.
 *
 * @since 0.1.0
 */
export class Auth extends ServiceMap.Service<
  Auth,
  {
    /**
     * Gets the current user associated with the Supabase client.
     *
     * Gets the current user details if there is an existing session.
     * This method performs a network request to the Supabase Auth server,
     * so the returned value is authentic and can be used to base authorization rules on.
     */
    readonly getUser: () => Effect.Effect<SupabaseUser, AuthError>;

    /**
     * Log in an existing user with an email and password or phone and password.
     *
     * Be aware that you may get back an error message that will not distinguish between
     * the cases where the account does not exist or that the email/phone and password combination
     * is wrong or that the account can only be accessed via social login.
     */
    readonly signInWithPassword: ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => Effect.Effect<
      {
        user: SupabaseUser;
        session: Session;
        weakPassword?: WeakPassword;
      },
      AuthError
    >;
  }
>()("effect-supabase/Auth") {}

export namespace Auth {
  /**
   * create a default layer for `Auth`.
   *
   * @example
   * ```typescript
   * const program = SomeAuthEffect.pipe(
   *   Effect.provide(Auth.make(Client.ssr(...)))
   * )
   * ```
   *
   * @constructor
   * @since 0.1.0
   */
  export const make = Layer.effect(
    Auth,
    Effect.gen(function* () {
      const c = yield* Client;
      const client = yield* c._get();

      const getUser = () =>
        Effect.promise(() => client.auth.getUser()).pipe(
          Effect.flatMap((res) =>
            res.error
              ? Effect.fail(new AuthError(res.error))
              : Effect.succeed(res.data.user)
          )
        );

      const signInWithPassword = ({
        email,
        password,
      }: {
        email: string;
        password: string;
      }) =>
        Effect.promise(() =>
          client.auth.signInWithPassword({ email, password })
        ).pipe(
          Effect.flatMap((res) =>
            res.error
              ? Effect.fail(new AuthError(res.error))
              : Effect.succeed(res.data)
          )
        );

      return {
        getUser,
        signInWithPassword,
      };
    })
  );
}
