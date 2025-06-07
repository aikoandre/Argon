# Implementation Plan: Hybrid Asynchronous Session Notes System

## Overview

This plan details the implementation of a hybrid architecture for dynamic memory management through evolving "Session Notes", processed asynchronously to maintain the responsiveness of the main system.

## Proposed Architecture

### Main Flow (Synchronous)
```
User Turn → Main Call → Response to User
```
- Maintains fast and responsive user experience
- Not affected by background memory processing

### Asynchronous Memory Update Pipeline

#### 1. Full Analysis LLM (Trigger)
**Responsibility:** Analyze the turn and identify both update intentions and new entity creations

**Input:** Current turn context
**Output:** Enhanced "Update Intentions" data structure with dual operations

```json
{
  "updates": [
    {
      "lore_entry_id": "character_001",
      "update_summary": "Developed new magical ability after intense training"
    },
    {
      "lore_entry_id": "location_002", 
      "update_summary": "Location was partially destroyed during the battle"
    }
  ],
  "creations": [
    {
      "entity_type": "Character",
      "creation_summary": "A new character named 'Kenta' was introduced. He is a mysterious demon hunter who appeared to help Momo, but his true intentions are unknown. He wears a black coat and carries a katana."
    }
  ]
}
```

#### 2. Dual Queue System
**Responsibility:** Manage both update and creation tasks

**Two Specialized Queues:**
- **NoteUpdateQueue:** Handles existing entity SessionNote updates
- **NewEntityCreationQueue:** Handles new LoreEntry creation

**Characteristics:**
- Parallel processing of different operation types
- Independent retry logic for each queue type
- Sequential processing within each queue to avoid conflicts
- Detailed logging for auditing both operations

#### 3. Dual Worker System
**Two Specialized Workers Processing in Parallel:**

##### A. Notes Rewrite Worker
**Responsibility:** Process SessionNote updates for existing entities

**Process:**
1. Retrieve original LoreEntry from database
2. Retrieve current SessionNote (if exists)
3. Execute specialized Rewrite LLM
4. Save updated SessionNote to database
5. Trigger composite document re-embedding

**Specialized Rewrite Prompt:**
```
You are a story continuity editor. Your task is to update a character/element note based on a new event.

[Original Lore (Static)]: {lore_entry_content}
[Current Session Note]: {current_session_note}
[New Event]: {update_summary}

Task: Rewrite the 'Session Note' incorporating the 'New Event'. 
- Maintain existing information that is still true
- Integrate the new event naturally
- Maintain narrative consistency
- Respond ONLY with the complete rewritten note

New Session Note:
```

##### B. New Entity Creation Worker
**Responsibility:** Create new LoreEntries from analysis summaries

**Process:**
1. Receive creation task from NewEntityCreationQueue
2. Execute LLM with structured data prompt
3. Validate and create new LoreEntry record
4. Mark as `is_dynamically_generated = True`
5. Trigger initial embedding creation

**Specialized Creation Prompt:**
```
You are a world-building assistant. Based on the following summary, create a LoreEntry in JSON format.

[Creation Summary]: {creation_summary}

Task: Generate a JSON object with the following keys:
- title: Entity name
- content: Detailed third-person description including appearance, personality, and known history
- tags: Array of relevant keywords

Example Response:
{
  "title": "Kenta",
  "content": "Kenta is an enigmatic figure who presents himself as a demon hunter. He wears a tattered black coat and carries an ancient-looking katana. He appeared suddenly to help Momo Ayase, but his manner of speaking is curt and his motivations are obscure. While he has acted as an ally, there is an aura of danger and mystery around him.",
  "tags": ["demon hunter", "mysterious", "katana", "temporary ally"]
}

Response:
```

#### 4. Composite Document Vector Updates
**Responsibility:** Maintain FAISS index with complete entity knowledge

**Two Update Scenarios:**

##### A. SessionNote Updates (Existing Entities)
**Process:**
1. Retrieve LoreEntry.content and updated SessionNote.note_content
2. Create composite document: `f"[Base Lore]\n{lore_content}\n\n[Session-Specific Notes]\n{note_content}"`
3. Generate embedding of composite text via Mistral API
4. Update/replace existing vector in FAISS using lore_entry_id
5. Validate index integrity

