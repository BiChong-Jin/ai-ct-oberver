from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Analysis
from app.auth.router import get_current_user
from app.analysis.service import validate_file, analyze_ct_image

router = APIRouter(prefix="/api", tags=["analysis"])


class AnalysisResponse(BaseModel):
    id: int
    filename: str
    analysis: str
    disclaimer: str
    created_at: datetime


class HistoryItem(BaseModel):
    id: int
    filename: str
    analysis: str
    created_at: datetime

    class Config:
        from_attributes = True


DISCLAIMER = (
    "この分析はAIシステムによって教育・研究目的のみで生成されました。"
    "これは医療診断ではなく、医療上の決定の根拠として使用すべきではありません。"
    "必ず資格を持つ医療専門家にご相談ください。"
)


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    file_content = await file.read()
    file_size = len(file_content)

    is_valid, error_message = validate_file(file.filename, file_size, file_content)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_message)

    try:
        analysis_result = analyze_ct_image(file_content, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}",
        )

    # Save to database
    analysis = Analysis(
        user_id=current_user.id,
        filename=file.filename,
        analysis_result=analysis_result,
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    return AnalysisResponse(
        id=analysis.id,
        filename=analysis.filename,
        analysis=analysis.analysis_result,
        disclaimer=DISCLAIMER,
        created_at=analysis.created_at,
    )


@router.get("/history", response_model=List[HistoryItem])
async def get_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    analyses = (
        db.query(Analysis)
        .filter(Analysis.user_id == current_user.id)
        .order_by(Analysis.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        HistoryItem(
            id=a.id,
            filename=a.filename,
            analysis=a.analysis_result,
            created_at=a.created_at,
        )
        for a in analyses
    ]


@router.get("/history/{analysis_id}", response_model=HistoryItem)
async def get_analysis(
    analysis_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    analysis = (
        db.query(Analysis)
        .filter(Analysis.id == analysis_id, Analysis.user_id == current_user.id)
        .first()
    )
    if not analysis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")

    return HistoryItem(
        id=analysis.id,
        filename=analysis.filename,
        analysis=analysis.analysis_result,
        created_at=analysis.created_at,
    )
