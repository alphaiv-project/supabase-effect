/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * PostgREST Type Test Suite
 *
 * Validates type inference, column selection, execute variants, schema
 * validation, CRUD mutations, all filters, transforms, and pagination.
 */

import { describe, it, expectTypeOf } from "vitest";
import { pipe } from "effect";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import type { Database, Json } from "../test-database.types";
import * as Client from "../../src/client";
import * as Postgrest from "../../src/postgrest";
import type { PostgrestError } from "../../src/postgrest-error";

// ---------------------------------------------------------------------------
// Shared schemas & types
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
// Column inference: from vs table + select
// ---------------------------------------------------------------------------

describe("column inference", () => {
  it("from() with columns preserves column inference", () => {
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

  it("from() narrows to a single column", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id"),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{ id: number }>
    >();
  });

  it("from() with '*' returns the full row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "*"),
      Postgrest.eq("active", true),
      Postgrest.order("created_at", { ascending: false }),
      Postgrest.limit(10),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<Database["public"]["Tables"]["users"]["Row"]>
    >();
  });

  it("table() + select() loses column inference (returns unknown)", () => {
    const result = pipe(
      Postgrest.table<Database>()("users"),
      Postgrest.select("id, name"),
      Postgrest.executeMultiple()
    );

    // table + select cannot resolve Supabase's overloaded .select() through
    // a generic structural constraint — TypeScript returns unknown.
    // Use from() with columns for read queries instead.
    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<unknown[]>();
  });
});

// ---------------------------------------------------------------------------
// executeMultiple
// ---------------------------------------------------------------------------

describe("executeMultiple", () => {
  it("returns Array<T> from a typed table", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name, email"),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<UserRow[]>();
    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<PostgrestError>();
    expectTypeOf<
      Effect.Services<typeof result>
    >().toEqualTypeOf<Client.Client>();
  });

  it("executeMultipleWithSchema decodes with schema", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name, email"),
      Postgrest.executeMultipleWithSchema(UserSchema)
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
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name, email"),
      Postgrest.eq("active", true),
      Postgrest.order("name"),
      Postgrest.limit(10),
      Postgrest.executeMultipleWithSchema(UserSchema)
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
  });

  it("executeMultipleWithSchema composes with multiple filters", () => {
    const result = (minAge: number, roles: string[]) =>
      pipe(
        Postgrest.from<Database>()("users", "id, name, email, role"),
        Postgrest.gte("age", minAge),
        Postgrest.in_("role", roles),
        Postgrest.is("deleted_at", null),
        Postgrest.order("age", { ascending: false }),
        Postgrest.executeMultipleWithSchema(UserWithRoleSchema)
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
  });

  it("executeFilterMapMultipleWithSchema filters out decode failures", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name, email"),
      Postgrest.eq("status", "active"),
      Postgrest.executeFilterMapMultipleWithSchema(UserSchema)
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{
        readonly id: number;
        readonly name: string;
        readonly email: string;
      }>
    >();
    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<PostgrestError>();
  });
});

// ---------------------------------------------------------------------------
// executeSingle
// ---------------------------------------------------------------------------

