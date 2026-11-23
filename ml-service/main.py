
from pathlib import Path

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="ProjectHealth AI - ML Service")

MODEL_PATH = Path(__file__).parent / "risk_model.joblib"
model = joblib.load(MODEL_PATH) if MODEL_PATH.exists() else None


class ProjectData(BaseModel):
    completion_rate: float = Field(ge=0, le=1)
    overdue_rate: float = Field(ge=0, le=1)
    upcoming_rate: float = Field(ge=0, le=1)
    unassigned_rate: float = Field(ge=0, le=1)
    workload_concentration: float = Field(ge=0, le=1)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": model is not None
    }


@app.post("/predict")
def predict(data: ProjectData):
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not trained. Run train.py first."
        )

    features = np.array([[
        data.completion_rate,
        data.overdue_rate,
        data.upcoming_rate,
        data.unassigned_rate,
        data.workload_concentration
    ]])

    prediction = str(model.predict(features)[0])

    probabilities = model.predict_proba(features)[0]
    classes = model.classes_

    confidence = float(max(probabilities))

    return {
        "predicted_risk": prediction,
        "confidence": round(confidence * 100, 1),
        "probabilities": {
            str(label): round(float(prob) * 100, 1)
            for label, prob in zip(classes, probabilities)
        },
        "model": "Random Forest",
        "training_data": "Synthetic"
    }
