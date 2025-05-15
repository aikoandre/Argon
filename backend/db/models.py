# backend-python/db/models.py
from sqlalchemy import Column, String, Text, ForeignKey, JSON # Usar JSON para tags no SQLite
from sqlalchemy.dialects.postgresql import UUID as PG_UUID # Para Postgres
from sqlalchemy.types import TypeDecorator, CHAR # Para UUID no SQLite
from sqlalchemy.orm import relationship
import uuid # Import uuid
# Import Base from the database module in the same package
from .database import Base # Use relative import since it's in the same package

# --- UUID Handling for SQLite ---
# SQLAlchemy não tem um tipo UUID nativo para SQLite, então criamos um customizado
class GUID(TypeDecorator):
    impl = CHAR
    cache_ok = True
    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PG_UUID())
        else:
            return dialect.type_descriptor(CHAR(32))
    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return str(value)
        else:
            if not isinstance(value, uuid.UUID):
                return "%.32x" % uuid.UUID(value).int
            else:
                # hexstring
                return "%.32x" % value.int
    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if not isinstance(value, uuid.UUID):
                value = uuid.UUID(value)
            return value

# --- Modelos de Banco de Dados (SQLAlchemy) ---
class GlobalLore(Base):
    __tablename__ = "global_lore"

    id = Column(GUID, primary_key=True, default=uuid.uuid4) # Coluna UUID
    title = Column(String, index=True, nullable=False)
    content = Column(Text, nullable=False)
    # Armazenar tags como JSON string no SQLite
    tags = Column(JSON, default=[])