##### B. New Entity Creation
**Process:**
1. Retrieve newly created LoreEntry.content
2. Create initial document (no SessionNote yet): `f"[Base Lore]\n{lore_content}"`
3. Generate embedding via Mistral API
4. Add new vector to FAISS with lore_entry_id metadata
5. Validate index integrity

**Advantages of Composite Approach:**
- Single similarity search retrieves complete, contextualized information
- Perfect alignment between database state and searchable vectors
- Consistent entity representation regardless of creation method

## Complete Asynchronous Flow Summary

**The "One Note at a Time, One LoreEntry at a Time" Approach**

### Post-User Response Flow:
1. **Full Analysis LLM** executes and outputs dual-operation JSON (`updates` + `creations`)
2. **Backend Distribution:**
   - Iterates over `updates` list → adds each item as task to **NoteUpdateQueue**
   - Iterates over `creations` list → adds each item as task to **NewEntityCreationQueue**
3. **Parallel Worker Processing:**
   - **NoteUpdateWorker:** Reads old SessionNote, synthesizes with new info via Rewrite LLM, saves new note, triggers composite re-embedding
   - **NewEntityWorker:** Uses Creation LLM to generate structured LoreEntry from summary, saves to database, triggers initial composite embedding
4. **RAG Synchronization:** Both operations result in FAISS updates with complete, searchable composite documents

### Key Architectural Benefits:
- **Unified Entity Model:** All entities (user-created or AI-generated) follow same LoreEntry + SessionNote pattern
- **Complete Context Retrieval:** Single similarity search returns full entity knowledge via composite documents  
- **Scalable Processing:** Independent queues handle different operation types efficiently
- **Consistent Interface:** All entities manageable through same UI regardless of creation method

---
## Approach Advantages

### Separation of Responsibilities
- **Full Analysis LLM:** Focus on understanding and identifying both updates and new entities
- **Rewrite LLM:** Focus on narrative quality and SessionNote cohesion
- **Creation LLM:** Focus on structured LoreEntry generation
- Specialized prompts optimized for each specific task

### Scalability
- Dual queue system handles both updates and creations independently
- Scenarios with multiple elements (10+ characters) become manageable
- Parallel processing of different operation types
- Natural load balancing through separate queues
- Composite document approach eliminates RAG fragmentation

### Quality Control
- Different models for different tasks (analysis, rewriting, creation)
- More powerful/creative LLM for rewriting and creation
- Faster/analytical LLM for analysis
- Retry and validation at each step
- Structured JSON validation for new entities

### Optimized Performance
- User interface remains responsive
- RAG always accesses complete, up-to-date entity information via composite documents
- Asynchronous processing doesn't block experience
- Single vector per entity eliminates multi-document search complexity

## Technical Implementation

### Required Components

#### Backend Services
1. **AnalysisService**
   - Integration with analysis LLM
   - Parsing of dual-operation intentions (updates + creations)
   - Data structure validation for both operation types

2. **DualQueueService**
   - Redis/Celery queues for both NoteUpdateQueue and NewEntityCreationQueue
   - Priority management across queue types
   - Status tracking and retry logic for both operations

3. **NoteRewriteWorkerService**
   - Dedicated worker for SessionNote rewriting
   - Integration with rewrite LLM
   - Context and prompt handling for updates

4. **EntityCreationWorkerService**
   - Dedicated worker for new LoreEntry creation
   - Integration with creation LLM
   - JSON validation and database insertion

5. **CompositeVectorService**
   - Integration with Mistral Embeddings
   - Composite document creation and management
   - FAISS index updates for both scenarios
   - Mapping maintenance between entities and vectors

