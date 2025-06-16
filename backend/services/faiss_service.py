import faiss
import numpy as np
import os
import threading
import logging
import sys
import asyncio # Import asyncio
from typing import Dict, List, Tuple, Optional, Any
from uuid import UUID, uuid4  # Import UUID and uuid4 for ID handling
from uuid import UUID

logger = logging.getLogger(__name__) # Initialize logger

# Path to store the FAISS index
FAISS_INDEX_PATH = "faiss_index.bin"
# Path to store the mapping from lore_entry_id to FAISS index ID
FAISS_ID_MAP_PATH = "faiss_id_map.npy"

def _ensure_valid_id(id_str: str) -> str:
    """Ensures an ID string is valid, converting UUID objects if needed."""
    if isinstance(id_str, UUID):
        return str(id_str)
    try:
        # Try parsing as UUID to validate format
        UUID(str(id_str))
        return str(id_str)
    except (ValueError, AttributeError, TypeError):
        # If not a valid UUID, return original string
        return str(id_str)

# Global FAISS index instance
_global_faiss_index: Optional["FAISSIndex"] = None

def get_faiss_index() -> "FAISSIndex":
    """Get the global FAISS index instance (singleton pattern)."""
    global _global_faiss_index
    if _global_faiss_index is None:
        _global_faiss_index = FAISSIndex()
    return _global_faiss_index

