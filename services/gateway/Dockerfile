# ---- BUILD STAGE ----
FROM golang:1.24 AS builder

WORKDIR /app/services/gateway

# Copy go.mod + go.sum for module + shared replace target
COPY services/gateway/go.mod services/gateway/go.sum ./
COPY services/shared/go.mod services/shared/go.sum ../shared/
RUN go mod download

# Copy service source and shared module
COPY services/gateway/ ./
COPY services/shared/ ../shared/

# Build static binary
ENV CGO_ENABLED=0
RUN go build -o gateway .

# ---- RUNTIME STAGE ----
FROM alpine:3.20

WORKDIR /
RUN apk add --no-cache ca-certificates curl
COPY --from=builder /app/services/gateway/gateway /gateway

EXPOSE 8084
ENTRYPOINT ["/gateway"]
