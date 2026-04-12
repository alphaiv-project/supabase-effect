/**
 * Comprehensive Type Test Suite
 *
 * Validates all execute variants, schema validation, CRUD operations, filters,
 * pagination, and backward compatibility with exact type assertions.
 */

import { describe, it, expectTypeOf } from "vitest";
import { pipe } from "effect";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import type { Database } from "./test-database.types";
import * as Client from "../src/client";
import * as Postgrest from "../src/postgrest";
import type { PostgrestError } from "../src/postgrest-error";

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const UserSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  email: Schema.String,
});

const UserWithRoleSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  email: Schema.String,
  role: Schema.String,
});

const UserIdNameSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
});

type UserRow = { id: number; name: string; email: string };
type UserIdNameRow = { id: number; name: string };

// ---------------------------------------------------------------------------
// executeMultiple
// ---------------------------------------------------------------------------

describe("executeMultiple", () => {
  it("returns Array<T> from a typed table", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.from("users", "id, name, email")(client),
          Postgrest.executeMultiple()
        )
      )
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<UserRow[]>();
    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<PostgrestError>();
    expectTypeOf<
      Effect.Services<typeof result>
    >().toEqualTypeOf<Client.Client>();
  });

  it("executeMultipleWithSchema decodes with schema", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.from("users", "id, name, email")(client),
          Postgrest.executeMultipleWithSchema(UserSchema)
        )
      )
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{
        readonly id: number;
        readonly name: string;
        readonly email: string;
      }>
    >();
    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<
      PostgrestError | Schema.SchemaError
    >();
    expectTypeOf<
      Effect.Services<typeof result>
    >().toEqualTypeOf<Client.Client>();
  });

  it("executeMultipleWithSchema composes with filters", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.from("users", "id, name, email")(client),
          Postgrest.eq("active", true),
          Postgrest.order("name"),
          Postgrest.limit(10),
          Postgrest.executeMultipleWithSchema(UserSchema)
        )
      )
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{
        readonly id: number;
        readonly name: string;
        readonly email: string;
      }>
    >();
    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<
      PostgrestError | Schema.SchemaError
    >();
    expectTypeOf<
      Effect.Services<typeof result>
    >().toEqualTypeOf<Client.Client>();
  });

  it("executeMultipleWithSchema composes with multiple filters", () => {
    const result = (minAge: number, roles: string[]) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.from("users", "id, name, email, role")(client),
            Postgrest.gte("age", minAge),
            Postgrest.in_("role", roles),
            Postgrest.is("deleted_at", null),
            Postgrest.order("age", { ascending: false }),
            Postgrest.executeMultipleWithSchema(UserWithRoleSchema)
          )
        )
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      Array<{
        readonly id: number;
        readonly name: string;
        readonly email: string;
        readonly role: string;
      }>
    >();
    expectTypeOf<Effect.Error<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestError | Schema.SchemaError
    >();
    expectTypeOf<
      Effect.Services<ReturnType<typeof result>>
    >().toEqualTypeOf<Client.Client>();
  });

  it("executeFilterMapMultipleWithSchema filters out decode failures", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.from("users", "id, name, email")(client),
          Postgrest.eq("status", "active"),
          Postgrest.executeFilterMapMultipleWithSchema(UserSchema)
        )
      )
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{
        readonly id: number;
        readonly name: string;
        readonly email: string;
      }>
    >();
    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<PostgrestError>();
    expectTypeOf<
      Effect.Services<typeof result>
    >().toEqualTypeOf<Client.Client>();
  });
});

// ---------------------------------------------------------------------------
// executeSingle
// ---------------------------------------------------------------------------

