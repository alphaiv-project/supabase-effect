import type {
  Provider,
  ResendParams,
  Session,
  SignInAnonymouslyCredentials,
  SignInWithOAuthCredentials,
  SignInWithPasswordCredentials,
  SignUpWithPasswordCredentials,
  AuthError as SupabaseAuthError,
  User as SupabaseUser,
  UserAttributes,
  UserIdentity,
  VerifyOtpParams,
  WeakPassword,
} from "@supabase/supabase-js";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as ServiceMap from "effect/ServiceMap";
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
    readonly signInWithPassword: (
      credentials: SignInWithPasswordCredentials
    ) => Effect.Effect<
      {
        user: SupabaseUser;
        session: Session;
        weakPassword: Option.Option<WeakPassword>;
      },
      AuthError
    >;

    /**
     * Creates a new anonymous user.
     *
     * @returns — A session where the is_anonymous claim in the access token JWT set to true
     */
    readonly signInAnonymously: (
      credentials?: SignInAnonymouslyCredentials
    ) => Effect.Effect<
      {
        user: Option.Option<SupabaseUser>;
        session: Option.Option<Session>;
      },
      AuthError
    >;

    /**
     * Inside a browser context, signOut() will remove the logged in user from the browser session and log them out
     * - removing all items from localstorage and then trigger a "SIGNED_OUT" event.
     *
     * For server-side management, you can revoke all refresh tokens for a user by passing a user’s JWT through to auth.api.signOut(JWT: string).
     * There is no way to revoke a user’s access token jwt until it expires. It is recommended to set a shorter expiry on the jwt for this reason.
     * If using others scope, no SIGNED_OUT event is fired!
     */
    readonly signOut: () => Effect.Effect<void, AuthError>;

    /**
     * Creates a new user.
     * Be aware that if a user account exists in the system you may get back an error message that attempts to hide this information from the user. This method has support for PKCE via email signups. The PKCE flow cannot be used when autoconfirm is enabled.
     *
     * @returns — A logged-in session if the server has “autoconfirm” ON
     * @returns — A user if the server has “autoconfirm” OFF
     */
    readonly signUp: (
      credentials: SignUpWithPasswordCredentials
    ) => Effect.Effect<
      {
        user: Option.Option<SupabaseUser>;
        session: Option.Option<Session>;
      },
      AuthError
    >;

    /**
     * Sends a reauthentication OTP to the user’s email or phone number. Requires the user to be signed-in.
     */
    readonly reauthenticate: () => Effect.Effect<
      {
        user: Option.Option<SupabaseUser>;
        session: Option.Option<Session>;
      },
      AuthError
    >;

    /**
     * Updates user data for a logged in user.
     */
    readonly updateUser: (
      attributes: UserAttributes,
      options?: {
        emailRedirectTo?: string | undefined;
      }
    ) => Effect.Effect<SupabaseUser, AuthError>;

    /**
     * Resends an existing signup confirmation email, email change email, SMS OTP or phone change OTP.
     */
    readonly resend: (
      credentials: ResendParams
    ) => Effect.Effect<void, AuthError>;

    /**
     * Sends a password reset request to an email address. This method supports the PKCE flow.
     *
     * @param email — The email address of the user.
     * @param options.redirectTo — The URL to send the user to after they click the password reset link.
     * @param options.captchaToken — Verification token received when the user completes the captcha on the site.
     */
    readonly resetPasswordForEmail: (
      email: string,
      options?: {
        redirectTo?: string;
        captchaToken?: string;
      }
    ) => Effect.Effect<void, AuthError>;
    /**
     * Log in an existing user via a third-party provider. This method supports the PKCE flow.
     */
    readonly signInWithOAuth: (
      credentials: SignInWithOAuthCredentials
    ) => Effect.Effect<
      {
        provider: Provider;
        url: string;
      },
      AuthError
    >;
    /**
     * Log in an existing user by exchanging an Auth Code issued during the PKCE flow.
     */
    readonly exchangeCodeForSession: (code: string) => Effect.Effect<
      {
        user: SupabaseUser;
        session: Session;
      },
      AuthError
    >;

    /** Gets all the identities linked to a user. */
    readonly getUserIdentities: () => Effect.Effect<UserIdentity[], AuthError>;

    /**
     * Log in a user given a User supplied OTP or TokenHash received through mobile or email.
     */
    readonly verifyOtp: (credentials: VerifyOtpParams) => Effect.Effect<
      {
        user: Option.Option<SupabaseUser>;
        session: Option.Option<Session>;
      },
      AuthError,
      never
    >;
  }
