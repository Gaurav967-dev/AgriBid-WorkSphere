from __future__ import annotations

import re
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SignInRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=1024)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        email = value.strip().lower()

        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            raise ValueError("Enter a valid email address.")

        return email


class AuthUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    email: str
    role_code: str
    role_name: str
    is_active: bool


class AuthResponse(BaseModel):
    message: str
    user: AuthUserResponse


class TokenVerificationResponse(BaseModel):
    valid: bool
    user: AuthUserResponse
