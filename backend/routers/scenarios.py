# backend/routers/scenarios.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

# Importe o modelo SQLAlchemy e os schemas Pydantic
from ..models.scenario_card import ScenarioCard
from ..schemas.scenario_card import ScenarioCardCreate, ScenarioCardUpdate, ScenarioCardInDB
# Poderia importar WorldCard para validar referências, mas pode ficar complexo por enquanto

from ..database import get_db

router = APIRouter(
    prefix="/api/scenarios",
    tags=["Scenario Cards"],
)

@router.post("", response_model=ScenarioCardInDB, status_code=status.HTTP_201_CREATED)
def create_scenario_card(
    scenario: ScenarioCardCreate, db: Session = Depends(get_db)
):
    """
    Cria um novo Scenario Card.
    """
    # Validações de world_card_references podem ser adicionadas aqui se necessário
    # Por exemplo, verificar se os IDs ou tags referenciados existem
    db_scenario = ScenarioCard(**scenario.model_dump())
    db.add(db_scenario)
    db.commit()
    db.refresh(db_scenario)
    return db_scenario

@router.get("", response_model=List[ScenarioCardInDB])
def get_all_scenario_cards(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Lista todos os Scenario Cards.
    """
    scenarios = db.query(ScenarioCard).order_by(ScenarioCard.name).offset(skip).limit(limit).all()
    return scenarios

@router.get("/{scenario_id}", response_model=ScenarioCardInDB)
def get_scenario_card(scenario_id: str, db: Session = Depends(get_db)):
    """
    Obtém detalhes de um Scenario Card específico pelo ID.
    """
    db_scenario = db.query(ScenarioCard).filter(ScenarioCard.id == scenario_id).first()
    if db_scenario is None:
        raise HTTPException(status_code=404, detail="Scenario Card not found")
    return db_scenario

@router.put("/{scenario_id}", response_model=ScenarioCardInDB)
def update_scenario_card(
    scenario_id: str, scenario_update: ScenarioCardUpdate, db: Session = Depends(get_db)
):
    """
    Atualiza um Scenario Card existente. Permite atualização parcial.
    """
    db_scenario = db.query(ScenarioCard).filter(ScenarioCard.id == scenario_id).first()
    if db_scenario is None:
        raise HTTPException(status_code=404, detail="Scenario Card not found")

    update_data = scenario_update.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(db_scenario, key, value)

    db.add(db_scenario)
    db.commit()
    db.refresh(db_scenario)
    return db_scenario

@router.delete("/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scenario_card(scenario_id: str, db: Session = Depends(get_db)):
    """
    Deleta um Scenario Card existente.
    """
    db_scenario = db.query(ScenarioCard).filter(ScenarioCard.id == scenario_id).first()
    if db_scenario is None:
        raise HTTPException(status_code=404, detail="Scenario Card not found")

    # Cuidado: Se ChatSessions estiverem usando este cenário,
    # pode ser necessário impedir a exclusão ou lidar com as FKs.
    db.delete(db_scenario)
    db.commit()
    return None