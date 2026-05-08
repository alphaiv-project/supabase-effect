/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * PostgREST View Type Test Suite
 *
 * Validates that `Postgrest.from()` and the entire builder pipeline work
 * correctly when the relation is a Postgres view (entry under
 * `Database["public"]["Views"]`) rather than a table.
 *
 * Two view shapes are exercised:
 *   - `user_post_counts` — non-updatable view (Row + Relationships only),
 *     mirroring what Supabase CLI emits for a typical `CREATE VIEW`.
 *   - `active_users` — updatable view (Row + Insert + Update + Relationships).
 *
 * Background: the underlying `client.from()` is overloaded over
 * `Schema["Tables"]` and `Schema["Views"]`. `Postgrest.from()` is a thin
 * `Effect.map(getClient(), (c) => c.from(name))`, so view support is
 * delegated entirely to the supabase-js type machinery — these tests pin
 * that contract.
 */

import { describe, it, expectTypeOf } from "vitest";
import { pipe } from "effect";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import type { Database } from "../test-database.types.js";
import * as Client from "../../src/client.js";
import * as Postgrest from "../../src/postgrest.js";
import type { PostgrestError } from "../../src/postgrest-error.js";

// ---------------------------------------------------------------------------
// Shared schemas & types
// ---------------------------------------------------------------------------

const UserPostCountSchema = Schema.Struct({
  user_id: Schema.NullOr(Schema.Number),
  user_name: Schema.NullOr(Schema.String),
  post_count: Schema.NullOr(Schema.Number),
});

const ActiveUserSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  email: Schema.String,
});

type UserPostCountRow = {
  user_id: number | null;
  user_name: string | null;
  email: string | null;
  post_count: number | null;
  last_post_at: string | null;
};

type ActiveUserRow = {
  id: number;
  name: string;
  email: string;
  age: number | null;
  role: string;
};

// ---------------------------------------------------------------------------
// from() resolves view names
// ---------------------------------------------------------------------------

describe("from() with views", () => {
  it("accepts a non-updatable view name and infers the row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("user_post_counts"),
      Postgrest.select("*"),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<UserPostCountRow>
    >();
    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<PostgrestError>();
    expectTypeOf<
      Effect.Services<typeof result>
    >().toEqualTypeOf<Client.Client>();
  });

  it("accepts an updatable view name and infers the row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("active_users"),
      Postgrest.select("*"),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<ActiveUserRow>
    >();
  });

  it("table() (deprecated alias) also resolves view names", () => {
    const result = pipe(
      Postgrest.table<Database>()("user_post_counts"),
      Postgrest.select("user_id, user_name"),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{ user_id: number | null; user_name: string | null }>
    >();
  });
});

// ---------------------------------------------------------------------------
// Column inference on views
// ---------------------------------------------------------------------------

