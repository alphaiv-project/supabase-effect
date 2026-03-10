# effect-supabase

[![npm version](https://img.shields.io/npm/v/effect-supabase.svg)](https://www.npmjs.com/package/effect-supabase)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An [Effect-ts](https://effect.website/) wrapper for [Supabase](https://supabase.com/) that provides type-safe, composable database operations.

## Features

- 🎯 **Type-safe**: Full TypeScript support with Effect's type system
- 🔄 **Composable**: Leverage Effect's powerful composition capabilities
- 🛡️ **Error handling**: Built-in error handling with Effect's error management
- 🧩 **Dependency injection**: Use Effect's Context system for clean architecture
- 📦 **Lightweight**: Minimal wrapper around the official Supabase client

## Installation

```bash
# pnpm
pnpm add effect-supabase effect @supabase/supabase-js

# npm
npm install effect-supabase effect @supabase/supabase-js

# yarn
yarn add effect-supabase effect @supabase/supabase-js
```

## Quick Start

```typescript
import { Effect, Console } from "effect";
import * as Supabase from "effect-supabase";

// Create a Supabase layer with your configuration
const SupabaseLayer = Supabase.layer({
  url: "https://your-project.supabase.co",
  key: "your-anon-key",
});

// Use the Supabase client in your effects
const program = Supabase.withClient((client) =>
  Effect.promise(() =>
    client
      .from("users")
      .select("*")
      .then((result) => result.data)
  )
).pipe(
  Effect.flatMap((users) => Console.log("Users:", users)),
  Effect.provide(SupabaseLayer)
);

// Run the program
Effect.runPromise(program);
```

## Usage

### Creating a Supabase Service

#### Basic Layer

```typescript
import * as Supabase from "effect-supabase";

const layer = Supabase.layer({
  url: process.env.SUPABASE_URL!,
  key: process.env.SUPABASE_ANON_KEY!,
});
```

#### Layer from Effect

```typescript
import { Config, Effect } from "effect";
import * as Supabase from "effect-supabase";

const configEffect = Effect.all({
  url: Config.string("SUPABASE_URL"),
  key: Config.string("SUPABASE_ANON_KEY"),
});

const layer = Supabase.layerEffect(configEffect);
```

### Accessing the Client

#### Direct Access

```typescript
import { Effect } from "effect";
import * as Supabase from "effect-supabase";

const program = Effect.gen(function* () {
  const client = yield* Supabase.client;
  
  const { data, error } = yield* Effect.promise(() =>
    client.from("todos").select("*")
  );
  
  if (error) throw error;
  return data;
});
```

#### Using withClient Helper

```typescript
import { Effect } from "effect";
import * as Supabase from "effect-supabase";

const getAllTodos = Supabase.withClient((client) =>
  Effect.promise(() =>
    client
      .from("todos")
      .select("*")
      .then((result) => {
        if (result.error) throw result.error;
        return result.data;
      })
  )
);
```

### Real-time Subscriptions

```typescript
import { Effect, Stream } from "effect";
import * as Supabase from "effect-supabase";

const todosStream = Supabase.withClient((client) =>
  Stream.async<{ id: number; task: string }>((emit) => {
    const channel = client
      .channel("todos-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "todos" },
        (payload) => {
          emit.single(payload.new as any);
        }
      )
      .subscribe();

    return Effect.sync(() => {
      channel.unsubscribe();
    });
  })
);
```

### Authentication

```typescript
import { Effect } from "effect";
import * as Supabase from "effect-supabase";

const signIn = (email: string, password: string) =>
  Supabase.withClient((client) =>
    Effect.promise(() =>
      client.auth.signInWithPassword({ email, password })
    )
  );

const signOut = Supabase.withClient((client) =>
  Effect.promise(() => client.auth.signOut())
);

const getCurrentUser = Supabase.withClient((client) =>
  Effect.promise(() => client.auth.getUser())
);
```

## API Reference

### Types

#### `SupabaseConfig`

Configuration object for creating a Supabase client.

```typescript
interface SupabaseConfig {
  readonly url: string;
  readonly key: string;
  readonly options?: SupabaseClientOptions;
}
```

### Tags

#### `Supabase`

The Effect Context tag for the Supabase client.

```typescript
class Supabase extends Context.Tag("effect-supabase/Supabase")<
  Supabase,
  SupabaseClient
>() {}
```

### Constructors

#### `make`

Creates a Supabase client directly.

```typescript
const make: (config: SupabaseConfig) => SupabaseClient;
```

### Layers

#### `layer`

Creates a Layer that provides the Supabase service.

```typescript
const layer: (config: SupabaseConfig) => Layer.Layer<Supabase>;
```

#### `layerEffect`

Creates a Layer from an Effect that produces a SupabaseConfig.

```typescript
const layerEffect: (
  config: Effect.Effect<SupabaseConfig>
) => Layer.Layer<Supabase>;
```

### Accessors

#### `client`

An Effect that provides access to the Supabase client.

```typescript
const client: Effect.Effect<SupabaseClient, never, Supabase>;
```

### Utils

#### `withClient`

Helper function to work with the Supabase client.

```typescript
const withClient: <A, E, R>(
  f: (client: SupabaseClient) => Effect.Effect<A, E, R>
) => Effect.Effect<A, E, R | Supabase>;
```

## Examples

### Complete CRUD Example

```typescript
import { Effect, Console } from "effect";
import * as Supabase from "effect-supabase";

interface Todo {
  id: number;
  task: string;
  completed: boolean;
}

const SupabaseLayer = Supabase.layer({
  url: process.env.SUPABASE_URL!,
  key: process.env.SUPABASE_ANON_KEY!,
});

const createTodo = (task: string) =>
  Supabase.withClient((client) =>
    Effect.promise(() =>
      client.from("todos").insert({ task, completed: false }).select()
    )
  );

const getTodos = Supabase.withClient((client) =>
  Effect.promise<Todo[]>(() =>
    client
      .from("todos")
      .select("*")
      .then((result) => {
        if (result.error) throw result.error;
        return result.data as Todo[];
      })
  )
);

const updateTodo = (id: number, completed: boolean) =>
  Supabase.withClient((client) =>
    Effect.promise(() =>
      client.from("todos").update({ completed }).eq("id", id)
    )
  );

const deleteTodo = (id: number) =>
  Supabase.withClient((client) =>
    Effect.promise(() => client.from("todos").delete().eq("id", id))
  );

const program = Effect.gen(function* () {
  yield* Console.log("Creating todo...");
  yield* createTodo("Learn Effect-ts");

  yield* Console.log("Fetching todos...");
  const todos = yield* getTodos;
  yield* Console.log("Todos:", todos);

  if (todos.length > 0) {
    yield* Console.log("Updating todo...");
    yield* updateTodo(todos[0].id, true);
  }
}).pipe(Effect.provide(SupabaseLayer));

Effect.runPromise(program);
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © [Jungin Yu](mailto:jungini1226@gmail.com)

## Resources

- [Effect Documentation](https://effect.website/)
- [Supabase Documentation](https://supabase.com/docs)
- [Effect Discord](https://discord.gg/effect-ts)
