FROM python:3.10-slim

WORKDIR /app

# Copy your application code
COPY ../../ .

# Install dependencies
RUN pip install --no-cache-dir -r services/recommender/requirements.txt

EXPOSE 8082

CMD ["uvicorn", "services.recommender.main:app", "--host", "0.0.0.0", "--port", "8082"]