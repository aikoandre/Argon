# backend/services/composite_document_service.py
"""
Composite Document Service for SessionNotes system.

Manages composite documents that combine LoreEntry + SessionNote for FAISS indexing.
"""
import logging
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
import json
import numpy as np
from collections import OrderedDict
import time

from models.lore_entry import LoreEntry
from models.session_note import SessionNote
from services.litellm_service import litellm_service
from services.faiss_service import get_faiss_index

logger = logging.getLogger(__name__)


class CompositeDocument:
    """Represents a composite document combining LoreEntry and SessionNote"""
    
    def __init__(self, lore_entry: LoreEntry, session_note: Optional[SessionNote] = None):
        self.lore_entry = lore_entry
        self.session_note = session_note
        self.composite_text = self._create_composite_text()
        
    def _create_composite_text(self) -> str:
        """Create composite text from LoreEntry and SessionNote"""
        base_lore = f"[Base Lore]\nCharacter Name: {self.lore_entry.name}\nType: {self.lore_entry.entry_type}\nDescription: {self.lore_entry.description or 'No description available.'}"
        
        if self.session_note and self.session_note.note_content.strip():
            session_notes = f"\n\n[Session Notes]\nRecent Developments: {self.session_note.note_content}"
            return base_lore + session_notes
        
        return base_lore
    
    def get_metadata(self) -> Dict[str, Any]:
        """Get metadata for the composite document"""
        return {
            "lore_entry_id": self.lore_entry.id,
            "entity_name": self.lore_entry.name,
            "entity_type": self.lore_entry.entry_type,
            "is_dynamically_generated": self.lore_entry.is_dynamically_generated,
            "has_session_notes": self.session_note is not None and bool(self.session_note.note_content.strip()),
            "last_updated_turn": self.session_note.last_updated_turn if self.session_note else 0
        }


