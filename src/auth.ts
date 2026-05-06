import {
  isAuthError,
  type AuthChangeEvent,
  type AuthError as SupabaseAuthError,
  type AuthMFAChallengePhoneResponse,
  type AuthMFAChallengeTOTPResponse,
  type AuthMFAChallengeWebauthnResponse,
  type AuthMFAEnrollPhoneResponse,
  type AuthMFAEnrollTOTPResponse,
  type AuthMFAEnrollWebauthnResponse,
  type AuthTokenResponse,
  type MFAChallengePhoneParams,
  type MFAChallengeTOTPParams,
  type MFAChallengeWebauthnParams,
  type MFAEnrollPhoneParams,
  type MFAEnrollTOTPParams,
  type MFAEnrollWebauthnParams,
  type OAuthResponse,
  type Session,
  type SignInWithIdTokenCredentials,
  type SignInWithOAuthCredentials,
  type Subscription,
} from "@supabase/supabase-js";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as ServiceMap from "effect/ServiceMap";
import { AuthError } from "./auth-error.js";
import { getClient } from "./client.js";

/**
 * @internal
 *
 * Mirrors {@link Effect.promise} but lifts AuthError-shaped throws into a
 * typed `AuthError` failure. Anything else surfaces as a defect — the
 * underlying SDK can throw e.g. `LockAcquireTimeoutError` or propagate
 * subscriber-callback errors, and we want those to crash loudly rather than
 * silently leak as `unknown` in the error channel.
 */
const tryAuthPromise = <T>(fn: () => Promise<T>): Effect.Effect<T, AuthError> =>
  Effect.tryPromise({
    try: fn,
    catch: (e) => {
      if (isAuthError(e)) return new AuthError(e);
      throw e;
    },
  });

/**
 * @internal
 */
type SuccessData<T> = T extends { data: infer D; error: null } ? D : never;

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
      },
    AuthError
  >
): Effect.Effect<T, AuthError> =>
  Effect.flatMap(authResponse, (res) =>
    res.error ? Effect.fail(new AuthError(res.error)) : Effect.succeed(res.data)
  );

/**
 * Authentication service for Supabase.
 *
 * @since 0.1.0
 */
