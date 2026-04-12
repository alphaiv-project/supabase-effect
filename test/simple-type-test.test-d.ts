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

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{ id: number; name: string; email: string }>
    >();
    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<PostgrestError>();
    expectTypeOf<
      Effect.Services<typeof result>
    >().toEqualTypeOf<Client.Client>();
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

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<Database["public"]["Tables"]["users"]["Row"]>
    >();
    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<PostgrestError>();
    expectTypeOf<
      Effect.Services<typeof result>
    >().toEqualTypeOf<Client.Client>();
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

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<{
      id: number;
      name: string;
      email: string;
      role: string;
    }>();
    expectTypeOf<
      Effect.Error<ReturnType<typeof result>>
    >().toEqualTypeOf<PostgrestError>();
    expectTypeOf<
      Effect.Services<ReturnType<typeof result>>
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

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      Option.Option<{ id: number; name: string; email: string }>
    >();
    expectTypeOf<
      Effect.Error<ReturnType<typeof result>>
    >().toEqualTypeOf<PostgrestError>();
    expectTypeOf<
      Effect.Services<ReturnType<typeof result>>
    >().toEqualTypeOf<Client.Client>();
  });
});

describe("mutations", () => {
  it("insert + select + executeSingle loses column inference (returns unknown)", () => {
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

    // insert + select loses column-level type inference (returns unknown)
    // because Postgrest.select cannot resolve overloads on a generic builder.
    // Use schema validation for typed mutation results.
    expectTypeOf<
      Effect.Success<ReturnType<typeof result>>
    >().toEqualTypeOf<unknown>();
    expectTypeOf<
      Effect.Error<ReturnType<typeof result>>
    >().toEqualTypeOf<PostgrestError>();
    expectTypeOf<
      Effect.Services<ReturnType<typeof result>>
    >().toEqualTypeOf<Client.Client>();
  });

  it("update + select + executeSingle loses column inference (returns unknown)", () => {
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

    expectTypeOf<
      Effect.Success<ReturnType<typeof result>>
    >().toEqualTypeOf<unknown>();
    expectTypeOf<
      Effect.Error<ReturnType<typeof result>>
    >().toEqualTypeOf<PostgrestError>();
    expectTypeOf<
      Effect.Services<ReturnType<typeof result>>
    >().toEqualTypeOf<Client.Client>();
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

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      Array<{
        id: number;
        name: string;
        age: number | null;
        role: string;
      }>
    >();
    expectTypeOf<
      Effect.Error<ReturnType<typeof result>>
    >().toEqualTypeOf<PostgrestError>();
    expectTypeOf<
      Effect.Services<ReturnType<typeof result>>
    >().toEqualTypeOf<Client.Client>();
  });
});

export { clientLayer };
