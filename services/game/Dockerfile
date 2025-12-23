FROM golang:1.24 AS builder

WORKDIR /app/services/game

COPY services/game/go.mod services/game/go.sum ./
COPY services/shared/go.mod services/shared/go.sum ../shared/
RUN go mod download

COPY services/game/ ./
COPY services/shared/ ../shared/

ENV CGO_ENABLED=0
RUN go build -o game .

FROM alpine:3.20
WORKDIR /
RUN apk add --no-cache ca-certificates curl
COPY --from=builder /app/services/game/game /game

EXPOSE 8081
ENTRYPOINT ["/game"]
