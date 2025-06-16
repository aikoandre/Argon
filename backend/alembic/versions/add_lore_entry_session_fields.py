"""Add SessionNote-related fields to LoreEntry

Revision ID: add_lore_entry_session_fields
Revises: 5b4ab90a4081
Create Date: 2025-06-15 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_lore_entry_session_fields'
down_revision = '5b4ab90a4081'
branch_labels = None
depends_on = None

def upgrade():
    # Add new fields to lore_entries
    op.add_column('lore_entries', sa.Column('is_dynamically_generated', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')))
    op.add_column('lore_entries', sa.Column('created_in_session_id', sa.String(), sa.ForeignKey('chat_sessions.id'), nullable=True))
    
    # Create index for performance
    op.create_index('idx_lore_entries_dynamic', 'lore_entries', ['is_dynamically_generated'])

def downgrade():
    # Remove the additions
    op.drop_index('idx_lore_entries_dynamic', table_name='lore_entries')
    op.drop_column('lore_entries', 'created_in_session_id')
    op.drop_column('lore_entries', 'is_dynamically_generated')
