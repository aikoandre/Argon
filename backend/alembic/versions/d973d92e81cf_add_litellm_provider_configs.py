"""add_litellm_provider_configs

Revision ID: d973d92e81cf
Revises: remove_masterworld_and_lore_images
Create Date: 2025-06-07 12:32:22.318474

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd973d92e81cf'
down_revision: Union[str, None] = 'remove_masterworld_and_lore_images'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new LiteLLM provider configuration columns
    
    # Primary LLM (Generation Service)
    op.add_column('user_settings', sa.Column('primary_llm_provider', sa.String(), nullable=True))
    op.add_column('user_settings', sa.Column('primary_llm_model', sa.String(), nullable=True))
    op.add_column('user_settings', sa.Column('primary_llm_api_key_new', sa.String(), nullable=True))
    
    # Analysis LLM (Analysis & Knowledge Extraction)
    op.add_column('user_settings', sa.Column('analysis_llm_provider', sa.String(), nullable=True))
    op.add_column('user_settings', sa.Column('analysis_llm_model_new', sa.String(), nullable=True))
    op.add_column('user_settings', sa.Column('analysis_llm_api_key_new', sa.String(), nullable=True))
    
    # Maintenance LLM (Background Tasks)
    op.add_column('user_settings', sa.Column('maintenance_llm_provider', sa.String(), nullable=True))
    op.add_column('user_settings', sa.Column('maintenance_llm_model', sa.String(), nullable=True))
    op.add_column('user_settings', sa.Column('maintenance_llm_api_key', sa.String(), nullable=True))
    
    # Embedding LLM (Vector Embeddings)
    op.add_column('user_settings', sa.Column('embedding_llm_provider', sa.String(), nullable=True))
    op.add_column('user_settings', sa.Column('embedding_llm_model', sa.String(), nullable=True))
    op.add_column('user_settings', sa.Column('embedding_llm_api_key', sa.String(), nullable=True))
    
    # Set default values for existing data
    op.execute("""
        UPDATE user_settings 
        SET 
            primary_llm_provider = LOWER(COALESCE(llm_provider, 'openrouter')),
            primary_llm_model = COALESCE(selected_llm_model, 'gpt-4o'),
            primary_llm_api_key_new = primary_llm_api_key,
            analysis_llm_provider = LOWER(COALESCE(llm_provider, 'openrouter')),
            analysis_llm_model_new = COALESCE(analysis_llm_model, 'gpt-4o'),
            analysis_llm_api_key_new = analysis_llm_api_key,
            maintenance_llm_provider = LOWER(COALESCE(llm_provider, 'openrouter')),
            maintenance_llm_model = COALESCE(analysis_llm_model, 'gpt-4o'),
            maintenance_llm_api_key = analysis_llm_api_key,
            embedding_llm_provider = 'mistral',
            embedding_llm_model = 'mistral-embed',
            embedding_llm_api_key = mistral_api_key
        WHERE id IS NOT NULL;
    """)


def downgrade() -> None:
    # Remove the new LiteLLM provider configuration columns
    op.drop_column('user_settings', 'embedding_llm_api_key')
    op.drop_column('user_settings', 'embedding_llm_model')
    op.drop_column('user_settings', 'embedding_llm_provider')
    op.drop_column('user_settings', 'maintenance_llm_api_key')
    op.drop_column('user_settings', 'maintenance_llm_model')
    op.drop_column('user_settings', 'maintenance_llm_provider')
    op.drop_column('user_settings', 'analysis_llm_api_key_new')
    op.drop_column('user_settings', 'analysis_llm_model_new')
    op.drop_column('user_settings', 'analysis_llm_provider')
    op.drop_column('user_settings', 'primary_llm_api_key_new')
    op.drop_column('user_settings', 'primary_llm_model')
    op.drop_column('user_settings', 'primary_llm_provider')
