/**
 * Simple Type Inference Tests
 *
 * Demonstrates that Supabase's type-level query parser is fully preserved
 * through the Effect wrapper. Each test compiles only if the types are correct.
 */

import { describe, it, expectTypeOf } from "vitest";
import { pipe } from "effect";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type { Database } from "./test-database.types";
import * as Client from "../src/client";
import * as Postgrest from "../src/postgrest";
import type { PostgrestError } from "../src/postgrest-error";

const clientLayer = Client.Client.browser(
  "https://example.supabase.co",
  "fake-anon-key"
);

describe("basic select", () => {
  it("select specific columns infers only those columns", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.table("users")(client),
          Postgrest.select("id, name, email"),
          Postgrest.executeMultiple()
        )
      )
    );

    expectTypeOf(result).toEqualTypeOf<
      Effect.Effect<
        Array<{ id: number; name: string; email: string }>,
        PostgrestError,
        Client.Client
      >
    >();
  });

  it("select * with filters and transforms returns full row type", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.table("users")(client),
          Postgrest.select("*"),
          Postgrest.eq("active", true),
          Postgrest.order("created_at", { ascending: false }),
          Postgrest.limit(10),
          Postgrest.executeMultiple()
        )
      )
    );

    expectTypeOf(result).toEqualTypeOf<
      Effect.Effect<
        Array<Database["public"]["Tables"]["users"]["Row"]>,
        PostgrestError,
        Client.Client
      >
    >();
  });
});

describe("single row queries", () => {
  it("executeSingle returns the narrowed row type", () => {
    const result = (userId: number) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.select("id, name, email, role"),
            Postgrest.eq("id", userId),
            Postgrest.executeSingle()
          )
        )
      );

    expectTypeOf(result(1)).toEqualTypeOf<
      Effect.Effect<
        { id: number; name: string; email: string; role: string },
        PostgrestError,
        Client.Client
      >
    >();
  });

  it("executeMaybeSingle wraps the narrowed row type in Option", () => {
    const result = (email: string) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.select("id, name, email"),
            Postgrest.eq("email", email),
            Postgrest.executeMaybeSingle()
          )
        )
      );

    expectTypeOf(result("a@b.com")).toEqualTypeOf<
      Effect.Effect<
        Option.Option<{ id: number; name: string; email: string }>,
        PostgrestError,
        Client.Client
      >
    >();
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

    expectTypeOf(
      result({ name: "Alice", email: "alice@example.com" })
    ).toEqualTypeOf<
      Effect.Effect<
        { id: number; name: string; email: string; created_at: string },
        PostgrestError,
        Client.Client
      >
    >();
  });

  it("update + select + executeSingle infers updated-then-selected columns", () => {
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

    expectTypeOf(result(1, "Alice Updated")).toEqualTypeOf<
      Effect.Effect<
        { id: number; name: string; updated_at: string },
        PostgrestError,
        Client.Client
      >
    >();
  });
});

describe("complex filters", () => {
  it("multiple filter types chain without losing the row type", () => {
    const result = (minAge: number, roles: string[]) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.select("id, name, age, role"),
            Postgrest.gte("age", minAge),
            Postgrest.in_("role", roles),
            Postgrest.is("deleted_at", null),
            Postgrest.order("age", { ascending: false }),
            Postgrest.executeMultiple()
          )
        )
      );

    expectTypeOf(result(18, ["admin"])).toEqualTypeOf<
      Effect.Effect<
        Array<{
          id: number;
          name: string;
          age: number | null;
          role: string;
        }>,
        PostgrestError,
        Client.Client
      >
    >();
  });
});

// Kept to allow running the clientLayer value without unused-var errors.
export { clientLayer };
