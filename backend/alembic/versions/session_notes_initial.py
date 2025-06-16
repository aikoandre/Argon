"""
Alembic migration for creating the session_notes table and adding new fields to lore_entries.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'session_notes_initial'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Create session_notes table
    op.create_table(
        'session_notes',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('session_id', sa.String(), sa.ForeignKey('chat_sessions.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('lore_entry_id', sa.String(), sa.ForeignKey('lore_entries.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('note_content', sa.Text(), nullable=False, default=''),
        sa.Column('last_updated_turn', sa.Integer(), nullable=False, default=0),
        sa.Column('entity_name', sa.String(255), nullable=True, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint('session_id', 'lore_entry_id', name='uix_session_lore'),
    )
    op.create_index('idx_session_notes_session_id', 'session_notes', ['session_id'])
    op.create_index('idx_session_notes_lore_entry_id', 'session_notes', ['lore_entry_id'])
    op.create_index('idx_session_notes_entity_name', 'session_notes', ['entity_name'])

    # Add new fields to lore_entries
    op.add_column('lore_entries', sa.Column('is_dynamically_generated', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')))
    op.add_column('lore_entries', sa.Column('created_in_session_id', sa.String(), sa.ForeignKey('chat_sessions.id'), nullable=True))
    op.create_index('idx_lore_entries_dynamic', 'lore_entries', ['is_dynamically_generated'])

def downgrade():
    op.drop_index('idx_lore_entries_dynamic', table_name='lore_entries')
    op.drop_column('lore_entries', 'created_in_session_id')
    op.drop_column('lore_entries', 'is_dynamically_generated')
    op.drop_index('idx_session_notes_entity_name', table_name='session_notes')
    op.drop_index('idx_session_notes_lore_entry_id', table_name='session_notes')
    op.drop_index('idx_session_notes_session_id', table_name='session_notes')
    op.drop_table('session_notes')
