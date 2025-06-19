"""add_service_specific_fields_to_prompt_modules

Revision ID: e70f7fc72616
Revises: 500adbbf2172
Create Date: 2025-06-18 16:43:02.022520

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e70f7fc72616'
down_revision: Union[str, None] = '500adbbf2172'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add service-specific fields to prompt_modules table
    with op.batch_alter_table('prompt_modules', schema=None) as batch_op:
        batch_op.add_column(sa.Column('applicable_services', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('is_core_module', sa.Boolean(), nullable=True, default=False))
        batch_op.add_column(sa.Column('service_priority', sa.Integer(), nullable=True, default=0))


def downgrade() -> None:
    # Remove service-specific fields from prompt_modules table
    with op.batch_alter_table('prompt_modules', schema=None) as batch_op:
        batch_op.drop_column('service_priority')
        batch_op.drop_column('is_core_module')
        batch_op.drop_column('applicable_services')
