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

@router.get("/serve/{image_path:path}")
async def serve_image(image_path: str):
    """
    Serves an image file from the static directory using FileResponse.
    Takes the path *relative to* /static as 'image_path'.
    e.g., request /api/images/serve/images/my-image.jpg to serve static/images/my-image.jpg
    Also handles requests where the 'images' directory is omitted, like:
    /api/images/serve/personas/filename.jpg -> static/images/personas/filename.jpg
    """
    # Debug logging for the incoming request
    logging.debug(f"Received request for image_path: {image_path}")
    logging.debug(f"STATIC_DIR is: {STATIC_DIR}")
    logging.debug(f"Current working directory: {os.getcwd()}")
    logging.debug(f"Absolute path of this file: {os.path.abspath(__file__)}")

    # Print the actual PROJECT_ROOT for debugging
    logging.debug(f"PROJECT_ROOT is: {Path(__file__).resolve().parent.parent.parent}")

    # Check if the path starts with 'images/' and handle accordingly
    if image_path.startswith('images/'):
        # Normal case: path includes 'images/' prefix
        file_location = STATIC_DIR / image_path
    else:
        # Special case: path is missing 'images/' prefix
        # This handles URLs like /api/images/serve/personas/filename.jpg
        file_location = STATIC_DIR / 'images' / image_path

    logging.debug(f"Attempting to serve image from absolute path: {file_location.resolve()}")
    logging.debug(f"Does file_location exist? {file_location.exists()}")
    logging.debug(f"Is file_location a file? {file_location.is_file()}")

    # List the directory contents for debugging
    if file_location.parent.exists():
        logging.debug(f"Contents of directory {file_location.parent}: {os.listdir(file_location.parent)}")
    else:
        logging.debug(f"Parent directory does not exist: {file_location.parent}")

    # Also check if the file exists directly in the static directory (as a fallback)
    direct_path = STATIC_DIR / image_path
    logging.debug(f"Checking if file exists directly in static dir: {direct_path.resolve()}")
    logging.debug(f"Does direct_path exist? {direct_path.exists()}")
    logging.debug(f"Is direct_path a file? {direct_path.is_file()}")

    if file_location.exists() and file_location.is_file():
        target_path = file_location
    elif direct_path.exists() and direct_path.is_file():
        logging.warning(f"Using direct path as fallback: {direct_path}")
        target_path = direct_path
    else:
        logging.error(f"Image file does not exist in either location: {file_location} or {direct_path}")
        raise HTTPException(status_code=404, detail="Image not found")

    # Ensure the file is within the static directory (prevent directory traversal)
    try:
        target_path.relative_to(STATIC_DIR)
    except ValueError:
        logging.error(f"Attempted to access file outside static directory: {target_path}")
        raise HTTPException(status_code=403, detail="Access denied")

    # Get file extension and enforce image content type
    file_ext = target_path.suffix.lower()
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

    logging.info(f"Serving image file: {target_path} with content type: {content_type}")

    # Use FileResponse with explicit content type headers
    response = FileResponse(
        path=target_path,
        media_type=content_type,
        filename=target_path.name,  # Original filename for downloads
        content_disposition_type='inline',  # Force inline display
        headers={
            'X-Content-Type-Options': 'nosniff',  # Prevent MIME type sniffing
            'Content-Type': content_type,  # Explicitly set Content-Type
            'Content-Disposition': 'inline',
            'Cache-Control': 'public, max-age=3600',  # Cache for 1 hour
            'Accept-Ranges': 'bytes'  # Support partial content for better browser handling
        }
    )
    return response
@router.get("/serve/personas/{filename}")
@router.get("/serve/images/personas/{filename}")
async def serve_persona_image(filename: str, request: Request = None):
    """
    Serves a persona image file from the static/images/personas directory.
    Supports both /serve/personas/{filename} and /serve/images/personas/{filename} URLs.
    """
    # Print the request path for debugging
    logging.debug(f"Request path: {request.url}")

    # Construct the file path
    file_location = STATIC_DIR / "images" / "personas" / filename

    logging.debug(f"Attempting to serve persona image from: {file_location.resolve()}")
    logging.debug(f"Does file exist? {file_location.exists()}")
    logging.debug(f"Is file_location a file? {file_location.is_file()}")

    # Check if the file exists directly in the static/images/personas directory
    if file_location.exists() and file_location.is_file():
        target_path = file_location
    else:
        # Try alternative locations
        alt_paths = [
            STATIC_DIR / "personas" / filename,  # Without 'images' directory
            STATIC_DIR / filename,  # Directly in static
        ]

        for path in alt_paths:
            logging.debug(f"Checking alternative path: {path.resolve()}")
            logging.debug(f"Does alternative path exist? {path.exists()}")
            logging.debug(f"Is it a file? {path.is_file()}")

            if path.exists() and path.is_file():
                logging.warning(f"Using alternative path: {path}")
                target_path = path
                break
        else:
            # If no valid file is found
            logging.error(f"Persona image not found in any location. Searched: {file_location}")
            raise HTTPException(status_code=404, detail="Image not found")

    # Ensure the file is within the static directory (prevent directory traversal)
    try:
        target_path.relative_to(STATIC_DIR)
    except ValueError:
        logging.error(f"Attempted to access file outside static directory: {target_path}")
        raise HTTPException(status_code=403, detail="Access denied")

    # Get file extension and enforce image content type
    file_ext = target_path.suffix.lower()
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

    logging.info(f"Serving persona image: {target_path} with content type: {content_type}")

    # Use FileResponse with explicit content type headers
    response = FileResponse(
        path=target_path,
        media_type=content_type,
        filename=target_path.name,  # Original filename for downloads
        content_disposition_type='inline',  # Force inline display
        headers={
            'X-Content-Type-Options': 'nosniff',  # Prevent MIME type sniffing
            'Content-Type': content_type,  # Explicitly set Content-Type
            'Content-Disposition': 'inline',
            'Cache-Control': 'public, max-age=3600',  # Cache for 1 hour
            'Accept-Ranges': 'bytes'  # Support partial content for better browser handling
        }
    )
    return response
