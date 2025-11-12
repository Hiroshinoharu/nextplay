from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def root():
    return {"service":"recommender","status":"running"}