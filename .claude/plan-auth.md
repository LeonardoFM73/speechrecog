# Plan: Authentication + Multi-User History

## Architecture Overview

### Backend Changes

**New files:**
- `backend/services/auth.py` — JWT token generation/validation
- `backend/services/users.py` — user CRUD (create, get, verify password)

**Modified files:**
- `backend/models/schemas.py` — add User schemas, JWT token response
- `backend/services/sessions.py` — add `username` field to SessionDoc, add list/retrieve sessions by username
- `backend/app.py` — add auth middleware, login/register endpoints

**Dependencies to add** to `requirements.txt`:
- `bcrypt==4.3.0`
- `PyJWT==2.10.1`

### MongoDB Collections

**`users` collection:**
```python
{
    _id: ObjectId,
    username: str (unique),
    password_hash: str (bcrypt),
    created_at: float (unix timestamp),
}
```

**`sessions` collection** (modified):
```python
{
    _id: ObjectId,
    session_id: str (unique UUID),
    username: str,  # NEW — who owns this session
    started_at: float,
    ended_at: float | None,
    mode: str,
    scenario_id: str,
    scenario_text: str | None,
    speaker_id: int | None,
    tts_speed: float,
    jp_level: str,
    max_turns: int,
    messages: list[SessionTurn],
    user_metadata: dict | None,
}
```

**Indexes needed:**
- `sessions.username` — for listing user sessions
- `sessions.username.started_at` — for sorting by recency

### API Endpoints

**Auth:**
- `POST /auth/register` — create user (username + password)
- `POST /auth/login` — authenticate, return JWT token
- `GET /auth/me` — get current user info (needs Bearer token)

**Sessions (modified):**
- `GET /sessions` — list all sessions for the authenticated user (new)
- `GET /sessions/{session_id}` — get one session (keep, but verify ownership)
- `POST /sessions` — create session (keep, but add username from JWT)
- `PATCH /sessions/{session_id}` — update session (verify ownership)
- `POST /sessions/{session_id}/messages` — append message (verify ownership)

**Auth middleware:**
- All session endpoints require `Authorization: Bearer <jwt>` header
- Extract username from JWT and inject into request context
- Token format: `{"sub": "<username>", "iat": <timestamp>}`
- Secret from env: `JWT_SECRET`

### Frontend Changes

**New files:**
- `frontend/app/components/LoginPage.tsx` — login/register form
- `frontend/app/context/AuthContext.tsx` — auth state management (token, user, login/logout)

**Modified files:**
- `frontend/app/hooks/useSession.ts` — store JWT, attach to requests, handle auth state
- `frontend/app/components/SessionProvider.tsx` — consume auth context, redirect to login if not authenticated
- `frontend/app/components/SessionRoot.tsx` — conditionally show LoginPage or MiguPage
- `frontend/app/services/api.ts` — add auth token header, add `listSessions` function
- `frontend/app/components/HistoryDrawer.tsx` — add scenario/session picker (list of past sessions)

**Auth flow:**
1. On app load, check localStorage for JWT token
2. If token exists, verify with `/auth/me`
3. If valid, hydrate sessions list and load active session
4. If invalid/missing, show LoginPage
5. On login, store JWT in localStorage, redirect to main page
6. On logout, clear token, redirect to login

**Scenario switching:**
- When user changes scenario, create a new session (or load existing one for that scenario)
- HistoryDrawer shows list of sessions grouped by scenario
- Clicking a session loads its history

### Implementation Order

1. Backend auth service (auth.py + users.py)
2. Backend schema updates + session model changes
3. Backend app.py endpoints + middleware
4. Frontend AuthContext + LoginPage
5. Frontend API client updates (JWT in requests)
6. Frontend useSession updates (auth-aware)
7. Frontend SessionRoot conditionals
8. HistoryDrawer session picker
9. Tests + integration

## Key Design Decisions

- **JWT in localStorage** (not httpOnly cookie) — simpler for SPA, acceptable for this self-hosted use case
- **No session expiry** (long-lived tokens) — self-hosted, no external attack surface
- **One session per scenario per user** — when switching scenario, either create new session or load existing one (idempotent by scenario_id + username)
- **Ownership verification** — all session endpoints verify that the requesting user owns the session
