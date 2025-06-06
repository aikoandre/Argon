"""Remove description, tags, image_url from master_worlds and image_url from lore_entries

Revision ID: remove_masterworld_and_lore_images
Revises: ddcec873f865
Create Date: 2025-06-05 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
revision = 'remove_masterworld_and_lore_images'
down_revision = 'ddcec873f865'
branch_labels = None
depends_on = None


def upgrade():
    # Remove columns from master_worlds table
    with op.batch_alter_table('master_worlds', schema=None) as batch_op:
        batch_op.drop_column('description')
        batch_op.drop_column('tags')
        batch_op.drop_column('image_url')

    # Remove image_url column from lore_entries table
    with op.batch_alter_table('lore_entries', schema=None) as batch_op:
        batch_op.drop_column('image_url')


def downgrade():
    # Add back columns to master_worlds table
    with op.batch_alter_table('master_worlds', schema=None) as batch_op:
        batch_op.add_column(sa.Column('image_url', sa.VARCHAR(), nullable=True))
        batch_op.add_column(sa.Column('tags', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('description', sa.TEXT(), nullable=True))

    # Add back image_url column to lore_entries table
    with op.batch_alter_table('lore_entries', schema=None) as batch_op:
        batch_op.add_column(sa.Column('image_url', sa.VARCHAR(), nullable=True))
