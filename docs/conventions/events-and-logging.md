# Events, activity log and diagnostic logging

## Activity log

Business actions that users or admins should see in the activity feed are emitted as events. The `activity` module stores them.

```typescript
this.eventEmitter.emit(
  ACTIVITY_EVENT,
  new ActivityEvent(
    ActivityType.<TYPE>,
    EntityType.<ENTITY>,
    entityId,       // string | null
    userId,         // string | null
    actorCallSign,  // string | null
    targetCallSign, // string | null
    { /* metadata: identifiers and small values only */ },
  ),
);
```

- `ACTIVITY_EVENT` and `ActivityEvent` are in `src/activity/events/activity.events.ts`. The `ActivityType` and `EntityType` enums are in `src/activity/enums/activity-type.enum.ts`. Add new values there.
- `ActivityListener` persists the event. A persistence error is caught and logged, so an activity failure never fails the request.
- Some modules emit plain dotted event names directly (for example `'membership.approved'` in `branch/services/membership.service.ts`, which also matches an `ActivityType` value). Document the payload of any new event name in the emitting module.
- Do not put secrets, tokens, emails or personal data into metadata beyond what the activity feed already shows.

## Diagnostic logging

- Use `shared/logging/event-logger.ts` for structured diagnostics in OIDC and publishing. It writes only the fields of `LogEvent` (dotted `event` name, ids, `step`, `status`, error code), so a request, body or error message cannot leak through by accident.
- Other code uses the Nest `Logger` with a fixed context name (`private readonly logger = new Logger(Foo.name)`).
- Never log headers, cookies, query strings, request bodies, tokens, codes, passwords or emails.

## HTTP errors

`HttpExceptionFilter` (global):

- 5xx: logged as an error with method and path only.
- 401, 403, 404: not logged.
- Other 4xx: logged at debug level with method and path only.
- Responds with `{ statusCode, timestamp, path, message }`.
