import os
import uuid
import re # Import regex for sanitization
import logging # Import logging
from fastapi import UploadFile, HTTPException
from pathlib import Path
from typing import Optional # Import Optional
from PIL import Image # Import Pillow

# Set up logging
logger = logging.getLogger(__name__)

# Calculate PROJECT_ROOT based on the location of this file
# This file is in `backend/file_storage.py`.
# Path(__file__).resolve().parent gives `backend` directory
# .parent again gives the project root directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Base directory where static files are served FROM (e.g., project_root/static)
BASE_STATIC_DIR = PROJECT_ROOT / "static"
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
    
    # Determine the new file extension (always webp for optimized images)
    new_file_ext = "webp"
    
    # Generate filename based on entity_name if provided, fall back to UUID
    if entity_name:
        base_name = sanitize_filename(entity_name)
        # Add a short UUID suffix to prevent collisions for identical sanitized names
        filename_base = f"{base_name}_{uuid.uuid4().hex[:8]}"
    else:
        filename_base = str(uuid.uuid4())
    
    filename = f"{filename_base}.{new_file_ext}"
    
    # Get the correct subdirectory for this entity type
    entity_subdir = ENTITY_DIRS[entity_type]
    file_path = BASE_IMAGES_DIR / entity_subdir / filename  # Full path where the optimized file should be saved

    # Ensure target directory exists
    file_path.parent.mkdir(parents=True, exist_ok=True)

    # Create a temporary path for the original upload before processing
    temp_upload_path = file_path.parent / f"temp_{uuid.uuid4().hex}.{file.filename.split('.')[-1]}"

    try:
        logger.info(f"Attempting to save temporary file to: {temp_upload_path.resolve()}")
        logger.info(f"Received file: {file.filename}, size: {file.size}")

        # Save the uploaded file temporarily
        with open(temp_upload_path, "wb") as buffer:
            while content := await file.read(1024 * 1024): # Read 1MB chunks
                buffer.write(content)
        
        logger.info(f"Successfully saved temporary file: {temp_upload_path.resolve()}")

        # Open, optimize, and save the image
        with Image.open(temp_upload_path) as img:
            # Convert to RGB if not already (important for WebP saving from some formats like PNG with alpha)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")

            # Resize the image (e.g., max 400x400 for better quality)
            img.thumbnail((1200, 1200)) # Resizes in place, maintaining aspect ratio

            # Save the optimized image as WebP with higher quality
            img.save(file_path, "webp", quality=90) # Increased quality to 90

        logger.info(f"Successfully optimized and saved image to: {file_path.resolve()}")

    except Exception as e:
        logger.error(f"Error processing or saving file {file.filename} to {file_path}: {e}", exc_info=True)
        raise HTTPException(500, f"Error processing or saving file: {str(e)}")
    finally:
        # Clean up the temporary file
        if temp_upload_path.exists():
            os.remove(temp_upload_path)
            logger.info(f"Cleaned up temporary file: {temp_upload_path.resolve()}")

    return f"/static/images/{entity_subdir}/{filename}"

def delete_image_file(image_url: str) -> None:
    if not image_url:
        return

    # Ensure it's a static file URL we expect
    # Expect the image_url to now start with the /static/ prefix
    expected_prefix = "/static/"
    if not image_url.startswith(expected_prefix):
        logger.warning(f"Attempted to delete URL not served by static files: {image_url}")
        return

    # Extract the path relative to BASE_STATIC_DIR (e.g., "images/personas/A_ebe4120c.webp")
    image_path_relative_to_static_root = image_url[len(expected_prefix):]

    # Verify the path is within the 'images' subdirectory and one of our entity directories
    # This check is now more robust, ensuring it's within 'images/' and then a valid entity_dir
    is_valid_path = image_path_relative_to_static_root.startswith("images/") and \
                    any(image_path_relative_to_static_root.startswith(f"images/{entity_dir}/") for entity_dir in ENTITY_DIRS.values())
    if not is_valid_path:
        logger.warning(f"Attempted to delete file from unauthorized or invalid static directory: {image_url}")
        return

    try:
        # Construct the actual file system path from the extracted part
        file_path = BASE_STATIC_DIR / image_path_relative_to_static_root

        logger.info(f"Attempting to delete file: {file_path.resolve()}") # Use logger
            
        # Check if the file exists and is actually a file before trying to delete
        if file_path.exists() and file_path.is_file():
            file_path.unlink()
            logger.info(f"Successfully deleted file: {file_path.resolve()}") # Use logger
        else:
            logger.warning(f"File not found or is not a file, cannot delete: {file_path.resolve()}") # Use logger
    except Exception as e:
        logger.error(f"Error deleting image file {image_url}: {e}", exc_info=True) # Use logger
