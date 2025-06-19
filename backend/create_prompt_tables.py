from db.database import engine, Base
from models.prompt_preset import PromptPreset, PromptModule, UserPromptConfiguration
import os

print(f"Database URL: {engine.url}")
print(f"Actual database file path: {engine.url.database}")
print(f"Current working directory: {os.getcwd()}")

# Create all tables
Base.metadata.create_all(bind=engine)
print("Prompt preset tables created successfully")

# Verify tables were created by checking the actual database file
import sqlite3

# Extract the actual path
db_path = str(engine.url).replace('sqlite:///', '').replace('sqlite://', '')
if db_path.startswith('/'):
    actual_path = db_path
else:
    actual_path = os.path.join(os.getcwd(), db_path)

print(f"Checking database at: {actual_path}")

if os.path.exists(actual_path):
    conn = sqlite3.connect(actual_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print(f"All tables: {[t[0] for t in tables]}")
    
    prompt_tables = [t[0] for t in tables if 'prompt' in t[0]]
    print(f"Prompt tables: {prompt_tables}")
    conn.close()
else:
    print(f"Database file does not exist at: {actual_path}")
