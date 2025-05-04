import pandas as pd
import numpy as np
import joblib
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import io
import traceback

router = APIRouter()

# Load single Ridge model
try:
    model = joblib.load("model/compare_TrendYoYUP3.joblib")
except Exception as e:
    model = None
    print("Gagal memuat model compare_TrendYoYUP3.joblib:", e)

@router.post("/predict-compare")
async def predict_compare(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))

        if 'Year' not in df.columns:
            raise HTTPException(status_code=400, detail="Kolom 'Year' harus ada dalam file")

        X = df[['Year']].values
        y_pred = model.predict(X)

        df['Enrollments'] = y_pred.round().astype(int)
        df['Type'] = 'Predicted'

        result = df[['Year', 'Enrollments', 'Type']].to_dict(orient='records')
        return JSONResponse(content={"predictions": result})

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Terjadi kesalahan: {str(e)}")
