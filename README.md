# supabase-effect

An [Effect-ts](https://effect.website/) wrapper for [Supabase](https://supabase.com/) that provides type-safe, composable database operations.
*NOTE*: it only supports effect@v4, which is currently experimental. (2026-03-11)

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
