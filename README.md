# supabase-effect

An [Effect-ts](https://effect.website/) wrapper for [Supabase](https://supabase.com/) that provides type-safe, composable database operations.

## ⚠️ Important: Effect v4 Beta Dependency

**This library requires `effect@4.0.0-beta.29`, which is currently experimental.**

- Effect v4 is in beta and APIs may change
- Known issues:
  - Some type helpers (`Effect.Effect.Success`, `Effect.Effect.Error`) may not work in certain contexts
  - Breaking changes may occur between beta versions
- Production use: Evaluate stability requirements for your use case

We'll update to stable Effect v4 once released.

---

## TODOs

### SupabaseClient

- [x] Client Wrapper (SupabaseClient, and associated layers, constructors.)

### Authentication

- [x] Full support on authentication utils. 
- [ ] Type-safe authentication error codes.

### Storage

- [x] Full support on storage utils.

### Functions (Serverless features from supabase)

- [ ] Full support on function utils.

### Realtime 

- [ ] Full support on realtime utils.

### Postgrest

- [x] Basic Postgrest utility - Effect-ts styled utilities
- [x] Type-safe postgres error codes.
- [ ] PostgrestQueryBuilder support - needs further specification, and discussion on supportability.
