# API design

## Routes

- Every route is prefixed with `/api` (`app.setGlobalPrefix('api')` in `src/main.ts`).
- Controllers use a plural kebab-case resource path: `@Controller('branches')`, `@Controller('oidc/admin')`.
- Keep controllers thin: parse input, call one service method, return the result. Business logic and repository access belong in services.

## Validation

- Every request body and query uses a DTO with class-validator decorators (`@IsString()`, `@IsUUID()`, `@IsOptional()`, `@IsEnum()`, `@ValidateNested()`, ...).
- The global `ValidationPipe` (`src/main.ts`) runs with `transform: true` and `enableImplicitConversion: true`, so query strings become numbers and booleans where the DTO types say so.
- The pipe does **not** strip unknown properties (`whitelist` is not set). A DTO validates only the fields it declares, so services must read named fields from the DTO and never spread it into an entity.
- Use `@IsUUID()` for ids in DTOs. Route params use `ParseUUIDPipe` in a few places only.

## Errors

- Throw NestJS exceptions (`NotFoundException`, `BadRequestException`, `ForbiddenException`, `ConflictException`, `InternalServerErrorException`). Do not create custom error classes.
- The message is an i18n key, not user-facing text. The frontend translates it:

  ```typescript
  throw new NotFoundException('error.notFound');
  throw new ForbiddenException('error.forbiddenDescription');
  ```

- Reuse existing keys (for example `error.notFound`, `error.forbiddenDescription`, `error.noPermission`, `error.invalidData`, `error.internal`) before adding a new one. A new key must exist in both Turkish and English UI locales (see root `docs/system/contracts.md`).
- Do not write raw English messages. About 15 legacy sites still do (`new NotFoundException('Attendee not found')`); do not copy them.
- Error response shape, produced by `HttpExceptionFilter`: `{ statusCode, timestamp, path, message }`.
- Upload errors: `MulterExceptionFilter` answers with `error.fileTooLarge` or `error.somethingWentWrong`.

## Lists and pagination

- `PaginationDto` (`shared/dto/pagination.dto.ts`) defines `sort`, `pageNumber` (default 1) and `pageSize` (default 50). Query DTOs extend it when they need it.
- Not every service applies these fields. Before you rely on paging for an endpoint, read its service. For example, the attendee list ignores `pageNumber` and `pageSize`, while the branch list applies `skip`/`take`.
- Keep the response shape of an existing list endpoint when you change it.

## Serialization and sensitive fields

- `ClassSerializerInterceptor` is global. Mark sensitive entity fields with `@Exclude()` so they never reach a response.
- Never return password hashes, tokens, OAuth data or secrets, and never log them.

## Files

- Uploads use Multer. `MulterExceptionFilter` maps upload errors to i18n keys.
- Read and write files through `FileStorageService` (`shared/storage`). It uses local disk or Cloudflare R2 depending on configuration. Do not write to `uploads/` directly from a module.

## Rate limiting

- `ThrottlerGuard` is global: 100 requests per 60 seconds per client by default. Routes override it with `@Throttle()` or skip it with `@SkipThrottle()`.

## Queries

- Use TypeORM repositories and the QueryBuilder. Do not add raw SQL outside migrations.
- Search filters use `LOWER(...) LIKE :search` or the Turkish-aware helpers in `shared/utils/turkish-search.util.ts`.
