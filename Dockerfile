# Backend Flask + Gunicorn
FROM python:3.11-slim-bookworm AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
	PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY . .

EXPOSE 5000

# Servir con gunicorn en lugar del servidor de desarrollo
CMD ["gunicorn", "-b", "0.0.0.0:5000", "app:app"]
