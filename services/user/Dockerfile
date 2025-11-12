FROM golang:1.24.5
WORKDIR /app
COPY . .
RUN go mod tidy && go build -o app .
EXPOSE 8083
CMD [ "./app" ]