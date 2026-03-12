import os
import psycopg2

# Database utility functions for the recommender service
def get_connection():
    """
    Returns a psycopg2 connection object based on the DATABASE_URL environment variable.

    Raises an Exception if DATABASE_URL is not provided.
    """
    url = os.getenv("DATABASE_URL")
    if not url:
        raise Exception("DATABASE_URL not provided")

    return psycopg2.connect(url)