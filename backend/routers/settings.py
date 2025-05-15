# backend/routers/settings.py
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import Optional

from backend.models.user_settings import UserSettings
from backend.schemas.user_settings import UserSettingsInDB, UserSettingsUpdate
from backend.database import get_db

router = APIRouter(
    prefix="/api/settings",
    tags=["settings"],
)

# ID fixo para a única linha de configurações
SETTINGS_ID = 1

@router.get("", response_model=Optional[UserSettingsInDB])
def get_user_settings(db: Session = Depends(get_db)):
    settings = db.query(UserSettings).filter(UserSettings.id == SETTINGS_ID).first()
    if not settings:
        # Cria configurações padrão se não existirem
        default_settings = UserSettings(id=SETTINGS_ID)
        db.add(default_settings)
        db.commit()
        db.refresh(default_settings)
        return default_settings
    return settings

@router.put("", response_model=UserSettingsInDB)
def update_user_settings(
    settings_update: UserSettingsUpdate, db: Session = Depends(get_db)
):
    db_settings = db.query(UserSettings).filter(UserSettings.id == SETTINGS_ID).first()
    if not db_settings:
        # Cria se não existir ao tentar atualizar
        db_settings = UserSettings(id=SETTINGS_ID, **settings_update.model_dump(exclude_unset=True)) # Pydantic V2
        # Para Pydantic V1: **settings_update.dict(exclude_unset=True)
        db.add(db_settings)
    else:
        update_data = settings_update.model_dump(exclude_unset=True) # Pydantic V2
        # Para Pydantic V1: update_data = settings_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_settings, key, value)
    
    db.commit()
    db.refresh(db_settings)
    return db_settings
