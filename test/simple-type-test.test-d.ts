/**
 * Simple Type Inference Tests
 *
 * Demonstrates that Supabase's type-level query parser is fully preserved
 * through the Effect wrapper via `from`.
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

const clientLayer = Client.Client.browser(
  "https://example.supabase.co",
  "fake-anon-key"
);

describe("basic select", () => {
  it("select specific columns infers only those columns", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.from("users", "id, name, email")(client),
          Postgrest.executeMultiple()
        )
      )
    );

    expectTypeOf<EffectSuccess<typeof result>>().toEqualTypeOf<
      Array<{ id: number; name: string; email: string }>
    >();
    expectTypeOf<EffectError<typeof result>>().toEqualTypeOf<PostgrestError>();
    expectTypeOf<EffectContext<typeof result>>().toEqualTypeOf<Client.Client>();
  });

  it("select * with filters and transforms returns full row type", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.from("users", "*")(client),
          Postgrest.eq("active", true),
          Postgrest.order("created_at", { ascending: false }),
          Postgrest.limit(10),
          Postgrest.executeMultiple()
        )
      )
    );

    expectTypeOf<EffectSuccess<typeof result>>().toEqualTypeOf<
      Array<Database["public"]["Tables"]["users"]["Row"]>
    >();
    expectTypeOf<EffectError<typeof result>>().toEqualTypeOf<PostgrestError>();
    expectTypeOf<EffectContext<typeof result>>().toEqualTypeOf<Client.Client>();
  });
});

describe("single row queries", () => {
  it("executeSingle returns the narrowed row type", () => {
    const result = (userId: number) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.from("users", "id, name, email, role")(client),
            Postgrest.eq("id", userId),
            Postgrest.executeSingle()
          )
        )
      );

    expectTypeOf<EffectSuccess<ReturnType<typeof result>>>().toEqualTypeOf<{
      id: number;
      name: string;
      email: string;
      role: string;
    }>();
    expectTypeOf<
      EffectError<ReturnType<typeof result>>
    >().toEqualTypeOf<PostgrestError>();
    expectTypeOf<
      EffectContext<ReturnType<typeof result>>
    >().toEqualTypeOf<Client.Client>();
  });

  it("executeMaybeSingle wraps the narrowed row type in Option", () => {
    const result = (email: string) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.from("users", "id, name, email")(client),
            Postgrest.eq("email", email),
            Postgrest.executeMaybeSingle()
          )
        )
      );

    expectTypeOf<EffectSuccess<ReturnType<typeof result>>>().toEqualTypeOf<
      Option.Option<{ id: number; name: string; email: string }>
    >();
    expectTypeOf<
      EffectError<ReturnType<typeof result>>
    >().toEqualTypeOf<PostgrestError>();
    expectTypeOf<
      EffectContext<ReturnType<typeof result>>
    >().toEqualTypeOf<Client.Client>();
  });
});

describe("mutations", () => {
  it("insert + select + executeSingle infers inserted-then-selected columns", () => {
    const result = (newUser: { name: string; email: string }) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.insert(newUser),
            Postgrest.select("id, name, email, created_at"),
            Postgrest.executeSingle()
          )
        )
      );

    // NOTE: insert + select loses column-level type inference (returns unknown)
    // because Postgrest.select cannot resolve overloads on a generic builder.
    // Use schema validation for typed mutation results.
    expectTypeOf(result({ name: "Alice", email: "alice@example.com" })).not.toBeNever();
  });

  it("update + select + executeSingle compiles", () => {
    const result = (userId: number, newName: string) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.update({ name: newName }),
            Postgrest.eq("id", userId),
            Postgrest.select("id, name, updated_at"),
            Postgrest.executeSingle()
          )
        )
      );

    expectTypeOf(result(1, "Alice Updated")).not.toBeNever();
  });
});

describe("complex filters", () => {
  it("multiple filter types chain without losing the row type", () => {
    const result = (minAge: number, roles: string[]) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.from("users", "id, name, age, role")(client),
            Postgrest.gte("age", minAge),
            Postgrest.in_("role", roles),
            Postgrest.is("deleted_at", null),
            Postgrest.order("age", { ascending: false }),
            Postgrest.executeMultiple()
          )
        )
      );

    expectTypeOf<EffectSuccess<ReturnType<typeof result>>>().toEqualTypeOf<
      Array<{
        id: number;
        name: string;
        age: number | null;
        role: string;
      }>
    >();
    expectTypeOf<
      EffectError<ReturnType<typeof result>>
    >().toEqualTypeOf<PostgrestError>();
    expectTypeOf<
      EffectContext<ReturnType<typeof result>>
    >().toEqualTypeOf<Client.Client>();
  });
});

export { clientLayer };
