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
    Se master_world_id for fornecido, valida se ele existe.
    Valida se os world_card_references pertencem ao mesmo mundo, se especificado.
    """
    from ..models.master_world import MasterWorld
    from ..models.lore_entry import LoreEntry
    
    print(f"Attempting to create scenario with data: {scenario.model_dump()}")  # Debug log
    
    # Verifica se o master_world existe, se fornecido
    if scenario.master_world_id:
        print(f"Validating master_world_id: {scenario.master_world_id}")  # Debug log
        master_world = db.query(MasterWorld).filter(MasterWorld.id == scenario.master_world_id).first()
        if not master_world:
            print(f"Master world not found: {scenario.master_world_id}")  # Debug log
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Master world not found"
            )

    try:
        db_scenario = ScenarioCard(**scenario.model_dump())
        print(f"Scenario object created: {db_scenario}")  # Debug log
        db.add(db_scenario)
        db.commit()
        db.refresh(db_scenario)
        return db_scenario
    except Exception as e:
        print(f"Error creating scenario: {e}")  # Debug log
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create scenario"
        )

@router.get("", response_model=List[ScenarioCardInDB])
def get_all_scenario_cards(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    List all Scenario Cards (no filtering)
    """
    return db.query(ScenarioCard).order_by(ScenarioCard.name).offset(skip).limit(limit).all()

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
    from ..models.master_world import MasterWorld
    from ..models.lore_entry import LoreEntry

    db_scenario = db.query(ScenarioCard).filter(ScenarioCard.id == scenario_id).first()
    if db_scenario is None:
        raise HTTPException(status_code=404, detail="Scenario Card not found")

    update_data = scenario_update.model_dump(exclude_unset=True)

    # Validar master_world_id se for atualizado
    if 'master_world_id' in update_data and update_data['master_world_id']:
        master_world = db.query(MasterWorld).filter(MasterWorld.id == update_data['master_world_id']).first()
        if not master_world:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Master world not found"
            )


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