#### Database Schema Updates
```sql
-- Add processing status tracking to existing table
ALTER TABLE session_lore_modifications 
ADD COLUMN processing_status VARCHAR(20) DEFAULT 'pending';
ADD COLUMN last_processed_at TIMESTAMP;
ADD COLUMN processing_errors TEXT;

-- New table for SessionNotes (if not exists)
CREATE TABLE session_notes (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES chat_sessions(id),
    lore_entry_id UUID REFERENCES lore_entries(id),
    note_content TEXT,
    last_updated_turn INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add dynamic generation flag to LoreEntries
ALTER TABLE lore_entries 
ADD COLUMN is_dynamically_generated BOOLEAN DEFAULT FALSE;

-- Dual queue tables
CREATE TABLE note_update_tasks (
    id UUID PRIMARY KEY,
    lore_entry_id UUID,
    session_id UUID,
    update_summary TEXT,
    status VARCHAR(20),
    created_at TIMESTAMP,
    processed_at TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT
);

CREATE TABLE entity_creation_tasks (
    id UUID PRIMARY KEY,
    entity_type VARCHAR(50),
    creation_summary TEXT,
    session_id UUID,
    status VARCHAR(20),
    created_lore_entry_id UUID,
    created_at TIMESTAMP,
    processed_at TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT
);
```

#### Configuration
```python
# settings.py additions
DUAL_QUEUE_CONFIG = {
    "note_update_queue": {
        "max_retries": 3,
        "retry_delay": 60,  # seconds
        "batch_size": 5,
        "concurrent_workers": 2
    },
    "entity_creation_queue": {
        "max_retries": 3,
        "retry_delay": 60,  # seconds
        "batch_size": 3,
        "concurrent_workers": 1
    }
}

LLM_CONFIG = {
    "analysis_model": "mistral-large-latest",
    "rewrite_model": "mistral-large-latest",
    "creation_model": "mistral-large-latest",
    "temperature_analysis": 0.3,
    "temperature_rewrite": 0.7,
    "temperature_creation": 0.5
}

COMPOSITE_DOCUMENT_CONFIG = {
    "base_lore_prefix": "[Base Lore]",
    "session_notes_prefix": "[Session-Specific Notes]",
    "separator": "\n\n"
}
```

### API Endpoints

#### Monitoring and Debug
```python
# GET /api/dual-queue/status
# Returns status of both queues and all workers

# GET /api/dual-queue/note-updates/{session_id}
# Lists note update tasks for a specific session

# GET /api/dual-queue/entity-creations/{session_id}
# Lists entity creation tasks for a specific session

# POST /api/dual-queue/retry-note-update/{task_id}
# Forces retry of a specific note update task

# POST /api/dual-queue/retry-entity-creation/{task_id}
# Forces retry of a specific entity creation task

# GET /api/composite-documents/{lore_entry_id}/{session_id}
# Returns the current composite document for an entity in a session
```

## Implementation Timeline

### Phase 1: Base Infrastructure (1-2 weeks)
- [ ] Dual task queue setup (Redis/Celery for both queues)
- [ ] Database schema updates (SessionNotes, task tables)
- [ ] Basic worker configuration for both worker types
- [ ] Basic logging and monitoring for dual operations

### Phase 2: Enhanced Analysis LLM (1 week)
- [ ] Implement enhanced AnalysisService with dual output support
- [ ] Develop and test analysis prompts for both updates and creations
- [ ] Integration with existing chat system
- [ ] Structured output validation for both operation types

### Phase 3: Dual Worker System (2-3 weeks)
- [ ] Implement NoteRewriteWorkerService
- [ ] Implement EntityCreationWorkerService  
- [ ] Develop specialized prompts for both operations
- [ ] Retry and error handling system for both workers
- [ ] Testing with different scenarios (updates, creations, mixed)

### Phase 4: Composite Vector System (1-2 weeks)
- [ ] Implement CompositeVectorService
- [ ] Automatic FAISS updates for both scenarios
- [ ] Composite document creation and management
- [ ] Integrity validation and performance testing

### Phase 5: Monitoring and Optimization (1 week)
- [ ] Dual-queue monitoring dashboard
- [ ] Performance metrics for both operation types
- [ ] Prompt fine-tuning for all three LLM types
- [ ] Load testing with mixed workloads

## Security Considerations

