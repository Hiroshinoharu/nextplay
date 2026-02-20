import os
import psycopg2

# Database utility functions for the recommender service
def get_connection():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise Exception("DATABASE_URL not provided")

    return psycopg2.connect(url)