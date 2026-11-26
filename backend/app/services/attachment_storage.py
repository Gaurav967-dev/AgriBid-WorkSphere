from __future__ import annotations

import csv
import io
import struct
import zipfile
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from app.core.config import get_settings

ALLOWED_TYPES: dict[str, str] = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
OLE_SIGNATURE = bytes.fromhex("D0CF11E0A1B11AE1")
MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024


def private_storage_root() -> Path:
    """Resolve relative upload paths from the backend directory, never the web root."""
    configured = Path(get_settings().upload_dir).expanduser()
    backend_root = Path(__file__).resolve().parents[2]
    root = configured if configured.is_absolute() else backend_root / configured
    root = root.resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def storage_path(storage_key: str) -> Path:
    """Resolve a generated storage key and reject traversal or nested paths."""
    if (
        not storage_key
        or Path(storage_key).name != storage_key
        or "/" in storage_key
        or "\\" in storage_key
    ):
        raise HTTPException(status_code=500, detail="Attachment storage reference is invalid.")
    root = private_storage_root()
    path = (root / storage_key).resolve()
    try:
        path.relative_to(root)
    except ValueError:
        raise HTTPException(
            status_code=500, detail="Attachment storage reference is invalid."
        ) from None
    return path


def safe_original_filename(filename: str | None) -> str:
    """Keep a display filename only; never use it as a storage path."""
    candidate = (filename or "").replace("\\", "/").split("/")[-1]
    candidate = "".join("_" if ord(char) < 32 or ord(char) == 127 else char for char in candidate)
    candidate = candidate.strip().strip(".")
    if not candidate or candidate in {".", ".."}:
        raise HTTPException(status_code=400, detail="A valid filename is required.")
    if len(candidate) > 255:
        raise HTTPException(status_code=400, detail="Filename must be 255 characters or fewer.")
    return candidate


def _ole_stream_names(data: bytes) -> set[str]:
    """Read Compound File directory stream names without extracting file contents."""
    if len(data) < 512 or data[:8] != OLE_SIGNATURE:
        return set()
    sector_shift = struct.unpack_from("<H", data, 30)[0]
    if sector_shift not in {9, 12}:
        return set()
    sector_size = 1 << sector_shift
    first_directory_sector = struct.unpack_from("<I", data, 48)[0]
    difat = list(struct.unpack_from("<109I", data, 76))
    fat_sector_ids = [sid for sid in difat if sid < 0xFFFFFFFA]
    fat: list[int] = []
    for sid in fat_sector_ids:
        start = (sid + 1) * sector_size
        end = start + sector_size
        if end > len(data):
            return set()
        fat.extend(struct.unpack_from(f"<{sector_size // 4}I", data, start))
    if not fat or first_directory_sector >= len(fat):
        return set()
    directory = bytearray()
    current = first_directory_sector
    visited: set[int] = set()
    while current < 0xFFFFFFFA and current < len(fat) and current not in visited:
        visited.add(current)
        start = (current + 1) * sector_size
        end = start + sector_size
        if end > len(data):
            return set()
        directory.extend(data[start:end])
        current = fat[current]
    names: set[str] = set()
    for offset in range(0, len(directory) - 127, 128):
        entry = directory[offset : offset + 128]
        name_length = struct.unpack_from("<H", entry, 64)[0]
        entry_type = entry[66]
        if entry_type == 2 and 2 <= name_length <= 64:
            try:
                names.add(entry[: name_length - 2].decode("utf-16le").casefold())
            except UnicodeDecodeError:
                continue
    return names


def detect_mime_type(extension: str, data: bytes) -> str:
    """Match the extension against a recognized signature or file structure."""
    if extension not in ALLOWED_TYPES or not data:
        raise HTTPException(
            status_code=400, detail="This file type is not supported or the file is empty."
        )

    if extension in {".jpg", ".jpeg"} and data.startswith(b"\xff\xd8\xff"):
        return ALLOWED_TYPES[extension]
    if extension == ".png" and data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ALLOWED_TYPES[extension]
    if extension == ".webp" and len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ALLOWED_TYPES[extension]
    if extension == ".pdf" and b"%PDF-" in data[:1024]:
        return ALLOWED_TYPES[extension]

    if extension in {".docx", ".xlsx"}:
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                names = set(archive.namelist())
        except (zipfile.BadZipFile, OSError):
            names = set()
        required = "word/document.xml" if extension == ".docx" else "xl/workbook.xml"
        if "[Content_Types].xml" in names and required in names:
            return ALLOWED_TYPES[extension]

    if extension in {".doc", ".xls"} and data.startswith(OLE_SIGNATURE):
        streams = _ole_stream_names(data)
        expected = {"worddocument"} if extension == ".doc" else {"workbook", "book"}
        if streams.intersection(expected):
            return ALLOWED_TYPES[extension]

    if extension == ".csv":
        try:
            decoded = data.decode("utf-8-sig")
            if "\x00" not in decoded and decoded.strip():
                rows = csv.reader(io.StringIO(decoded))
                first_row = next(rows, None)
                if first_row and any(cell.strip() for cell in first_row):
                    return ALLOWED_TYPES[extension]
        except (UnicodeDecodeError, csv.Error):
            pass

    raise HTTPException(
        status_code=400,
        detail="The file content does not match its filename extension or is invalid.",
    )


async def read_and_validate_upload(upload: UploadFile) -> tuple[str, bytes, str]:
    filename = safe_original_filename(upload.filename)
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="This file type is not supported.")
    configured_limit = get_settings().max_upload_size_bytes
    limit = min(configured_limit, MAX_ATTACHMENT_SIZE_BYTES)
    data = await upload.read(limit + 1)
    if not data:
        raise HTTPException(status_code=400, detail="Empty files cannot be uploaded.")
    if len(data) > limit:
        raise HTTPException(status_code=413, detail="Each attachment must be 5 MB or smaller.")
    mime_type = detect_mime_type(extension, data)
    return filename, data, mime_type


def write_private_file(data: bytes, extension: str) -> str:
    """Write bytes under a random name in private storage and return only its key."""
    storage_key = f"{uuid4().hex}{extension}"
    target = storage_path(storage_key)
    try:
        with target.open("xb") as output:
            output.write(data)
    except OSError:
        target.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Unable to store the attachment.") from None
    return storage_key


def remove_private_file(storage_key: str) -> None:
    storage_path(storage_key).unlink(missing_ok=True)
