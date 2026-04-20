# Build stage
FROM oven/bun:1.2.20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build Next.js application
RUN bun run build

# Production stage
FROM oven/bun:1.2.20-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install production dependencies only
RUN bun install --frozen-lockfile --production

# Copy built application from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs

# Expose port
EXPOSE 3000

# Environment variable for Next.js
ENV NODE_ENV production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
	CMD bun -e "fetch('http://localhost:3000').then((r) => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"

# Start Next.js application
CMD ["bun", "run", "start"]
