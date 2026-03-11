# CodeMeet Plan

A recommendation platform for programmers and coders, which matches people based on their interests, preferences and characteristics.

## 1. Project Requirements & Architecture

- **Backend**: Java 21 / Spring Boot 4.0.3.
- **Frontend**: React 19 / TypeScript / Vite 7 / Tailwind CSS 4.
- **Database**: PostgreSQL + PostGIS (`codemeet_db`).
- **Core Entities**: User, Profile, Bio, Connection, Message.
- **Authentication**: JWT (jjwt 0.12.5) & bcrypt.

## 2. Completed Work

### Backend
- ✅ Project scaffolding (Spring Boot + Maven wrapper).
- ✅ User, Bio, and Profile entity models with repositories.
- ✅ Registration & Login (`/api/auth/register`, `/api/auth/login`) with bcrypt + JWT.
- ✅ JWT authentication filter on all `/api/**` routes.
- ✅ User API endpoints (`/users/{id}`, `/users/{id}/bio`, `/users/{id}/profile`, `/me`, `/me/bio`, `/me/profile`, `/me/alias`) now include `id` across the `/users` response family.
- ✅ Bio & Profile creation/update with proper DB constraints (`TEXT` columns for JSON-stringified multi-selects, `aboutMe` 1000-char field).
- ✅ **Recommendation Engine** — Weighted scoring across the bio fields (language 30, GPS distance up to 25, lookFor 20, experience 15, age proximity up to 10, OS 5, codingStyle 5). Returns max 10 id-only recommendations.
- ✅ **Recommendation Quality Guardrail** — Weak matches below the minimum threshold are filtered out before they reach the UI.
- ✅ **Connections** — PENDING / ACCEPTED / REJECTED states, request / accept / reject / disconnect endpoints, duplicate-prevention, and backend gating so only users with complete profiles can connect to currently recommended users.
- ✅ **Dismissed recommendations cooldown** — skipped users are stored server-side and excluded for a rolling seven-day cooldown window.
- ✅ **Profile Picture Management** — File system storage at `~/.codemeet/uploads/`, served via `/uploads/**` static resource mapping, with upload, replace, and remove support.
- ✅ **Real-time Chat** — WebSocket/STOMP at `/ws`, `@MessageMapping("/chat")`, Message entity in DB, paginated history (`/chat/history/{id}?page=&size=`), read receipts, chat file attachments.
- ✅ **Presence Service** — In-memory online tracking via WebSocket session events, `lastSeenAt` persisted on disconnect.
- ✅ **Typing Indicator** — `@MessageMapping("/chat/typing")` broadcasts to partner topic.
- ✅ **Real-time Notifications** — STOMP topic `/topic/notifications/{userId}` for connection requests.
- ✅ **Profile Visibility** — `canViewProfile()` returns 404 for users who are not recommended, pending, or connected. Email never exposed.
- ✅ **SPA Routing Support** — SecurityConfig permits all non-`/api/**` paths so deep-link navigation works.

