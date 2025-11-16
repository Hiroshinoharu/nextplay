# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy only package.json first (better caching)
COPY frontend/package*.json ./

RUN npm install

# Copy the rest of the frontend source
COPY frontend/. .

RUN npm run build


# ---- Serve Stage ----
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]