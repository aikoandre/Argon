"""again

Revision ID: bac536f4298c
Revises: 5b4ab90a4081
Create Date: 2025-06-15 19:27:59.408186

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
revision: str = 'bac536f4298c'
down_revision: Union[str, None] = '5b4ab90a4081'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('_alembic_tmp_chat_messages')
    with op.batch_alter_table('chat_messages', schema=None) as batch_op:
        batch_op.drop_column('uuid')

    with op.batch_alter_table('extracted_knowledge', schema=None) as batch_op:
        batch_op.alter_column('id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)
        batch_op.alter_column('chat_session_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)
        batch_op.alter_column('source_message_id',
               existing_type=sa.NUMERIC(),
               type_=sa.UUID(),
               existing_nullable=False)

    with op.batch_alter_table('lore_entries', schema=None) as batch_op:
        batch_op.alter_column('is_dynamically_generated',
               existing_type=sa.TEXT(),
               server_default=None,
               type_=sa.String(),
               existing_nullable=True)
        batch_op.alter_column('created_in_session_id',
               existing_type=sa.TEXT(),
               type_=sa.String(),
               existing_nullable=True)
        batch_op.drop_index('idx_lore_entries_dynamic')

    with op.batch_alter_table('session_notes', schema=None) as batch_op:
        batch_op.alter_column('id',
               existing_type=sa.TEXT(),
               server_default=None,
               type_=sa.String(),
               nullable=False)
        batch_op.alter_column('session_id',
               existing_type=sa.TEXT(),
               type_=sa.String(),
               existing_nullable=False)
        batch_op.alter_column('lore_entry_id',
               existing_type=sa.TEXT(),
               type_=sa.String(),
               existing_nullable=True)
        batch_op.alter_column('note_content',
               existing_type=sa.TEXT(),
               server_default=None,
               existing_nullable=False)
        batch_op.alter_column('last_updated_turn',
               existing_type=sa.INTEGER(),
               server_default=None,
               existing_nullable=False)
        batch_op.alter_column('entity_name',
               existing_type=sa.TEXT(),
               type_=sa.String(length=255),
               existing_nullable=True)
        batch_op.drop_index('idx_session_notes_entity_name')
        batch_op.drop_index('idx_session_notes_lore_entry_id')
        batch_op.drop_index('idx_session_notes_session_id')
        batch_op.create_index(batch_op.f('ix_session_notes_entity_name'), ['entity_name'], unique=False)
        batch_op.create_index(batch_op.f('ix_session_notes_lore_entry_id'), ['lore_entry_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_session_notes_session_id'), ['session_id'], unique=False)
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.create_foreign_key(None, 'lore_entries', ['lore_entry_id'], ['id'], ondelete='CASCADE')
        batch_op.create_foreign_key(None, 'chat_sessions', ['session_id'], ['id'], ondelete='CASCADE')

    with op.batch_alter_table('user_settings', schema=None) as batch_op:
        batch_op.drop_column('reasoning_exclude_tokens')
        batch_op.drop_column('reasoning_mode')
        batch_op.drop_column('reasoning_max_tokens')
        batch_op.drop_column('planning_llm_api_key')
        batch_op.drop_column('planning_llm_model')
        batch_op.drop_column('reasoning_effort')

    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('user_settings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('reasoning_effort', sa.VARCHAR(), nullable=True))
        batch_op.add_column(sa.Column('planning_llm_model', sa.VARCHAR(), nullable=True))
        batch_op.add_column(sa.Column('planning_llm_api_key', sa.VARCHAR(), nullable=True))
        batch_op.add_column(sa.Column('reasoning_max_tokens', sa.INTEGER(), nullable=True))
        batch_op.add_column(sa.Column('reasoning_mode', sa.VARCHAR(), nullable=True))
        batch_op.add_column(sa.Column('reasoning_exclude_tokens', sa.BOOLEAN(), nullable=False))

    with op.batch_alter_table('session_notes', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.create_foreign_key(None, 'chat_sessions', ['session_id'], ['id'])
        batch_op.create_foreign_key(None, 'lore_entries', ['lore_entry_id'], ['id'])
        batch_op.drop_index(batch_op.f('ix_session_notes_session_id'))
        batch_op.drop_index(batch_op.f('ix_session_notes_lore_entry_id'))
        batch_op.drop_index(batch_op.f('ix_session_notes_entity_name'))
        batch_op.create_index('idx_session_notes_session_id', ['session_id'], unique=False)
        batch_op.create_index('idx_session_notes_lore_entry_id', ['lore_entry_id'], unique=False)
        batch_op.create_index('idx_session_notes_entity_name', ['entity_name'], unique=False)
        batch_op.alter_column('entity_name',
               existing_type=sa.String(length=255),
               type_=sa.TEXT(),
               existing_nullable=True)
        batch_op.alter_column('last_updated_turn',
               existing_type=sa.INTEGER(),
               server_default=sa.text('0'),
               existing_nullable=False)
        batch_op.alter_column('note_content',
               existing_type=sa.TEXT(),
               server_default=sa.text("('')"),
               existing_nullable=False)
        batch_op.alter_column('lore_entry_id',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               existing_nullable=True)
        batch_op.alter_column('session_id',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               existing_nullable=False)
        batch_op.alter_column('id',
               existing_type=sa.String(),
               server_default=sa.text("(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))"),
               type_=sa.TEXT(),
               nullable=True)

    with op.batch_alter_table('lore_entries', schema=None) as batch_op:
        batch_op.create_index('idx_lore_entries_dynamic', ['is_dynamically_generated'], unique=False)
        batch_op.alter_column('created_in_session_id',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               existing_nullable=True)
        batch_op.alter_column('is_dynamically_generated',
               existing_type=sa.String(),
               server_default=sa.text("'false'"),
               type_=sa.TEXT(),
               existing_nullable=True)

    with op.batch_alter_table('extracted_knowledge', schema=None) as batch_op:
        batch_op.alter_column('source_message_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)
        batch_op.alter_column('chat_session_id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)
        batch_op.alter_column('id',
               existing_type=sa.UUID(),
               type_=sa.NUMERIC(),
               existing_nullable=False)

    with op.batch_alter_table('chat_messages', schema=None) as batch_op:
        batch_op.add_column(sa.Column('uuid', sa.VARCHAR(), nullable=True))

    op.create_table('_alembic_tmp_chat_messages',
    sa.Column('id', sa.VARCHAR(), nullable=False),
    sa.Column('chat_session_id', sa.VARCHAR(), nullable=False),
    sa.Column('sender_type', sa.VARCHAR(), nullable=False),
    sa.Column('content', sa.TEXT(), nullable=False),
    sa.Column('timestamp', sa.DATETIME(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    sa.Column('message_metadata', sqlite.JSON(), nullable=True),
    sa.Column('active_persona_name', sa.VARCHAR(), nullable=True),
    sa.Column('active_persona_image_url', sa.VARCHAR(), nullable=True),
    sa.Column('is_beginning_message', sa.BOOLEAN(), nullable=True),
    sa.ForeignKeyConstraint(['chat_session_id'], ['chat_sessions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    # ### end Alembic commands ###
