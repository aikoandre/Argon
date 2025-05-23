from fastapi import APIRouter, UploadFile, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, FileResponse
from ..file_storage import save_uploaded_file, delete_image_file
from pathlib import Path
import os # Add this import for os module
# Calculate PROJECT_ROOT based on the location of this file
# This file is in `backend/routers/images.py`.
# Path(__file__).resolve().parent gives `routers` directory.
# .parent again gives the `backend` directory.
# .parent again gives the `project_root` directory.
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
STATIC_DIR = PROJECT_ROOT / "static"
import logging
from ..db.database import get_db
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__) # Get a named logger for this module

router = APIRouter(prefix="/api/images", tags=["images"])

@router.post("/upload/{entity_type}")
async def upload_image(
    entity_type: str,
    file: UploadFile,
    entity_name: str = None,
    db: Session = Depends(get_db)
):
    # Verify content type
    content_type = file.content_type
    if not content_type or not content_type.startswith('image/'):
        return JSONResponse(
            {"detail": "File must be an image"},
            status_code=400,
            media_type="application/json"
        )
    
    try:
        image_url = await save_uploaded_file(file, entity_name=entity_name, entity_type=entity_type)
        return JSONResponse(
            {"url": image_url},
            status_code=201,
            media_type="application/json",
            headers={"Content-Type": "application/json"}
        )
    except HTTPException as he:
        return JSONResponse(
            {"detail": he.detail},
            status_code=he.status_code,
            media_type="application/json",
            headers={"Content-Type": "application/json"}
        )

@router.delete("/{image_url:path}")
def delete_image(
    image_url: str,
    db: Session = Depends(get_db)
):
    try:
        delete_image_file(image_url)
        return JSONResponse({"detail": "Image deleted successfully"}, media_type="application/json")
    except Exception as e:
        raise HTTPException(500, f"Error deleting image: {str(e)}")