describe("executeSingle", () => {
  it("auto-applies .single() and returns a typed row", () => {
    const result = (userId: number) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.from("users", "id, name, email")(client),
            Postgrest.eq("id", userId),
            Postgrest.executeSingle()
          )
        )
      );

    expectTypeOf<
      Effect.Success<ReturnType<typeof result>>
    >().toEqualTypeOf<UserRow>();
    expectTypeOf<
      Effect.Error<ReturnType<typeof result>>
    >().toEqualTypeOf<PostgrestError>();
    expectTypeOf<
      Effect.Services<ReturnType<typeof result>>
    >().toEqualTypeOf<Client.Client>();
  });

  it("executeSingleWithSchema decodes with schema", () => {
    const result = (userId: number) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.from("users", "id, name, email")(client),
            Postgrest.eq("id", userId),
            Postgrest.executeSingleWithSchema(UserSchema)
          )
        )
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<{
      readonly id: number;
      readonly name: string;
      readonly email: string;
    }>();
    expectTypeOf<Effect.Error<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestError | Schema.SchemaError
    >();
    expectTypeOf<
      Effect.Services<ReturnType<typeof result>>
    >().toEqualTypeOf<Client.Client>();
  });

  it("executeSingleWithSchema composes with filters", () => {
    const result = (userId: number) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.from("users", "id, name, email, role")(client),
            Postgrest.eq("id", userId),
            Postgrest.is("deleted_at", null),
            Postgrest.executeSingleWithSchema(UserWithRoleSchema)
          )
        )
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<{
      readonly id: number;
      readonly name: string;
      readonly email: string;
      readonly role: string;
    }>();
    expectTypeOf<Effect.Error<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestError | Schema.SchemaError
    >();
    expectTypeOf<
      Effect.Services<ReturnType<typeof result>>
    >().toEqualTypeOf<Client.Client>();
  });
});

// ---------------------------------------------------------------------------
// executeMaybeSingle
// ---------------------------------------------------------------------------

describe("executeMaybeSingle", () => {
  it("auto-applies .maybeSingle() and wraps result in Option", () => {
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
      Option.Option<UserRow>
    >();
    expectTypeOf<
      Effect.Error<ReturnType<typeof result>>
    >().toEqualTypeOf<PostgrestError>();
    expectTypeOf<
      Effect.Services<ReturnType<typeof result>>
    >().toEqualTypeOf<Client.Client>();
  });

  it("executeMaybeSingleWithSchema decodes with schema", () => {
    const result = (email: string) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.from("users", "id, name, email")(client),
            Postgrest.eq("email", email),
            Postgrest.executeMaybeSingleWithSchema(UserSchema)
          )
        )
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      Option.Option<{
        readonly id: number;
        readonly name: string;
        readonly email: string;
      }>
    >();
    expectTypeOf<Effect.Error<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestError | Schema.SchemaError
    >();
    expectTypeOf<
      Effect.Services<ReturnType<typeof result>>
    >().toEqualTypeOf<Client.Client>();
  });

  it("executeMaybeSingleWithSchema composes with filters", () => {
    const result = (email: string) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.from("users", "id, name, email")(client),
            Postgrest.eq("email", email),
            Postgrest.is("deleted_at", null),
            Postgrest.executeMaybeSingleWithSchema(UserSchema)
          )
        )
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      Option.Option<{
        readonly id: number;
        readonly name: string;
        readonly email: string;
      }>
    >();
    expectTypeOf<Effect.Error<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestError | Schema.SchemaError
    >();
    expectTypeOf<
      Effect.Services<ReturnType<typeof result>>
    >().toEqualTypeOf<Client.Client>();
  });
});

// ---------------------------------------------------------------------------
// CRUD mutations
// ---------------------------------------------------------------------------

describe("insert", () => {
  it("insert + execute returns raw response", () => {
    const result = (newUser: { name: string; email: string }) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.insert(newUser),
            Postgrest.execute
          )
        )
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestSingleResponse<null>
    >();
    expectTypeOf<
      Effect.Error<ReturnType<typeof result>>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Effect.Services<ReturnType<typeof result>>
    >().toEqualTypeOf<Client.Client>();
  });

  it("bulk insert + execute returns raw response", () => {
    const result = (users: Array<{ name: string; email: string }>) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.insert(users),
            Postgrest.execute
          )
        )
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestSingleResponse<null>
    >();
    expectTypeOf<
      Effect.Error<ReturnType<typeof result>>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Effect.Services<ReturnType<typeof result>>
    >().toEqualTypeOf<Client.Client>();
  });
});

describe("update", () => {
  it("update + filter + execute returns raw response", () => {
    const result = (userId: number, newName: string) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.update({ name: newName }),
            Postgrest.eq("id", userId),
            Postgrest.execute
          )
        )
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestSingleResponse<null>
    >();
    expectTypeOf<
      Effect.Error<ReturnType<typeof result>>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Effect.Services<ReturnType<typeof result>>
    >().toEqualTypeOf<Client.Client>();
  });

  it("update + select + executeSingleWithSchema compiles", () => {
    const result = (userId: number, newName: string) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.update({ name: newName }),
            Postgrest.eq("id", userId),
            Postgrest.select("id, name"),
            Postgrest.executeSingleWithSchema(UserIdNameSchema)
          )
        )
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<{
      readonly id: number;
      readonly name: string;
    }>();
    expectTypeOf<Effect.Error<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestError | Schema.SchemaError
    >();
  });
});

