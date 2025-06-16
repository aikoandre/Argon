"""merge heads for session notes

Revision ID: 5b4ab90a4081
Revises: a54ba0e0469d, session_notes_initial
Create Date: 2025-06-15 19:00:16.750550

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5b4ab90a4081'
down_revision: Union[str, None] = ('a54ba0e0469d', 'session_notes_initial')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
