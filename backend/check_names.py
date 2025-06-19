from db.database import SessionLocal
from models.prompt_preset import PromptModule
from models.active_session_event import ActiveSessionEvent  # Import to resolve relationship

db = SessionLocal()
modules = db.query(PromptModule).all()
print(f"Total modules: {len(modules)}")
for m in modules[:10]:
    print(f"Name: {m.name} (Length: {len(m.name)})")
    if len(m.name) > 50:
        print(f"  -> Truncated: {m.name[:47]}...")
    print("---")
db.close()
