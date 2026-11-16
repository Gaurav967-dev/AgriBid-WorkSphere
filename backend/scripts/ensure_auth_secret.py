from __future__ import annotations

import secrets
from pathlib import Path


def main() -> None:
    env_path = Path(".env")

    if not env_path.exists():
        raise SystemExit("backend/.env is missing. Create it from .env.example first.")

    lines = env_path.read_text(encoding="utf-8-sig").splitlines()

    defaults = {
        "JWT_ISSUER": "agribid-worksphere",
        "JWT_AUDIENCE": "agribid-worksphere-api",
        "ID_TOKEN_EXPIRE_MINUTES": "5",
    }

    values = {}
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            key, value = stripped.split("=", 1)
            values[key.strip()] = value.strip()

    current_secret = values.get("JWT_SECRET_KEY", "")
    secret_is_placeholder = (
        not current_secret
        or current_secret
        in {
            "CHANGE_ME",
            "CHANGE_ME_GENERATE_A_RANDOM_SECRET",
        }
        or len(current_secret.encode("utf-8")) < 32
    )

    if secret_is_placeholder:
        values["JWT_SECRET_KEY"] = secrets.token_urlsafe(48)
        print("Generated a new local JWT signing secret.")
    else:
        print("Existing JWT signing secret retained.")

    for key, value in defaults.items():
        values.setdefault(key, value)

    # Preserve unrelated settings and comments.
    updated_lines = []
    written_keys = set()

    for line in lines:
        stripped = line.strip()

        if stripped and not stripped.startswith("#") and "=" in stripped:
            key = stripped.split("=", 1)[0].strip()

            if key in values:
                updated_lines.append(f"{key}={values[key]}")
                written_keys.add(key)
                continue

        updated_lines.append(line)

    for key, value in values.items():
        if key not in written_keys:
            updated_lines.append(f"{key}={value}")

    env_path.write_text(
        "\n".join(updated_lines).rstrip() + "\n",
        encoding="utf-8",
    )

    print("JWT issuer, audience and ID-token lifetime configured.")
    print("Signing secret was not displayed.")
    print("Local .env updated successfully.")


if __name__ == "__main__":
    main()
