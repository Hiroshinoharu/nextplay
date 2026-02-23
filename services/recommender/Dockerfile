FROM python:3.11-slim

WORKDIR /app

ENV PYTHONPATH=/app
ENV MODEL_PATH=""
ENV MODEL_VERSION="dev"
ENV MODEL_REQUIRED="false"

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY services/recommender/requirements.txt /tmp/requirements.txt

RUN pip install --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r /tmp/requirements.txt

COPY services/recommender /app/services/recommender

EXPOSE 8082

CMD ["uvicorn", "services.recommender.main:app", "--host", "0.0.0.0", "--port", "8082"]
