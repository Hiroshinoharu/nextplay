package db

import(
	"database/sql"
	"os"

	_ "github.com/lib/pq"
)

var DB *sql.DB

func Connect() error{
	url := os.Getenv("DATABASE_URL")

	conn, err := sql.Open("postgres",url)
	if err != nil{
		return err
	}

	if err := conn.Ping(); err != nil{
		return err
	}

	DB = conn
	return nil
}