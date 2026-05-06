# Ridgeway Site - Overnight Intelligence Platform

Deliver a hosted, AI-first intelligence platform that transforms fragmented overnight operational signals into a validated morning briefing for industrial site operators.

## 🚀 Overview

Ridgeway Site is a full-stack platform designed to process, analyze, and deliver intelligent operational briefings. It acts as an automated intelligence gatherer, taking overnight signals and utilizing AI (Anthropic's Claude) to provide a validated morning briefing. 

## 🔐 Authentication Flows

The platform supports comprehensive authentication flows via OTP (One-Time Password) verification:
- **Registration & Verification**: Users register and receive a secure OTP via email to verify their account before accessing the operations platform.
- **Forgot Password**: Users can request a password reset, verify their identity via an emailed OTP, and securely configure a new password.
- **Session Management**: Secure JWT-based access and refresh tokens handled via secure cookies and local storage.

## 🛠️ Tech Stack

### Client (Frontend)
- **Framework**: Next.js 16 (React 19)
- **Styling**: Tailwind CSS 4, Radix UI Primitives
- **State Management**: Zustand, React Query (@tanstack/react-query)
- **Forms & Validation**: React Hook Form, Zod
- **Data Visualization & Maps**: Recharts, Leaflet, React Three Fiber (3D)
- **Animations**: Framer Motion

### Server (Backend)
- **Runtime**: Node.js (via Bun)
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **Cache & Queue**: Redis, BullMQ (for asynchronous background jobs)
- **AI Integration**: Anthropic AI SDK
- **Authentication**: JSON Web Tokens (JWT), bcrypt
- **Emails**: Nodemailer, Mailgen

### Infrastructure & Deployment
- **Containerization**: Docker & Docker Compose
- **Environments**: Development (`docker-compose.yml`) & Production (`docker-compose.prod.yml`)

## 📁 Project Structure

```text
RidgewaySite/
├── client/                 # Next.js frontend application
│   ├── src/                # Frontend source code
│   ├── package.json        # Client dependencies
│   └── Dockerfile          # Client Docker configuration
├── server/                 # Node.js/Express backend application
│   ├── src/                # Backend source code
│   ├── package.json        # Server dependencies (Bun)
│   └── Dockerfile          # Server Docker configuration
├── docker-compose.yml      # Development Docker configuration
├── docker-compose.prod.yml # Production Docker configuration
└── .env                    # Root environment variables
```

## ⚙️ Prerequisites

- **Docker** and **Docker Compose**
- **Node.js** (v18+)
- **Bun** (for local server development)

## 🚦 Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd RidgewaySite
```

### 2. Environment Setup

Create the necessary `.env` files based on the provided examples. 
You will typically need to configure:
- MongoDB connection strings
- Redis connection strings
- JWT Secret
- SMTP Credentials (for emails)
- Anthropic API Key

### 3. Running with Docker (Recommended)

The easiest way to run the entire stack (Client, Server, MongoDB, Redis) is using Docker Compose.

**Development Mode:**
```bash
docker-compose up -d --build
```
- Client runs on `http://localhost:3000`
- Server API runs on `http://localhost:8000`
- MongoDB runs on `localhost:27017`
- Redis runs on `localhost:6379`

**Production Mode:**
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

### 4. Running Locally (Without Docker)

**Start the Server:**
```bash
cd server
bun install
bun run dev
```

**Start the Client:**
```bash
cd client
npm install
npm run dev
```

## 🌐 API Endpoints

The backend exposes the following REST API endpoints. All routes are prefixed with `/api/v1`.
Endpoints marked with **(Auth)** require a valid JWT token.

### Health
- `GET /health` - Check API status

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user
- `POST /auth/verify-email` - Verify email address
- `POST /auth/refresh-token` - Refresh access token
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password
- `POST /auth/logout` **(Auth)** - Logout user
- `GET /auth/current-user` **(Auth)** - Get current user profile
- `POST /auth/change-password` **(Auth)** - Change current password
- `POST /auth/resend-email-verification` **(Auth)** - Resend email verification link

### Events
- `GET /events` **(Auth)** - Get events for a specific night
- `GET /events/:id` **(Auth)** - Get details of a specific event
- `PATCH /events/:id/review` **(Auth)** - Apply an AI review to an event

### Incidents
- `GET /incidents` **(Auth)** - Get incidents (can be filtered by night, status, severity)
- `GET /incidents/:id` **(Auth)** - Get details of a specific incident
- `GET /incidents/:id/graph` **(Auth)** - Get the evidence graph for visual representation

### Investigations
- `POST /investigations/start` **(Auth)** - Start a new AI-driven investigation
- `GET /investigations/:jobId/stream` **(Auth)** - Stream investigation progress using SSE
- `GET /investigations/:id` **(Auth)** - Get details of an investigation

### Briefings
- `GET /briefings/latest` **(Auth)** - Get the latest morning briefing
- `PATCH /briefings/:id/sections/:sectionName` **(Auth)** - Update a specific briefing section
- `POST /briefings/:id/approve` **(Auth)** - Approve a briefing

### Reviews
- `POST /reviews` **(Auth)** - Create a manual review for an event
- `GET /reviews/night/:date` **(Auth)** - Get all reviews for a specific night

### Map & Drones
- `GET /map/geometry` **(Auth)** - Get map geometry data
- `GET /map/events` **(Auth)** - Get map event pins
- `GET /map/drones/route/:patrolId` **(Auth)** - Get drone patrol route
- `GET /map/drones/:patrolId/state` **(Auth)** - Get current drone state
- `POST /map/drones/simulate-mission` **(Auth)** - Simulate a drone mission

## 📝 Scripts

### Server
- `bun run dev`: Starts the backend server in development/watch mode.
- `bun run start`: Starts the backend server in production mode.

### Client
- `npm run dev`: Starts the Next.js development server.
- `npm run build`: Builds the Next.js application for production.
- `npm run start`: Starts the Next.js production server.
- `npm run lint`: Runs ESLint.

## 📄 License

ISC License
