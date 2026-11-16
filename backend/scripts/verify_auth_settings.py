from app.core.config import get_settings

settings = get_settings()

print(
    "JWT secret configured:",
    settings.jwt_secret_key != "CHANGE_ME" and len(settings.jwt_secret_key.encode("utf-8")) >= 32,
)
print("ID token lifetime:", settings.id_token_expire_minutes)
print("Access token lifetime:", settings.access_token_expire_minutes)
print("Refresh token lifetime:", settings.refresh_token_expire_days)
print("JWT issuer:", settings.jwt_issuer)
print("JWT audience:", settings.jwt_audience)
