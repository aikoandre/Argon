# Unified LLM Services Architecture Plan

## Overview

This plan implements a simplified, elegant architecture that reduces complexity by using four distinct LLM services with different responsibilities, eliminating the need for multiple specialized services while maintaining all functionality.

## Design Principle

**Core Philosophy:** Use infrastructure intelligently to execute different tasks, not create unnecessary complexity. Four services, multiple prompts - like a Swiss Army knife with one handle (API/model) and different blades (prompts) for different jobs.

## Architecture Components

### Four Core LLM Services

#### 1. Generation Service (Main LLM)
- **Purpose:** Direct user responses
- **Model:** Primary model (powerful, potentially slower)
- **Usage:** Synchronous, user-facing responses
- **Responsibilities:**
  - Execute RAG pipeline (Query Transformation, FAISS, Rerankers)
  - Construct main prompt with RAG context and session state
  - Generate character/narrator responses and "Embedded Panel"

#### 2. Analysis Service (Analysis LLM)
- **Purpose:** Turn analysis and intent extraction
- **Model:** Analytical model (can be same as Generation)
- **Usage:** Asynchronous, post-response analysis
- **Responsibilities:**
  - Process last turn (user input + AI response)
  - Generate "Intentions" JSON with two lists: `updates` and `creations`
  - Feed the maintenance pipeline

#### 3. Maintenance Service (Maintenance LLM)
- **Purpose:** All background writing and state updates
- **Model:** Fast, economical model
- **Usage:** Asynchronous, background tasks
- **Responsibilities:**
  - Note rewriting (UPDATE_NOTE tasks)
  - Entity creation (CREATE_ENTITY tasks)  
  - World simulation (SIMULATE_WORLD tasks)

#### 4. Embedding Service (Embedding LLM)
- **Purpose:** Vector embeddings for semantic search and RAG
- **Model:** Specialized embedding model (e.g., Mistral Embed)
- **Usage:** Asynchronous, for all content that needs to be searchable
- **Responsibilities:**
  - Generate embeddings for new content (lore entries, dynamic memories)
  - Update FAISS indexes with new vectors
  - Support RAG pipeline with semantic search capabilities

## Workflow Architecture

### A. Synchronous Flow (Immediate User Response)

```
User Input → Generation Service → RAG Pipeline → Response to User
```

**Steps:**
1. **User Input:** User sends message
2. **Generation Service:**
   - Execute RAG pipeline for most current context
   - Include processed SessionNotes from previous turns
   - Construct prompt with RAG context, session state, instructions
   - Generate character/narrator response and Embedded Panel
3. **User Output:** Response sent immediately to frontend

### B. Asynchronous Flow (Post-Response Processing)

```
Last Turn → Analysis Service → Intentions → MaintenanceQueue → Worker
```

**Steps:**
4. **Analysis Service:**
   - Process last turn (user input + AI response)
   - Generate "Intentions" JSON:
     ```json
     {
       "updates": [/* existing entity updates */],
       "creations": [/* new entity creations */]
     }
     ```

5. **Task Queueing:**
   - Backend transforms "Intentions" into individual tasks
   - `updates` items → `{"task_type": "UPDATE_NOTE", ...}`
   - `creations` items → `{"task_type": "CREATE_ENTITY", ...}`
   - All tasks go to unified `MaintenanceQueue`

### C. World Simulation Flow (Background Only)

```
World Tick → Simulation Task → Maintenance Service → Re-queue Updates
```

**Steps:**
6. **World Tick Trigger:** Every X turns, system triggers simulation
7. **Maintenance Service - Simulation Task:**
   - System identifies simulation targets (off-scene NPCs)
   - Special task added: `{"task_type": "SIMULATE_WORLD", "targets": [...]}`
   - Worker calls Maintenance LLM with Simulation prompt
   - Output: JSON array of `update_summary` (same format as Analysis Service)
8. **Re-queueing:** Worker takes simulation results and creates new `UPDATE_NOTE` tasks

### D. Unified Worker System

**WorldMaintenanceWorker:**
- Single worker consuming `MaintenanceQueue`
- Task type-based routing:

```python
def process_task(task):
    if task.task_type == "UPDATE_NOTE":
        # Use Note Rewriting prompt
        result = maintenance_llm.rewrite_note(task.data)
        save_to_db(result)
        create_embedding_task(result)  # Queue for Embedding Service
    
    elif task.task_type == "CREATE_ENTITY":
        # Use Entity Creation prompt  
        result = maintenance_llm.create_entity(task.data)
        save_to_db(result)
        create_embedding_task(result)  # Queue for Embedding Service
    
    elif task.task_type == "SIMULATE_WORLD":
        # Use World Simulation prompt
        intentions = maintenance_llm.simulate_world(task.data)
        # Re-queue as UPDATE_NOTE tasks
        for intention in intentions:
            queue_task({"task_type": "UPDATE_NOTE", "data": intention})
```

**EmbeddingWorker:**
- Separate worker for embedding tasks
- Processes content through Embedding Service
- Updates FAISS indexes with new vectors
- Maintains semantic search capabilities

## Implementation Details

### Database Schema Updates

```sql
-- MaintenanceQueue table
CREATE TABLE maintenance_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_type VARCHAR(50) NOT NULL, -- UPDATE_NOTE, CREATE_ENTITY, SIMULATE_WORLD
    task_data JSON NOT NULL,
    priority INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    error_message TEXT NULL
);

-- Task tracking
CREATE INDEX idx_maintenance_queue_status ON maintenance_queue(status);
CREATE INDEX idx_maintenance_queue_type ON maintenance_queue(task_type);
```

### Service Configuration