### Rate Limiting
- Implement rate limiting for LLM APIs
- Exponential backoff on rate limit
- Queue prioritization based on importance

### Error Handling
- Graceful fallback on LLM failure
- Preserve previous state on error
- Automatic alerts for critical failures

### Data Integrity
- Automatic backup before updates
- Validation of rewritten note format
- Rollback capability for problematic updates

## Success Metrics

### Performance
- Chat response time maintained < 2s
- Memory update latency < 30s (note updates)
- Entity creation latency < 45s (new LoreEntries)
- Processing throughput > 50 updates/min (combined operations)

### Quality
- Note rewrite success rate > 95%
- Entity creation success rate > 90%
- Narrative consistency maintained across both operations
- Positive user feedback on dynamic world building

### Scalability
- Support for 100+ simultaneous mixed operations
- Graceful degradation under high load
- Stable memory usage over time
- Efficient composite document management

## Next Steps

1. **Plan Validation:** Technical review with team
2. **Prototyping:** Implement minimal version for testing
3. **Benchmarking:** Establish baseline metrics
4. **Iterative Development:** Implement by phases
5. **Extensive Testing:** Real scenarios with beta users

---

*Document created on: June 7, 2025*
*Status: Planning - Awaiting Implementation*

## Data Model Architecture

### Core Model: LoreEntry (Base) + SessionNote (Dynamic)

This is the foundation of the system. Every pre-existing entity in the MasterWorld will have two layers of knowledge:

#### 1. LoreEntry (SQLAlchemy Model)
- **Purpose:** Canonical, static truth
- **Fields:** `id`, `title`, `content`, `tags`, `is_dynamically_generated`
- **Role:** The original "character sheet" or entity definition
- **Persistence:** Permanent, rarely modified

#### 2. SessionNote (SQLAlchemy Model)
- **Purpose:** Session-specific, dynamic truth
- **Fields:** `id`, `session_id (FK)`, `lore_entry_id (FK)`, `note_content (Text)`, `last_updated_turn`
- **Role:** The living "footnote" - GM's notepad for that entity in that specific session
- **Persistence:** Session-scoped, frequently updated

#### Context Priority
When the Main Generation LLM needs context about an entity, the system provides both layers. The prompt is instructed to give **maximum priority** to SessionNote content over LoreEntry content.

## RAG Integration Strategy

### The Challenge: Linking LoreEntry and SessionNote in FAISS

**Option A (Poor):** Embed LoreEntry and SessionNote as separate documents in FAISS
- **Problem:** Similarity search may find one but not the other, resulting in incomplete context

**Option B (Excellent - The Correct Solution):** Create "Composite RAG Documents"

#### Composite Document Process:
1. When a SessionNote is created or updated:
   - Retrieve `content` from associated LoreEntry
   - Retrieve `note_content` from updated SessionNote
   - Concatenate into single string: `f"[Base Lore]\n{lore_content}\n\n[Session-Specific Notes]\n{note_content}"`
   - Generate embedding of combined text
   - Save resulting vector in FAISS with metadata pointing to `lore_entry_id`

#### Advantage:
The FAISS vector now represents complete, up-to-date knowledge about the entity. A single similarity search retrieves all relevant information at once, perfectly contextualized.

## Dynamic Entity Creation

### Auto-Generated LoreEntries (Preferred Approach)

Rather than "loose notes," automatically creating LoreEntries maintains system consistency. All entities (user-created or AI-generated) are treated uniformly, live in the same table, and can be edited through the same interface.

#### Enhanced Analysis Output Structure:
```json
{
  "updates": [
    {
      "lore_entry_id": "character_001",
      "update_summary": "Developed new magical ability after intense training"
    }
  ],
  "creations": [
    {
      "entity_type": "Character",
      "creation_summary": "A new character named 'Kenta' was introduced. He is a mysterious demon hunter who appeared to help Momo, but his true intentions are unknown. He wears a black coat and carries a katana."
    }
  ]
}
```

#### Dual Queue System:
1. **NoteUpdateQueue:** Handles existing entity updates
2. **NewEntityCreationQueue:** Handles new entity creation

## Enhanced Architecture
