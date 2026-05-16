import json
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pipeline import run_pipeline

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    website: str
    description: str = ""
    tiktok: str = ""


@app.post("/analyze")
async def analyze(data: AnalyzeRequest):
    async def generate():
        async for message, payload in run_pipeline(
            data.website, data.description, data.tiktok
        ):
            yield f"data: {json.dumps({'type': 'log', 'message': message})}\n\n"
            if payload is not None:
                yield f"data: {json.dumps({'type': 'done', 'strategy': payload['strategy'], 'slides': payload['slides'], 'personalMd': payload['personalMd']})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
