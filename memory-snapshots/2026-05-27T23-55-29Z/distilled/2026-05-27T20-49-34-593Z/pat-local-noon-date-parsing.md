# HTML date inputs are parsed as local-noon timestamps to dodge tz off-by-one

- **id**: `pat-local-noon-date-parsing`
- **category**: pattern
- **confidence**: 0.85
- **first seen**: 2026-05-27T20:49:34.593Z
- **reference count**: 0
- **last referenced**: never
- **evidence**:
  - chain:0003
  - src/features/todos/todos.feature.ts (parseDueDateInput)
  - specs/0003.md (Risks: timezone)

HTML <input type="date"> returns YYYY-MM-DD in local time. Parsing this as new Date(s) gives UTC midnight, which is the previous day in tz east of UTC and the same day in tz west. The convention in this repo is to parse it as local-noon via new Date(y, m-1, d, 12, 0, 0, 0).getTime(). Local-noon is at least 12 hours away from either UTC boundary across all real tz from UTC-12 to UTC+12, so the formatted YYYY-MM-DD round-trips correctly. Kiribati (UTC+14) is the known exception; out of scope. See parseDueDateInput in todos.feature.ts.
