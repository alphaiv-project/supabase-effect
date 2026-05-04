/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * PostgrestError Type Test Suite
 *
 * Verifies that `mapCode` / `catchCode` exclude the handled code from the
 * residual Effect error union.
 */

import { describe, it, expectTypeOf } from "vitest";
import { pipe } from "effect";
import * as Effect from "effect/Effect";
import { PostgrestError } from "../../src/postgrest-error.js";

const srcMulti = Effect.never as unknown as Effect.Effect<
  number,
  PostgrestError.PostgrestErrorWithCode<"PGRST116" | "PGRST202" | "PGRST301">
>;
const srcSingle = Effect.never as unknown as Effect.Effect<
  number,
  PostgrestError.PostgrestErrorWithCode<"PGRST116">
>;
const srcPlain = Effect.never as unknown as Effect.Effect<
  number,
  PostgrestError
>;

class CustomError {
  readonly _tag = "CustomError";
}

describe("PostgrestError.catchCode", () => {
  it("removes the caught code from the residual union", () => {
    const r = pipe(
      srcMulti,
      PostgrestError.catchCode("PGRST116", () => Effect.succeed(0))
    );

    expectTypeOf<Effect.Error<typeof r>>().toEqualTypeOf<
      PostgrestError.PostgrestErrorWithCode<"PGRST202" | "PGRST301">
    >();
  });

  it("collapses to never when catching the only remaining code", () => {
    const r = pipe(
      srcSingle,
      PostgrestError.catchCode("PGRST116", () => Effect.succeed(0))
    );

    expectTypeOf<Effect.Error<typeof r>>().toEqualTypeOf<never>();
  });

  it("chained catches progressively narrow to never", () => {
    const r = pipe(
      srcMulti,
      PostgrestError.catchCode("PGRST116", () => Effect.succeed(0)),
      PostgrestError.catchCode("PGRST202", () => Effect.succeed(0)),
      PostgrestError.catchCode("PGRST301", () => Effect.succeed(0))
    );

    expectTypeOf<Effect.Error<typeof r>>().toEqualTypeOf<never>();
  });

  it("catching an unrelated code leaves the union unchanged", () => {
    const r = pipe(
      srcMulti,
      PostgrestError.catchCode("PGRST100", () => Effect.succeed(0))
    );

    expectTypeOf<Effect.Error<typeof r>>().toEqualTypeOf<
      PostgrestError.PostgrestErrorWithCode<
        "PGRST116" | "PGRST202" | "PGRST301"
      >
    >();
  });

  it("narrows the inner callback parameter to { code: EC }", () => {
    pipe(
      srcMulti,
      PostgrestError.catchCode("PGRST116", (spe) => {
        expectTypeOf(spe.code).toEqualTypeOf<"PGRST116">();
        return Effect.succeed(0);
      })
    );
  });

  it("falls back to the string overload for unknown codes on plain PostgrestError", () => {
    const r = pipe(
      srcPlain,
      PostgrestError.catchCode("CUSTOM_CODE_NOT_IN_UNION", () =>
        Effect.succeed(0)
      )
    );

    expectTypeOf<Effect.Error<typeof r>>().toEqualTypeOf<PostgrestError>();
  });

  it("adds the recovery effect's error channel to the union", () => {
    const r = pipe(
      srcMulti,
      PostgrestError.catchCode("PGRST116", () => Effect.fail(new CustomError()))
    );

    expectTypeOf<Effect.Error<typeof r>>().toEqualTypeOf<
      | PostgrestError.PostgrestErrorWithCode<"PGRST202" | "PGRST301">
      | CustomError
    >();
  });
});

describe("PostgrestError.mapCode", () => {
  it("removes the mapped code and adds the replacement error", () => {
    const r = pipe(
      srcMulti,
      PostgrestError.mapCode("PGRST116", () => new CustomError())
    );

    expectTypeOf<Effect.Error<typeof r>>().toEqualTypeOf<
      | PostgrestError.PostgrestErrorWithCode<"PGRST202" | "PGRST301">
      | CustomError
    >();
  });

  it("collapses PostgrestError to never when mapping the only code", () => {
    const r = pipe(
      srcSingle,
      PostgrestError.mapCode("PGRST116", () => new CustomError())
    );

    expectTypeOf<Effect.Error<typeof r>>().toEqualTypeOf<CustomError>();
  });

  it("narrows the inner callback parameter to { code: EC }", () => {
    pipe(
      srcMulti,
      PostgrestError.mapCode("PGRST202", (spe) => {
        expectTypeOf(spe.code).toEqualTypeOf<"PGRST202">();
        return new CustomError();
      })
    );
  });
});
