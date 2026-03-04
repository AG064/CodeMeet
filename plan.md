# CodeMeet Plan

A recommendation platform for programmers and coders, which matches people based on their interests, preferences and characteristics.

## 1. Project Requirements & Architecture

- **Backend**: Java 21 / Spring Boot 4.0.3.
- **Frontend**: React 19 / TypeScript / Vite 7 / Tailwind CSS 4.
- **Database**: PostgreSQL (`codemeet_db`).
- **Core Entities**: User, Profile, Bio, Connection, Message.
- **Authentication**: JWT (jjwt 0.12.5) & bcrypt.

## 2. Completed Work

### Backend
- ✅ Project scaffolding (Spring Boot + Maven wrapper).
- ✅ User, Bio, and Profile entity models with repositories.
- ✅ Registration & Login (`/api/auth/register`, `/api/auth/login`) with bcrypt + JWT.
- ✅ JWT authentication filter on all `/api/**` routes.
- ✅ User API endpoints (`/users/{id}`, `/users/{id}/bio`, `/users/{id}/profile`, `/me`, `/me/bio`, `/me/profile`, `/me/alias`).
- ✅ Bio & Profile creation/update with proper DB constraints (`TEXT` columns for JSON-stringified multi-selects, `aboutMe` 1000-char field).
- ✅ **Recommendation Engine** — Weighted scoring across 6 bio fields (language 30, city 25, lookFor 20, experience 15, OS 5, codingStyle 5). Returns max 10 IDs.
- ✅ **Connections** — PENDING / ACCEPTED / REJECTED states, request / accept / reject / disconnect endpoints, duplicate-prevention.
- ✅ **Profile Picture Upload** — File system storage at `~/.codemeet/uploads/`, served via `/uploads/**` static resource mapping.
- ✅ **Real-time Chat** — WebSocket/STOMP at `/ws`, `@MessageMapping("/chat")`, Message entity in DB, paginated history (`/chat/history/{id}?page=&size=`), read receipts, chat file attachments.
- ✅ **Presence Service** — In-memory online tracking via WebSocket session events, `lastSeenAt` persisted on disconnect.
- ✅ **Typing Indicator** — `@MessageMapping("/chat/typing")` broadcasts to partner topic.
- ✅ **Real-time Notifications** — STOMP topic `/topic/notifications/{userId}` for connection requests.
- ✅ **Profile Visibility** — `canViewProfile()` returns 404 for users who are not recommended, pending, or connected. Email never exposed.
- ✅ **SPA Routing Support** — SecurityConfig permits all non-`/api/**` paths so deep-link navigation works.

### Frontend
- ✅ Vite + React + Tailwind CSS scaffolding with TypeScript.
- ✅ **Auth / Routing** — Login, Register pages with JWT token in localStorage, axios interceptors (401/403 → redirect), protected routes via Layout auth guard.
- ✅ **Onboarding (`SetupBio`)** — Six bio fields (multi-select pills for language, experience, lookFor, codingStyle, preferredOs; text input for city) + About Me textarea (1000-char limit with counter).
- ✅ **Dashboard** — Identity card (avatar, alias, about-me blurb), bio completion ring, quick-action grid (Discover, Network, Comms).
- ✅ **Matches** — Recommendation cards with Connect / Dismiss actions.
- ✅ **Connections** — Tabbed view: Pending requests (accept/decline) + Active connections (message/disconnect).
- ✅ **Chat** — Real-time STOMP messaging, partner sidebar, file/image attachments, read receipts (✓/✓✓), typing indicator, in-conversation search, unread badge, paginated scroll-back. Responsive: sidebar hidden on mobile when conversation active.
- ✅ **Public Profile** — `/profile/:id` page showing avatar, alias, bio, about-me; only accessible if connected/pending/recommended.
- ✅ **Settings** — Font picker (9 presets), Theme picker (5 themes incl. Custom 3-colour), Background picker (5 CSS patterns + custom image upload), Privacy controls (online status, typing, read receipts).
- ✅ **Theme System** — CSS custom properties (`--color-zinc-*`, `--color-indigo-*`) overridden by `[data-theme]` selectors. Five themes: Default, GitHub Dark, VS Code Dark+, Dracula, Custom. Custom derives full Tailwind palette from 3 hex picks via HSL manipulation. Flash-free restore via inline `<script>` in `index.html`.
- ✅ **Font System** — CSS variable `--app-font`. 9 presets: Inter (default), 5 Monaspace (self-hosted woff2), JetBrains Mono, Fira Code (Google Fonts), System UI.
- ✅ **Background System** — `BackgroundPattern` component. 5 CSS presets (dots, grid, crosshatch, gradient mesh, none) + custom image upload stored as data-URL.
- ✅ **Notifications** — Bell icon with unread count, real-time WebSocket updates.
- ✅ **404 Page** — Catch-all route.
- ✅ **Privacy Page** — Static privacy statement with back button.
- ✅ **Responsive** — Desktop sidebar + mobile bottom nav, responsive grids throughout.

