"""merge lore entry session fields and other heads

Revision ID: b7c2df818992
Revises: add_lore_entry_session_fields, bac536f4298c
Create Date: 2025-06-15 19:48:32.128723

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7c2df818992'
down_revision: Union[str, None] = ('add_lore_entry_session_fields', 'bac536f4298c')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
