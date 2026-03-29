from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from routers import scope, crisis, health, assess, lava, followup, discover, optimize, monitor, plans

app = FastAPI(title="CrisisGrid API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scope.router)
app.include_router(crisis.router)
app.include_router(health.router)
app.include_router(assess.router)
app.include_router(lava.router)
app.include_router(followup.router)
app.include_router(discover.router)
app.include_router(optimize.router)
app.include_router(monitor.router)
app.include_router(plans.router)


@app.get("/")
async def root():
    return {"status": "ok", "service": "crisisgrid-api"}
