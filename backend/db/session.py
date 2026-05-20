# db/session.py — SQLAlchemy engine and session factory
#
# Adapted from teammate's app/db/session.py.
#
# Database selection is controlled by DB_TYPE in the .env file:
#   DB_TYPE=postgres  → uses PostgreSQL (supervisor requirement)
#   DB_TYPE=mysql     → uses MySQL (teammate's original setup)
#   DB_TYPE=          → no database, falls back to in-memory storage
#
# All other settings (host, port, user, password, name) are separate variables
# so switching databases only requires changing DB_TYPE — nothing else.

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

# ── Read individual connection settings from environment ───────────────────────
DB_TYPE     = os.getenv("DB_TYPE", "").strip().lower()   # "postgres" | "mysql" | ""
DB_HOST     = os.getenv("DB_HOST", "localhost")
DB_PORT     = os.getenv("DB_PORT", "5432")
DB_USER     = os.getenv("DB_USER", "")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME     = os.getenv("DB_NAME", "")

# ── Build the connection URL based on DB_TYPE ──────────────────────────────────
# Only the URL prefix changes between databases — the rest of the code is identical.
if DB_TYPE == "postgres":
    _DB_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
elif DB_TYPE == "mysql":
    _DB_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
else:
    # DB_TYPE is empty or unrecognised — run without a database
    _DB_URL = None

# DB_AVAILABLE is imported by comparisons.py to decide whether to use DB or in-memory fallback
DB_AVAILABLE: bool = bool(_DB_URL)

Base = declarative_base()

# Only create the engine if a valid DB_TYPE was provided
if DB_AVAILABLE:
    engine = create_engine(
        _DB_URL,
        echo=False,          # set True temporarily to print SQL queries for debugging
        pool_pre_ping=True,  # checks connection health before each use
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
else:
    engine = None
    SessionLocal = None


def get_db():
    """FastAPI dependency: yields a database session and closes it when done.

    Only call this when DB_AVAILABLE is True — comparisons.py checks that first.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create all ORM tables if they do not already exist.

    Called once at app startup (see main_new.py lifespan).
    Safe to call on every restart — SQLAlchemy skips tables that already exist.
    Does nothing when DB_AVAILABLE is False.
    """
    if not DB_AVAILABLE:
        print("ℹ️  DB_TYPE not set — running without database (in-memory fallback)")
        return
    from db import models  # noqa: F401 — registers models with Base before create_all
    try:
        Base.metadata.create_all(bind=engine)
        print(f"✅ Database tables ready ({DB_TYPE.upper()} @ {DB_HOST}:{DB_PORT}/{DB_NAME})")
    except Exception as e:
        print(f"❌ Failed to create database tables: {e}")
