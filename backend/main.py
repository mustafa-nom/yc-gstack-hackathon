import json
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
    audience: str
    tiktok: str


@app.post("/analyze")
async def analyze(data: AnalyzeRequest):
    async def generate():
        async for message, payload in run_pipeline(
            data.website, data.description, data.audience, data.tiktok
        ):
            if payload is None:
                chunk = json.dumps({"type": "log", "message": message})
            else:
                chunk = json.dumps({
                    "type": "done",
                    "strategy": payload["strategy"],
                    "slides": payload["slides"],
                    "personalMd": payload["personalMd"],
                })
            yield f"data: {chunk}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
