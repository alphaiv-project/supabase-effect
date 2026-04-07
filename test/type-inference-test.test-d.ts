/**
 * Type Inference Test Suite
 *
 * Validates two fixes:
 *
 * 1. `table` preserves the full Database schema type (previously erased to `any`
 *    because the inner lambda accepted `AnySupabaseClient` instead of generic `C`).
 *
 * 2. `insert` / `update` / `upsert` accept a typed generic `V` with a QB constraint
 *    instead of `unknown`, so valid mutations compile when the QB is properly typed.
 *
 * ## @ts-expect-error sentinel pattern
 *
 * For Problem 1 we still use `@ts-expect-error` within `it()` bodies because it
 * directly expresses the invariant: a concrete type must NOT be assignable to an
 * incompatible annotation. If the result type were `any`, the assignment would
 * silently succeed (TypeScript wouldn't error), the `@ts-expect-error` directive
 * would itself become an error ("Unused '@ts-expect-error' directive"), and the
 * typecheck run would fail — proving the fix is necessary.
 */

import { describe, it, expectTypeOf } from "vitest";
import { pipe } from "effect";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type { Database } from "./test-database.types";
import * as Client from "../src/client";
import * as Postgrest from "../src/postgrest";
import type { PostgrestError } from "../src/postgrest-error";

// ---------------------------------------------------------------------------
// Problem 1 — table type preservation
// ---------------------------------------------------------------------------

describe("table type preservation", () => {
  /**
   * T1: select("id, name") column narrowing
   *
   * The @ts-expect-error proves the type is concrete, not `any`:
   *   - Before fix: result is Effect<any[], ...> — assignable to Effect<boolean[], ...>
   *     so NO TS error, the directive itself errors → typecheck fails.
   *   - After fix: result is Effect<Array<{id,name}>, ...> — NOT assignable to
   *     Effect<boolean[], ...> so TS errors, satisfying the directive → passes.
   */
  it("select('id, name') is narrowed to exactly those columns, not any", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.table("users")(client),
          Postgrest.select("id, name"),
          Postgrest.executeMultiple()
        )
      )
    );

    // Positive assertion: the exact concrete type.
    expectTypeOf(result).toEqualTypeOf<
      Effect.Effect<
        Array<{ id: number; name: string }>,
        PostgrestError,
        Client.Client
      >
    >();

    // Sentinel: boolean[] is incompatible with the concrete array type.
    // @ts-expect-error — Array<{id,name}> is not assignable to boolean[]
    const _: Effect.Effect<boolean[], PostgrestError, Client.Client> = result;
  });

  /**
   * T2: select("id") single-column narrowing
   */
  it("select('id') is narrowed to a single-column type, not any", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.table("users")(client),
          Postgrest.select("id"),
          Postgrest.executeMultiple()
        )
      )
    );

    expectTypeOf(result).toEqualTypeOf<
      Effect.Effect<Array<{ id: number }>, PostgrestError, Client.Client>
    >();

    // @ts-expect-error — Array<{id}> is not assignable to boolean[]
    const _: Effect.Effect<boolean[], PostgrestError, Client.Client> = result;
  });

  /**
   * T3: executeSingle() returns a typed row, not any
   */
  it("executeSingle returns a concrete typed row, not any", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.table("users")(client),
          Postgrest.select("id, name, email, role"),
          Postgrest.eq("id", 1),
          Postgrest.executeSingle()
        )
      )
    );

    expectTypeOf(result).toEqualTypeOf<
      Effect.Effect<
        { id: number; name: string; email: string; role: string },
        PostgrestError,
        Client.Client
      >
    >();

    // @ts-expect-error — concrete row type is not assignable to boolean
    const _: Effect.Effect<boolean, PostgrestError, Client.Client> = result;
  });

  /**
   * T4: executeMaybeSingle() wraps in Option with a typed inner value
   */
  it("executeMaybeSingle wraps in Option<T> with a concrete T, not any", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.table("users")(client),
          Postgrest.select("id, name"),
          Postgrest.eq("email", "alice@example.com"),
          Postgrest.executeMaybeSingle()
        )
      )
    );

    expectTypeOf(result).toEqualTypeOf<
      Effect.Effect<
        Option.Option<{ id: number; name: string }>,
        PostgrestError,
        Client.Client
      >
    >();

    // @ts-expect-error — Option<{id,name}> is not assignable to boolean
    const _: Effect.Effect<boolean, PostgrestError, Client.Client> = result;
  });
});

// ---------------------------------------------------------------------------
// Problem 2 — mutation value type safety
// ---------------------------------------------------------------------------

describe("mutation type safety", () => {
  /**
   * T5: insert with valid Insert-compatible fields compiles.
   *
   * { name, email } satisfies users.Insert (required fields; id is auto-generated).
   */
  it("insert with valid Insert fields compiles", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.table("users")(client),
          Postgrest.insert({ name: "Alice", email: "alice@example.com" }),
          Postgrest.execute
        )
      )
    );

    expectTypeOf(result).not.toBeNever();
  });

  /**
   * T7: Array (bulk) insert compiles.
   *
   * TypeScript infers V from the element type; V[] matches insert's overload.
   */
  it("bulk insert (array) with valid Insert fields compiles", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.table("users")(client),
          Postgrest.insert([
            { name: "Alice", email: "alice@example.com" },
            { name: "Bob", email: "bob@example.com" },
          ]),
          Postgrest.execute
        )
      )
    );

    expectTypeOf(result).not.toBeNever();
  });

  /**
   * T8: update with valid Update-compatible fields compiles.
   *
   * users.Update has all fields optional, so { name: string } is valid.
   */
  it("update with valid Update fields compiles", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.table("users")(client),
          Postgrest.update({ name: "Alice Updated" }),
          Postgrest.eq("id", 1),
          Postgrest.execute
        )
      )
    );

    expectTypeOf(result).not.toBeNever();
  });

  /**
   * T10: upsert with valid Insert-compatible fields compiles.
   */
  it("upsert with valid Insert fields compiles", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.table("users")(client),
          Postgrest.upsert(
            { name: "Alice", email: "alice@example.com" },
            { onConflict: "email" }
          ),
          Postgrest.execute
        )
      )
    );

    expectTypeOf(result).not.toBeNever();
  });

  /**
   * NOTE — invalid-column rejection is intentionally not tested.
   *
   * Supabase defines insert/update/upsert as generic overloaded methods:
   *   insert<Row extends Insert>(values: Row): ...
   *   insert<Row extends Insert>(values: Row[]): ...
   *
   * TypeScript's bivariant method checking with generic overloads means a
   * structural QB constraint cannot reliably reject structurally-incompatible
   * values at the call site. Full column-level rejection would require importing
   * and re-exposing the actual Insert/Update types, which causes TypeScript OOM
   * in Supabase's recursive type parser.
   */
});
