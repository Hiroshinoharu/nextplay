FROM golang:1.24 AS builder

WORKDIR /app

COPY services/game/go.mod services/game/go.sum ./
RUN go mod download

COPY services/game/ ./

ENV CGO_ENABLED=0
RUN go build -o game .

FROM alpine:3.20
WORKDIR /
RUN apk add --no-cache ca-certificates curl
COPY --from=builder /app/game /game

EXPOSE 8081
ENTRYPOINT ["/game"]
