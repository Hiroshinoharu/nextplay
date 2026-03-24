# ---- BUILD STAGE ----
FROM node:20 AS builder

WORKDIR /app
COPY frontend/package*.json ./
RUN npm install

# ---- BUILD APP ----
COPY frontend/index.html ./index.html
COPY frontend/*.html ./
COPY frontend/public ./public
COPY frontend/src ./src
COPY frontend/vite.config.ts ./vite.config.ts
COPY frontend/tsconfig*.json ./
COPY frontend/eslint.config.js ./eslint.config.js
RUN npm run build

# ---- SERVE STAGE ----
FROM nginx:stable-alpine

# Default to the local Compose gateway host. Hosted environments can override this.
ENV GATEWAY_UPSTREAM_URL=http://gateway:8084

COPY --from=builder /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]