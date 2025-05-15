"""Add character to chat session relationship with     
   cascade delete

Revision ID: abab5b9862f1
Revises: f6ec9afc6804
Create Date: 2025-05-15 14:02:53.427073

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'abab5b9862f1'
down_revision: Union[str, None] = 'f6ec9afc6804'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
