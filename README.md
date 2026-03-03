# CodeMeet

A full-stack recommendation application designed to connect developers, programmers, and hobbyists based on their programming languages, interests, and characteristics.

## Project Overview

CodeMeet is an application tailored for coders. It provides:
- Secure User Authentication (JWT and bcrypt)
- Profile & Bio creation to highlight tech stack and interests
- An intelligent recommendation algorithm
- A connection system to link with like-minded peers
- Real-time chat between matching developers

## Current Status

We have implemented the following features:
- **Backend Setup**: Full Spring Boot foundational functionality with PostgreSQL integration.
- **Security**: User registration and login flow using JWT, and protected routes.
- **Core Entities**: Endpoints for creating and updating Bios and Profiles.
- **Matching & Connections**: A backend recommendation engine logic with scoring, and a complete connections system (accepting/dismissing).
- **Frontend Foundations**: React + Vite frontend scaffolding with Tailwind CSS integration.
- **UI Screens**: Authentication flows (Login/Register), Onboarding (`SetupBio`), Dashboard, Matching View, Connections list, and Active Chat.
- **Real-time Features**: Implemented full STOMP WebSocket chat with typing indicators and online presence tracking.
- **Privacy**: Strict profile visibility rules (404 for unconnected users) and email obfuscation.

All core features, including Chat, Matching, and Profile management are fully implemented. Next planned phase is Data Seeding for scale testing and GraphQL API implementation.

## Technology Stack & Dependencies

### Backend
- **Java 21**
- **Spring Boot 4.0.3**
  - Spring Boot Starter WebMVC
  - Spring Boot Starter Data JPA
  - Spring Boot Starter Security
  - Spring Boot Starter WebSocket
- **PostgreSQL** (Database)
- **JJWT API 0.12.5** (JSON Web Tokens)
- **Lombok**
- **Maven** (Build Tool)

### Frontend
- **Node.js 18+**
- **React 19.x** with **TypeScript**
- **Vite 7.x** (Build Tool)
- **Tailwind CSS 4.x** (Styling)
- **React Router DOM 7.x** (Routing)
- **Axios** (HTTP Client)

## Setup and Installation Instructions

### Prerequisites (System Dependencies)
To run this project, you need to install the following software on your local machine:

- **Java JDK 21**: 
  - *Windows/Mac*: Download and install from [Eclipse Temurin](https://adoptium.net/temurin/releases/?version=21) or [Oracle](https://www.oracle.com/java/technologies/downloads/#java21).
  - *Ubuntu/Debian/WSL*: `sudo apt install openjdk-21-jdk`
  - *MacOS (Homebrew)*: `brew install openjdk@21`
- **Node.js 18+**: 
  - *Windows/Mac*: Download and install from the official [Node.js website](https://nodejs.org/). (We recommend using the LTS version).
  - *Ubuntu/Debian/WSL*: `sudo apt install nodejs npm` (or via [NVM](https://github.com/nvm-sh/nvm))
  - *MacOS (Homebrew)*: `brew install node`
- **PostgreSQL**: 
  - *Windows/Mac*: Download the installer from the official [PostgreSQL downloads page](https://www.postgresql.org/download/).
  - *Ubuntu/Debian/WSL*: `sudo apt install postgresql postgresql-contrib` (Note: for WSL start the service via `sudo service postgresql start`)
  - *MacOS (Homebrew)*: `brew install postgresql`
- **Maven** (Optional): The project includes a Maven wrapper (`mvnw`/`mvnw.cmd`) which downloads Maven automatically. If you'd prefer to install it globally:
  - *Ubuntu/Debian/WSL*: `sudo apt install maven`
  - *MacOS (Homebrew)*: `brew install maven`

### Database Setup
1. Open your PostgreSQL interactive terminal (`psql`) or a database tool like pgAdmin.
2. Create a database for the application (e.g., `codemeet_db`).
3. Make sure you have your database password ready.

### Backend Setup (Spring Boot)
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Update the `src/main/resources/application.properties` file with your PostgreSQL database URL and credentials:
   ```properties
   spring.datasource.url=jdbc:postgresql://localhost:5432/codemeet_db
   spring.datasource.username=your_postgres_username
   spring.datasource.password=your_postgres_password
   # Add JWT secret and expiration settings if needed
   ```
3. Build the backend dependencies and ensure it compiles:
   ```bash
   ./mvnw clean install
   ```
4. Start the backend server:
   ```bash
   ./mvnw spring-boot:run
   ```
   *The backend should default to running on `http://localhost:8080`.*

### Frontend Setup (React/Vite)
1. Open a new terminal window and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install the necessary NPM dependencies:
   ```bash
   npm install
   ```
3. (Optional) Create a `.env` file in the `frontend` directory with your backend API URL:
   ```env
   VITE_API_BASE_URL=http://localhost:8080
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The frontend should start on `http://localhost:5173` or a similar port.*

## Usage Guide
Once both servers are running:
1. Open the frontend URL (typically `http://localhost:5173`).
2. Register for a new account.
3. Complete your Bio and Profile through the onboarding questionnaire.
4. Browse developer matches on the **Matches** page and send connection requests.
5. Manage requests in **Connections** page.
6. Once connected, initiate a real-time chat from the connections list or chat interface!

## Additional Features
- **Real-time Chat**: Connects via WebSocket/STOMP.
- **Online Presence**: Shows user status (online/offline) and last seen time.
- **Typing Indicators**: Shows when a user is typing a message.
- *Upcoming: GraphQL API for data querying.*
