from sqlalchemy import create_engine, text

from app.core.config import get_settings


def main() -> None:
    engine = create_engine(get_settings().database_url)

    try:
        with engine.connect() as connection:
            rows = (
                connection.execute(
                    text("""
                    SELECT
                        u.email,
                        r.code,
                        u.is_active,
                        LEFT(u.password_hash, 10) AS hash_prefix
                    FROM users AS u
                    JOIN roles AS r ON r.id = u.role_id
                    WHERE r.code = :role
                """),
                    {"role": "ADMIN"},
                )
                .mappings()
                .all()
            )

        print("Admin count:", len(rows))

        for row in rows:
            print(
                "Email:",
                row["email"],
                "| Role:",
                row["code"],
                "| Active:",
                row["is_active"],
                "| Hash prefix:",
                row["hash_prefix"],
            )

        assert len(rows) == 1, "Expected exactly one administrator."
        assert rows[0]["is_active"] is True, "Administrator is inactive."
        assert rows[0]["hash_prefix"] == "$argon2id$", "Password hash is not Argon2id."

        print("\nAdministrator verification passed.")

    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
