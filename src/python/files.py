import hashlib
import os
from pathlib import Path
from wand.image import Image


THUMBNAILS_DIR = Path("/thumbnails")


file_extensions = {
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".bmp": "image/bmp",
    ".gif": "image/gif",
    ".ico": "image/icon",
    ".icon": "image/icon",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".txt": "text/unknown",
    ".text": "text/unknown",
    ".json": "text/json",
    ".xml": "text/xml",
    ".html": "text/html",
    ".xhtml": "text/xhtml",
    ".ini": "text/ini",
    ".py": "code/python",
    ".c": "code/c",
    ".h": "code/h",
    ".js": "code/js",
    ".jsx": "code/jsx",
    ".ts": "code/ts",
    ".tsx": "code/tsx",
    ".cpp": "code/cpp",
    ".c++": "code/cpp",
    ".hpp": "code/hpp",
    ".h++": "code/hpp",
    ".avi": "video/avi",
    ".m4v": "video/mp4",
    ".mkv": "video/mkv",
    ".mov": "video/mov",
    ".mp4": "video/mp4",
    ".ogv": "video/ogg",
    ".webm": "video/webm",
    ".wmv": "video/wmv",
    ".aac": "video/aac",
    ".aiff": "audio/aiff",
    ".flac": "audio/flac",
    ".m4a": "audio/mp4",
    ".midi": "audio/midi",
    ".mp3": "audio/mp3",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".ttf": "font/ttf",
    ".woff": "font/woff",
    ".otf": "font/otf",
    ".pdf": "pdf",
    ".csv": "csv",
    ".exe": "exe/unknown",
}


file_signatures = (
    # Images
    ([(0, b"RIFF"), (8, b"WEBP")], "image/webp"),
    (b"\xff\xd8\xff\xdb", "image/jpeg"),
    (b"\xff\xd8\xff\xee", "image/jpeg"),
    (b"\xff\xd8\xff\xe0", "image/jpeg"),
    (b"\xff\xd8\xff\xe1", "image/jpeg"),
    (b"\x89\x50\x4e\x47\x0d\x0a\x1a\x0a", "image/png"),
    (b"\x42\x4d", "image/bmp"),
    (b"\x46\x4c\x49\x46", "image/flif"),
    (b"<svg", "image/svg"),
    # Audio
    ([(0, b"RIFF"), (8, b"WAVE")], "audio/wav"),
    (b"\xff\xfb", "audio/mp3"),
    (b"\xff\xf3", "audio/mp3"),
    (b"\xff\xf2", "audio/mp3"),
    (b"\x49\x44\x33", "audio/mp3"),
    (b"\x4f\x67\x67\x53", "audio/ogg"),
    (b"\x4d\x54\x68\x64", "audio/midi"),
    # Video
    ([(0, b"RIFF"), (8, b"AVI ")], "video/avi"),
    (b"\x30\x26\xb2\x75\x8e\x66\xcf\x11\xa6\xd9\x00\xaa\x00\x62\xce\x6c", "video/wmv"),
    (b"\x4d\x4c\x56\x49", "video/mlv"),
    (b"\x1a\x45\xdf\xa3", "video/webm"),
    (b"ftypisom", "video/mp4"),
    # Misc
    (b"\x25\x50\x44\x46\x2d", "pdf"),
    (b"\x4d\x5a", "exe/exe"),
    (b"\x5a\x4d", "exe/exe"),
    (b"\x50\x4b\x03\x04", "archive/zip"),
    (b"\x50\x4b\x05\x06", "archive/zip"),
    (b"\x50\x4b\x07\x08", "archive/zip"),
    (b"\x52\x61\x72\x21\x1a\x07\x00", "archive/rar"),
    (b"\x52\x61\x72\x21\x1a\x07\x01\x00", "archive/rar"),
    (b"\x75\x73\x74\x61\x72\x00\x30\x30", "archive/tar"),
    (b"\x75\x73\x74\x61\x72\x20\x20\x00", "archive/tar"),
    (b"\x37\x7a\xbc\xaf\x27\x1c", "archive/7z"),
    (b"\x1f\x8b", "archive/gz"),
    (b"\xfd\x37\x7a\x58\x5a\x00", "archive/xz"),
    (b"\x04\x22\x4d\x18", "archive/lz4"),
    (b"\x7f\x45\x4c\x46", "exe/elf"),
    (b"\x00\x61\x73\x6d", "exe/wasm"),
    # Text
    (b"<?xml ", "code/xml"),
)


def sample(path: Path) -> bytes:
    fd = os.open(str(path), os.O_RDONLY)
    try:
        return os.read(fd, 64)
    finally:
        os.close(fd)


def sniff(path: Path):
    if path.is_symlink():
        path = path.resolve()
    # Check for directory
    if path.is_dir():
        return "directory"
    # Make sure the file exists
    if not path.is_file():
        raise FileNotFoundError(str(path))
    # Check for known extensions
    if result := file_extensions.get(path.suffix, None):
        return result
    # Get a sample
    data = sample(path)
    # Check the sample against known magic bytes
    for signature, result in file_signatures:
        if isinstance(signature, bytes):
            if data.startswith(signature):
                return result
        else:
            match = True
            for offset, part in signature:
                if part != data[offset : offset + len(part)]:
                    match = False
                    break
            if match:
                return result
    # Check if the sample contains non-utf-8 characters
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return "binary"
    # Check if the sample contains unprintable characters
    if all(c.isprintable() or c.isspace() for c in text):
        return "text/unknown"
    else:
        return "binary"


def generate_thumbnail(image_path: Path, force: bool = False):
    thumbnail_path = THUMBNAILS_DIR / (hashlib.sha256(bytes(image_path)).hexdigest() + ".png")
    if not force and thumbnail_path.exists():
        return
    with Image(filename=image_path) as image:
        with image.clone() as thumbnail:
            thumbnail.thumbnail(128, 128)
            thumbnail.save(filename=thumbnail_path)



def delete_thumbnail(image_path: Path):
    thumbnail_path = THUMBNAILS_DIR / (hashlib.sha256(bytes(image_path)).hexdigest() + ".png")
    thumbnail_path.unlink(missing_ok=True)
