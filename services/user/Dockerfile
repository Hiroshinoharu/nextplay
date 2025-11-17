FROM golang:1.24 AS builder

WORKDIR /app

COPY services/user/go.mod services/user/go.sum ./
RUN go mod download

COPY services/user/ ./

ENV CGO_ENABLED=0
RUN go build -o user .

FROM alpine:3.20
WORKDIR /
RUN apk add --no-cache ca-certificates curl
COPY --from=builder /app/user /user

EXPOSE 8083
ENTRYPOINT ["/user"]