```python
# services/llm_config.py
LLM_SERVICES = {
    "generation": {
        "model": "claude-3-5-sonnet-20241022",  # Powerful model
        "provider": "anthropic",
        "max_tokens": 4000,
        "temperature": 0.7
    },
    "analysis": {
        "model": "claude-3-5-sonnet-20241022",  # Can be same as generation
        "provider": "anthropic", 
        "max_tokens": 2000,
        "temperature": 0.3
    },
    "maintenance": {
        "model": "claude-3-haiku-20240307",  # Fast, economical
        "provider": "anthropic",
        "max_tokens": 1500,
        "temperature": 0.2
    },
    "embedding": {
        "model": "mistral-embed",  # Specialized embedding model
        "provider": "mistral",
        "max_tokens": None,  # Not applicable for embeddings
        "temperature": None  # Not applicable for embeddings
    }
}
```

### Prompt Templates

#### Analysis Service Prompt
```python
ANALYSIS_PROMPT = """
Analyze this conversation turn and extract intentions for world state updates.

TURN DATA:
User Input: {user_input}
AI Response: {ai_response}
Current Context: {context}

OUTPUT FORMAT (JSON):
{
  "updates": [
    {
      "entity_id": "existing_entity_id",
      "update_type": "note_update",
      "new_information": "what changed",
      "reasoning": "why this update is needed"
    }
  ],
  "creations": [
    {
      "entity_type": "character|location|item|concept",
      "name": "entity name",
      "initial_data": "key information",
      "reasoning": "why this entity should be created"
    }
  ]
}
"""
```

#### Maintenance Service Prompts
```python
UPDATE_NOTE_PROMPT = """
Rewrite this entity note with new information while preserving essential details.

ENTITY: {entity_name}
CURRENT NOTE: {current_note}
NEW INFORMATION: {new_info}
REASONING: {reasoning}

OUTPUT: Updated note text (plain text, no JSON)
"""

CREATE_ENTITY_PROMPT = """
Create a new lore entry based on this information.

ENTITY TYPE: {entity_type}
NAME: {name}
INITIAL DATA: {initial_data}
CONTEXT: {context}

OUTPUT (JSON):
{
  "name": "entity name",
  "category": "character|location|item|concept",
  "description": "detailed description",
  "tags": ["tag1", "tag2"],
  "connections": ["related_entity_1", "related_entity_2"]
}
"""

SIMULATE_WORLD_PROMPT = """
Simulate off-screen character activities and world changes.

TARGETS: {targets}
CURRENT WORLD STATE: {world_state}
TIME ELAPSED: {time_info}

OUTPUT (JSON array of updates):
[
  {
    "entity_id": "character_id",
    "update_type": "activity",
    "new_information": "what they did",
    "reasoning": "why this makes sense"
  }
]
"""
```

### API Endpoints

```python
# New endpoints for maintenance system
@router.post("/maintenance/trigger-analysis")
async def trigger_turn_analysis(session_id: int, turn_data: dict):
    """Trigger analysis of the last turn"""
    pass

@router.post("/maintenance/trigger-simulation") 
async def trigger_world_simulation(world_id: int):
    """Trigger world simulation for off-screen entities"""
    pass

@router.get("/maintenance/queue-status")
async def get_queue_status():
    """Get current status of maintenance queue"""
    pass
```

## Implementation Timeline

### Phase 1: Core Infrastructure (Week 1-2)
- [ ] Set up MaintenanceQueue database table
- [ ] Implement unified 4-service LLM configuration
- [ ] Create basic worker framework
- [ ] Set up task queueing system
- [ ] Configure embedding service pipeline

### Phase 2: Service Implementation (Week 2-3)
- [ ] Implement Generation Service integration
- [ ] Create Analysis Service with prompt templates
- [ ] Build Maintenance Service with all prompt variants
- [ ] Configure Embedding Service for vector operations
- [ ] Implement WorldMaintenanceWorker logic
- [ ] Set up EmbeddingWorker for async processing

### Phase 3: Integration & Testing (Week 3-4)
- [ ] Connect services to existing chat system
- [ ] Implement turn analysis triggers
- [ ] Add world simulation scheduling
- [ ] Test complete workflow end-to-end

### Phase 4: Optimization & Monitoring (Week 4)
- [ ] Add queue monitoring and error handling
- [ ] Implement retry logic for failed tasks
- [ ] Add performance metrics and logging
- [ ] Create admin interface for queue management

## Key Advantages

### Simplicity of Configuration
- Only 4 LLM service configurations to manage
- Complexity moved from "what to call" to "what to ask"
- Single maintenance model for all background tasks
- Dedicated embedding service for semantic search

### Efficiency
- Fast, economical model for all background writing
- No blocking of main user interaction flow
- Intelligent resource allocation

### Robustness  
- Queue system ensures no lost tasks
- Graceful degradation if background tasks fail
- Consistency maintained with vector rollback strategy

### Maintainability
- Single point of change for background model
- Clear separation of concerns
- Easy to modify prompt strategies without infrastructure changes

## Risk Mitigation

### Queue Overload
- Priority system for critical tasks
- Rate limiting for simulation tasks
- Queue size monitoring and alerts

### Model Failures
- Retry logic with exponential backoff
- Fallback to slower but more reliable models
- Error logging and notification system

### Data Consistency
- Transaction-based updates
- Vector embedding rollback on failure
- Audit trail for all changes

## Success Metrics

- **Response Time:** User responses under 2 seconds
- **Queue Processing:** Background tasks completed within 30 seconds
- **Error Rate:** Less than 1% task failure rate
- **Resource Usage:** 50% reduction in LLM API costs for background tasks
- **System Reliability:** 99.9% uptime for user-facing features

This unified architecture provides the perfect balance of power, efficiency, and maintainability while keeping the system manageable and cost-effective.
