FROM python:3.10
ENV PYTHONUNBUFFERED=1
RUN pip install fastapi[all] uvicorn aiohttp lxml aiofiles pydantic

COPY ./src/python /app
WORKDIR /app
CMD ["uvicorn", "main:app", "--port", "80", "--host", "0.0.0.0"]
