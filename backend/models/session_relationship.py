# backend/models/session_relationship.py
import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy import JSON # Use generic JSON for broader compatibility
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base

class SessionRelationship(Base):
    __tablename__ = "session_relationships"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    chat_session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    
    # Generic identifiers for the two entities in the relationship
    entity1_id = Column(String, nullable=False)
    entity1_type = Column(String, nullable=False) # e.g., 'user_persona', 'character_card', 'lore_entry'
    entity2_id = Column(String, nullable=False)
    entity2_type = Column(String, nullable=False) # e.g., 'user_persona', 'character_card', 'lore_entry'

    # Métricas do Relacionamento
    # Você pode ter várias métricas ou uma geral. Exemplos:
    trust_score = Column(Integer, default=0)    # Ex: -100 (total desconfiança) a 100 (total confiança)
    affection_score = Column(Integer, default=0) # Ex: -100 (ódio) a 100 (amor/devoção)
    rivalry_score = Column(Integer, default=0)   # Ex: 0 (sem rivalidade) a 100 (rivais mortais)

    # Tags descritivas do estado atual do relacionamento
    status_tags = Column(JSON, nullable=True, default=lambda: []) # Ex: ["aliados_cautelosos", "interesse_romantico_inicial", "desconfiança_mutua"]

    # Ensures only one relationship record per unique pair within a session
    # The application logic will need to ensure consistent ordering of entity1/entity2
    # (e.g., always storing the entity with the lexicographically smaller ID as entity1)
    # if you want to treat (A,B) and (B,A) as the same relationship.
    __table_args__ = (
        UniqueConstraint('chat_session_id', 'entity1_id', 'entity1_type', 'entity2_id', 'entity2_type', name='_session_relationship_uc'),
    )

    chat_session = relationship("ChatSession") # Se quiser navegar de volta