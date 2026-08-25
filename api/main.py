import hashlib
import hmac
import os
import secrets
import sqlite3
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
WEB_ROOT = BASE_DIR.parent
DEFAULT_DB_PATH = Path("/tmp/shipment_api.sqlite3") if os.getenv("VERCEL") else BASE_DIR / "shipment_api.sqlite3"
DB_PATH = Path(os.getenv("API_DB_PATH", DEFAULT_DB_PATH))
ADMIN_USERNAME = os.getenv("API_ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("API_ADMIN_PASSWORD", "admin123")

app = FastAPI(title="Short Shipment API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

_sessions: set[str] = set()


class LoginRequest(BaseModel):
    username: str
    password: str


class Representative(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    designation: str = Field(min_length=1, max_length=160)
    enterprise: str = Field(min_length=1, max_length=160)
    signature_png: Optional[str] = None


class RepresentativeRecord(Representative):
    id: int
    updated_at: str


def connection() -> sqlite3.Connection:
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db


def initialize_database() -> None:
    with connection() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS representatives (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                designation TEXT NOT NULL,
                enterprise TEXT NOT NULL,
                signature_png TEXT,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        default_representatives = [
            ("Eranga Lahiru", "Assistant Manager - Commercial & Logistic", "MAS CAPITAL PVT LTD"),
            ("Gihan Praboda", "Assistant Manager - Commercial & Logistic", "MAS CAPITAL PVT LTD"),
            ("Isuru Buddhika", "Assistant Manager - Commercial & Logistic", "MAS CAPITAL PVT LTD"),
            ("Harshana", "Assistant Manager - Commercial & Logistic", "MAS CAPITAL PVT LTD"),
            ("Sujith Srimal", "Assistant Manager - Commercial & Logistic", "MAS CAPITAL PVT LTD"),
            ("Thilan Fernando", "Assistant Manager - Commercial & Logistic", "MAS CAPITAL PVT LTD"),
            ("Kasun Sachintha", "Assistant Manager - Commercial & Logistic", "MAS CAPITAL PVT LTD"),
            ("Vimukthi", "Assistant Manager - Commercial & Logistic", "MAS CAPITAL PVT LTD"),
            ("Lakshitha", "Assistant Manager - Commercial & Logistic", "MAS CAPITAL PVT LTD"),
            ("Devaka Hirantha", "Assistant Manager - Commercial & Logistic", "MAS CAPITAL PVT LTD"),
        ]
        db.executemany(
            "INSERT OR IGNORE INTO representatives (name, designation, enterprise) VALUES (?, ?, ?)",
            default_representatives,
        )
        db.commit()


def require_admin(authorization: Optional[str] = Header(default=None)) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin login required")
    token = authorization.removeprefix("Bearer ")
    if not any(hmac.compare_digest(token, active_token) for active_token in _sessions):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin session")


def as_record(row: sqlite3.Row) -> RepresentativeRecord:
    return RepresentativeRecord(
        id=row["id"],
        name=row["name"],
        designation=row["designation"],
        enterprise=row["enterprise"],
        signature_png=row["signature_png"],
        updated_at=row["updated_at"],
    )


@app.on_event("startup")
def startup() -> None:
    initialize_database()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "short-shipment-api"}


@app.post("/auth/login")
def login(credentials: LoginRequest) -> dict[str, str]:
    username_ok = hmac.compare_digest(credentials.username, ADMIN_USERNAME)
    password_ok = hmac.compare_digest(credentials.password, ADMIN_PASSWORD)
    if not username_ok or not password_ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = secrets.token_urlsafe(32)
    _sessions.add(token)
    return {"access_token": token, "token_type": "bearer"}


@app.get("/api/representatives", response_model=list[RepresentativeRecord])
def list_representatives() -> list[RepresentativeRecord]:
    with connection() as db:
        rows = db.execute("SELECT * FROM representatives ORDER BY name COLLATE NOCASE").fetchall()
    return [as_record(row) for row in rows]


@app.post("/api/representatives", response_model=RepresentativeRecord, dependencies=[Depends(require_admin)])
def create_representative(representative: Representative) -> RepresentativeRecord:
    try:
        with connection() as db:
            cursor = db.execute(
                "INSERT INTO representatives (name, designation, enterprise, signature_png) VALUES (?, ?, ?, ?)",
                (representative.name.strip(), representative.designation.strip(), representative.enterprise.strip(), representative.signature_png),
            )
            db.commit()
            row = db.execute("SELECT * FROM representatives WHERE id = ?", (cursor.lastrowid,)).fetchone()
    except sqlite3.IntegrityError as error:
        raise HTTPException(status_code=409, detail="Representative name already exists") from error
    return as_record(row)


@app.put("/api/representatives/{representative_id}", response_model=RepresentativeRecord, dependencies=[Depends(require_admin)])
def update_representative(representative_id: int, representative: Representative) -> RepresentativeRecord:
    with connection() as db:
        cursor = db.execute(
            """
            UPDATE representatives
            SET name = ?, designation = ?, enterprise = ?, signature_png = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (representative.name.strip(), representative.designation.strip(), representative.enterprise.strip(), representative.signature_png, representative_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Representative not found")
        db.commit()
        row = db.execute("SELECT * FROM representatives WHERE id = ?", (representative_id,)).fetchone()
    return as_record(row)


@app.delete("/api/representatives/{representative_id}", dependencies=[Depends(require_admin)])
def delete_representative(representative_id: int) -> dict[str, bool]:
    with connection() as db:
        cursor = db.execute("DELETE FROM representatives WHERE id = ?", (representative_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Representative not found")
        db.commit()
    return {"deleted": True}


if WEB_ROOT.exists():
    app.mount("/", StaticFiles(directory=WEB_ROOT, html=True), name="frontend")
