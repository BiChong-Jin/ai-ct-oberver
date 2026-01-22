from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os

from app.auth.router import router as auth_router
from app.analysis.router import router as analysis_router

app = FastAPI(title="CT Image Analyzer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(analysis_router)

static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred"},
    )


@app.get("/")
async def index():
    return FileResponse(os.path.join(static_dir, "index.html"))


@app.get("/login")
async def login_page():
    return FileResponse(os.path.join(static_dir, "login.html"))


@app.get("/register")
async def register_page():
    return FileResponse(os.path.join(static_dir, "register.html"))
