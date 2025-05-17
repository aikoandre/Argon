from fastapi import APIRouter, UploadFile, Depends, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from ..file_storage import save_uploaded_file, delete_image_file
from pathlib import Path
import logging
import mimetypes
from ..file_storage import save_uploaded_file, delete_image_file
from pathlib import Path
import logging
from ..db.database import get_db
from sqlalchemy.orm import Session

from fastapi.responses import StreamingResponse
import aiofiles
import io

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

@router.get("/serve/{image_path:path}")
async def serve_image(image_path: str):
    """
    Serves an image file from the static directory using FileResponse.
    Takes the path *relative to* /static as 'image_path'.
    e.g., request /api/images/serve/images/my-image.jpg to serve static/images/my-image.jpg
    """
    # Get the static directory path
    static_dir = Path("static").resolve()  # Use absolute path
    file_location = static_dir / image_path
    
    # Log the request
    logging.info(f"Image serve request for: {file_location}")
    
    if not file_location.exists() or not file_location.is_file():
        logging.error(f"Image file not found for serving: {file_location}")
        raise HTTPException(status_code=404, detail="Image not found")

    # Ensure the file is within the static directory (prevent directory traversal)
    try:
        file_location.relative_to(static_dir)
    except ValueError:
        logging.error(f"Attempted to access file outside static directory: {file_location}")
        raise HTTPException(status_code=403, detail="Access denied")

    # Get file extension and enforce image content type
    file_ext = file_location.suffix.lower()
    allowed_types = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
    }
    
    content_type = allowed_types.get(file_ext)
    if not content_type:
        logging.error(f"Unsupported image type: {file_ext}")
        raise HTTPException(status_code=400, detail="Unsupported image type")
    
    logging.info(f"Serving image file: {file_location} with content type: {content_type}")
    
    # Use FileResponse with explicit content type headers
    response = FileResponse(
        path=file_location,
        media_type=content_type,
        filename=file_location.name,  # Original filename for downloads
        content_disposition_type='inline',  # Force inline display
        headers={
            'X-Content-Type-Options': 'nosniff',  # Prevent MIME type sniffing
            'Content-Type': content_type,  # Explicitly set Content-Type
            'Content-Disposition': 'inline',
            'Cache-Control': 'public, max-age=3600',  # Cache for 1 hour
            'Accept-Ranges': 'bytes'  # Support partial content for better browser handling
        }
    )
