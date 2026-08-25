FROM python:3.12-slim

WORKDIR /app
COPY api/requirements.txt /app/api/requirements.txt
RUN pip install --no-cache-dir -r /app/api/requirements.txt
COPY . /app

ENV PORT=7860
ENV API_DB_PATH=/app/api/shipment_api.sqlite3
EXPOSE 7860

CMD uvicorn api.main:app --host 0.0.0.0 --port ${PORT}
