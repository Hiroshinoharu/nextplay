# Test container

# ----------------------------
# Stage 1: Build the React app
# ----------------------------
FROM node:20 AS build
WORKDIR /app

# Copy package files first (for caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of my frontend code
COPY . .

# Build production-ready static files
RUN npm run build

# --------------------------------------
# Stage 2: Server with lightweight server
# ----------------------------------------
FROM node:20-slim
WORKDIR /app

# Install a simple HTTP server
RUN npm install -g serve

# Copy built assets from the previous stage
COPY --from=build /app/dist ./dist

EXPOSE 3000

# Serve the app
CMD ["serve", "-s", "dist", "-l", "3000"]