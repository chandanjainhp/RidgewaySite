# Ridgeway Site Overnight Intelligence Platform

An intelligent incident management and investigation platform built with modern web technologies and AI-powered analysis.

## Project Overview

The Ridgeway Site Overnight Intelligence Platform is a comprehensive solution for real-time event monitoring, incident management, investigation tracking, and AI-assisted analysis. It combines a Next.js frontend with a Node.js backend to provide seamless incident response and correlation.

## Key Features

- **Real-time Event Monitoring**: Track and analyze events as they occur
- **Incident Management**: Create, track, and manage incidents with detailed information
- **Investigation Workflows**: Structured investigation processes with correlation analysis
- **AI-Powered Analysis**: Intelligent agent for incident analysis and recommendations
- **Drone Simulation**: Simulate drone operations for incident response
- **Briefing System**: Generate and manage incident briefings
- **Review & Audit**: Complete audit trail and review capabilities
- **Map Visualization**: Geographic visualization of incidents and events

## Tech Stack

### Frontend
- **Next.js** - React framework for production
- **JavaScript** - Client-side logic
- **CSS** - Styling with global and component-level styles
- **PostCSS** - CSS processing

### Backend
- **Node.js** - Server runtime
- **Express.js** - Web framework
- **MongoDB** - Primary database
- **Redis** - Caching and session management
- **Neo4j/Graph Database** - Relationship and correlation data
- **Bull** - Job queue for async processing

### AI & Intelligence
- **Anthropic Claude** - AI model for intelligent analysis
- **Agent Framework** - Custom AI agent implementation
- **Tool Registry** - Extensible tool system for agent actions

## Project Structure

```
client/                 # Next.js frontend application
├── src/
│   ├── app/            # Next.js app directory
│   ├── components/     # React components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utility libraries
│   └── store/          # State management
└── public/             # Static assets

server/                 # Node.js backend application
├── src/
│   ├── ai/             # AI agent and planning logic
│   ├── controllers/    # Route controllers
│   ├── db/             # Database configurations
│   ├── middlewares/    # Express middlewares
│   ├── models/         # Data models
│   ├── queues/         # Job queues
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── tools/          # Agent tools
│   ├── utils/          # Utility functions
│   └── validators/     # Input validation
└── public/             # Static assets and images
```

## Installation

### Prerequisites
- Node.js 18+ and npm/pnpm
- MongoDB
- Redis
- Neo4j (optional, for advanced correlation features)

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/chandanjainhp/RidgewaySite.git
cd RidgewaySite
```

2. **Install dependencies**
```bash
# Frontend
cd client
pnpm install

# Backend
cd ../server
npm install
```

3. **Configure environment variables**
Create `.env` files in both `client/` and `server/` directories with required configurations:

**server/.env**
```
MONGODB_URI=mongodb://localhost:27017/ridgeway
REDIS_URL=redis://localhost:6379
NEO4J_URI=neo4j://localhost:7687
ANTHROPIC_API_KEY=your_api_key
PORT=5000
```

**client/.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

4. **Start the application**
```bash
# Terminal 1: Backend
cd server
npm start

# Terminal 2: Frontend
cd client
pnpm dev
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout

### Incidents
- `GET /api/incidents` - List incidents
- `POST /api/incidents` - Create incident
- `GET /api/incidents/:id` - Get incident details
- `PUT /api/incidents/:id` - Update incident

### Events
- `GET /api/events` - List events
- `POST /api/events` - Create event
- `GET /api/events/:id` - Get event details

### Investigations
- `GET /api/investigations` - List investigations
- `POST /api/investigations` - Start investigation
- `GET /api/investigations/:id` - Get investigation details
- `POST /api/investigations/:id/correlate` - Correlate data

### Briefings
- `GET /api/briefings` - List briefings
- `POST /api/briefings` - Generate briefing
- `GET /api/briefings/:id` - Get briefing details

## Features in Detail

### AI-Powered Analysis
The platform includes an AI agent powered by Anthropic Claude that:
- Analyzes incidents and events
- Correlates related incidents
- Generates recommendations
- Assists in investigation planning

### Job Queue System
- Event processing queue for real-time event handling
- Investigation queue for long-running analysis tasks
- Worker processes for reliable job execution

### Rate Limiting & Security
- Request rate limiting middleware
- Input validation and sanitization
- Authentication and authorization
- Error handling and logging

## Development

### Code Structure Best Practices
- Controllers handle HTTP requests and responses
- Services contain business logic
- Models define data schemas
- Tools provide specialized functionality for the AI agent
- Validators ensure data integrity

### Available Scripts

**Frontend**
```bash
pnpm dev      # Start development server
pnpm build    # Build for production
pnpm start    # Start production server
```

**Backend**
```bash
npm start     # Start server
npm run dev   # Start with nodemon for development
npm test      # Run tests (if configured)
```

## Configuration

### Database Configuration
- MongoDB for incidents, events, investigations, and user data
- Redis for caching and session management
- Neo4j for correlation and relationship data (optional)

### AI Configuration
Edit `server/src/ai/agent.js` to customize:
- Model parameters
- System prompts
- Available tools
- Memory configurations

## Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit your changes (`git commit -m 'Add amazing feature'`)
3. Push to the branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Support

For issues, questions, or suggestions, please open an issue on GitHub.

## Author

**Chandan Jain** - [GitHub](https://github.com/chandanjainhp)

---

**Last Updated**: April 2026