class FAISSIndex:
    def __init__(self, dimension: int = 1024): # Mistral-embed typically produces 1024-dim embeddings
        self.dimension = dimension
        self.index: Optional[faiss.Index] = None
        self.lore_entry_id_to_faiss_id: Dict[str, int] = {} # Maps lore_entry_id (str) to FAISS internal ID (int)
        self.extracted_knowledge_id_to_faiss_id: Dict[str, int] = {} # Maps extracted_knowledge_id (str) to FAISS internal ID (int)
        self.faiss_id_to_type_and_id: Dict[int, tuple] = {}  # Maps FAISS internal ID (int) to (type, id)
        self.lock = threading.Lock() # For thread-safe access to the index and maps
        self.composite_doc_cache: Dict[str, str] = {}  # lore_entry_id -> composite doc
        self._load_index()

    def cache_composite_document(self, lore_entry_id: str, composite_doc: str):
        """Cache the composite document for a lore entry."""
        self.composite_doc_cache[lore_entry_id] = composite_doc

    def get_composite_document(self, lore_entry_id: str) -> Optional[str]:
        """Retrieve the cached composite document for a lore entry, if available."""
        return self.composite_doc_cache.get(lore_entry_id)

    def retrieve_rag_context(self, lore_entry_id: str) -> Optional[str]:
        """
        Retrieve the composite document for RAG, prioritizing SessionNote content.
        Returns the cached composite doc if available, else None.
        """
        return self.get_composite_document(lore_entry_id)

    def _load_index(self):
        """Loads the FAISS index and ID map from disk if they exist."""
        with self.lock:
            if os.path.exists(FAISS_INDEX_PATH):
                logger.info(f"Loading FAISS index from {FAISS_INDEX_PATH}...")
                self.index = faiss.read_index(FAISS_INDEX_PATH)
                logger.info(f"FAISS index loaded with {self.index.ntotal} vectors.")
            else:
                logger.info("No existing FAISS index found. Creating a new IndexFlatL2.")
                self.index = faiss.IndexFlatL2(self.dimension) # L2 distance for similarity search

            if os.path.exists(FAISS_ID_MAP_PATH):
                logger.info(f"Loading FAISS ID map from {FAISS_ID_MAP_PATH}...")
                loaded_map = np.load(FAISS_ID_MAP_PATH, allow_pickle=True).item()
                self.lore_entry_id_to_faiss_id = loaded_map
                self.faiss_id_to_lore_entry_id = {v: k for k, v in loaded_map.items()}
                
                # Rebuild the faiss_id_to_type_and_id mapping from the loaded data
                for lore_id, faiss_id in loaded_map.items():
                    self.faiss_id_to_type_and_id[faiss_id] = ("lore_entry", lore_id)
                
                logger.info(f"FAISS ID map loaded with {len(self.lore_entry_id_to_faiss_id)} entries.")
                logger.info(f"Rebuilt type mapping with {len(self.faiss_id_to_type_and_id)} entries.")
            else:
                logger.info("No existing FAISS ID map found.")

    async def _save_index(self):
        """Saves the FAISS index and ID map to disk."""
        # The lock is acquired by the calling methods (add_embedding, update_embedding, remove_embedding)
        # so it's not needed here to prevent deadlock when using asyncio.to_thread.
        import os
        if self.index:
            abs_path = os.path.abspath(FAISS_INDEX_PATH)
            logger.info(f"Attempting to save FAISS index to {FAISS_INDEX_PATH} (absolute: {abs_path})...")
            sys.stdout.flush()
            sys.stderr.flush()
            try:
                await asyncio.to_thread(faiss.write_index, self.index, FAISS_INDEX_PATH)
                logger.info(f"FAISS index saved successfully at {abs_path}.")
            except Exception as e:
                logger.error(f"ERROR: Failed to save FAISS index: {e}")
            sys.stdout.flush()
            sys.stderr.flush()
        if self.lore_entry_id_to_faiss_id:
            abs_map_path = os.path.abspath(FAISS_ID_MAP_PATH)
            logger.info(f"Attempting to save FAISS ID map to {FAISS_ID_MAP_PATH} (absolute: {abs_map_path})...")
            sys.stdout.flush()
            sys.stderr.flush()
            try:
                await asyncio.to_thread(np.save, FAISS_ID_MAP_PATH, self.lore_entry_id_to_faiss_id)
                logger.info(f"FAISS ID map saved successfully at {abs_map_path}.")
            except Exception as e:
                logger.error(f"ERROR: Failed to save FAISS ID map: {e}")
            sys.stdout.flush()
            sys.stderr.flush()

    async def add_embedding(self, item_id: str, embedding: List[float], item_type: str = "lore_entry"): # Make async
        """Adds a new embedding to the FAISS index."""
        with self.lock:
            # Ensure we have a valid string ID
            item_id = _ensure_valid_id(item_id)
            
            if item_type == "lore_entry":
                id_map = self.lore_entry_id_to_faiss_id
            else:
                id_map = self.extracted_knowledge_id_to_faiss_id
            if item_id in id_map:
                logger.info(f"Lore entry ID {item_id} already exists. Using update_embedding instead.")
                await self.update_embedding(item_id, embedding, item_type) # Await the update call
                return

            vector = np.array([embedding], dtype=np.float32)
            if vector.shape[1] != self.dimension:
                raise ValueError(f"Embedding dimension mismatch. Expected {self.dimension}, got {vector.shape[1]}")

            # Add the vector to the index. FAISS assigns an internal ID.
            self.index.add(vector)
            faiss_internal_id = self.index.ntotal - 1 # The ID of the newly added vector

            id_map[item_id] = faiss_internal_id
            self.faiss_id_to_type_and_id[faiss_internal_id] = (item_type, item_id)
            await self._save_index() # Await the asynchronous save
            logger.info(f"Added embedding for {item_type}: {item_id} with FAISS ID: {faiss_internal_id}.")

    async def update_embedding(self, item_id: str, new_embedding: List[float], item_type: str = "lore_entry"): # Make async
        """Updates an existing embedding in the FAISS index."""
        with self.lock:
            if item_type == "lore_entry":
                id_map = self.lore_entry_id_to_faiss_id
            else:
                id_map = self.extracted_knowledge_id_to_faiss_id
            if item_id not in id_map:
                logger.info(f"Lore entry ID {item_id} not found for update. Adding as new embedding.")
                await self.add_embedding(item_id, new_embedding, item_type) # Await the add call
                return

            faiss_internal_id = id_map[item_id]
            vector = np.array([new_embedding], dtype=np.float32)
            if vector.shape[1] != self.dimension:
                raise ValueError(f"Embedding dimension mismatch. Expected {self.dimension}, got {vector.shape[1]}")

            # For IndexFlatL2, updating means removing and re-adding.
            # This is not ideal for performance on large indices, but works for now.
            # More advanced indices (e.g., IndexIDMap) handle updates better.
            await self.remove_embedding(item_id, item_type) # Await the asynchronous remove
            await self.add_embedding(item_id, new_embedding, item_type) # Await the asynchronous add
            logger.info(f"Updated embedding for lore_entry_id: {item_id} (FAISS ID: {faiss_internal_id}).")


    async def remove_embedding(self, item_id: str, item_type: str = "lore_entry"): # Make async
        """Removes an embedding from the FAISS index."""
        with self.lock:
            if item_type == "lore_entry":
                id_map = self.lore_entry_id_to_faiss_id
            else:
                id_map = self.extracted_knowledge_id_to_faiss_id
            if item_id not in id_map:
                logger.info(f"Lore entry ID {item_id} not found in index for removal.")
                return

            faiss_internal_id = id_map[item_id]
            
            # Create a list of IDs to remove
            ids_to_remove = faiss.LongVector([faiss_internal_id])
            self.index.remove_ids(ids_to_remove)

            del id_map[item_id]
            del self.faiss_id_to_type_and_id[faiss_internal_id]
            await self._save_index() # Await the asynchronous save
            logger.info(f"Removed embedding for lore_entry_id: {item_id} (FAISS ID: {faiss_internal_id}).")

    def search_similar(self, query_embedding: List[float], k: int = 500, item_type: str = None) -> List[tuple]:
        """
        Searches for the k most similar lore entries to the query embedding.
        Returns a list of tuples: (lore_entry_id, distance).
        """
        with self.lock:
            if self.index.ntotal == 0:
                return []

            query_vector = np.array([query_embedding], dtype=np.float32)
            if query_vector.shape[1] != self.dimension:
                raise ValueError(f"Query embedding dimension mismatch. Expected {self.dimension}, got {query_vector.shape[1]}")

            distances, faiss_ids = self.index.search(query_vector, k)
            
            results = []
            for i in range(len(faiss_ids[0])):
                faiss_id = faiss_ids[0][i]
                distance = distances[0][i]
                if faiss_id != -1: # -1 indicates no result found for that slot
                    type_and_id = self.faiss_id_to_type_and_id.get(faiss_id)
                    if not type_and_id:
                        continue
                    if item_type is None or type_and_id[0] == item_type:
                        results.append((type_and_id[0], type_and_id[1], float(distance)))
            return results

    def add_vectors(self, vectors: List[List[float]], metadatas: List[dict]) -> None:
        """Adds multiple vectors with metadata to the FAISS index"""
        with self.lock:
            if not self.index:
                raise ValueError("FAISS index not initialized")
                
            vectors_np = np.array(vectors, dtype=np.float32)
            if vectors_np.shape[1] != self.dimension:
                raise ValueError(f"Embedding dimension mismatch. Expected {self.dimension}, got {vectors_np.shape[1]}")
                
            # Add vectors to index
            self.index.add(vectors_np)
            
            # Store metadata mappings
            start_id = self.index.ntotal - len(vectors)
            for i, metadata in enumerate(metadatas):
                faiss_id = start_id + i
                item_type = metadata.get('type', 'unknown')
                item_id = _ensure_valid_id(metadata.get('message_id', str(uuid4())))
                
                # Store mapping from FAISS ID to metadata
                self.faiss_id_to_type_and_id[faiss_id] = (item_type, item_id)
                
                # Store reverse mapping if needed
                if item_type == "lore_entry":
                    self.lore_entry_id_to_faiss_id[item_id] = faiss_id
                elif item_type == "extracted_knowledge":
                    self.extracted_knowledge_id_to_faiss_id[item_id] = faiss_id
                    
            logger.info(f"Added {len(vectors)} vectors to FAISS index")

    def list_all_vectors(self):
        """Return a list of all vectors and their metadata in the FAISS index."""
        with self.lock:
            return [
                {"faiss_id": faiss_id, "type": type_and_id[0], "item_id": type_and_id[1]}
                for faiss_id, type_and_id in self.faiss_id_to_type_and_id.items()
            ]

    async def remove_vectors_by_session(self, session_id: str):
        """Remove all vectors related to a given chat session (user_message/ai_response)."""
        to_remove = []
        with self.lock:
            for faiss_id, (item_type, item_id) in self.faiss_id_to_type_and_id.items():
                # Only user_message/ai_response types have session_id in metadata
                if hasattr(self, 'metadata_lookup'):
                    meta = self.metadata_lookup.get(faiss_id, {})
                    if meta.get('session_id') == session_id:
                        to_remove.append((item_type, item_id))
                # Fallback: try to match session_id in item_id if encoded
                elif session_id in str(item_id):
                    to_remove.append((item_type, item_id))
        for item_type, item_id in to_remove:
            await self.remove_embedding(item_id, item_type)

    async def remove_vectors_by_card(self, card_id: str):
        """Remove all vectors related to a given card (character or scenario)."""
        to_remove = []
        with self.lock:
            for faiss_id, (item_type, item_id) in self.faiss_id_to_type_and_id.items():
                # If your metadata includes card_id, check here
                if hasattr(self, 'metadata_lookup'):
                    meta = self.metadata_lookup.get(faiss_id, {})
                    if meta.get('card_id') == card_id:
                        to_remove.append((item_type, item_id))
                elif card_id in str(item_id):
                    to_remove.append((item_type, item_id))
        for item_type, item_id in to_remove:
            await self.remove_embedding(item_id, item_type)

    async def clear_all_data(self):
        """Completely clear all FAISS data and reset the index."""
        with self.lock:
            logger.info("Clearing all FAISS data...")
            
            # Reset the index to empty state
            self.index = faiss.IndexFlatL2(self.dimension)
            
            # Clear all mappings
            self.lore_entry_id_to_faiss_id.clear()
            self.extracted_knowledge_id_to_faiss_id.clear()
            self.faiss_id_to_type_and_id.clear()
            
            # Clear reverse mapping if it exists
            if hasattr(self, 'faiss_id_to_lore_entry_id'):
                self.faiss_id_to_lore_entry_id.clear()
            
            # Clear metadata lookup if it exists
            if hasattr(self, 'metadata_lookup'):
                self.metadata_lookup.clear()
            
            # Save the empty index and mappings
            await self._save_index()
            
            logger.info("All FAISS data cleared successfully.")
    
    def get_index_stats(self) -> Dict[str, Any]:
        """Get statistics about the current FAISS index."""
        with self.lock:
            stats = {
                "total_vectors": self.index.ntotal if self.index else 0,
                "dimension": self.dimension,
                "lore_entries": len(self.lore_entry_id_to_faiss_id),
                "extracted_knowledge": len(self.extracted_knowledge_id_to_faiss_id),
                "total_mappings": len(self.faiss_id_to_type_and_id)
            }
            
            # Count by type
            type_counts = {}
            for faiss_id, (item_type, item_id) in self.faiss_id_to_type_and_id.items():
                type_counts[item_type] = type_counts.get(item_type, 0) + 1
            
            stats["type_breakdown"] = type_counts
            return stats

    async def remove_vectors_by_lore_entry(self, lore_entry_id: str):
        """Remove all vectors related to a specific lore entry."""
        await self.remove_embedding(lore_entry_id, "lore_entry")

    async def remove_all_vectors_by_type(self, item_type: str):
        """Remove all vectors of a specific type (e.g., 'lore_entry', 'extracted_knowledge')."""
        to_remove = []
        with self.lock:
            for faiss_id, (vector_type, item_id) in self.faiss_id_to_type_and_id.items():
                if vector_type == item_type:
                    to_remove.append((vector_type, item_id))
        
        logger.info(f"Removing {len(to_remove)} vectors of type '{item_type}'")
        for vector_type, item_id in to_remove:
            await self.remove_embedding(item_id, vector_type)

    def detect_unmapped_vectors(self) -> Dict[str, Any]:
        """Detect vectors in the FAISS index that have no mapping."""
        with self.lock:
            if not self.index:
                return {"error": "No FAISS index loaded"}
            
            total_vectors = self.index.ntotal
            mapped_faiss_ids = set(self.faiss_id_to_type_and_id.keys())
            all_faiss_ids = set(range(total_vectors))
            unmapped_ids = all_faiss_ids - mapped_faiss_ids
            
            return {
                "total_vectors": total_vectors,
                "mapped_vectors": len(mapped_faiss_ids),
                "unmapped_vectors": len(unmapped_ids),
                "unmapped_ids": sorted(unmapped_ids),
                "mapped_ids": sorted(mapped_faiss_ids),
                "coverage_percentage": (len(mapped_faiss_ids) / total_vectors * 100) if total_vectors > 0 else 0
            }

    async def clean_unmapped_vectors(self) -> Dict[str, Any]:
        """Remove vectors from FAISS index that have no mapping."""
        with self.lock:
            detection_result = self.detect_unmapped_vectors()
            unmapped_ids = detection_result.get("unmapped_ids", [])
            
            if not unmapped_ids:
                return {"message": "No unmapped vectors found", "removed": 0}
            
            logger.info(f"Cleaning {len(unmapped_ids)} unmapped vectors...")
            
            # Create new index with only mapped vectors
            mapped_vectors = []
            new_lore_mapping = {}
            new_extracted_mapping = {}
            new_type_mapping = {}
            new_faiss_id = 0
            
            # Extract mapped vectors in order of their current FAISS IDs
            for old_faiss_id in sorted(self.faiss_id_to_type_and_id.keys()):
                vector = self.index.reconstruct(old_faiss_id)
                mapped_vectors.append(vector)
                
                # Get the type and item_id
                item_type, item_id = self.faiss_id_to_type_and_id[old_faiss_id]
                new_type_mapping[new_faiss_id] = (item_type, item_id)
                
                # Update type-specific mappings
                if item_type == "lore_entry":
                    new_lore_mapping[item_id] = new_faiss_id
                elif item_type == "extracted_knowledge":
                    new_extracted_mapping[item_id] = new_faiss_id
                
                new_faiss_id += 1
            
            # Create new index
            new_index = faiss.IndexFlatL2(self.dimension)
            if mapped_vectors:
                vectors_array = np.array(mapped_vectors, dtype=np.float32)
                new_index.add(vectors_array)
            
            # Update all mappings
            self.index = new_index
            self.lore_entry_id_to_faiss_id = new_lore_mapping
            self.extracted_knowledge_id_to_faiss_id = new_extracted_mapping
            self.faiss_id_to_type_and_id = new_type_mapping
            
            # Update reverse mapping if it exists
            if hasattr(self, 'faiss_id_to_lore_entry_id'):
                self.faiss_id_to_lore_entry_id = {v: k for k, v in new_lore_mapping.items()}
            
            # Save the cleaned index
            await self._save_index()
            
            result = {
                "message": f"Successfully cleaned {len(unmapped_ids)} unmapped vectors",
                "removed": len(unmapped_ids),
                "remaining_vectors": new_index.ntotal,
                "unmapped_ids_removed": unmapped_ids
            }
            
            logger.info(f"Cleaning complete: {result}")
            return result

    async def force_rebuild_mappings(self) -> Dict[str, Any]:
        """Force rebuild all mappings from the current state."""
        with self.lock:
            logger.info("Force rebuilding FAISS mappings...")
            
            # Clear current type mapping
            self.faiss_id_to_type_and_id.clear()
            
            # Rebuild from lore_entry mapping
            for lore_id, faiss_id in self.lore_entry_id_to_faiss_id.items():
                self.faiss_id_to_type_and_id[faiss_id] = ("lore_entry", lore_id)
            
            # Rebuild from extracted_knowledge mapping
            for extracted_id, faiss_id in self.extracted_knowledge_id_to_faiss_id.items():
                self.faiss_id_to_type_and_id[faiss_id] = ("extracted_knowledge", extracted_id)
            
            # Update reverse mapping if it exists
            if hasattr(self, 'faiss_id_to_lore_entry_id'):
                self.faiss_id_to_lore_entry_id = {v: k for k, v in self.lore_entry_id_to_faiss_id.items()}
            
            result = {
                "message": "Mappings rebuilt successfully",
                "total_mappings": len(self.faiss_id_to_type_and_id),
                "lore_entries": len(self.lore_entry_id_to_faiss_id),
                "extracted_knowledge": len(self.extracted_knowledge_id_to_faiss_id)
            }
            
            logger.info(f"Rebuild complete: {result}")
            return result

    def detect_and_clean_unmapped_vectors(self) -> Dict[str, Any]:
        """
        Detects unmapped vectors and cleans them in a single operation.
        This is a convenience method that combines detect_unmapped_vectors and clean_unmapped_vectors.
        """
        with self.lock:
            detection_result = self.detect_unmapped_vectors()
            if detection_result.get("unmapped_vectors", 0) == 0:
                return {
                    "message": "No unmapped vectors found",
                    "detection": detection_result,
                    "cleaned": False
                }
            
            logger.info(f"Found {detection_result['unmapped_vectors']} unmapped vectors. Cleaning...")
            
            # Use the clean_unmapped_vectors method to fix the issue
            clean_result = asyncio.run(self.clean_unmapped_vectors())
            
            return {
                "message": f"Successfully detected and cleaned {detection_result['unmapped_vectors']} unmapped vectors",
                "detection": detection_result,
                "cleaned": True,
                "clean_result": clean_result
            }