describe("column inference on views", () => {
  it("select() narrows view columns and preserves nullability", () => {
    const result = pipe(
      Postgrest.from<Database>()("user_post_counts"),
      Postgrest.select("user_id, post_count"),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{ user_id: number | null; post_count: number | null }>
    >();
  });

  it("select() on an updatable view preserves non-null columns", () => {
    const result = pipe(
      Postgrest.from<Database>()("active_users"),
      Postgrest.select("id, name, email"),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{ id: number; name: string; email: string }>
    >();
  });

  it("select('*') on a view returns the full Row type", () => {
    const result = pipe(
      Postgrest.from<Database>()("role_summary"),
      Postgrest.select("*"),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{ role_name: string | null; user_count: number | null }>
    >();
  });
});

// ---------------------------------------------------------------------------
// Filters on views
// ---------------------------------------------------------------------------

describe("filters on views", () => {
  it("eq + order + limit work on a view", () => {
    const result = (minPostCount: number) =>
      pipe(
        Postgrest.from<Database>()("user_post_counts"),
        Postgrest.select("user_id, user_name, post_count"),
        Postgrest.gte("post_count", minPostCount),
        Postgrest.order("post_count", { ascending: false }),
        Postgrest.limit(10),
        Postgrest.executeMultiple()
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      Array<{
        user_id: number | null;
        user_name: string | null;
        post_count: number | null;
      }>
    >();
    expectTypeOf<
      Effect.Error<ReturnType<typeof result>>
    >().toEqualTypeOf<PostgrestError>();
  });

  it("complex filter chain works on a view", () => {
    const result = (rolePattern: string) =>
      pipe(
        Postgrest.from<Database>()("active_users"),
        Postgrest.select("id, name, email, role"),
        Postgrest.ilike("name", "%admin%"),
        Postgrest.in_("role", ["admin", "moderator"]),
        Postgrest.like("role", rolePattern),
        Postgrest.not("email", "is", null),
        Postgrest.order("name"),
        Postgrest.executeMultiple()
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      Array<{ id: number; name: string; email: string; role: string }>
    >();
  });

  it("range pagination works on a view", () => {
    const result = (page: number, pageSize: number) => {
      const offset = page * pageSize;
      return pipe(
        Postgrest.from<Database>()("user_post_counts"),
        Postgrest.select("user_id, post_count"),
        Postgrest.order("post_count", { ascending: false }),
        Postgrest.range(offset, offset + pageSize - 1),
        Postgrest.executeMultiple()
      );
    };

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      Array<{ user_id: number | null; post_count: number | null }>
    >();
  });
});

// ---------------------------------------------------------------------------
// executeSingle / executeMaybeSingle on views
// ---------------------------------------------------------------------------

describe("single-row execution on views", () => {
  it("executeSingle() auto-applies .single() and returns view row", () => {
    const result = (userId: number) =>
      pipe(
        Postgrest.from<Database>()("user_post_counts"),
        Postgrest.select("user_id, user_name, post_count"),
        Postgrest.eq("user_id", userId),
        Postgrest.executeSingle()
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<{
      user_id: number | null;
      user_name: string | null;
      post_count: number | null;
    }>();
    expectTypeOf<
      Effect.Error<ReturnType<typeof result>>
    >().toEqualTypeOf<PostgrestError>();
  });

  it("executeMaybeSingle() wraps view row in Option", () => {
    const result = (userId: number) =>
      pipe(
        Postgrest.from<Database>()("user_post_counts"),
        Postgrest.select("user_id, post_count"),
        Postgrest.eq("user_id", userId),
        Postgrest.executeMaybeSingle()
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      Option.Option<{ user_id: number | null; post_count: number | null }>
    >();
  });

  it("asSingle() + execute returns raw response of view row", () => {
    const result = (userId: number) =>
      pipe(
        Postgrest.from<Database>()("active_users"),
        Postgrest.select("id, name"),
        Postgrest.eq("id", userId),
        Postgrest.asSingle(),
        Postgrest.execute
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestSingleResponse<{ id: number; name: string }>
    >();
  });

  it("asMaybeSingle() + execute returns nullable response of view row", () => {
    const result = (userId: number) =>
      pipe(
        Postgrest.from<Database>()("active_users"),
        Postgrest.select("id, name"),
        Postgrest.eq("id", userId),
        Postgrest.asMaybeSingle(),
        Postgrest.execute
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestSingleResponse<{ id: number; name: string } | null>
    >();
  });
});

// ---------------------------------------------------------------------------
// Schema validation on views
// ---------------------------------------------------------------------------

describe("schema validation on views", () => {
  it("executeMultipleWithSchema decodes view rows", () => {
    const result = pipe(
      Postgrest.from<Database>()("user_post_counts"),
      Postgrest.select("user_id, user_name, post_count"),
      Postgrest.executeMultipleWithSchema(UserPostCountSchema)
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{
        readonly user_id: number | null;
        readonly user_name: string | null;
        readonly post_count: number | null;
      }>
    >();
    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<
      PostgrestError | Schema.SchemaError
    >();
  });

  it("executeMultipleWithSchema composes with view filters", () => {
    const result = (minCount: number) =>
      pipe(
        Postgrest.from<Database>()("user_post_counts"),
        Postgrest.select("user_id, user_name, post_count"),
        Postgrest.gte("post_count", minCount),
        Postgrest.order("post_count", { ascending: false }),
        Postgrest.executeMultipleWithSchema(UserPostCountSchema)
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      Array<{
        readonly user_id: number | null;
        readonly user_name: string | null;
        readonly post_count: number | null;
      }>
    >();
    expectTypeOf<Effect.Error<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestError | Schema.SchemaError
    >();
  });

  it("executeFilterMapMultipleWithSchema filters out invalid view rows", () => {
    const result = pipe(
      Postgrest.from<Database>()("user_post_counts"),
      Postgrest.select("user_id, user_name, post_count"),
      Postgrest.executeFilterMapMultipleWithSchema(UserPostCountSchema)
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<
      Array<{
        readonly user_id: number | null;
        readonly user_name: string | null;
        readonly post_count: number | null;
      }>
    >();
    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<PostgrestError>();
  });

  it("executeSingleWithSchema decodes a single view row", () => {
    const result = (userId: number) =>
      pipe(
        Postgrest.from<Database>()("active_users"),
        Postgrest.select("id, name, email"),
        Postgrest.eq("id", userId),
        Postgrest.executeSingleWithSchema(ActiveUserSchema)
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

  it("executeMaybeSingleWithSchema decodes an optional view row", () => {
    const result = (email: string) =>
      pipe(
        Postgrest.from<Database>()("active_users"),
        Postgrest.select("id, name, email"),
        Postgrest.eq("email", email),
        Postgrest.executeMaybeSingleWithSchema(ActiveUserSchema)
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      Option.Option<{
        readonly id: number;
        readonly name: string;
        readonly email: string;
      }>
    >();
  });
});

// ---------------------------------------------------------------------------
// Count + view
// ---------------------------------------------------------------------------

describe("count on views", () => {
  it("executeMultipleWithCount() returns { data, count }", () => {
    const result = pipe(
      Postgrest.from<Database>()("user_post_counts"),
      Postgrest.select("user_id, post_count", { count: "exact" }),
      Postgrest.executeMultipleWithCount()
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<{
      data: Array<{ user_id: number | null; post_count: number | null }>;
      count: number | null;
    }>();
  });

  it("executeMultipleWithCountAndSchema decodes view rows + count", () => {
    const result = pipe(
      Postgrest.from<Database>()("user_post_counts"),
      Postgrest.select("user_id, user_name, post_count", { count: "exact" }),
      Postgrest.executeMultipleWithCountAndSchema(UserPostCountSchema)
    );

    expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<{
      data: Array<{
        readonly user_id: number | null;
        readonly user_name: string | null;
        readonly post_count: number | null;
      }>;
      count: number | null;
    }>();
    expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<
      PostgrestError | Schema.SchemaError
    >();
  });
});

// ---------------------------------------------------------------------------
// Mutations on updatable views
// ---------------------------------------------------------------------------

describe("mutations on an updatable view", () => {
  it("insert + execute compiles for an updatable view", () => {
    const result = (newUser: { name: string; email: string }) =>
      pipe(
        Postgrest.from<Database>()("active_users"),
        Postgrest.insert(newUser),
        Postgrest.execute
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestSingleResponse<null>
    >();
  });

  it("insert + select + executeSingle preserves view column inference", () => {
    const result = (newUser: { name: string; email: string }) =>
      pipe(
        Postgrest.from<Database>()("active_users"),
        Postgrest.insert(newUser),
        Postgrest.select("id, name, email"),
        Postgrest.executeSingle()
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<{
      id: number;
      name: string;
      email: string;
    }>();
  });

  it("update + filter + execute compiles for an updatable view", () => {
    const result = (userId: number, newName: string) =>
      pipe(
        Postgrest.from<Database>()("active_users"),
        Postgrest.update({ name: newName }),
        Postgrest.eq("id", userId),
        Postgrest.execute
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestSingleResponse<null>
    >();
  });

  it("upsert + execute compiles for an updatable view", () => {
    const result = (user: { email: string; name: string }) =>
      pipe(
        Postgrest.from<Database>()("active_users"),
        Postgrest.upsert(user, { onConflict: "email" }),
        Postgrest.execute
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestSingleResponse<null>
    >();
  });

  it("delete_ + filter + execute compiles for an updatable view", () => {
    const result = (userId: number) =>
      pipe(
        Postgrest.from<Database>()("active_users"),
        Postgrest.delete_(),
        Postgrest.eq("id", userId),
        Postgrest.execute
      );

    expectTypeOf<Effect.Success<ReturnType<typeof result>>>().toEqualTypeOf<
      PostgrestSingleResponse<null>
    >();
  });
});

// ---------------------------------------------------------------------------
// Tables and views are interchangeable in the builder pipeline
// ---------------------------------------------------------------------------

describe("tables and views in the same pipeline", () => {
  it("the same pipeline shape works against either a table or a view", () => {
    const fromTable = pipe(
      Postgrest.from<Database>()("users"),
      Postgrest.select("id, name"),
      Postgrest.eq("active", true),
      Postgrest.order("name"),
      Postgrest.executeMultiple()
    );

    const fromView = pipe(
      Postgrest.from<Database>()("active_users"),
      Postgrest.select("id, name"),
      Postgrest.order("name"),
      Postgrest.executeMultiple()
    );

    expectTypeOf<Effect.Success<typeof fromTable>>().toEqualTypeOf<
      Array<{ id: number; name: string }>
    >();
    expectTypeOf<Effect.Success<typeof fromView>>().toEqualTypeOf<
      Array<{ id: number; name: string }>
    >();
    expectTypeOf<Effect.Error<typeof fromTable>>().toEqualTypeOf<
      Effect.Error<typeof fromView>
    >();
  });
});
