# Backend Flask + Gunicorn
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
	PYTHONUNBUFFERED=1

WORKDIR /app

# Dependencias del sistema mínimas para pandas/openpyxl
RUN apt-get update && apt-get install -y --no-install-recommends \
	build-essential \
	libatlas-base-dev \
	&& rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY . .

EXPOSE 5000

# Servir con gunicorn en lugar del servidor de desarrollo
CMD ["gunicorn", "-b", "0.0.0.0:5000", "app:app"]