## 3. Known Gaps & Remaining Work

### Must Fix
- ⚠️ **Dismiss not persisted** — `handleDismiss` in `Matches.tsx` removes from local state only; no backend API call. Dismissed users reappear on page reload. Need: backend `DISMISSED` connection status or separate table, plus frontend API call.
- ⚠️ **Profile picture remove** — Upload and change work, but there is no endpoint or UI to *remove* an existing picture (task requires add/remove/change).

### Should Improve
- ⚠️ **Minimum recommendation score** — Users with zero matching fields still appear. Consider a threshold (e.g. score ≥ 10) to avoid weak matches.
- ⚠️ **Location exclusion** — City match boosts score (+25) but different-city users are not excluded. Task says impractically far matches should not be recommended. Consider filtering to same-city only, or at least requiring some minimum score contribution from location.
- ⚠️ **RecommendationService scalability** — Currently loads all bios and all connections into memory. Should use targeted DB queries for 100+ users.
- ⚠️ **`Profile.isOnline` field** — Dead column; presence tracked in-memory by `PresenceService`. Can be removed.

### Not Yet Implemented
- ❌ **Mock Data Seeder** — Spring `ApplicationRunner` or SQL scripts to inject 100+ fictitious users with varied bios and random connections. Must support drop-and-reload workflow.
- ❌ **GraphQL API (Part 2)** — Required schema types (`User`, `Bio`, `Profile`), queries (`user(id)`, `bio(id)`, `profile(id)`, `me`, `myBio`, `myProfile`, `recommendations`, `connections`), developer-mode playground toggle.

## 4. Architecture Notes

```
frontend/          React 19 + Vite 7 + Tailwind CSS 4
  src/
    api/axios.ts        Axios instance with JWT interceptor
    layout/Layout.tsx   Auth guard, sidebar, header, BackgroundPattern
    pages/              Login, Register, Dashboard, SetupBio, Matches,
                        Connections, Chat, Settings, Privacy, PublicProfile, NotFound
    index.css           @font-face, @theme, CSS custom properties,
                        theme blocks, background patterns, utility classes
  index.html            Google Fonts + early preference restore script

backend/           Spring Boot 4.0.3 + Java 21
  src/main/java/com/matchme/backend/
    config/             SecurityConfig, JwtAuthenticationFilter,
                        WebConfig (SPA fallback + uploads), WebSocketConfig
    controller/         AuthController, UserController, RecommendationController,
                        ConnectionController, ChatController
    service/            JwtService, RecommendationService, PresenceService, etc.
    model/              User, Bio, Profile, Connection, ConnectionStatus, Message
    dto/                BioDto, ProfileDto, LoginRequest, RegisterRequest,
                        UserResponse, MessageDto
    repository/         Spring Data JPA repos

  application.properties   DB config, JWT secret, upload path, ddl-auto
```

### Persistence
- All settings (font, theme, background, custom colours, privacy toggles) stored in **localStorage** — no backend round-trip needed.
- `localStorage` keys: `token`, `fontPreference`, `themePreference`, `bgPreference`, `customThemeColors`, `privacySettings`.
