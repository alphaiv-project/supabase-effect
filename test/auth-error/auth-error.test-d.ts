/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * AuthError Type Test Suite
 *
 * Verifies that `mapCode` / `catchCode` exclude the handled code from the
 * residual Effect error union.
 */

import { describe, it, expectTypeOf } from "vitest";
import { pipe } from "effect";
import * as Effect from "effect/Effect";
import * as AuthError from "../../src/auth-error.js";

const srcMulti = Effect.never as unknown as Effect.Effect<
  number,
  AuthError.AuthErrorWithCode<"email_exists" | "phone_exists" | "user_banned">
>;
const srcSingle = Effect.never as unknown as Effect.Effect<
  number,
  AuthError.AuthErrorWithCode<"email_exists">
>;
const srcPlain = Effect.never as unknown as Effect.Effect<
  number,
  AuthError.AuthError
>;

class CustomError {
  readonly _tag = "CustomError";
}

describe("AuthError.catchCode", () => {
  it("removes the caught code from the residual union", () => {
    const r = pipe(
      srcMulti,
      AuthError.catchCode("email_exists", () => Effect.succeed(0))
    );

    expectTypeOf<Effect.Error<typeof r>>().toEqualTypeOf<
      AuthError.AuthErrorWithCode<"phone_exists" | "user_banned">
    >();
  });

  it("collapses to never when catching the only remaining code", () => {
    const r = pipe(
      srcSingle,
      AuthError.catchCode("email_exists", () => Effect.succeed(0))
    );

    expectTypeOf<Effect.Error<typeof r>>().toEqualTypeOf<never>();
  });

  it("chained catches progressively narrow to never", () => {
    const r = pipe(
      srcMulti,
      AuthError.catchCode("email_exists", () => Effect.succeed(0)),
      AuthError.catchCode("phone_exists", () => Effect.succeed(0)),
      AuthError.catchCode("user_banned", () => Effect.succeed(0))
    );

    expectTypeOf<Effect.Error<typeof r>>().toEqualTypeOf<never>();
  });

  it("catching an unrelated code leaves the union unchanged", () => {
    const r = pipe(
      srcMulti,
      AuthError.catchCode("captcha_failed", () => Effect.succeed(0))
    );

    expectTypeOf<Effect.Error<typeof r>>().toEqualTypeOf<
      AuthError.AuthErrorWithCode<
        "phone_exists" | "user_banned" | "email_exists"
      >
    >();
  });

  it("narrows the callback parameter to AuthErrorWithCode<EC>", () => {
    pipe(
      srcMulti,
      AuthError.catchCode("email_exists", (e) => {
        expectTypeOf(e).toEqualTypeOf<
          AuthError.AuthErrorWithCode<"email_exists">
        >();
        return Effect.succeed(0);
      })
    );
  });

  it("falls back to the string overload for unknown codes on plain AuthError", () => {
    const r = pipe(
      srcPlain,
      AuthError.catchCode("custom_code_not_in_union", () => Effect.succeed(0))
    );

    expectTypeOf<Effect.Error<typeof r>>().toEqualTypeOf<AuthError.AuthError>();
  });

  it("adds the recovery effect's error channel to the union", () => {
    const r = pipe(
      srcMulti,
      AuthError.catchCode("email_exists", () => Effect.fail(new CustomError()))
    );

    expectTypeOf<Effect.Error<typeof r>>().toEqualTypeOf<
      AuthError.AuthErrorWithCode<"phone_exists" | "user_banned"> | CustomError
    >();
  });
});

describe("AuthError.mapCode", () => {
  it("removes the mapped code and adds the replacement error", () => {
    const r = pipe(
      srcMulti,
      AuthError.mapCode("email_exists", () => new CustomError())
    );

    expectTypeOf<Effect.Error<typeof r>>().toEqualTypeOf<
      AuthError.AuthErrorWithCode<"phone_exists" | "user_banned"> | CustomError
    >();
  });

  it("collapses AuthError to never when mapping the only code", () => {
    const r = pipe(
      srcSingle,
      AuthError.mapCode("email_exists", () => new CustomError())
    );

    expectTypeOf<Effect.Error<typeof r>>().toEqualTypeOf<CustomError>();
  });

  it("narrows the callback parameter to AuthErrorWithCode<EC>", () => {
    pipe(
      srcMulti,
      AuthError.mapCode("phone_exists", (e) => {
        expectTypeOf(e).toEqualTypeOf<
          AuthError.AuthErrorWithCode<"phone_exists">
        >();
        return new CustomError();
      })
    );
  });
});
