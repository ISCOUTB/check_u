
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-spa \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY modules/requirements.txt /app/modules/requirements.txt

RUN pip install --no-cache-dir -r /app/modules/requirements.txt

COPY . /app

EXPOSE 5001

CMD ["python", "modules/api/app.py"]
