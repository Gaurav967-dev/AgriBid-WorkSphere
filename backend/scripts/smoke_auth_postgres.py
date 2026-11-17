from __future__ import annotations

from getpass import getpass

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.database import SessionLocal
from app.core.security import hash_refresh_token
from app.main import app
from app.models import AuthSession, User


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def main() -> None:
    email = input("Administrator email [admin@agribid.ai]: ").strip()
    if not email:
        email = "admin@agribid.ai"

    password = getpass("Administrator password: ")
    with SessionLocal() as db:
        user = db.scalar(
            select(User).options(joinedload(User.role)).where(User.email == email.lower())
        )

        require(user is not None, "Administrator account was not found.")
        require(user.is_active, "Administrator account is inactive.")
        require(user.role.code == "ADMIN", "The account is not an ADMIN.")

    print("\nVerified administrator account and role.")

    # FLOW A: login -> verify -> refresh -> verify -> logout.
    with TestClient(app) as client:
        login = client.post(
            "/api/v1/auth/sign",
            json={"email": email, "password": password},
        )
        require(login.status_code == 200, f"Login failed: HTTP {login.status_code}")
        print("PASS: PostgreSQL-backed login")

        for cookie_name in ("id_token", "access_token", "refresh_token"):
            require(
                client.cookies.get(cookie_name) is not None,
                f"{cookie_name} cookie was not issued.",
            )
        print("PASS: All three authentication cookies issued")

        verification = client.get("/api/v1/auth/verify-token")
        require(
            verification.status_code == 200,
            f"Token verification failed: HTTP {verification.status_code}",
        )
        print("PASS: Access-token verification")

        old_refresh = client.cookies.get("refresh_token")
        old_hash = hash_refresh_token(old_refresh)

        refresh = client.post("/api/v1/auth/refresh-token")
        require(
            refresh.status_code == 200,
            f"Refresh failed: HTTP {refresh.status_code}",
        )

        new_refresh = client.cookies.get("refresh_token")
        require(new_refresh and new_refresh != old_refresh, "Refresh token did not rotate.")
        print("PASS: Refresh-token rotation")

        with SessionLocal() as db:
            old_session = db.scalar(select(AuthSession).where(AuthSession.token_hash == old_hash))

            require(old_session is not None, "Original session not found.")
            require(old_session.revoked_at is not None, "Original session was not revoked.")
            require(
                old_session.replaced_by_session_id is not None,
                "Replacement session link is missing.",
            )

        verification = client.get("/api/v1/auth/verify-token")
        require(verification.status_code == 200, "New access token is not valid.")
        print("PASS: New access token works after refresh")

        new_hash = hash_refresh_token(new_refresh)

        logout = client.post("/api/v1/auth/logout")
        require(logout.status_code == 200, f"Logout failed: HTTP {logout.status_code}")

        verification = client.get("/api/v1/auth/verify-token")
        require(verification.status_code == 401, "Access token still works after logout.")

        with SessionLocal() as db:
            logged_out_session = db.scalar(
                select(AuthSession).where(AuthSession.token_hash == new_hash)
            )
            require(
                logged_out_session is not None and logged_out_session.revoked_at is not None,
                "Logout did not revoke the database session.",
            )

        print("PASS: Logout and database session revocation")

    # FLOW B: login -> refresh -> replay old refresh token.
    with TestClient(app) as client:
        login = client.post(
            "/api/v1/auth/sign",
            json={"email": email, "password": password},
        )
        require(login.status_code == 200, "Second login failed.")

        original_refresh = client.cookies.get("refresh_token")
        require(bool(original_refresh), "Second refresh cookie is missing.")

        refresh = client.post("/api/v1/auth/refresh-token")
        require(refresh.status_code == 200, "Second refresh failed.")
        print("PASS: Second session created and rotated")

        # Replay the old refresh token from a separate client.
        with TestClient(app) as replay_client:
            replay = replay_client.post(
                "/api/v1/auth/refresh-token",
                headers={"Cookie": f"refresh_token={original_refresh}"},
            )

        require(replay.status_code == 401, "Reused refresh token was accepted.")
        print("PASS: Reused refresh token rejected")

        verification = client.get("/api/v1/auth/verify-token")
        require(
            verification.status_code == 401,
            "The active access session was not revoked after refresh-token reuse.",
        )
        print("PASS: Active session revoked after reuse detection")

    print("\nAll PostgreSQL authentication smoke checks passed.")
    print("Temporary sessions created by this test were revoked.")


if __name__ == "__main__":
    main()