export class Auth extends ServiceMap.Service<Auth>()("supabase-effect/Auth", {
  make: Effect.gen(function* () {
    const authClient = (yield* getClient()).auth;

    const adminCreateUser = (
      ...args: Parameters<typeof authClient.admin.createUser>
    ) =>
      tryAuthPromise(() => authClient.admin.createUser(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(({ user }) => user)
      );

    const adminCustomProvidersCreateProvider = (
      ...args: Parameters<
        typeof authClient.admin.customProviders.createProvider
      >
    ) =>
      tryAuthPromise(() =>
        authClient.admin.customProviders.createProvider(...args)
      ).pipe(flatMapAuthResponse, Effect.map(Option.fromNullOr));

    const adminCustomProvidersDeleteProvider = (
      ...args: Parameters<
        typeof authClient.admin.customProviders.deleteProvider
      >
    ) =>
      tryAuthPromise(() =>
        authClient.admin.customProviders.deleteProvider(...args)
      ).pipe(flatMapAuthResponse, Effect.asVoid);

    const adminCustomProvidersGetProvider = (
      ...args: Parameters<typeof authClient.admin.customProviders.getProvider>
    ) =>
      tryAuthPromise(() =>
        authClient.admin.customProviders.getProvider(...args)
      ).pipe(flatMapAuthResponse, Effect.map(Option.fromNullOr));

    const adminCustomProvidersListProviders = (
      ...args: Parameters<typeof authClient.admin.customProviders.listProviders>
    ) =>
      tryAuthPromise(() =>
        authClient.admin.customProviders.listProviders(...args)
      ).pipe(
        flatMapAuthResponse,
        Effect.map(({ providers }) => providers)
      );

    const adminCustomProvidersUpdateProvider = (
      ...args: Parameters<
        typeof authClient.admin.customProviders.updateProvider
      >
    ) =>
      tryAuthPromise(() =>
        authClient.admin.customProviders.updateProvider(...args)
      ).pipe(flatMapAuthResponse, Effect.map(Option.fromNullOr));

    const adminDeleteUser = (
      ...args: Parameters<typeof authClient.admin.deleteUser>
    ) =>
      tryAuthPromise(() => authClient.admin.deleteUser(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(({ user }) => user)
      );

    const adminGenerateLink = (
      ...args: Parameters<typeof authClient.admin.generateLink>
    ) =>
      tryAuthPromise(() => authClient.admin.generateLink(...args)).pipe(
        flatMapAuthResponse
      );

    const adminGetUserById = (
      ...args: Parameters<typeof authClient.admin.getUserById>
    ) =>
      tryAuthPromise(() => authClient.admin.getUserById(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(({ user }) => user)
      );

    const adminInviteUserByEmail = (
      ...args: Parameters<typeof authClient.admin.inviteUserByEmail>
    ) =>
      tryAuthPromise(() => authClient.admin.inviteUserByEmail(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(({ user }) => user)
      );

    const adminListUsers = (
      ...args: Parameters<typeof authClient.admin.listUsers>
    ) =>
      tryAuthPromise(() => authClient.admin.listUsers(...args)).pipe(
        flatMapAuthResponse
      );

    const adminaMfaDeleteFactor = (
      ...args: Parameters<typeof authClient.admin.mfa.deleteFactor>
    ) =>
      tryAuthPromise(() => authClient.admin.mfa.deleteFactor(...args)).pipe(
        flatMapAuthResponse,
        Effect.map((res) => Option.fromUndefinedOr(res?.id))
      );

    const adminaMfaListFactors = (
      ...args: Parameters<typeof authClient.admin.mfa.listFactors>
    ) =>
      tryAuthPromise(() => authClient.admin.mfa.listFactors(...args)).pipe(
        flatMapAuthResponse,
        Effect.map((res) => res?.factors ?? [])
      );

    const adminOAuthCreateClient = (
      ...args: Parameters<typeof authClient.admin.oauth.createClient>
    ) =>
      tryAuthPromise(() => authClient.admin.oauth.createClient(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(Option.fromNullOr)
      );

    const adminOAuthDeleteClient = (
      ...args: Parameters<typeof authClient.admin.oauth.deleteClient>
    ) =>
      tryAuthPromise(() => authClient.admin.oauth.deleteClient(...args)).pipe(
        flatMapAuthResponse,
        Effect.asVoid
      );

    const adminOAuthGetClient = (
      ...args: Parameters<typeof authClient.admin.oauth.getClient>
    ) =>
      tryAuthPromise(() => authClient.admin.oauth.getClient(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(Option.fromNullOr)
      );

    const adminOAuthListClients = (
      ...args: Parameters<typeof authClient.admin.oauth.listClients>
    ) =>
      tryAuthPromise(() => authClient.admin.oauth.listClients(...args)).pipe(
        flatMapAuthResponse
      );

    const adminOAuthRegenerateClientSecret = (
      ...args: Parameters<typeof authClient.admin.oauth.regenerateClientSecret>
    ) =>
      tryAuthPromise(() =>
        authClient.admin.oauth.regenerateClientSecret(...args)
      ).pipe(flatMapAuthResponse, Effect.map(Option.fromNullOr));

    const adminOAuthUpdateClient = (
      ...args: Parameters<typeof authClient.admin.oauth.updateClient>
    ) =>
      tryAuthPromise(() => authClient.admin.oauth.updateClient(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(Option.fromNullOr)
      );

    const adminSignOut = (
      ...args: Parameters<typeof authClient.admin.signOut>
    ) =>
      tryAuthPromise(() => authClient.admin.signOut(...args)).pipe(
        flatMapAuthResponse,
        Effect.asVoid
      );

    const adminUpdateUserById = (
      ...args: Parameters<typeof authClient.admin.updateUserById>
    ) =>
      tryAuthPromise(() => authClient.admin.updateUserById(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(({ user }) => user)
      );

    function mfaChallenge(
      params: MFAChallengeTOTPParams
    ): Effect.Effect<
      Option.Option<SuccessData<AuthMFAChallengeTOTPResponse>>,
      AuthError
    >;
    function mfaChallenge(
      params: MFAChallengePhoneParams
    ): Effect.Effect<
      Option.Option<SuccessData<AuthMFAChallengePhoneResponse>>,
      AuthError
    >;
    function mfaChallenge(
      params: MFAChallengeWebauthnParams
    ): Effect.Effect<
      Option.Option<SuccessData<AuthMFAChallengeWebauthnResponse>>,
      AuthError
    >;
    function mfaChallenge(
      params:
        | MFAChallengeTOTPParams
        | MFAChallengePhoneParams
        | MFAChallengeWebauthnParams
    ): Effect.Effect<
      Option.Option<
        | SuccessData<AuthMFAChallengeTOTPResponse>
        | SuccessData<AuthMFAChallengePhoneResponse>
        | SuccessData<AuthMFAChallengeWebauthnResponse>
      >,
      AuthError
    > {
      return tryAuthPromise(() =>
        authClient.mfa.challenge(params as MFAChallengeTOTPParams)
      ).pipe(flatMapAuthResponse, Effect.map(Option.fromNullOr));
    }

    const mfaChallengeAndVerify = (
      ...args: Parameters<typeof authClient.mfa.challengeAndVerify>
    ) =>
      tryAuthPromise(() => authClient.mfa.challengeAndVerify(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(Option.fromNullOr)
      );

    function mfaEnroll(
      params: MFAEnrollTOTPParams
    ): Effect.Effect<SuccessData<AuthMFAEnrollTOTPResponse>, AuthError>;
    function mfaEnroll(
      params: MFAEnrollPhoneParams
    ): Effect.Effect<SuccessData<AuthMFAEnrollPhoneResponse>, AuthError>;
    function mfaEnroll(
      params: MFAEnrollWebauthnParams
    ): Effect.Effect<SuccessData<AuthMFAEnrollWebauthnResponse>, AuthError>;
    function mfaEnroll(
      params:
        | MFAEnrollTOTPParams
        | MFAEnrollPhoneParams
        | MFAEnrollWebauthnParams
    ): Effect.Effect<
      | SuccessData<AuthMFAEnrollTOTPResponse>
      | SuccessData<AuthMFAEnrollPhoneResponse>
      | SuccessData<AuthMFAEnrollWebauthnResponse>,
      AuthError
    > {
      return tryAuthPromise(() =>
        authClient.mfa.enroll(params as MFAEnrollTOTPParams)
      ).pipe(flatMapAuthResponse) as Effect.Effect<
        | SuccessData<AuthMFAEnrollTOTPResponse>
        | SuccessData<AuthMFAEnrollPhoneResponse>
        | SuccessData<AuthMFAEnrollWebauthnResponse>,
        AuthError
      >;
    }

    const mfaGetAuthenticatorAssuranceLevel = (
      ...args: Parameters<typeof authClient.mfa.getAuthenticatorAssuranceLevel>
    ) =>
      tryAuthPromise(() =>
        authClient.mfa.getAuthenticatorAssuranceLevel(...args)
      ).pipe(flatMapAuthResponse, Effect.map(Option.fromNullOr));

    const mfaListFactors = (
      ...args: Parameters<typeof authClient.mfa.listFactors>
    ) =>
      tryAuthPromise(() => authClient.mfa.listFactors(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(Option.fromNullOr)
      );

    const mfaUnenroll = (...args: Parameters<typeof authClient.mfa.unenroll>) =>
      tryAuthPromise(() => authClient.mfa.unenroll(...args)).pipe(
        flatMapAuthResponse,
        Effect.map((res) => Option.fromUndefinedOr(res?.id))
      );

    const mfaVerify = (...args: Parameters<typeof authClient.mfa.verify>) =>
      tryAuthPromise(() => authClient.mfa.verify(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(Option.fromNullOr)
      );

    const exchangeCodeForSession = (
      ...args: Parameters<typeof authClient.exchangeCodeForSession>
    ) =>
      tryAuthPromise(() => authClient.exchangeCodeForSession(...args)).pipe(
        flatMapAuthResponse
      );

    const getClaims = (...args: Parameters<typeof authClient.getClaims>) =>
      tryAuthPromise(() => authClient.getClaims(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(Option.fromNullOr)
      );

    const getSession = (...args: Parameters<typeof authClient.getSession>) =>
      tryAuthPromise(() => authClient.getSession(...args)).pipe(
        Effect.flatMap((res) => {
          if (res.error) {
            return Effect.fail(new AuthError(res.error));
          }

          return Effect.succeed(res.data.session);
        }),
        Effect.map(Option.fromNullOr)
      );

    const getUser = (...args: Parameters<typeof authClient.getUser>) =>
      tryAuthPromise(() => authClient.getUser(...args)).pipe(
        flatMapAuthResponse,
        Effect.map((res) => res.user)
      );

    const getUserIdentities = (
      ...args: Parameters<typeof authClient.getUserIdentities>
    ) =>
      tryAuthPromise(() => authClient.getUserIdentities(...args)).pipe(
        flatMapAuthResponse,
        Effect.map((res) => res?.identities ?? [])
      );

    const initialize = (...args: Parameters<typeof authClient.initialize>) =>
      tryAuthPromise(() => authClient.initialize(...args)).pipe(
        Effect.flatMap((res) => {
          if (res.error !== null) {
            return Effect.fail(new AuthError(res.error));
          }

          return Effect.void;
        })
      );

    const isThrowOnErrorEnabled = (
      ...args: Parameters<typeof authClient.isThrowOnErrorEnabled>
    ) => Effect.sync(() => authClient.isThrowOnErrorEnabled(...args));

    function linkIdentity(
      credentials: SignInWithOAuthCredentials
    ): Effect.Effect<SuccessData<OAuthResponse>, AuthError>;
    function linkIdentity(
      credentials: SignInWithIdTokenCredentials
    ): Effect.Effect<SuccessData<AuthTokenResponse>, AuthError>;
    function linkIdentity(
      credentials: SignInWithOAuthCredentials | SignInWithIdTokenCredentials
    ): Effect.Effect<
      SuccessData<OAuthResponse> | SuccessData<AuthTokenResponse>,
      AuthError
    > {
      return tryAuthPromise(() =>
        authClient.linkIdentity(credentials as SignInWithOAuthCredentials)
      ).pipe(flatMapAuthResponse);
    }

    function onAuthStateChange(
      callback: (event: AuthChangeEvent, session: Session | null) => void
    ): Effect.Effect<Subscription>;
    function onAuthStateChange(
      callback: (
        event: AuthChangeEvent,
        session: Session | null
      ) => Promise<void>
    ): Effect.Effect<Subscription>;
    function onAuthStateChange(
      callback: (
        event: AuthChangeEvent,
        session: Session | null
      ) => void | Promise<void>
    ) {
      return Effect.sync(() =>
        authClient.onAuthStateChange(
          callback as (event: AuthChangeEvent, session: Session | null) => void
        )
      ).pipe(Effect.map((res) => res.data.subscription));
    }

    const reauthenticate = (
      ...args: Parameters<typeof authClient.reauthenticate>
    ) =>
      tryAuthPromise(() => authClient.reauthenticate(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(({ user, session }) => ({
          user: Option.fromNullOr(user),
          session: Option.fromNullOr(session),
        }))
      );

    const refreshSession = (
      ...args: Parameters<typeof authClient.refreshSession>
    ) =>
      tryAuthPromise(() => authClient.refreshSession(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(({ user, session }) => ({
          user: Option.fromNullOr(user),
          session: Option.fromNullOr(session),
        }))
      );

    const resend = (...args: Parameters<typeof authClient.resend>) =>
      tryAuthPromise(() => authClient.resend(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(({ messageId }) => Option.fromNullishOr(messageId))
      );

    const resetPasswordForEmail = (
      ...args: Parameters<typeof authClient.resetPasswordForEmail>
    ) =>
      tryAuthPromise(() => authClient.resetPasswordForEmail(...args)).pipe(
        flatMapAuthResponse,
        Effect.asVoid
      );

    const setSession = (...args: Parameters<typeof authClient.setSession>) =>
      tryAuthPromise(() => authClient.setSession(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(({ user, session }) => ({
          user: Option.fromNullOr(user),
          session: Option.fromNullOr(session),
        }))
      );

    const signInAnonymously = (
      ...args: Parameters<typeof authClient.signInAnonymously>
    ) =>
      tryAuthPromise(() => authClient.signInAnonymously(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(({ user, session }) => ({
          user: Option.fromNullOr(user),
          session: Option.fromNullOr(session),
        }))
      );

    const signInWithIdToken = (
      ...args: Parameters<typeof authClient.signInWithIdToken>
    ) =>
      tryAuthPromise(() => authClient.signInWithIdToken(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(({ user, session }) => ({
          user: Option.fromNullOr(user),
          session: Option.fromNullOr(session),
        }))
      );

    const signInWithOAuth = (
      ...args: Parameters<typeof authClient.signInWithOAuth>
    ) =>
      tryAuthPromise(() => authClient.signInWithOAuth(...args)).pipe(
        flatMapAuthResponse
      );

    const signInWithOtp = (
      ...args: Parameters<typeof authClient.signInWithOtp>
    ) =>
      tryAuthPromise(() => authClient.signInWithOtp(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(({ messageId }) => Option.fromNullishOr(messageId))
      );

    const signInWithPassword = (
      ...args: Parameters<typeof authClient.signInWithPassword>
    ) =>
      tryAuthPromise(() => authClient.signInWithPassword(...args)).pipe(
        flatMapAuthResponse
      );

    const signInWithSSO = (
      ...args: Parameters<typeof authClient.signInWithSSO>
    ) =>
      tryAuthPromise(() => authClient.signInWithSSO(...args)).pipe(
        flatMapAuthResponse,
        Effect.map((res) => Option.fromUndefinedOr(res?.url))
      );

    const signInWithWeb3 = (
      ...args: Parameters<typeof authClient.signInWithWeb3>
    ) =>
      tryAuthPromise(() => authClient.signInWithWeb3(...args)).pipe(
        flatMapAuthResponse
      );

    const signOut = (...args: Parameters<typeof authClient.signOut>) =>
      tryAuthPromise(() => authClient.signOut(...args)).pipe(
        Effect.flatMap((res) =>
          res.error ? Effect.fail(new AuthError(res.error)) : Effect.void
        )
      );

    const signUp = (...args: Parameters<typeof authClient.signUp>) =>
      tryAuthPromise(() => authClient.signUp(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(({ user, session }) => ({
          user: Option.fromNullOr(user),
          session: Option.fromNullOr(session),
        }))
      );

    const startAutoRefresh = (
      ...args: Parameters<typeof authClient.startAutoRefresh>
    ) => tryAuthPromise(() => authClient.startAutoRefresh(...args));

    const stopAutoRefresh = (
      ...args: Parameters<typeof authClient.stopAutoRefresh>
    ) => tryAuthPromise(() => authClient.stopAutoRefresh(...args));

    const unlinkIdentity = (
      ...args: Parameters<typeof authClient.unlinkIdentity>
    ) =>
      tryAuthPromise(() => authClient.unlinkIdentity(...args)).pipe(
        flatMapAuthResponse,
        Effect.asVoid
      );

    const updateUser = (...args: Parameters<typeof authClient.updateUser>) =>
      tryAuthPromise(() => authClient.updateUser(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(({ user }) => user)
      );

    const verifyOtp = (...args: Parameters<typeof authClient.verifyOtp>) =>
      tryAuthPromise(() => authClient.verifyOtp(...args)).pipe(
        flatMapAuthResponse,
        Effect.map(({ user, session }) => ({
          user: Option.fromNullOr(user),
          session: Option.fromNullOr(session),
        }))
      );

    return {
      /**
       * Creates a new user.
       *
       * This function should only be called on a server. Never expose your
       * `service_role` key in the browser.
       */
      adminCreateUser,

      /**
       * Creates a new custom OIDC/OAuth provider.
       *
       * For OIDC providers, the server fetches and validates the OpenID Connect
       * discovery document from the issuer's well-known endpoint (or the provided
       * `discovery_url`) at creation time. This may return a validation error
       * (`error_code: "validation_failed"`) if the discovery document is
       * unreachable, not valid JSON, missing required fields, or if the issuer in
       * the document does not match the expected issuer.
       *
       * This function should only be called on a server. Never expose your
       * `service_role` key in the browser.
       */
      adminCustomProvidersCreateProvider,

      /**
       * Deletes a custom provider.
       *
       * This function should only be called on a server. Never expose your
       * `service_role` key in the browser.
       */
      adminCustomProvidersDeleteProvider,

      /**
       * Gets details of a specific custom provider by identifier.
       *
       * This function should only be called on a server. Never expose your
       * `service_role` key in the browser.
       */
      adminCustomProvidersGetProvider,

      /**
       * Lists all custom providers with optional type filter.
       *
       * This function should only be called on a server. Never expose your
       * `service_role` key in the browser.
       */
      adminCustomProvidersListProviders,

      /**
       * Updates an existing custom provider.
       *
       * When `issuer` or `discovery_url` is changed on an OIDC provider, the
       * server re-fetches and validates the discovery document before persisting.
       * This may return a validation error (`error_code: "validation_failed"`) if
       * the discovery document is unreachable, invalid, or the issuer does not
       * match.
       *
       * This function should only be called on a server. Never expose your
       * `service_role` key in the browser.
       */
      adminCustomProvidersUpdateProvider,

      /**
       * Delete a user. Requires a `service_role` key.
       *
       * @param id The user id you want to remove.
       * @param shouldSoftDelete If `true`, then the user will be soft-deleted
       * from the auth schema. Soft deletion allows user identification from the
       * hashed user ID but is not reversible. Defaults to `false` for backward
       * compatibility.
       *
       * This function should only be called on a server. Never expose your
       * `service_role` key in the browser.
       */
      adminDeleteUser,

      /**
       * Generates email links and OTPs to be sent via a custom email provider.
       *
       * @param email The user's email.
       * @param options.password User password. For signup only.
       * @param options.data Optional user metadata. For signup only.
       * @param options.redirectTo The redirect url which should be appended to
       * the generated link.
       */
      adminGenerateLink,

      /**
       * Get user by id.
       *
       * @param uid The user's unique identifier.
       *
       * This function should only be called on a server. Never expose your
       * `service_role` key in the browser.
       */
      adminGetUserById,

      /**
       * Sends an invite link to an email address.
       *
       * @param email The email address of the user.
       * @param options Additional options to be included when inviting.
       */
      adminInviteUserByEmail,

      /**
       * Get a list of users.
       *
       * This function should only be called on a server. Never expose your
       * `service_role` key in the browser.
       */
      adminListUsers,

      /**
       * Deletes a factor on a user. This will log the user out of all active
       * sessions if the deleted factor was verified.
       *
       * @see GoTrueMFAApi#unenroll
       * @experimental
       */
      adminaMfaDeleteFactor,

      /**
       * Lists all factors associated to a user.
       */
      adminaMfaListFactors,

      /**
       * Creates a new OAuth client. Only relevant when the OAuth 2.1 server is
       * enabled in Supabase Auth.
       *
       * This function should only be called on a server. Never expose your
       * `service_role` key in the browser.
       */
      adminOAuthCreateClient,

      /**
       * Deletes an OAuth client. Only relevant when the OAuth 2.1 server is
       * enabled in Supabase Auth.
       *
       * This function should only be called on a server. Never expose your
       * `service_role` key in the browser.
       */
      adminOAuthDeleteClient,

      /**
       * Gets details of a specific OAuth client. Only relevant when the OAuth
       * 2.1 server is enabled in Supabase Auth.
       *
       * This function should only be called on a server. Never expose your
       * `service_role` key in the browser.
       */
      adminOAuthGetClient,

      /**
       * Lists all OAuth clients with optional pagination. Only relevant when the
       * OAuth 2.1 server is enabled in Supabase Auth.
       *
       * This function should only be called on a server. Never expose your
       * `service_role` key in the browser.
       */
      adminOAuthListClients,

      /**
       * Regenerates the secret for an OAuth client. Only relevant when the OAuth
       * 2.1 server is enabled in Supabase Auth.
       *
       * This function should only be called on a server. Never expose your
       * `service_role` key in the browser.
       */
      adminOAuthRegenerateClientSecret,

      /**
       * Updates an existing OAuth client. Only relevant when the OAuth 2.1
       * server is enabled in Supabase Auth.
       *
       * This function should only be called on a server. Never expose your
       * `service_role` key in the browser.
       */
      adminOAuthUpdateClient,

      /**
       * Removes a logged-in session.
       *
       * @param jwt A valid, logged-in JWT.
       * @param scope The logout scope.
       */
      adminSignOut,

      /**
       * Updates the user data. Changes are applied directly without confirmation
       * flows.
       *
       * @param uid The user's unique identifier.
       * @param attributes The data you want to update.
       *
       * This function should only be called on a server. Never expose your
       * `service_role` key in the browser.
       *
       * @remarks
       * This is a server-side operation and does not trigger client-side
       * `onAuthStateChange` listeners. The admin API has no connection to client
       * state.
       *
       * To sync changes to the client after calling this method, call
       * `supabase.auth.refreshSession()` on the client to fetch the updated user
       * data. This will trigger the `TOKEN_REFRESHED` event and notify all
       * listeners.
       */
      adminUpdateUserById,

      /**
       * Log in an existing user by exchanging an Auth Code issued during the
       * PKCE flow.
       */
      exchangeCodeForSession,

      /**
       * Extracts the JWT claims present in the access token by first verifying
       * the JWT against the server's JSON Web Key Set endpoint
       * `/.well-known/jwks.json`, which is often cached, resulting in
       * significantly faster responses. Prefer this method over `#getUser` which
       * always sends a request to the Auth server for each JWT.
       *
       * If the project is not using an asymmetric JWT signing key (like ECC or
       * RSA) it always sends a request to the Auth server (similar to `#getUser`)
       * to verify the JWT.
       *
       * @param jwt An optional specific JWT you wish to verify, not the one you
       * can obtain from `#getSession`.
       * @param options Various additional options that allow you to customize the
       * behavior of this method.
       */
      getClaims,

      /**
       * Returns the session, refreshing it if necessary.
       *
       * The session returned can be `null` if the session is not detected which
       * can happen in the event a user is not signed-in or has logged out.
       *
       * **IMPORTANT:** This method loads values directly from the storage
       * attached to the client. If that storage is based on request cookies for
       * example, the values in it may not be authentic and therefore it's strongly
       * advised against using this method and its results in such circumstances. A
       * warning will be emitted if this is detected. Use `#getUser()` instead.
       */
      getSession,

      /**
       * Gets the current user details if there is an existing session. This
       * method performs a network request to the Supabase Auth server, so the
       * returned value is authentic and can be used to base authorization rules
       * on.
       *
       * @param jwt Takes in an optional access token JWT. If no JWT is provided,
       * the JWT from the current session is used.
       */
      getUser,

      /**
       * Gets all the identities linked to a user.
       */
      getUserIdentities,

      /**
       * Initializes the client session either from the url or from storage.
       *
       * This method is automatically called when instantiating the client, but
       * should also be called manually when checking for an error from an auth
       * redirect (oauth, magiclink, password recovery, etc).
       */
      initialize,

      /**
       * Returns whether error throwing mode is enabled for this client.
       */
      isThrowOnErrorEnabled,

      /**
       * Links an oauth identity to an existing user. This method supports the
       * PKCE flow.
       */
      linkIdentity,

      /**
       * Prepares a challenge used to verify that a user has access to a MFA
       * factor.
       */
      mfaChallenge,

      /**
       * Helper method which creates a challenge and immediately uses the given
       * code to verify against it thereafter. The verification code is provided
       * by the user by entering a code seen in their authenticator app.
       */
      mfaChallengeAndVerify,

      /**
       * Starts the enrollment process for a new Multi-Factor Authentication
       * (MFA) factor. This method creates a new unverified factor. To verify a
       * factor, present the QR code or secret to the user and ask them to add it
       * to their authenticator app. The user has to enter the code from their
       * authenticator app to verify it.
       *
       * Upon verifying a factor, all other sessions are logged out and the
       * current session's authenticator level is promoted to `aal2`.
       */
      mfaEnroll,

      /**
       * Returns the Authenticator Assurance Level (AAL) for the active session.
       *
       * `aal1` (or `null`) means that the user's identity has been verified only
       * with a conventional login (email+password, OTP, magic link, social login,
       * etc.).
       *
       * `aal2` means that the user's identity has been verified both with a
       * conventional login and at least one MFA factor.
       *
       * When called without a JWT parameter, this method is fairly quick
       * (microseconds) and rarely uses the network. When a JWT is provided
       * (useful in server-side environments like Edge Functions where no session
       * is stored), this method will make a network request to validate the user
       * and fetch their MFA factors.
       *
       * @param jwt An optional specific JWT you wish to verify, not the one you
       * can obtain from `#getSession`.
       */
      mfaGetAuthenticatorAssuranceLevel,

      /**
       * Returns the list of MFA factors enabled for this user.
       */
      mfaListFactors,

      /**
       * Unenroll removes a MFA factor. A user has to have an `aal2` authenticator
       * level in order to unenroll a verified factor.
       */
      mfaUnenroll,

      /**
       * Verifies a code against a challenge. The verification code is provided by
       * the user by entering a code seen in their authenticator app.
       */
      mfaVerify,

      /**
       * Receive a notification every time an auth event happens. Safe to use
       * without an async function as callback.
       *
       * @param callback A callback function to be invoked when an auth event
       * happens.
       */
      onAuthStateChange,

      /**
       * Sends a reauthentication OTP to the user's email or phone number.
       * Requires the user to be signed-in.
       */
      reauthenticate,

      /**
       * Returns a new session, regardless of expiry status. Takes in an optional
       * current session. If not passed in, then `refreshSession()` will attempt
       * to retrieve it from `getSession()`. If the current session's refresh
       * token is invalid, an error will be thrown.
       *
       * @param currentSession The current session. If passed in, it must contain
       * a refresh token.
       */
      refreshSession,

      /**
       * Resends an existing signup confirmation email, email change email, SMS
       * OTP or phone change OTP.
       */
      resend,

      /**
       * Sends a password reset request to an email address. This method supports
       * the PKCE flow.
       *
       * @param email The email address of the user.
       * @param options.redirectTo The URL to send the user to after they click
       * the password reset link.
       * @param options.captchaToken Verification token received when the user
       * completes the captcha on the site.
       */
      resetPasswordForEmail,

      /**
       * Sets the session data from the current session. If the current session is
       * expired, `setSession` will take care of refreshing it to obtain a new
       * session. If the refresh token or access token in the current session is
       * invalid, an error will be thrown.
       *
       * @param currentSession The current session that minimally contains an
       * access token and refresh token.
       */
      setSession,

      /**
       * Creates a new anonymous user.
       *
       * @returns A session where the `is_anonymous` claim in the access token
       * JWT is set to `true`.
       */
      signInAnonymously,

      /**
       * Allows signing in with an OIDC ID token. The authentication provider
       * used should be enabled and configured.
       */
      signInWithIdToken,

      /**
       * Log in an existing user via a third-party provider. This method supports
       * the PKCE flow.
       */
      signInWithOAuth,

      /**
       * Log in a user using magiclink or a one-time password (OTP).
       *
       * If the `{{ .ConfirmationURL }}` variable is specified in the email
       * template, a magiclink will be sent. If the `{{ .Token }}` variable is
       * specified in the email template, an OTP will be sent. If you're using
       * phone sign-ins, only an OTP will be sent. You won't be able to send a
       * magiclink for phone sign-ins.
       *
       * Be aware that you may get back an error message that will not distinguish
       * between the cases where the account does not exist or that the account can
       * only be accessed via social login.
       *
       * Do note that you will need to configure a Whatsapp sender on Twilio if
       * you are using phone sign in with the `whatsapp` channel. The whatsapp
       * channel is not supported on other providers at this time. This method
       * supports PKCE when an email is passed.
       */
      signInWithOtp,

      /**
       * Log in an existing user with an email and password or phone and password.
       *
       * Be aware that you may get back an error message that will not distinguish
       * between the cases where the account does not exist or that the
       * email/phone and password combination is wrong or that the account can
       * only be accessed via social login.
       */
      signInWithPassword,

      /**
       * Attempts a single-sign on using an enterprise Identity Provider. A
       * successful SSO attempt will redirect the current page to the identity
       * provider authorization page. The redirect URL is implementation and SSO
       * protocol specific.
       *
       * You can use it by providing a SSO domain. Typically you can extract this
       * domain by asking users for their email address. If this domain is
       * registered on the Auth instance the redirect will use that organization's
       * currently active SSO Identity Provider for the login.
       *
       * If you have built an organization-specific login page, you can use the
       * organization's SSO Identity Provider UUID directly instead.
       */
      signInWithSSO,

      /**
       * Signs in a user by verifying a message signed by the user's private key.
       * Supports Ethereum (via Sign-In-With-Ethereum) & Solana
       * (Sign-In-With-Solana) standards, both of which derive from the EIP-4361
       * standard with slight variation on Solana's side.
       *
       * @see https://eips.ethereum.org/EIPS/eip-4361
       */
      signInWithWeb3,

      /**
       * Inside a browser context, `signOut()` will remove the logged in user from
       * the browser session and log them out — removing all items from
       * `localStorage` and then triggering a `"SIGNED_OUT"` event.
       *
       * For server-side management, you can revoke all refresh tokens for a user
       * by passing a user's JWT through to `auth.api.signOut(JWT: string)`. There
       * is no way to revoke a user's access token JWT until it expires. It is
       * recommended to set a shorter expiry on the JWT for this reason.
       *
       * If using `others` scope, no `SIGNED_OUT` event is fired.
       */
      signOut,

      /**
       * Creates a new user.
       *
       * Be aware that if a user account already exists in the system you may get
       * back an error message that attempts to hide this information from the
       * user. This method has support for PKCE via email signups. The PKCE flow
       * cannot be used when autoconfirm is enabled.
       *
       * @returns A logged-in session if the server has "autoconfirm" ON.
       * @returns A user if the server has "autoconfirm" OFF.
       */
      signUp,

      /**
       * Starts an auto-refresh process in the background. The session is checked
       * every few seconds. Close to the time of expiration a process is started
       * to refresh the session. If refreshing fails it will be retried for as
       * long as necessary.
       *
       * If you set `GoTrueClientOptions#autoRefreshToken` you don't need to call
       * this function — it will be called for you.
       *
       * On browsers the refresh process works only when the tab/window is in the
       * foreground to conserve resources as well as prevent race conditions and
       * flooding auth with requests. If you call this method any managed
       * visibility change callback will be removed and you must manage visibility
       * changes on your own.
       *
       * On non-browser platforms the refresh process works continuously in the
       * background, which may not be desirable. You should hook into your
       * platform's foreground indication mechanism and call these methods
       * appropriately to conserve resources.
       *
       * @see #stopAutoRefresh
       */
      startAutoRefresh,

      /**
       * Stops an active auto refresh process running in the background (if any).
       *
       * If you call this method any managed visibility change callback will be
       * removed and you must manage visibility changes on your own.
       *
       * @see #startAutoRefresh
       */
      stopAutoRefresh,

      /**
       * Unlinks an identity from a user by deleting it. The user will no longer
       * be able to sign in with that identity once it's unlinked.
       */
      unlinkIdentity,

      /**
       * Updates user data for a logged in user.
       */
      updateUser,

      /**
       * Log in a user given a User supplied OTP or TokenHash received through
       * mobile or email.
       */
      verifyOtp,
    };
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}
