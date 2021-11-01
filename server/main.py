from fastapi import FastAPI


app = FastAPI(root_path="/")


@app.get("/")
async def index():
    return {"status": "success"}