class CompositeDocumentService:
    """Service for managing composite documents and FAISS integration"""
    
    def __init__(self):
        self.litellm_service = litellm_service
        self.faiss_index = get_faiss_index()
        self.max_composite_length = 4000  # Token limit for composite documents
        self.embedding_cache = OrderedDict()  # LRU cache for embeddings
        self.max_cache_size = 1000
        self.cache_hit_count = 0
        self.cache_miss_count = 0

    async def create_composite_document(
        self,
        db: Session,
        lore_entry_id: str,
        session_id: Optional[str] = None
    ) -> Optional[CompositeDocument]:
        """Create a composite document for a LoreEntry, optionally with SessionNote"""
        try:
            # Get LoreEntry
            lore_entry = db.query(LoreEntry).filter(LoreEntry.id == lore_entry_id).first()
            if not lore_entry:
                logger.warning(f"LoreEntry {lore_entry_id} not found")
                return None
            
            # Get SessionNote if session_id provided
            session_note = None
            if session_id:
                session_note = db.query(SessionNote).filter(
                    SessionNote.lore_entry_id == lore_entry_id,
                    SessionNote.session_id == session_id
                ).first()
            
            return CompositeDocument(lore_entry, session_note)
            
        except Exception as e:
            logger.error(f"Error creating composite document: {e}")
            return None

    async def generate_composite_embedding(
        self,
        composite_doc: CompositeDocument,
        user_settings: Dict[str, Any]
    ) -> Optional[np.ndarray]:
        """Generate embedding for composite document"""
        try:
            # Truncate if too long
            text = composite_doc.composite_text
            if len(text) > self.max_composite_length:
                text = text[:self.max_composite_length] + "..."
                logger.debug(f"Truncated composite document to {self.max_composite_length} characters")
            
            # Extract embedding configuration
            embedding_provider = user_settings.get('embedding_llm_provider', 'openrouter')
            embedding_model = user_settings.get('embedding_llm_model', 'mistral/mistral-embed')
            embedding_api_key = user_settings.get('embedding_llm_api_key')
            
            # Generate embedding
            embeddings = await self.litellm_service.get_embedding(
                provider=embedding_provider,
                model=embedding_model,
                texts=[text],  # Pass as list since method expects Union[str, List[str]]
                api_key=embedding_api_key
            )
            
            if embeddings and len(embeddings) > 0:
                embedding_vector = embeddings[0]  # Get first embedding
                logger.debug(f"Generated composite embedding for {composite_doc.lore_entry.name}")
                return np.array(embedding_vector)
            else:
                logger.error(f"Embedding generation failed: no embeddings returned")
                return None
                
        except Exception as e:
            logger.error(f"Error generating composite embedding: {e}")
            return None

    async def update_lore_entry_embedding(
        self,
        db: Session,
        lore_entry_id: str,
        session_id: str,
        user_settings: Dict[str, Any]
    ) -> bool:
        """Update the embedding for a LoreEntry with its current SessionNote"""
        try:
            # Create composite document
            composite_doc = await self.create_composite_document(
                db=db,
                lore_entry_id=lore_entry_id,
                session_id=session_id
            )
            
            if not composite_doc:
                return False
            
            # Generate new embedding
            embedding = await self.generate_composite_embedding(composite_doc, user_settings)
            if embedding is None:
                return False
            
            # Update LoreEntry with new embedding
            lore_entry = db.query(LoreEntry).filter(LoreEntry.id == lore_entry_id).first()
            if lore_entry:
                lore_entry.embedding_vector = embedding.tolist()
                db.flush()  # Don't commit here, let the parent service handle it
                logger.info(f"Updated embedding for LoreEntry {lore_entry.name}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error updating LoreEntry embedding: {e}")
            return False

    async def batch_update_embeddings(
        self,
        db: Session,
        lore_entry_ids: List[str],
        session_id: str,
        user_settings: Dict[str, Any]
    ) -> Dict[str, bool]:
        """Update embeddings for multiple LoreEntries in batch"""
        results = {}
        
        for lore_entry_id in lore_entry_ids:
            try:
                success = await self.update_lore_entry_embedding(
                    db=db,
                    lore_entry_id=lore_entry_id,
                    session_id=session_id,
                    user_settings=user_settings
                )
                results[lore_entry_id] = success
                
            except Exception as e:
                logger.error(f"Error updating embedding for {lore_entry_id}: {e}")
                results[lore_entry_id] = False
        
        successful_count = sum(1 for success in results.values() if success)
        logger.info(f"Batch embedding update: {successful_count}/{len(lore_entry_ids)} successful")
        
        return results

    def get_composite_documents_for_session(
        self,
        db: Session,
        session_id: str,
        master_world_id: str
    ) -> List[CompositeDocument]:
        """Get all composite documents for a session"""
        try:
            # Get all LoreEntries for the master world
            lore_entries = db.query(LoreEntry).filter(
                LoreEntry.master_world_id == master_world_id
            ).all()
            
            # Get all SessionNotes for the session
            session_notes = db.query(SessionNote).filter(
                SessionNote.session_id == session_id
            ).all()
            
            # Create mapping for quick lookup
            session_notes_map = {note.lore_entry_id: note for note in session_notes if note.lore_entry_id}
            
            # Create composite documents
            composite_docs = []
            for lore_entry in lore_entries:
                session_note = session_notes_map.get(lore_entry.id)
                composite_docs.append(CompositeDocument(lore_entry, session_note))
            
            logger.debug(f"Created {len(composite_docs)} composite documents for session {session_id}")
            return composite_docs
            
        except Exception as e:
            logger.error(f"Error getting composite documents for session: {e}")
            return []

    def get_rag_context_from_composite_docs(
        self,
        composite_docs: List[CompositeDocument],
        max_context_length: int = 8000
    ) -> str:
        """Convert composite documents to RAG context string"""
        try:
            context_parts = []
            current_length = 0
            
            for doc in composite_docs:
                doc_text = doc.composite_text
                if current_length + len(doc_text) > max_context_length:
                    break
                    
                context_parts.append(doc_text)
                current_length += len(doc_text)
            
            context = "\n\n---\n\n".join(context_parts)
            logger.debug(f"Generated RAG context: {len(context)} characters from {len(context_parts)} documents")
            
            return context
            
        except Exception as e:
            logger.error(f"Error generating RAG context: {e}")
            return ""
    
    def _get_cache_key(self, text: str, user_settings: Dict[str, Any]) -> str:
        """Generate cache key for embedding"""
        provider = user_settings.get('embedding_llm_provider', 'openrouter')
        model = user_settings.get('embedding_llm_model', 'mistral/mistral-embed')
        # Use hash of text + provider + model for cache key
        import hashlib
        content = f"{text}:{provider}:{model}"
        return hashlib.md5(content.encode()).hexdigest()

    def _cache_embedding(self, cache_key: str, embedding: np.ndarray):
        """Cache embedding with LRU eviction"""
        if len(self.embedding_cache) >= self.max_cache_size:
            # Remove oldest item
            self.embedding_cache.popitem(last=False)
        
        self.embedding_cache[cache_key] = {
            'embedding': embedding.copy(),
            'timestamp': time.time()
        }
        
        # Move to end (most recently used)
        self.embedding_cache.move_to_end(cache_key)

    def _get_cached_embedding(self, cache_key: str) -> Optional[np.ndarray]:
        """Get cached embedding if available"""
        if cache_key in self.embedding_cache:
            self.cache_hit_count += 1
            cached_data = self.embedding_cache[cache_key]
            # Move to end (most recently used)
            self.embedding_cache.move_to_end(cache_key)
            return cached_data['embedding'].copy()
        
        self.cache_miss_count += 1
        return None

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache performance statistics"""
        total_requests = self.cache_hit_count + self.cache_miss_count
        hit_rate = (self.cache_hit_count / total_requests * 100) if total_requests > 0 else 0
        
        return {
            'cache_size': len(self.embedding_cache),
            'max_cache_size': self.max_cache_size,
            'hit_count': self.cache_hit_count,
            'miss_count': self.cache_miss_count,
            'hit_rate_percent': round(hit_rate, 2),
            'total_requests': total_requests
        }

    async def batch_update_faiss_entities(
        self,
        db: Session,
        lore_entry_ids: List[str],
        session_id: str,
        user_settings: Dict[str, Any]
    ) -> Dict[str, bool]:
        """
        Phase 4: Batch update multiple entities in FAISS for better performance.
        
        Optimizations:
        - Batch embedding generation
        - Efficient FAISS updates
        - Progress tracking
        """
        results = {}
        embeddings_to_update = []
        valid_entries = []
        
        logger.info(f"[Phase4] Starting batch FAISS update for {len(lore_entry_ids)} entities")
        
        try:
            # Step 1: Create all composite documents
            for lore_entry_id in lore_entry_ids:
                composite_doc = await self.create_composite_document(
                    db=db,
                    lore_entry_id=lore_entry_id,
                    session_id=session_id
                )
                
                if composite_doc:
                    valid_entries.append((lore_entry_id, composite_doc))
                else:
                    results[lore_entry_id] = False
                    logger.warning(f"[Phase4] Failed to create composite doc for {lore_entry_id}")
            
            # Step 2: Batch generate embeddings (with caching)
            for lore_entry_id, composite_doc in valid_entries:
                cache_key = self._get_cache_key(composite_doc.composite_text, user_settings)
                cached_embedding = self._get_cached_embedding(cache_key)
                
                if cached_embedding is not None:
                    embeddings_to_update.append((lore_entry_id, cached_embedding, composite_doc))
                    logger.debug(f"[Phase4] Cache hit for {lore_entry_id}")
                else:
                    # Generate new embedding
                    embedding = await self.generate_composite_embedding(
                        composite_doc=composite_doc,
                        user_settings=user_settings
                    )
                    
                    if embedding is not None:
                        self._cache_embedding(cache_key, embedding)
                        embeddings_to_update.append((lore_entry_id, embedding, composite_doc))
                        logger.debug(f"[Phase4] Generated new embedding for {lore_entry_id}")
                    else:
                        results[lore_entry_id] = False
                        logger.error(f"[Phase4] Failed to generate embedding for {lore_entry_id}")
            
            # Step 3: Batch update FAISS index
            for lore_entry_id, embedding, composite_doc in embeddings_to_update:
                try:
                    await self.faiss_index.update_embedding(
                        item_id=lore_entry_id,
                        new_embedding=embedding.tolist(),
                        item_type="lore_entry"
                    )
                    
                    # Cache composite document for RAG
                    self.faiss_index.cache_composite_document(lore_entry_id, composite_doc.composite_text)
                    
                    results[lore_entry_id] = True
                    logger.debug(f"[Phase4] Successfully updated FAISS for {lore_entry_id}")
                    
                except Exception as e:
                    results[lore_entry_id] = False
                    logger.error(f"[Phase4] FAISS update failed for {lore_entry_id}: {e}")
            
            # Log performance metrics
            successful_count = sum(1 for success in results.values() if success)
            cache_stats = self.get_cache_stats()
            
            logger.info(f"[Phase4] Batch update complete: {successful_count}/{len(lore_entry_ids)} successful")
            logger.info(f"[Phase4] Cache performance: {cache_stats['hit_rate_percent']}% hit rate")
            
            return results
            
        except Exception as e:
            logger.error(f"[Phase4] Batch update failed: {e}")
            # Mark all remaining as failed
            for lore_entry_id in lore_entry_ids:
                if lore_entry_id not in results:
                    results[lore_entry_id] = False
            return results

    async def optimize_faiss_index(self, db: Session) -> Dict[str, Any]:
        """
        Phase 4: Perform FAISS index optimization and cleanup.
        
        Includes:
        - Detecting and cleaning unmapped vectors
        - Rebuilding mappings if needed
        - Performance analysis
        """
        logger.info("[Phase4] Starting FAISS index optimization")
        
        try:
            # Get initial stats
            initial_stats = self.faiss_index.get_index_stats()
            logger.info(f"[Phase4] Initial FAISS stats: {initial_stats}")
            
            # Detect unmapped vectors
            unmapped_result = self.faiss_index.detect_unmapped_vectors()
            logger.info(f"[Phase4] Unmapped vector analysis: {unmapped_result}")
            
            # Clean unmapped vectors if found
            cleanup_result = {}
            if unmapped_result.get('unmapped_vectors', 0) > 0:
                logger.info(f"[Phase4] Cleaning {unmapped_result['unmapped_vectors']} unmapped vectors")
                cleanup_result = await self.faiss_index.clean_unmapped_vectors()
                logger.info(f"[Phase4] Cleanup result: {cleanup_result}")
            
            # Get final stats
            final_stats = self.faiss_index.get_index_stats()
            logger.info(f"[Phase4] Final FAISS stats: {final_stats}")
            
            # Cache performance
            cache_stats = self.get_cache_stats()
            
            optimization_result = {
                'success': True,
                'initial_stats': initial_stats,
                'final_stats': final_stats,
                'unmapped_analysis': unmapped_result,
                'cleanup_result': cleanup_result,
                'cache_performance': cache_stats,
                'vectors_cleaned': unmapped_result.get('unmapped_vectors', 0),
                'optimization_completed': True
            }
            
            logger.info("[Phase4] FAISS optimization completed successfully")
            return optimization_result
            
        except Exception as e:
            logger.error(f"[Phase4] FAISS optimization failed: {e}")
            return {
                'success': False,
                'error_message': str(e),
                'optimization_completed': False
            }

    async def create_optimized_composite_document(
        self,
        lore_entry: LoreEntry,
        session_note: Optional[SessionNote] = None,
        user_settings: Dict[str, Any] = None
    ) -> Optional[CompositeDocument]:
        """
        Phase 4: Create composite document with optimization features.
        
        Includes performance tracking and enhanced formatting.
        """
        try:
            start_time = time.time()
            
            # Create composite document
            composite_doc = CompositeDocument(lore_entry, session_note)
            
            # Optional: Generate and cache embedding immediately if user_settings provided
            if user_settings:
                cache_key = self._get_cache_key(composite_doc.composite_text, user_settings)
                cached_embedding = self._get_cached_embedding(cache_key)
                
                if cached_embedding is None:
                    # Pre-generate embedding for better performance
                    embedding = await self.generate_composite_embedding(
                        composite_doc=composite_doc,
                        user_settings=user_settings
                    )
                    if embedding is not None:
                        self._cache_embedding(cache_key, embedding)
            
            creation_time = time.time() - start_time
            logger.debug(f"[Phase4] Composite document created in {creation_time:.3f}s")
            
            return composite_doc
            
        except Exception as e:
            logger.error(f"[Phase4] Error creating optimized composite document: {e}")
            return None