describe("executeSingle", () => {
  it("auto-applies .single() and returns a typed row", () => {
    const result = (userId: number) =>
      pipe(
        Postgrest.from<Database>()("users", "id, name, email"),
        Postgrest.eq("id", userId),
        Postgrest.executeSingle()
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
      pipe(
        Postgrest.from<Database>()("users", "id, name, email"),
        Postgrest.eq("id", userId),
        Postgrest.executeSingleWithSchema(UserSchema)
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<{
      readonly id: number;
      readonly name: string;
      readonly email: string;
    }>();
    expectTypeOf<Effect.Error<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestError | Schema.SchemaError
    >();
  });

  it("executeSingleWithSchema composes with filters", () => {
    const result = (userId: number) =>
      pipe(
        Postgrest.from<Database>()("users", "id, name, email, role"),
        Postgrest.eq("id", userId),
        Postgrest.is("deleted_at", null),
        Postgrest.executeSingleWithSchema(UserWithRoleSchema)
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
  });
});

// ---------------------------------------------------------------------------
// executeMaybeSingle
// ---------------------------------------------------------------------------

describe("executeMaybeSingle", () => {
  it("auto-applies .maybeSingle() and wraps result in Option", () => {
    const result = (email: string) =>
      pipe(
        Postgrest.from<Database>()("users", "id, name, email"),
        Postgrest.eq("email", email),
        Postgrest.executeMaybeSingle()
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
      pipe(
        Postgrest.from<Database>()("users", "id, name, email"),
        Postgrest.eq("email", email),
        Postgrest.executeMaybeSingleWithSchema(UserSchema)
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
  });

  it("executeMaybeSingleWithSchema composes with filters", () => {
    const result = (email: string) =>
      pipe(
        Postgrest.table<Database>()("users"),
        Postgrest.select("id, name, email"),
        Postgrest.eq("email", email),
        Postgrest.is("deleted_at", null),
        Postgrest.executeMaybeSingleWithSchema(UserSchema)
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
  });
});

// ---------------------------------------------------------------------------
// Raw execute with manual transforms
// ---------------------------------------------------------------------------

describe("raw execute with manual transforms", () => {
  it("asSingle() + execute compiles", () => {
    const result = (userId: number) =>
      pipe(
        Postgrest.from<Database>()("users", "id, name"),
        Postgrest.eq("id", userId),
        Postgrest.asSingle(),
        Postgrest.execute
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestSingleResponse<UserIdNameRow>
    >();
  });

  it("asMaybeSingle() + execute compiles", () => {
    const result = (email: string) =>
      pipe(
        Postgrest.from<Database>()("users", "id, name"),
        Postgrest.eq("email", email),
        Postgrest.asMaybeSingle(),
        Postgrest.execute
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestSingleResponse<UserIdNameRow | null>
    >();
  });

  it("asCsv() + execute compiles", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name, email"),
      Postgrest.asCsv(),
      Postgrest.execute
    );

    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<never>();
    expectTypeOf<
      Effect.Services<typeof result>
    >().toEqualTypeOf<Client.Client>();
  });
});

// ---------------------------------------------------------------------------
// CRUD mutations
// ---------------------------------------------------------------------------

describe("insert", () => {
  it("insert + execute returns raw response", () => {
    const result = (newUser: { name: string; email: string }) =>
      pipe(
        Postgrest.table<Database>()("users"),
        Postgrest.insert(newUser),
        Postgrest.execute
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
      pipe(
        Postgrest.table<Database>()("users"),
        Postgrest.insert(users),
        Postgrest.execute
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestSingleResponse<null>
    >();
    expectTypeOf<
      Effect.Error<ReturnType<typeof result>>
    >().toEqualTypeOf<never>();
  });

  it("insert + select + executeSingle loses column inference (returns unknown)", () => {
    const result = (newUser: { name: string; email: string }) =>
      pipe(
        Postgrest.table<Database>()("users"),
        Postgrest.insert(newUser),
        Postgrest.select("id, name, email, created_at"),
        Postgrest.executeSingle()
      );

    expectTypeOf<
      Effect.Success<ReturnType<typeof result>>
    >().toEqualTypeOf<unknown>();
    expectTypeOf<
      Effect.Error<ReturnType<typeof result>>
    >().toEqualTypeOf<PostgrestError>();
  });
});

describe("update", () => {
  it("update + filter + execute returns raw response", () => {
    const result = (userId: number, newName: string) =>
      pipe(
        Postgrest.table<Database>()("users"),
        Postgrest.update({ name: newName }),
        Postgrest.eq("id", userId),
        Postgrest.execute
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestSingleResponse<null>
    >();
    expectTypeOf<
      Effect.Error<ReturnType<typeof result>>
    >().toEqualTypeOf<never>();
  });

  it("update + select + executeSingleWithSchema compiles", () => {
    const result = (userId: number, newName: string) =>
      pipe(
        Postgrest.table<Database>()("users"),
        Postgrest.update({ name: newName }),
        Postgrest.eq("id", userId),
        Postgrest.select("id, name"),
        Postgrest.executeSingleWithSchema(UserIdNameSchema)
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<{
      readonly id: number;
      readonly name: string;
    }>();
    expectTypeOf<Effect.Error<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestError | Schema.SchemaError
    >();
  });

  it("update + select + executeSingle loses column inference (returns unknown)", () => {
    const result = (userId: number, newName: string) =>
      pipe(
        Postgrest.table<Database>()("users"),
        Postgrest.update({ name: newName }),
        Postgrest.eq("id", userId),
        Postgrest.select("id, name, updated_at"),
        Postgrest.executeSingle()
      );

    expectTypeOf<
      Effect.Success<ReturnType<typeof result>>
    >().toEqualTypeOf<unknown>();
    expectTypeOf<
      Effect.Error<ReturnType<typeof result>>
    >().toEqualTypeOf<PostgrestError>();
  });
});

describe("upsert", () => {
  it("upsert + execute returns raw response", () => {
    const result = (user: { email: string; name: string }) =>
      pipe(
        Postgrest.table<Database>()("users"),
        Postgrest.upsert(user, { onConflict: "email" }),
        Postgrest.execute
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestSingleResponse<null>
    >();
    expectTypeOf<
      Effect.Error<ReturnType<typeof result>>
    >().toEqualTypeOf<never>();
  });
});

describe("delete", () => {
  it("delete_ + filter + execute returns raw response", () => {
    const result = (userId: number) =>
      pipe(
        Postgrest.table<Database>()("users"),
        Postgrest.delete_(),
        Postgrest.eq("id", userId),
        Postgrest.execute
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestSingleResponse<null>
    >();
    expectTypeOf<
      Effect.Error<ReturnType<typeof result>>
    >().toEqualTypeOf<never>();
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
      pipe(
        Postgrest.from<Database>()("users", "id, name, age, role"),
        Postgrest.gte("age", minAge),
        Postgrest.lte("age", maxAge),
        Postgrest.ilike("name", namePattern),
        Postgrest.in_("role", roles),
        Postgrest.is("deleted_at", null),
        Postgrest.neq("status", "banned"),
        Postgrest.order("age"),
        Postgrest.limit(20),
        Postgrest.executeMultiple()
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

  it("gt preserves the row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name, age"),
      Postgrest.gt("age", 18),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{ id: number; name: string; age: number | null }>
    >();
  });

  it("lt preserves the row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name, age"),
      Postgrest.lt("age", 65),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{ id: number; name: string; age: number | null }>
    >();
  });

  it("like preserves the row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name"),
      Postgrest.like("name", "A%"),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      UserIdNameRow[]
    >();
  });

  it("or preserves the row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name, role"),
      Postgrest.or("role.eq.admin,role.eq.moderator"),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{ id: number; name: string; role: string }>
    >();
  });

  it("not preserves the row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name"),
      Postgrest.not("name", "is", null),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      UserIdNameRow[]
    >();
  });

  it("match preserves the row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name, role"),
      Postgrest.match({ role: "admin", active: true }),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{ id: number; name: string; role: string }>
    >();
  });

  it("filter (raw) preserves the row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name, age"),
      Postgrest.filter("age", "gte", 18),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{ id: number; name: string; age: number | null }>
    >();
  });
});

// ---------------------------------------------------------------------------
// Containment filters
// ---------------------------------------------------------------------------

describe("containment filters", () => {
  it("contains preserves the row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("roles", "id, name, permissions"),
      Postgrest.contains("permissions", { read: true }),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{ id: number; name: string; permissions: Json }>
    >();
  });

  it("containedBy preserves the row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("roles", "id, name, permissions"),
      Postgrest.containedBy("permissions", {
        read: true,
        write: true,
        admin: true,
      }),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{ id: number; name: string; permissions: Json }>
    >();
  });

  it("overlaps preserves the row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("roles", "id, name"),
      Postgrest.overlaps("name", ["admin", "moderator"]),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{ id: number; name: string }>
    >();
  });
});

