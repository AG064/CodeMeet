# CodeMeet Plan

A recommendation platform for programmers and coders, which matches people based on their interests, preferences and characteristics.

## 1. Project Requirements & Architecture

- **Backend**: Java / Spring Boot.
- **Frontend**: React / TypeScript / Vite.
- **Database**: PostgreSQL.
- **Core Entities**: User, Profile, Bio, Recommendations, Connections, Messages.
- **Authentication**: JWT & bcrypt.

## 2. Current Status (What is Done)
- ✅ Project scaffolding (Java Backend + React Frontend).
- ✅ User, Bio, and Profile entity models with their respective repositories.
- ✅ Registration & Login (bcrypt & JWT authentication).
- ✅ Basic User API endpoints (`/users/{id}`, `/me`).
- ✅ Updating and creating Bio & Profile API endpoints (`/me/bio`, `/me/profile`) with proper DB constraints and column definitions (`TEXT` for multi-select JSON stringification).
- ✅ **Step 1: Recommendation Engine** (Defined 5+ bio data points, scoring logic, `/recommendations` API endpoint).
- ✅ **Step 2: Connections** (Connection entities, states, `/connections` API endpoints, dismissing/accepting logic).
- ✅ **Step 3 Backend: Images & Files** (File system storage, `/api/me/profile-picture` upload endpoint, serving via static route `/uploads/**`).
- ✅ **Step 4 Backend: Real-time Chat** (WebSocket/STOMP setup, `Message` entity in DB, STOMP `/app/chat` mapping, read receipts, and pagination endpoints).
- ✅ **Frontend scaffolding** (Vite + React + Tailwind CSS).
- ✅ **Frontend Auth/Routing**: Login, Register UI with API integration and JWT storage, protected routes.
- ✅ **Frontend Onboarding Flow (`SetupBio.tsx`)**: Multi-step Cyberpunk-themed onboarding UI with completion %, validation, and multi-select. Backend saving working correctly (`/api/me/bio`).
- ✅ **Frontend Dashboard**: User status, avatar upload, navigation hub (`Dashboard.tsx`).
- ✅ **Frontend Matches**: Recommendation view with Connect/Dismiss (`Matches.tsx`).
- ✅ **Frontend Connections**: Pending requests & Active links management (`Connections.tsx`).
- ✅ **Frontend Chat**: Real-time messaging, chronological sorting, typing indicators, online presence (`Chat.tsx`).
- ✅ **Real-time Features**: Online status (Green/Gray dots), "Last seen at" timestamps, Typing indicators ("...").

## 3. Next Steps & Action Plan

### Step 4: Mock Data & Review Prep
- Build a database seeder script or Spring ApplicationRunner to inject at least 100 fictitious users with varied bios and random connections into the DB to test scaling.
- Create script/mechanism to drop DB and reload mock data easily.

### Step 5: GraphQL API (Part 2)
- Expose server functionality via GraphQL.
- Implement required schema (`User`, `Bio`, `Profile`).
- Add toggle for developer mode regarding GraphQL playground.
