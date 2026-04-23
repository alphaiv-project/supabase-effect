import * as Data from "effect/Data";
import { AuthError as SupabaseAuthError } from "@supabase/supabase-js";
import * as Effect from "effect/Effect";

export class AuthError extends Data.TaggedError("supabase-effect/AuthError")<{
  inner: SupabaseAuthError;
}> {
  constructor(inner: SupabaseAuthError) {
    super({ inner });
  }
}

/**
 * Supabase Auth Error Code
 *
 *
 * @link https://supabase.com/docs/guides/auth/debugging/error-codes
 *
 * @since 0.3.1
 */
export type ErrorCode =
  | "unexpected_failure"
  | "validation_failed"
  | "bad_json"
  | "email_exists"
  | "phone_exists"
  | "bad_jwt"
  | "not_admin"
  | "no_authorization"
  | "user_not_found"
  | "session_not_found"
  | "session_expired"
  | "refresh_token_not_found"
  | "refresh_token_already_used"
  | "flow_state_not_found"
  | "flow_state_expired"
  | "signup_disabled"
  | "user_banned"
  | "provider_email_needs_verification"
  | "invite_not_found"
  | "bad_oauth_state"
  | "bad_oauth_callback"
  | "oauth_provider_not_supported"
  | "unexpected_audience"
  | "single_identity_not_deletable"
  | "email_conflict_identity_not_deletable"
  | "identity_already_exists"
  | "email_provider_disabled"
  | "phone_provider_disabled"
  | "too_many_enrolled_mfa_factors"
  | "mfa_factor_name_conflict"
  | "mfa_factor_not_found"
  | "mfa_ip_address_mismatch"
  | "mfa_challenge_expired"
  | "mfa_verification_failed"
  | "mfa_verification_rejected"
  | "insufficient_aal"
  | "captcha_failed"
  | "saml_provider_disabled"
  | "manual_linking_disabled"
  | "sms_send_failed"
  | "email_not_confirmed"
  | "phone_not_confirmed"
  | "reauth_nonce_missing"
  | "saml_relay_state_not_found"
  | "saml_relay_state_expired"
  | "saml_idp_not_found"
  | "saml_assertion_no_user_id"
  | "saml_assertion_no_email"
  | "user_already_exists"
  | "sso_provider_not_found"
  | "saml_metadata_fetch_failed"
  | "saml_idp_already_exists"
  | "sso_domain_already_exists"
  | "saml_entity_id_mismatch"
  | "conflict"
  | "provider_disabled"
  | "user_sso_managed"
  | "reauthentication_needed"
  | "same_password"
  | "reauthentication_not_valid"
  | "otp_expired"
  | "otp_disabled"
  | "identity_not_found"
  | "weak_password"
  | "over_request_rate_limit"
  | "over_email_send_rate_limit"
  | "over_sms_send_rate_limit"
  | "bad_code_verifier"
  | "anonymous_provider_disabled"
  | "hook_timeout"
  | "hook_timeout_after_retry"
  | "hook_payload_over_size_limit"
  | "hook_payload_invalid_content_type"
  | "request_timeout"
  | "mfa_phone_enroll_not_enabled"
  | "mfa_phone_verify_not_enabled"
  | "mfa_totp_enroll_not_enabled"
  | "mfa_totp_verify_not_enabled"
  | "mfa_webauthn_enroll_not_enabled"
  | "mfa_webauthn_verify_not_enabled"
  | "mfa_verified_factor_exists"
  | "invalid_credentials"
  | "email_address_not_authorized"
  | "email_address_invalid";

/**
 * `AuthError` narrowed to a specific inner error code.
 *
 * Distributes over unions so `AuthErrorWithCode<"a" | "b">` behaves as a union
 * of tagged variants, letting `Exclude` in {@link catchCode} / {@link mapCode}
 * remove the handled branch. Empty unions collapse to `never`.
 *
 * @since 0.3.1
 */
export type AuthErrorWithCode<EC extends ErrorCode | (string & {})> =
  EC extends unknown ? AuthError & { inner: { code: EC } } : never;

/**
 * Type guard for `AuthError`.
 *
 * @since 0.1.0
 */
export function is(e: unknown): e is AuthError {
  return (
    e instanceof Object &&
    "_tag" in e &&
    (e as { _tag: string })._tag === "supabase-effect/AuthError"
  );
}

/**
 * Catches a `AuthError` with a given code and effect.
 *
 * Works like `Effect.mapError` but for `AuthError`'s built in error code.
 *
 * @example
 * ```ts
 * const result = SomeAuthEffect.pipe(
 *   AuthError.mapCode("email_exists", () => new Error("duplicate email"))
 * )
 * ```
 *
 * @see {@link catchCode} - when you want to treat an errornic situation as a successful one.
 * @since 0.1.0
 * @todo implement type-safe auth error code
 */
export function mapCode<E, EC extends ErrorCode>(
  code: EC,
  f: (e: AuthErrorWithCode<EC>) => E
): <A, E1, R>(
  self: Effect.Effect<A, E1, R>
) => Effect.Effect<A, E | Exclude<E1, { inner: { code: EC } }>, R>;
export function mapCode<E, EC extends string & {}>(
  code: EC,
  f: (e: AuthError) => E
): <A, E1, R>(
  self: Effect.Effect<A, E1 | AuthError, R>
) => Effect.Effect<A, E | E1 | AuthError, R>;
export function mapCode<E, EC extends ErrorCode | (string & {})>(
  code: EC,
  f: (e: AuthError) => E
): <A, E1, R>(
  self: Effect.Effect<A, E1 | AuthError, R>
) => Effect.Effect<A, E | E1 | AuthError, R> {
  return (self) =>
    Effect.catchIf(
      self,
      (e): e is AuthError => is(e) && e.inner.code === code,
      (e) => Effect.fail(f(e))
    );
}

/**
 * Catches a `AuthError` with a given code and effect.
 *
 * Works like `Effect.catchTag` but for `AuthError`'s built in error code.
 *
 * @example
 * ```ts
 * const result = SomeAuthEffect.pipe(
 *   AuthError.catchCode("email_exists", () => Effect.fail(new Error("duplicate email")))
 * )
 * ```
 *
 * @see {@link mapCode} - when you want to map the error only to error cases.
 * @since 0.1.0
 * @todo implement type-safe auth error code
 */
export function catchCode<A, E, R, EC extends ErrorCode>(
  code: EC,
  f: (e: AuthErrorWithCode<EC>) => Effect.Effect<A, E, R>
): <A1, E1, R1>(
  self: Effect.Effect<A1, E1, R1>
) => Effect.Effect<A | A1, E | Exclude<E1, { inner: { code: EC } }>, R | R1>;
export function catchCode<A, E, R, EC extends string & {}>(
  code: EC,
  f: (e: AuthErrorWithCode<EC>) => Effect.Effect<A, E, R>
): <A1, E1, R1>(
  self: Effect.Effect<A1, E1 | AuthError, R1>
) => Effect.Effect<A | A1, E | E1 | AuthError, R | R1>;
export function catchCode<A, E, R, EC extends ErrorCode | (string & {})>(
  code: EC,
  f: (e: AuthErrorWithCode<EC>) => Effect.Effect<A, E, R>
): <A1, E1, R1>(
  self: Effect.Effect<A1, E1 | AuthError, R1>
) => Effect.Effect<A | A1, E | E1 | AuthError, R | R1> {
  return (self) =>
    Effect.catchIf(
      self,
      (e): e is AuthErrorWithCode<EC> => is(e) && e.inner.code === code,
      (e) => f(e)
    );
}