### Frontend
- ✅ Vite + React + Tailwind CSS scaffolding with TypeScript.
- ✅ **Auth / Routing** — Login, Register pages with JWT token in localStorage, axios interceptors (401/403 → redirect), protected routes via Layout auth guard.
- ✅ **Onboarding (`SetupBio`)** — Bio fields for language, experience, lookFor, codingStyle, preferredOs, city, browser geolocation-backed coordinates, search radius, and age, plus an About Me textarea (1000-char limit with counter).
- ✅ **Dashboard** — Identity card (avatar, alias, about-me blurb), bio completion ring, quick-action grid (Discover, Network, Comms).
- ✅ **Matches** — Recommendation cards with Connect / Dismiss actions, id-only recommendation composition, and privacy-aware location rendering.
- ✅ **Connections** — Tabbed view: Pending requests (accept/decline) + Active connections (message/disconnect).
- ✅ **Chat** — Real-time STOMP messaging, partner sidebar, file/image attachments, read receipts (✓/✓✓), typing indicator, in-conversation search, unread badge, paginated scroll-back. Responsive: sidebar hidden on mobile when conversation active.
- ✅ **Public Profile** — `/profile/:id` page showing avatar, alias, bio, about-me; only accessible if connected/pending/recommended.
- ✅ **Settings** — Font picker (9 presets), Theme picker (5 themes incl. Custom 3-colour), Background picker (5 CSS patterns + custom image upload), privacy controls for avatar/location/age/last-seen, and support/source links.
- ✅ **Theme System** — CSS custom properties (`--color-zinc-*`, `--color-indigo-*`) overridden by `[data-theme]` selectors. Five themes: Default, GitHub Dark, VS Code Dark+, Dracula, Custom. Custom derives full Tailwind palette from 3 hex picks via HSL manipulation. Flash-free restore via inline `<script>` in `index.html`.
- ✅ **Font System** — CSS variable `--app-font`. 9 presets: Inter (default), 5 Monaspace (self-hosted woff2), JetBrains Mono, Fira Code (Google Fonts), System UI.
- ✅ **Background System** — `BackgroundPattern` component. 5 CSS presets (dots, grid, crosshatch, gradient mesh, none) + custom image upload stored as data-URL.
- ✅ **Notifications** — Bell icon with unread count, real-time WebSocket updates.
- ✅ **404 Page** — Catch-all route.
- ✅ **Privacy Page** — Static privacy statement with back button.
- ✅ **Responsive** — Desktop sidebar + mobile bottom nav, responsive grids throughout, including mobile Settings navigation and a global mobile logout action.
- ✅ **GPS Matching UX** — Browser geolocation capture, manual latitude/longitude fallback, and configurable radius in kilometres.
- ✅ **Mock Data Seeder** — JS and Python scripts can seed 100+ fictitious users for review and testing workflows.

## 3. Task Compliance Status

### Fully satisfied in the REST application
- ✅ Secure registration and login with bcrypt + JWT.
- ✅ Users can log out from desktop and mobile layouts.
- ✅ Profile creation and editing, including avatar upload/change/remove.
- ✅ Matching powered by more than five biographical data points.
- ✅ Browser location capture with radius-based PostGIS filtering.
- ✅ Recommendation list capped at 10 and sorted strongest-first.
- ✅ Dismissed recommendations persist through the active skip cooldown window.
- ✅ Connections, pending requests, accept/reject, disconnect, and chat-only-between-connections flow.
- ✅ Paginated real-time chat with unread indicators, typing indicators, timestamps, and chat access from connected profiles.
- ✅ `/users/{id}`, `/users/{id}/profile`, `/users/{id}/bio`, `/me`, `/me/profile`, `/me/bio`, `/recommendations`, and `/connections` now match the required REST payload expectations for the non-GraphQL part.
- ✅ Mobile and desktop responsive navigation, including Settings visibility on mobile.
- ✅ Seed/drop tooling for review with 100+ fictitious users.

### Intentional deferrals
- ⏸️ **GraphQL API (Part 2)** — intentionally excluded from the current implementation pass.

### Notes from the latest refactor
- The recommendations endpoint is id-only again so the client composes cards from `/users/{id}` + `/users/{id}/bio` as required.
- Bio and profile responses now include `id` to keep the `/users` payload family consistent.
- Connect requests are backend-gated by complete-profile and recommendation visibility rules rather than relying only on UI flow.
- Skip/dismiss uses the original rolling cooldown flow instead of permanent removal.
- Location-hidden profiles no longer leak distance or radius information in the recommendation UI.

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
  src/main/java/com/codemeet/backend/
    config/             SecurityConfig, JwtAuthenticationFilter,
                        WebConfig (SPA fallback + uploads), WebSocketConfig
    controller/         AuthController, UserController, RecommendationController,
                        ConnectionController, ChatController, BlockController
    service/            JwtService, RecommendationService, PresenceService, etc.
    model/              User, Bio, Profile, Connection, ConnectionStatus, Message
    dto/                BioDto, PrivacySettingsDto, ProfileDto, LoginRequest,
              RegisterRequest, UserResponse, PublicUserDto, MessageDto
    repository/         Spring Data JPA repos + native geospatial query projection

  application.properties   DB config, JWT secret, upload path, ddl-auto
```

### Persistence
- Appearance settings (font, theme, background, custom colours) are stored in **localStorage**.
- Privacy settings are persisted on the backend and cached in `localStorage` for smoother UX.
- `localStorage` keys: `token`, `fontPreference`, `themePreference`, `bgPreference`, `customThemeColors`, `privacySettings`.