// ---------------------------------------------------------------------------
// Range filters
// ---------------------------------------------------------------------------

describe("range filters", () => {
  it("rangeGt preserves the row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name"),
      Postgrest.rangeGt("age", "[0,18)"),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      UserIdNameRow[]
    >();
  });

  it("rangeGte preserves the row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name"),
      Postgrest.rangeGte("age", "[0,18]"),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      UserIdNameRow[]
    >();
  });

  it("rangeLt preserves the row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name"),
      Postgrest.rangeLt("age", "[65,100]"),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      UserIdNameRow[]
    >();
  });

  it("rangeLte preserves the row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name"),
      Postgrest.rangeLte("age", "[0,100]"),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      UserIdNameRow[]
    >();
  });

  it("rangeAdjacent preserves the row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name"),
      Postgrest.rangeAdjacent("age", "[18,25)"),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      UserIdNameRow[]
    >();
  });
});

// ---------------------------------------------------------------------------
// textSearch
// ---------------------------------------------------------------------------

describe("textSearch", () => {
  it("textSearch preserves the row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("posts", "id, title, content"),
      Postgrest.textSearch("content", "effect & supabase"),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{ id: number; title: string; content: string }>
    >();
  });

  it("textSearch with options preserves the row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("posts", "id, title"),
      Postgrest.textSearch("content", "effect supabase", {
        type: "websearch",
        config: "english",
      }),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{ id: number; title: string }>
    >();
  });
});

