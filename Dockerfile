FROM python:3.13
ENV PYTHONUNBUFFERED=1

RUN apt update && apt install -y \
    libmagickwand-dev \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN pip install fastapi[all] uvicorn aiohttp lxml aiofiles pydantic pymongo Wand

COPY ./backend /app
WORKDIR /
CMD ["python3", "-m", "app"]
