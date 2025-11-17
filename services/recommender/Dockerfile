FROM python:3.10-slim

WORKDIR /app

# Make Python able to import from  /app
ENV PYTHONPATH=/app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copy only the recommender service
COPY services/recommender /app/services/recommender

# Install dependencies
RUN pip install --no-cache-dir -r services/recommender/requirements.txt

EXPOSE 8082

CMD ["uvicorn", "services.recommender.main:app", "--host", "0.0.0.0", "--port", "8082"]
