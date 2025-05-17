import os
import uuid
from fastapi import UploadFile, HTTPException
from pathlib import Path

IMAGE_DIR = Path("static/images")
IMAGE_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}

def allowed_file(filename: str) -> bool:
    return "." in filename and \
           filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

async def save_uploaded_file(file: UploadFile) -> str:
    if not allowed_file(file.filename):
        raise HTTPException(400, "Invalid file type")
    
    file_ext = file.filename.split('.').pop()
    filename = f"{uuid.uuid4()}.{file_ext}"
    file_path = IMAGE_DIR / filename
    
    try:
        contents = await file.read()
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
    except Exception as e:
        raise HTTPException(500, f"Error saving file: {str(e)}")
    
    return f"/static/images/{filename}"

def delete_image_file(image_url: str) -> None:
    if image_url:
        try:
            file_path = Path(image_url.replace("/static/", "static/"))
            if file_path.exists():
                file_path.unlink()
        except Exception as e:
            print(f"Error deleting image file: {str(e)}")
