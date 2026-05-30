"""Shared fixtures for Ospitalo backend tests."""
import os
import time
import uuid
import pytest
import requests
from pymongo import MongoClient
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].splitlines()[0].strip()
BASE_URL = BASE_URL.rstrip("/")

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def mongo_db():
    cli = MongoClient(MONGO_URL)
    return cli[DB_NAME]


@pytest.fixture(scope="session")
def seeded_session(mongo_db):
    """Seed a user + session directly in Mongo and return (token, user_id)."""
    ts = int(time.time() * 1000)
    user_id = f"test-user-ospitalo-pytest-{ts}"
    token = f"test_session_ospitalo_pytest_{ts}_{uuid.uuid4().hex[:6]}"
    mongo_db.users.insert_one({
        "user_id": user_id,
        "email": f"pytest.ospitalo+{ts}@example.com",
        "name": "Pytest Ospitalo User",
        "picture": "https://via.placeholder.com/150",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    mongo_db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    yield {"token": token, "user_id": user_id}
    # Teardown: cleanup test data
    mongo_db.user_sessions.delete_many({"session_token": token})
    mongo_db.users.delete_many({"user_id": user_id})
    mongo_db.properties.delete_many({"user_id": user_id})
    mongo_db.checkins.delete_many({"user_id": user_id})


@pytest.fixture
def api_client(seeded_session):
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {seeded_session['token']}",
    })
    return s


@pytest.fixture
def anon_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s
