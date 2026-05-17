import json
import subprocess
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pipeline import run_pipeline
from scraper import resolve_url

CAROUSEL_DIR = Path(__file__).parent / "carousel"
SLIDES_OUTPUT = CAROUSEL_DIR / "output" / "final"
SLIDES_OUTPUT.mkdir(parents=True, exist_ok=True)

app = FastAPI()

app.mount("/slides", StaticFiles(directory=str(SLIDES_OUTPUT)), name="slides")

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


class ValidateUrlRequest(BaseModel):
    url: str


@app.post("/validate-url")
async def validate_url(data: ValidateUrlRequest):
    resolved = await resolve_url(data.url)
    return {"valid": resolved is not None, "resolved": resolved}


@app.post("/analyze")
async def analyze(data: AnalyzeRequest):
    async def generate():
        async for message, payload in run_pipeline(
            data.website, data.description, data.tiktok
        ):
            yield f"data: {json.dumps({'type': 'log', 'message': message})}\n\n"
            if payload is not None:
                yield f"data: {json.dumps({'type': 'done', 'strategy': payload['strategy'], 'slides': payload['slides'], 'persona': payload['persona'], 'personalMd': payload['personalMd']})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


class GenerateRequest(BaseModel):
    persona: dict
    count: int = 1
    topics: list = []
    skip_images: bool = False
    reference_tiktok: str = ""


@app.post("/generate")
async def generate_carousel(data: GenerateRequest):
    async def stream():
        yield f"data: {json.dumps({'type': 'log', 'message': 'Starting carousel generation…'})}\n\n"
        # Clear previous slides so we only return slides from this run
        import shutil
        if SLIDES_OUTPUT.exists():
            shutil.rmtree(SLIDES_OUTPUT)
        SLIDES_OUTPUT.mkdir(parents=True, exist_ok=True)
        reference_tiktok = data.reference_tiktok or data.persona.get("referenceTiktok", "")
        cmd = [
            "python", "generate_carousel.py",
            "--persona-json", json.dumps(data.persona),
            "--count", str(data.count),
            "--output-dir", str(CAROUSEL_DIR / "output"),
        ]
        if reference_tiktok:
            cmd += ["--account", reference_tiktok]
        if data.skip_images:
            cmd.append("--skip-images")
        cmd += data.topics

        proc = subprocess.Popen(
            cmd, cwd=str(CAROUSEL_DIR),
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
        )
        for line in proc.stdout:
            yield f"data: {json.dumps({'type': 'log', 'message': line.rstrip()})}\n\n"
        proc.wait()
        if proc.returncode == 0:
            image_urls = sorted([
                f"/slides/{p.parent.name}/{p.name}"
                for p in SLIDES_OUTPUT.rglob("slide_*.png")
            ])
            yield f"data: {json.dumps({'type': 'done', 'message': 'Carousel generated successfully.', 'imageUrls': image_urls})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Generation failed.'})}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