describe("upsert", () => {
  it("upsert + execute returns raw response", () => {
    const result = (user: { email: string; name: string }) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.upsert(user, { onConflict: "email" }),
            Postgrest.execute
          )
        )
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestSingleResponse<null>
    >();
    expectTypeOf<
      Effect.Error<ReturnType<typeof result>>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Effect.Services<ReturnType<typeof result>>
    >().toEqualTypeOf<Client.Client>();
  });
});

describe("delete", () => {
  it("delete_ + filter + execute returns raw response", () => {
    const result = (userId: number) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.delete_(),
            Postgrest.eq("id", userId),
            Postgrest.execute
          )
        )
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestSingleResponse<null>
    >();
    expectTypeOf<
      Effect.Error<ReturnType<typeof result>>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Effect.Services<ReturnType<typeof result>>
    >().toEqualTypeOf<Client.Client>();
  });
});

// ---------------------------------------------------------------------------
// Raw execute with manual transforms
// ---------------------------------------------------------------------------

describe("raw execute with manual transforms", () => {
  it("asSingle() + execute compiles", () => {
    const result = (userId: number) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.from("users", "id, name")(client),
            Postgrest.eq("id", userId),
            Postgrest.asSingle(),
            Postgrest.execute
          )
        )
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestSingleResponse<UserIdNameRow>
    >();
  });

  it("asMaybeSingle() + execute compiles", () => {
    const result = (email: string) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.from("users", "id, name")(client),
            Postgrest.eq("email", email),
            Postgrest.asMaybeSingle(),
            Postgrest.execute
          )
        )
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestSingleResponse<UserIdNameRow | null>
    >();
  });
});

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

describe("filters", () => {
  it("complex filter chain preserves the exact row type", () => {
    const result = (
      minAge: number,
      maxAge: number,
      namePattern: string,
      roles: string[]
    ) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.from("users", "id, name, age, role")(client),
            Postgrest.gte("age", minAge),
            Postgrest.lte("age", maxAge),
            Postgrest.ilike("name", namePattern),
            Postgrest.in_("role", roles),
            Postgrest.is("deleted_at", null),
            Postgrest.neq("status", "banned"),
            Postgrest.order("age"),
            Postgrest.limit(20),
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
  });

  it("or filter preserves the row type", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.from("users", "id, name, role")(client),
          Postgrest.or("role.eq.admin,role.eq.moderator"),
          Postgrest.executeMultiple()
        )
      )
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{ id: number; name: string; role: string }>
    >();
  });

  it("not filter preserves the row type", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.from("users", "id, name")(client),
          Postgrest.not("name", "is", null),
          Postgrest.executeMultiple()
        )
      )
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      UserIdNameRow[]
    >();
  });

  it("match filter preserves the row type", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.from("users", "id, name, role")(client),
          Postgrest.match({ role: "admin", active: true }),
          Postgrest.executeMultiple()
        )
      )
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{ id: number; name: string; role: string }>
    >();
  });

  it("like filter preserves the row type", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.from("users", "id, name")(client),
          Postgrest.like("name", "A%"),
          Postgrest.executeMultiple()
        )
      )
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      UserIdNameRow[]
    >();
  });
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe("pagination", () => {
  it("range() preserves the row type", () => {
    const result = (page: number, pageSize: number) => {
      const offset = page * pageSize;
      const to = offset + pageSize - 1;
      return Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.from("users", "id, name, email")(client),
            Postgrest.order("created_at", { ascending: false }),
            Postgrest.range(offset, to),
            Postgrest.executeMultiple()
          )
        )
      );
    };

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      UserRow[]
    >();
  });

  it("range() with filter + schema compiles", () => {
    const result = (page: number, pageSize: number) => {
      const offset = page * pageSize;
      const to = offset + pageSize - 1;
      return Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.from("users", "id, name, email")(client),
            Postgrest.eq("active", true),
            Postgrest.order("created_at", { ascending: false }),
            Postgrest.range(offset, to),
            Postgrest.executeMultipleWithSchema(UserSchema)
          )
        )
      );
    };

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      Array<{
        readonly id: number;
        readonly name: string;
        readonly email: string;
      }>
    >();
    expectTypeOf<Effect.Error<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestError | Schema.SchemaError
    >();
  });
});