>()("effect-supabase/Auth") {}

export namespace Auth {
  /**
   * @internal
   */
  const flatMapAuthResponse = <T>(
    authResponse: Effect.Effect<
      | {
          data: T;
          error: null;
        }
      | {
          data: unknown;
          error: SupabaseAuthError;
        }
    >
  ): Effect.Effect<T, AuthError> =>
    Effect.flatMap(authResponse, (res) =>
      res.error
        ? Effect.fail(new AuthError(res.error))
        : Effect.succeed(res.data)
    );

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
          flatMapAuthResponse,
          Effect.map(({ user }) => user)
        );

      const signInWithPassword = (credentials: SignInWithPasswordCredentials) =>
        Effect.promise(() => client.auth.signInWithPassword(credentials)).pipe(
          flatMapAuthResponse,
          Effect.map(({ weakPassword, ...rest }) => ({
            weakPassword: Option.fromUndefinedOr(weakPassword),
            ...rest,
          }))
        );

      const signInAnonymously = (credentials?: SignInAnonymouslyCredentials) =>
        Effect.promise(() => client.auth.signInAnonymously(credentials)).pipe(
          flatMapAuthResponse,
          Effect.map(({ user, session }) => ({
            user: Option.fromNullOr(user),
            session: Option.fromNullOr(session),
          }))
        );

      const signOut = () =>
        Effect.promise(() => client.auth.signOut()).pipe(
          Effect.flatMap(({ error }) =>
            error !== null ? Effect.fail(new AuthError(error)) : Effect.void
          )
        );

      const signUp = (credentials: SignUpWithPasswordCredentials) =>
        Effect.promise(() => client.auth.signUp(credentials)).pipe(
          flatMapAuthResponse,
          Effect.map(({ user, session }) => ({
            user: Option.fromNullOr(user),
            session: Option.fromNullOr(session),
          }))
        );

      const reauthenticate = () =>
        Effect.promise(() => client.auth.reauthenticate()).pipe(
          flatMapAuthResponse,
          Effect.map(({ user, session }) => ({
            user: Option.fromNullOr(user),
            session: Option.fromNullOr(session),
          }))
        );

      const updateUser = (
        attributes: UserAttributes,
        options?: {
          emailRedirectTo?: string | undefined;
        }
      ) =>
        Effect.promise(() => client.auth.updateUser(attributes, options)).pipe(
          flatMapAuthResponse,
          Effect.map(({ user }) => user)
        );

      const resetPasswordForEmail = (
        email: string,
        options?: {
          redirectTo?: string;
          captchaToken?: string;
        }
      ) =>
        Effect.promise(() =>
          client.auth.resetPasswordForEmail(email, options)
        ).pipe(flatMapAuthResponse, Effect.asVoid);

      const resend = (credentials: ResendParams) =>
        Effect.promise(() => client.auth.resend(credentials)).pipe(
          flatMapAuthResponse,
          Effect.asVoid
        );

      const signInWithOAuth = (credentials: SignInWithOAuthCredentials) =>
        Effect.promise(() => client.auth.signInWithOAuth(credentials)).pipe(
          flatMapAuthResponse
        );

      const exchangeCodeForSession = (code: string) =>
        Effect.promise(() => client.auth.exchangeCodeForSession(code)).pipe(
          flatMapAuthResponse
        );

      const getUserIdentities = () =>
        Effect.promise(() => client.auth.getUserIdentities()).pipe(
          flatMapAuthResponse,
          Effect.map((res) => res?.identities ?? [])
        );

      const verifyOtp = (credentials: VerifyOtpParams) =>
        Effect.promise(() => client.auth.verifyOtp(credentials)).pipe(
          flatMapAuthResponse,
          Effect.map(({ user, session }) => ({
            user: Option.fromNullOr(user),
            session: Option.fromNullOr(session),
          }))
        );

      return {
        exchangeCodeForSession,
        getUser,
        getUserIdentities,
        reauthenticate,
        resend,
        resetPasswordForEmail,
        signInAnonymously,
        signInWithOAuth,
        signInWithPassword,
        signOut,
        signUp,
        updateUser,
        verifyOtp,
      };
    })
  );
}