// ---------------------------------------------------------------------------
// in_ comprehensive
// ---------------------------------------------------------------------------

describe("in_ filter", () => {
  it("in_ with string array preserves the row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name, role"),
      Postgrest.in_("role", ["admin", "moderator"]),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{ id: number; name: string; role: string }>
    >();
    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<PostgrestError>();
    expectTypeOf<
      Effect.Services<typeof result>
    >().toEqualTypeOf<Client.Client>();
  });

  it("in_ with number array preserves the row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("users", "id, name, email"),
      Postgrest.in_("id", [1, 2, 3]),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<UserRow[]>();
  });

  it("in_ composes with other filters", () => {
    const result = (roles: string[]) =>
      pipe(
        Postgrest.from<Database>()("users", "id, name, role"),
        Postgrest.in_("role", roles),
        Postgrest.eq("active", true),
        Postgrest.order("name"),
        Postgrest.executeMultiple()
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      Array<{ id: number; name: string; role: string }>
    >();
  });

  it("in_ + executeSingle compiles", () => {
    const result = (userId: number) =>
      pipe(
        Postgrest.from<Database>()("users", "id, name, email"),
        Postgrest.in_("id", [userId]),
        Postgrest.executeSingle()
      );

    expectTypeOf<
      Effect.Success<ReturnType<typeof result>>
    >().toEqualTypeOf<UserRow>();
  });

  it("in_ + executeMaybeSingle wraps in Option", () => {
    const result = (ids: number[]) =>
      pipe(
        Postgrest.from<Database>()("users", "id, name"),
        Postgrest.in_("id", ids),
        Postgrest.executeMaybeSingle()
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      Option.Option<UserIdNameRow>
    >();
  });

  it("in_ + schema validation compiles", () => {
    const result = (roles: string[]) =>
      pipe(
        Postgrest.from<Database>()("users", "id, name, email"),
        Postgrest.in_("role", roles),
        Postgrest.executeMultipleWithSchema(UserSchema)
      );

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

  it("in_ + filterMapMultipleWithSchema compiles", () => {
    const result = (ids: number[]) =>
      pipe(
        Postgrest.from<Database>()("users", "id, name, email"),
        Postgrest.in_("id", ids),
        Postgrest.executeFilterMapMultipleWithSchema(UserSchema)
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      Array<{
        readonly id: number;
        readonly name: string;
        readonly email: string;
      }>
    >();
    expectTypeOf<
      Effect.Error<ReturnType<typeof result>>
    >().toEqualTypeOf<PostgrestError>();
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
      return pipe(
        Postgrest.from<Database>()("users", "id, name, email"),
        Postgrest.order("created_at", { ascending: false }),
        Postgrest.range(offset, to),
        Postgrest.executeMultiple()
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
      return pipe(
        Postgrest.from<Database>()("users", "id, name, email"),
        Postgrest.eq("active", true),
        Postgrest.order("created_at", { ascending: false }),
        Postgrest.range(offset, to),
        Postgrest.executeMultipleWithSchema(UserSchema)
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
