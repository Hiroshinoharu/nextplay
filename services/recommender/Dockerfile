FROM python:3.11-slim

WORKDIR /app

ENV PYTHONPATH=/app
ENV MODEL_PATH=/models/recommender/current/model.keras
ENV MODEL_MANIFEST_PATH=/models/recommender/current/artifact_manifest.json
ENV MODEL_VERSION=20260313T164930Z
ENV MODEL_REQUIRED=true

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl git \
    && rm -rf /var/lib/apt/lists/*

COPY services/recommender/requirements.txt /tmp/requirements.txt

RUN pip install --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r /tmp/requirements.txt

COPY services/recommender /app/services/recommender
COPY services/recommender/training/artifacts/current /models/recommender/current

EXPOSE 8082

CMD ["uvicorn", "services.recommender.main:app", "--host", "0.0.0.0", "--port", "8082"]
