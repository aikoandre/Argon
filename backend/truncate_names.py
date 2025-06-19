from db.database import SessionLocal
from models.prompt_preset import PromptModule
from models.active_session_event import ActiveSessionEvent  # Import to resolve relationship

db = SessionLocal()
modules = db.query(PromptModule).all()

updated_count = 0
for module in modules:
    if len(module.name) > 45:
        old_name = module.name
        # Truncate to 42 characters and add "..."
        module.name = module.name[:42] + "..."
        print(f"Updated: '{old_name}' -> '{module.name}'")
        updated_count += 1

if updated_count > 0:
    db.commit()
    print(f"\nUpdated {updated_count} module names")
else:
    print("No names needed truncation")

db.close()
