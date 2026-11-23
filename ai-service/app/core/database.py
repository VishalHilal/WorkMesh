from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session

from app.core.config import settings


class Base(DeclarativeBase):
    pass


def get_engine():
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is not configured.")
    return create_engine(settings.database_url, pool_pre_ping=True)


def check_db_connection() -> bool:
    """Return True if the database is reachable, False otherwise."""
    if not settings.database_url:
        return False
    try:
        engine = get_engine()
        with Session(engine) as session:
            session.execute(text("SELECT 1"))
        return True
    except (SQLAlchemyError, OSError):
        return False
