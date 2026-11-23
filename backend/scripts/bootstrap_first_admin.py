from __future__ import annotations

import re
from getpass import getpass
from uuid import UUID

from pwdlib import PasswordHash
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.models import Role, User

BOOTSTRAP_LOCK_ID = 72103101
MIN_PASSWORD_LENGTH = 12


def create_first_admin(
    full_name: str,
    email: str,
    password_hash: str,
) -> UUID:
    """Create the initial administrator only when no admin exists."""
    with SessionLocal() as session:
        with session.begin():
            # Serialize concurrent bootstrap attempts on PostgreSQL.
            session.execute(
                text("SELECT pg_advisory_xact_lock(:lock_id)"),
                {"lock_id": BOOTSTRAP_LOCK_ID},
            )

            admin_role = session.scalar(select(Role).where(Role.code == "ADMIN"))

            if admin_role is None:
                raise RuntimeError("ADMIN role is missing. Apply the role seed migration first.")

            existing_admin_id = session.scalar(
                select(User.id)
                .join(Role, User.role_id == Role.id)
                .where(Role.code == "ADMIN")
                .limit(1)
            )

            if existing_admin_id is not None:
                raise RuntimeError("An administrator already exists. Bootstrap is disabled.")

            admin = User(
                full_name=full_name,
                email=email,
                password_hash=password_hash,
                role_id=admin_role.id,
                is_active=True,
            )

            session.add(admin)
            session.flush()

            return admin.id


def main() -> int:
    print("\nAgriBid WorkSphere - First Administrator Setup")
    print("This command can create the initial administrator only once.\n")

    full_name = input("Administrator full name: ").strip()

    if not full_name or len(full_name) > 150:
        print("Error: Name must contain between 1 and 150 characters.")
        return 1

    email = input("Administrator email: ").strip().lower()

    if len(email) > 320 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        print("Error: Enter a valid email address.")
        return 1

    # Example for the development environment: admin@agribid.ai
    password = getpass("Administrator password: ")
    confirmation = getpass("Confirm password: ")

    if password != confirmation:
        print("Error: Passwords do not match.")
        return 1

    if len(password) < MIN_PASSWORD_LENGTH:
        print(f"Error: Password must contain at least {MIN_PASSWORD_LENGTH} characters.")
        return 1

    if len(password) > 1024:
        print("Error: Password is too long.")
        return 1

    # Hash the password before persisting it. Never store plaintext.
    hashed_password = PasswordHash.recommended().hash(password)

    # Remove local references to the plaintext after hashing.
    del password
    del confirmation

    try:
        user_id = create_first_admin(
            full_name=full_name,
            email=email,
            password_hash=hashed_password,
        )
    except RuntimeError as exc:
        print(f"\nSetup rejected: {exc}")
        return 1
    except SQLAlchemyError:
        print("\nDatabase operation failed. No administrator was created.")
        return 1

    print("\nFirst administrator created successfully.")
    print(f"User ID: {user_id}")
    print(f"Email: {email}")
    print("Role: ADMIN")
    print("Password: securely hashed with the recommended Argon2 configuration.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
