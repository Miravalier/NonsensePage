FROM python:3.12
ENV PYTHONUNBUFFERED=1

RUN apt update && apt install -y \
    libmagickwand-dev \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN pip install fastapi[all] uvicorn aiohttp lxml aiofiles pydantic pymongo Wand

COPY ./src/python /app
WORKDIR /app
CMD ["uvicorn", "main:app", "--port", "80", "--host", "0.0.0.0"]
