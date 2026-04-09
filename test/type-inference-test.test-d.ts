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
import type { Database } from "./test-database.types";
import * as Client from "../src/client";
import * as Postgrest from "../src/postgrest";
import type { PostgrestError } from "../src/postgrest-error";
import type { EffectSuccess, EffectError, EffectContext } from "./test-util";

// ---------------------------------------------------------------------------
// Problem 1 — table type preservation via `from`
// ---------------------------------------------------------------------------

describe("table type preservation", () => {
  it("from('users', 'id, name') is narrowed to exactly those columns", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.from("users", "id, name")(client),
          Postgrest.executeMultiple()
        )
      )
    );

    expectTypeOf<EffectSuccess<typeof result>>().toEqualTypeOf<
      Array<{ id: number; name: string }>
    >();
    expectTypeOf<EffectError<typeof result>>().toEqualTypeOf<PostgrestError>();
    expectTypeOf<EffectContext<typeof result>>().toEqualTypeOf<Client.Client>();
  });

  it("from('users', 'id') is narrowed to a single-column type", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.from("users", "id")(client),
          Postgrest.executeMultiple()
        )
      )
    );

    expectTypeOf<EffectSuccess<typeof result>>().toEqualTypeOf<
      Array<{ id: number }>
    >();
    expectTypeOf<EffectError<typeof result>>().toEqualTypeOf<PostgrestError>();
    expectTypeOf<EffectContext<typeof result>>().toEqualTypeOf<Client.Client>();
  });

  it("executeSingle returns a concrete typed row", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.from("users", "id, name, email, role")(client),
          Postgrest.eq("id", 1),
          Postgrest.executeSingle()
        )
      )
    );

    expectTypeOf<EffectSuccess<typeof result>>().toEqualTypeOf<{
      id: number;
      name: string;
      email: string;
      role: string;
    }>();
    expectTypeOf<EffectError<typeof result>>().toEqualTypeOf<PostgrestError>();
    expectTypeOf<EffectContext<typeof result>>().toEqualTypeOf<Client.Client>();
  });

  it("executeMaybeSingle wraps in Option<T> with a concrete T", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.from("users", "id, name")(client),
          Postgrest.eq("email", "alice@example.com"),
          Postgrest.executeMaybeSingle()
        )
      )
    );

    expectTypeOf<EffectSuccess<typeof result>>().toEqualTypeOf<
      Option.Option<{ id: number; name: string }>
    >();
    expectTypeOf<EffectError<typeof result>>().toEqualTypeOf<PostgrestError>();
    expectTypeOf<EffectContext<typeof result>>().toEqualTypeOf<Client.Client>();
  });
});

// ---------------------------------------------------------------------------
// Problem 2 — mutation value type safety
// ---------------------------------------------------------------------------

describe("mutation type safety", () => {
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
});
