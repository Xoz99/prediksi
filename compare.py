from fastapi import APIRouter, UploadFile, File
import pandas as pd
import joblib
import os
import io

router = APIRouter()
model_dir = "model"
model_pendaftar_path = os.path.join(model_dir, "compare_TrendYoYPendaftar.joblib")
model_up3_path = os.path.join(model_dir, "compare_TrendYoYUP3.joblib")

model_pendaftar = joblib.load(model_pendaftar_path) if os.path.exists(model_pendaftar_path) else None
model_up3 = joblib.load(model_up3_path) if os.path.exists(model_up3_path) else None

@router.get("/status-compare")
def status_compare():
    return {
        "app_info": {
            "status": "ready",
            "version": "1.2.0"
        },
        "model_predikTEL_U": {
            "name": "compare_TrendYoYPendaftar",
            "status": "aktif",
            "loaded": True
        },
        "model_predikYoY": {
            "name": "compare_TrendYoYUP3",
            "status": "aktif",
            "loaded": True
        }
    }

@router.post("/predict-compare")
async def predict_compare(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))

        if not {"Campus", "Year", "Applicants", "Type"}.issubset(df.columns):
            return {"error": "CSV harus memiliki kolom: Campus, Year, Applicants, Type"}

        df = df[df["Type"] == "Actual"]
        if df.empty:
            return {"error": "Tidak ada data aktual dalam file."}

        features = df[["Campus", "Year", "Applicants"]].copy()
        features["Campus"] = features["Campus"].astype("category").cat.codes

        predictions = {
            "pendaftar": model_pendaftar.predict(features) if model_pendaftar else [],
            "up3": model_up3.predict(features) if model_up3 else []
        }

        result = df.copy()
        result["Prediksi Pendaftar (Model Pendaftar)"] = predictions["pendaftar"]
        result["Prediksi Pendaftar (Model UP3)"] = predictions["up3"]

        return {
            "status": "success",
            "data": result.to_dict(orient="records")
        }
    except Exception as e:
        return {"error": str(e)}
    
    