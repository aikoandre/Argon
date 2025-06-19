# Database Migration for SillyTavern Modular Prompt System
# Generated: 2025-06-18

"""Add modular prompt system tables and expand user settings

Revision ID: add_modular_prompt_system
Revises: previous_migration
Create Date: 2025-06-18 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
revision = 'add_modular_prompt_system'
down_revision = None  # Update this with actual previous revision
branch_labels = None
depends_on = None

def upgrade():
    # Create prompt_presets table
    op.create_table('prompt_presets',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=True, default=False),
        sa.Column('is_sillytavern_compatible', sa.Boolean(), nullable=True, default=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create prompt_modules table
    op.create_table('prompt_modules',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('preset_id', sa.String(), nullable=False),
        sa.Column('identifier', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=True, default=True),
        sa.Column('injection_position', sa.String(length=50), nullable=True),
        sa.Column('injection_depth', sa.Integer(), nullable=True, default=0),
        sa.Column('injection_order', sa.Integer(), nullable=True, default=0),
        sa.Column('forbid_overrides', sa.Boolean(), nullable=True, default=False),
        sa.Column('role', sa.String(length=20), nullable=True, default='system'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['preset_id'], ['prompt_presets.id'], ondelete='CASCADE')
    )
    
    # Create user_prompt_configurations table
    op.create_table('user_prompt_configurations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('active_preset_id', sa.String(), nullable=True),
        
        # Core Parameters
        sa.Column('temperature', sa.Float(), nullable=True, default=1.0),
        sa.Column('top_p', sa.Float(), nullable=True, default=1.0),
        sa.Column('reasoning_effort', sa.String(length=50), nullable=True, default='Medium'),
        sa.Column('context_size', sa.Integer(), nullable=True, default=20),
        
        # Advanced Sampling Parameters
        sa.Column('top_k', sa.Integer(), nullable=True),
        sa.Column('top_a', sa.Float(), nullable=True),
        sa.Column('min_p', sa.Float(), nullable=True),
        sa.Column('max_tokens', sa.Integer(), nullable=True),
        
        # Penalty Controls
        sa.Column('frequency_penalty', sa.Float(), nullable=True, default=0.0),
        sa.Column('presence_penalty', sa.Float(), nullable=True, default=0.0),
        sa.Column('repetition_penalty', sa.Float(), nullable=True, default=1.0),
        
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['active_preset_id'], ['prompt_presets.id'], ondelete='SET NULL')
    )
    
    # Add context management fields to existing user_settings table
    with op.batch_alter_table('user_settings', schema=None) as batch_op:
        # Context and memory management
        batch_op.add_column(sa.Column('max_messages_for_context', sa.Integer(), nullable=True, default=20))
        batch_op.add_column(sa.Column('max_lore_entries_for_rag', sa.Integer(), nullable=True, default=3))
        
        # Enhanced LLM parameters for backward compatibility
        batch_op.add_column(sa.Column('primary_llm_top_k', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('primary_llm_top_a', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('primary_llm_min_p', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('primary_llm_frequency_penalty', sa.Float(), nullable=True, default=0.0))
        batch_op.add_column(sa.Column('primary_llm_presence_penalty', sa.Float(), nullable=True, default=0.0))
        batch_op.add_column(sa.Column('primary_llm_repetition_penalty', sa.Float(), nullable=True, default=1.0))
    
    # Create indexes for performance
    op.create_index('ix_prompt_modules_preset_id', 'prompt_modules', ['preset_id'])
    op.create_index('ix_prompt_modules_category', 'prompt_modules', ['category'])
    op.create_index('ix_prompt_modules_enabled', 'prompt_modules', ['enabled'])
    op.create_index('ix_user_prompt_configurations_user_id', 'user_prompt_configurations', ['user_id'])
    op.create_index('ix_user_prompt_configurations_preset_id', 'user_prompt_configurations', ['active_preset_id'])

def downgrade():
    # Remove indexes
    op.drop_index('ix_user_prompt_configurations_preset_id', table_name='user_prompt_configurations')
    op.drop_index('ix_user_prompt_configurations_user_id', table_name='user_prompt_configurations')
    op.drop_index('ix_prompt_modules_enabled', table_name='prompt_modules')
    op.drop_index('ix_prompt_modules_category', table_name='prompt_modules')
    op.drop_index('ix_prompt_modules_preset_id', table_name='prompt_modules')
    
    # Remove added columns from user_settings
    with op.batch_alter_table('user_settings', schema=None) as batch_op:
        batch_op.drop_column('primary_llm_repetition_penalty')
        batch_op.drop_column('primary_llm_presence_penalty')
        batch_op.drop_column('primary_llm_frequency_penalty')
        batch_op.drop_column('primary_llm_min_p')
        batch_op.drop_column('primary_llm_top_a')
        batch_op.drop_column('primary_llm_top_k')
        batch_op.drop_column('max_lore_entries_for_rag')
        batch_op.drop_column('max_messages_for_context')
    
    # Drop tables
    op.drop_table('user_prompt_configurations')
    op.drop_table('prompt_modules')
    op.drop_table('prompt_presets')
