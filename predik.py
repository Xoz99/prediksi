import os
import joblib
import logging
import traceback
import io
import pandas as pd
from fastapi import UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from datetime import datetime
import math

logger = logging.getLogger("predik")
def safe_float(val):
    try:
        return 0 if val is None or (isinstance(val, float) and math.isnan(val)) else float(val)
    except:
        return 0
def load_predik_model():
    model_path = "predikTEL-U.joblib"
    if os.path.exists(model_path):
        try:
            model_instance = joblib.load(model_path)
            logger.info(f"Model predikTEL-U loaded from {model_path}")
            return {
                "name": "predikTEL-U",
                "path": model_path,
                "description": "Model prediksi pendaftaran dan registrasi mahasiswa Tel-U",
                "status": "loaded",
                "instance": model_instance,
                "type": type(model_instance).__name__,
                "features": getattr(model_instance, 'feature_names_in_', [])
            }
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            return {"status": "error", "error": str(e)}
    else:
        logger.error(f"Model file not found: {model_path}")
        return {"status": "not_loaded", "error": f"Model file not found: {model_path}"}
async def predict_telu(file: UploadFile = File(...)):
    try:
        model_data = load_predik_model()
        if model_data["status"] != "loaded":
            return JSONResponse(content={
                "error": "Model prediksi belum dimuat",
                "status": "error"
            }, status_code=500)

        model = model_data["instance"]
        filename = file.filename.lower()
        contents = await file.read()
        if filename.endswith(".csv"):
            df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            return JSONResponse(content={"error": "Format file tidak didukung"}, status_code=400)

        if df.empty:
            return JSONResponse(content={"error": "File kosong atau tidak valid"}, status_code=400)

        required_cols = ['Realisasi Pendaftar', 'Realisasi Registrasi (NIM)']
        if not all(col in df.columns for col in required_cols):
            return JSONResponse(content={"error": f"Kolom yang dibutuhkan: {required_cols}"}, status_code=400)
        if 'Tahun' in df.columns:
            df['Tahun'] = df['Tahun'].astype(str).str.extract(r'(\d{4})').astype(float).astype('Int64')
            try:
                last_year = int(df['Tahun'].dropna().max())
                df['Tahun Prediksi'] = last_year + 1
            except:
                df['Tahun Prediksi'] = datetime.now().year + 1
        else:
            tahun_default = datetime.now().year
            df['Tahun'] = tahun_default
            df['Tahun Prediksi'] = tahun_default + 1
        if hasattr(model, 'predict'):
            X = df[required_cols]
            pred = model.predict(X)
            if pred.ndim > 1 and pred.shape[1] >= 2:
                df['Prediksi Pendaftar'] = pred[:, 0]
                df['Prediksi Registrasi'] = pred[:, 1]
            else:
                df['Prediksi Pendaftar'] = pred
                df['Prediksi Registrasi'] = pred * 0.7
        else:
            df['Prediksi Pendaftar'] = df['Realisasi Pendaftar'] * 1.08
            df['Prediksi Registrasi'] = df['Realisasi Registrasi (NIM)'] * 1.05
        df = df.fillna(0)
        if 'Lembaga' in df.columns and 'Tahun' in df.columns:
            df = df.sort_values(by=["Lembaga", "Tahun"], ascending=[True, True])
        stats = {
            "mean_realized_applicants": safe_float(df['Realisasi Pendaftar'].mean()),
            "mean_realized_registrations": safe_float(df['Realisasi Registrasi (NIM)'].mean()),
            "mean_predicted_applicants": safe_float(df['Prediksi Pendaftar'].mean()),
            "mean_predicted_registrations": safe_float(df['Prediksi Registrasi'].mean()),
            "rows_processed": len(df),
            "columns": list(df.columns)
        }

        if 'Tahun' in df.columns:
            yearly_data = df.groupby('Tahun').agg({
                'Realisasi Pendaftar': 'sum',
                'Realisasi Registrasi (NIM)': 'sum',
                'Prediksi Pendaftar': 'sum',
                'Prediksi Registrasi': 'sum'
            }).reset_index()
            stats["yearly_data"] = yearly_data.to_dict(orient="records")

        return JSONResponse(content=jsonable_encoder({
            "status": "success",
            "data": df.to_dict(orient="records"),
            "stats": stats,
            "model_info": {
                "name": model_data["name"],
                "status": model_data["status"]
            }
        }))

    except Exception as e:
        logger.error(f"Error in predict_telu: {str(e)}")
        return JSONResponse(content={
            "error": str(e),
            "traceback": traceback.format_exc()
        }, status_code=500)
