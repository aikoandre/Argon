import os
import uuid
import re # Import regex for sanitization
import logging # Import logging
from fastapi import UploadFile, HTTPException
from pathlib import Path
from typing import Optional # Import Optional

# Set up logging
logger = logging.getLogger(__name__)

# Base directory where static files are served FROM relative to project root
BASE_STATIC_DIR = Path("static")
BASE_IMAGES_DIR = BASE_STATIC_DIR / "images"

# Directory structure for different entity types
ENTITY_DIRS = {
    "character": "characters",
    "scenario": "scenarios",
    "persona": "personas",
    "world": "worlds",
    "lore": "lore"
}

# Create base images directory and all entity subdirectories
BASE_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
for entity_dir in ENTITY_DIRS.values():
    (BASE_IMAGES_DIR / entity_dir).mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}

def allowed_file(filename: str) -> bool:
    return "." in filename and \
           filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def sanitize_filename(name: str) -> str:
    """Sanitize a string to be safe for use in a filename."""
    # Replace spaces and multiple non-alphanumeric characters with underscores
    # Keep alphanumeric, hyphens, dots, and underscores
    sanitized = re.sub(r'[^\w\-\.]+', '_', name)
    # Ensure it's not empty and doesn't start/end with underscore/hyphen/dot
    sanitized = sanitized.strip('_-.')
    # Prevent filenames that are just dots or underscores
    if not sanitized or sanitized in ['.', '..']:
        return "untitled"
    return sanitized

async def save_uploaded_file(file: UploadFile, entity_name: Optional[str] = None, entity_type: str = "character") -> str:
    if not allowed_file(file.filename):
        raise HTTPException(400, "Invalid file type")
    
    if entity_type not in ENTITY_DIRS:
        raise HTTPException(400, f"Invalid entity type. Must be one of: {', '.join(ENTITY_DIRS.keys())}")
    
    file_ext = file.filename.split('.')[-1]
    
    # Generate filename based on entity_name if provided, fall back to UUID
    if entity_name:
        base_name = sanitize_filename(entity_name)
        # Add a short UUID suffix to prevent collisions for identical sanitized names
        filename = f"{base_name}_{uuid.uuid4().hex[:8]}.{file_ext}"
    else:
        filename = f"{uuid.uuid4()}.{file_ext}"
    
    # Get the correct subdirectory for this entity type
    entity_subdir = ENTITY_DIRS[entity_type]
    file_path = BASE_IMAGES_DIR / entity_subdir / filename  # Full path where the file should be saved

    # Read the file content in chunks to handle large files
    bytes_written = 0
    try:
        # Ensure target directory exists
        file_path.parent.mkdir(parents=True, exist_ok=True)

        logger.info(f"Attempting to save file to: {file_path.resolve()}") # Log the save path
        logger.info(f"Received file: {file.filename}, size: {file.size}")

        with open(file_path, "wb") as buffer:
            while content := await file.read(1024 * 1024): # Read 1MB chunks
                buffer.write(content)
                bytes_written += len(content)

        logger.info(f"Successfully saved file: {file_path.resolve()}") # Log successful save
        logger.info(f"Total bytes written to {file_path.name}: {bytes_written}")

    except Exception as e:
        # Log the error with traceback
        logger.error(f"Error saving file {file.filename} to {file_path}: {e}", exc_info=True)
        raise HTTPException(500, f"Error saving file: {str(e)}") # Re-raise as HTTPException

    return f"/static/images/{entity_subdir}/{filename}"

def delete_image_file(image_url: str) -> None:
    if not image_url:
        return

    # Ensure it's a static file URL we expect
    if not image_url.startswith("/static/"):
        logger.warning(f"Attempted to delete non-static URL: {image_url}")
        return  # Don't attempt to delete non-static paths
        
    # Verify the path is within one of our entity directories
    is_valid_path = any(f"/static/images/{entity_dir}/" in image_url for entity_dir in ENTITY_DIRS.values())
    if not is_valid_path:
        logger.warning(f"Attempted to delete file from unauthorized directory: {image_url}")
        return

    try:
        # Construct the actual file system path from the URL
        relative_path_from_static = image_url.replace("/static/", "") # Removes the /static/ prefix
        # Joins BASE_STATIC_DIR (root/static) with images/filename.jpg
        file_path = BASE_STATIC_DIR / relative_path_from_static

        logger.info(f"Attempting to delete file: {file_path.resolve()}") # Use logger
            
        # Check if the file exists and is actually a file before trying to delete
        if file_path.exists() and file_path.is_file():
            file_path.unlink()
            logger.info(f"Successfully deleted file: {file_path.resolve()}") # Use logger
        else:
            logger.warning(f"File not found or is not a file, cannot delete: {file_path.resolve()}") # Use logger
    except Exception as e:
        logger.error(f"Error deleting image file {image_url}: {e}", exc_info=True) # Use logger
