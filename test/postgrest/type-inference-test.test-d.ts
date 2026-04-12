/**
 * Type Inference Test Suite
 *
 * Validates that `from` preserves the full Database schema type through
 * Supabase's type-level query parser, and that mutation functions compile
 * with typed values.
 */

import { describe, it, expectTypeOf } from "vitest";
import { pipe } from "effect";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import type { Database } from "../test-database.types";
import * as Client from "../../src/client";
import * as Postgrest from "../../src/postgrest";
import type { PostgrestError } from "../../src/postgrest-error";

// ---------------------------------------------------------------------------
// Problem 1 — table type preservation via `from`
// ---------------------------------------------------------------------------

describe("table type preservation", () => {
  it("from('users') + select('id, name') is narrowed to exactly those columns", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name"),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{ id: number; name: string }>
    >();
    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<PostgrestError>();
    expectTypeOf<
      Effect.Services<typeof result>
    >().toEqualTypeOf<Client.Client>();
  });

  it("from('users') + select('id') is narrowed to a single-column type", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id"),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{ id: number }>
    >();
    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<PostgrestError>();
    expectTypeOf<
      Effect.Services<typeof result>
    >().toEqualTypeOf<Client.Client>();
  });

  it("executeSingle returns a concrete typed row", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name, email, role"),
      Postgrest.eq("id", 1),
      Postgrest.executeSingle()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<{
      id: number;
      name: string;
      email: string;
      role: string;
    }>();
    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<PostgrestError>();
    expectTypeOf<
      Effect.Services<typeof result>
    >().toEqualTypeOf<Client.Client>();
  });

  it("executeMaybeSingle wraps in Option<T> with a concrete T", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name"),
      Postgrest.eq("email", "alice@example.com"),
      Postgrest.executeMaybeSingle()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Option.Option<{ id: number; name: string }>
    >();
    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<PostgrestError>();
    expectTypeOf<
      Effect.Services<typeof result>
    >().toEqualTypeOf<Client.Client>();
  });
});

// ---------------------------------------------------------------------------
// Problem 2 — mutation value type safety
// ---------------------------------------------------------------------------

describe("mutation type safety", () => {
  it("insert with valid Insert fields returns raw response", () => {
    const result = pipe(
      Postgrest.table<Database>()("users"),
      Postgrest.insert({ name: "Alice", email: "alice@example.com" }),
      Postgrest.execute
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      PostgrestSingleResponse<null>
    >();
    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<never>();
    expectTypeOf<
      Effect.Services<typeof result>
    >().toEqualTypeOf<Client.Client>();
  });

  it("bulk insert (array) with valid Insert fields returns raw response", () => {
    const result = pipe(
      Postgrest.table<Database>()("users"),
      Postgrest.insert([
        { name: "Alice", email: "alice@example.com" },
        { name: "Bob", email: "bob@example.com" },
      ]),
      Postgrest.execute
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      PostgrestSingleResponse<null>
    >();
    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<never>();
    expectTypeOf<
      Effect.Services<typeof result>
    >().toEqualTypeOf<Client.Client>();
  });

  it("update with valid Update fields returns raw response", () => {
    const result = pipe(
      Postgrest.table<Database>()("users"),
      Postgrest.update({ name: "Alice Updated" }),
      Postgrest.eq("id", 1),
      Postgrest.execute
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      PostgrestSingleResponse<null>
    >();
    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<never>();
    expectTypeOf<
      Effect.Services<typeof result>
    >().toEqualTypeOf<Client.Client>();
  });

  it("upsert with valid Insert fields returns raw response", () => {
    const result = pipe(
      Postgrest.table<Database>()("users"),
      Postgrest.upsert(
        { name: "Alice", email: "alice@example.com" },
        { onConflict: "email" }
      ),
      Postgrest.execute
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      PostgrestSingleResponse<null>
    >();
    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<never>();
    expectTypeOf<
      Effect.Services<typeof result>
    >().toEqualTypeOf<Client.Client>();
  });
});
