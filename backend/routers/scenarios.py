# backend/routers/scenarios.py
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import json

# Importe o modelo SQLAlchemy e os schemas Pydantic
from ..models.scenario_card import ScenarioCard
from ..schemas.scenario_card import ScenarioCardCreate, ScenarioCardUpdate, ScenarioCardInDB
from ..file_storage import save_uploaded_file, delete_image_file
# Poderia importar WorldCard para validar referências, mas pode ficar complexo por enquanto

from ..database import get_db

router = APIRouter(
    prefix="/api/scenarios",
    tags=["Scenario Cards"],
)

@router.post("", response_model=ScenarioCardInDB, status_code=status.HTTP_201_CREATED)
async def create_scenario_card(
    data: str = Form(...),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """
    Cria um novo Scenario Card.
    Aceita multipart/form-data com um campo 'data' contendo os dados do cenário em JSON
    e um campo opcional 'image' contendo a imagem do cenário.
    """
    try:
        # Parse the JSON data from the form
        scenario_data = json.loads(data)
        scenario = ScenarioCardCreate(**scenario_data)
        
        from ..models.master_world import MasterWorld
        from ..models.user_persona import UserPersona
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

        create_data = scenario.model_dump(exclude_unset=True)
        
        # Handle image upload if provided
        if image:
            image_url = await save_uploaded_file(image, entity_name=scenario_data.get('name'))
            create_data['image_url'] = image_url

        db_scenario = ScenarioCard(**create_data)
        print(f"Scenario object created: {db_scenario}")  # Debug log
        db.add(db_scenario)
        db.commit()
        db.refresh(db_scenario)
        return db_scenario
        
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON in data field"
        )
    except Exception as e:
        print(f"Error creating scenario: {e}")  # Debug log
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
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
async def update_scenario_card(
    scenario_id: str,
    data: str = Form(...),
    image: Optional[UploadFile] = File(None),
    remove_image: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Atualiza um Scenario Card existente usando multipart/form-data.
    Aceita:
    - data: JSON string com os dados do cenário
    - image: arquivo opcional para nova imagem
    - remove_image: flag opcional para remover imagem existente
    """
    try:
        # Parse the JSON data from the form
        update_data = json.loads(data)
        scenario_update = ScenarioCardUpdate(**update_data)
        
        from ..models.master_world import MasterWorld
        from ..models.lore_entry import LoreEntry

        db_scenario = db.query(ScenarioCard).filter(ScenarioCard.id == scenario_id).first()
        if db_scenario is None:
            raise HTTPException(status_code=404, detail="Scenario Card not found")

        update_dict = scenario_update.model_dump(exclude_unset=True)

        # Validar master_world_id se for atualizado
        if 'master_world_id' in update_dict and update_dict['master_world_id']:
            master_world = db.query(MasterWorld).filter(MasterWorld.id == update_dict['master_world_id']).first()
            if not master_world:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Master world not found"
                )

        # Handle image changes
        if image:
            # Delete old image if exists
            if db_scenario.image_url:
                delete_image_file(db_scenario.image_url)
            # Save new image
            image_url = await save_uploaded_file(image, entity_name=update_data.get('name', db_scenario.name))
            update_dict['image_url'] = image_url
        elif remove_image == 'true' and db_scenario.image_url:
            # Remove existing image if requested
            delete_image_file(db_scenario.image_url)
            update_dict['image_url'] = None

        for key, value in update_dict.items():
            setattr(db_scenario, key, value)
            
        db.add(db_scenario)
        db.commit()
        db.refresh(db_scenario)
        return db_scenario
        
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON in data field"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

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
