from predik import load_predik_model
from compare import router as compare_router
from export import export_router
from export_lembaga import export_lembaga_router
from predict import predict_telu, predict_telu_data
from fastapi.responses import FileResponse
from pendaftarup3 import pendaftar_up3_router
from fastapi import FastAPI, UploadFile, File, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
import pandas as pd
import joblib
import os
import io
import traceback
import logging
import sys
import json
from collections import Counter, defaultdict
from predik import load_predik_model, predict_telu
from fastapi import FastAPI
import re
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)
logger.info("Pendaftar & UP3 router telah terdaftar di /api/v1")
app = FastAPI()
app.include_router(export_router)
app.include_router(pendaftar_up3_router, prefix="/api/v1")
app.include_router(export_lembaga_router, prefix="/api/v1")
available_models = {}
available_models["prediksi"] = load_predik_model()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app_info = {
    "version": "1.2.0",
    "status": "initializing"
}
@app.get("/")
def read_root():
    return {"message": "API is alive!"}
@app.post("/predict-telu")
async def route_predict_telu(file: UploadFile = File(...)):
    return await predict_telu(file)
@app.get("/exportpendaftarup3.html", response_class=HTMLResponse)
async def get_export_page():
    with open("static/exportpendaftarup3.html", "r", encoding="utf-8") as f:
        html_content = f.read()
    return HTMLResponse(content=html_content)
model_predik_info = load_predik_model()
model_path = "model/all_program_models (1).joblib"
jurusan_list = []

try:
    if os.path.exists(model_path):
        logger.info(f"Loading model from {model_path}")
        model_data = joblib.load(model_path)
        logger.info(f"Model loaded, type: {type(model_data)}")
        
        if isinstance(model_data, list):
            jurusan_list = model_data
            logger.info(f"Loaded list with {len(jurusan_list)} items")
        elif isinstance(model_data, dict):
            if "jurusan" in model_data:
                jurusan_list = model_data["jurusan"]
                logger.info(f"Loaded dict with jurusan key, {len(jurusan_list)} items")
            else:
                jurusan_list = list(model_data.keys())
                logger.info(f"Loaded dict keys as jurusan, {len(jurusan_list)} items")
        else:
            logger.error(f"Unknown model format: {type(model_data)}")
            app_info["status"] = "error"
            app_info["error"] = f"Unknown model format: {type(model_data)}"
    else:
        logger.error(f"Model file not found: {model_path}")
        app_info["status"] = "error"
        app_info["error"] = f"Model file not found: {model_path}"
except Exception as e:
    logger.error(f"Error loading model: {str(e)}")
    logger.error(traceback.format_exc())
    app_info["status"] = "error"
    app_info["error"] = f"Error loading model: {str(e)}"
if "error" not in app_info:
    app_info["status"] = "ready"
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    logger.error(f"Validation error: {str(exc)}")
    return JSONResponse(
        status_code=422,
        content={"error": "Validation Error", "detail": str(exc)},
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {str(exc)}")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"error": "Internal Server Error", "detail": str(exc)},
    )

@app.get("/status")
async def get_status():
    """Menampilkan status aplikasi dan model prediksi"""
    return {
        "app_info": app_info,
        "jurusan_count": len(jurusan_list),
        "model_info": {
            "name": model_predik_info.get("name", "Tidak tersedia"),
            "status": model_predik_info.get("status", "unknown"),
        },
        "environment": {
            "python_version": sys.version,
            "pandas_version": pd.__version__,
            "joblib_version": joblib.__version__,
            "cwd": os.getcwd(),
            "files_in_cwd": os.listdir(".")
        }
    }

@app.get("/jurusan")
async def get_jurusan():
    """Menampilkan daftar jurusan yang tersedia"""
    categories = {
        "D3": [],
        "D4": [],
        "S1": [],
        "S2": [],
        "S3": []
    }
    for jurusan in jurusan_list:
        for level in categories.keys():
            if jurusan.startswith(level):
                categories[level].append(jurusan)
                break
    
    return {
        "jurusan": jurusan_list,
        "categories": categories,
        "counts": {k: len(v) for k, v in categories.items()}
    }

@app.post("/test-upload")
async def test_upload(file: UploadFile = File(...)):
    """Endpoint test untuk memeriksa upload file"""
    try:
        logger.info(f"Test upload received: {file.filename}")
        logger.info(f"Content type: {file.content_type}")
        sample = await file.read(1024)
        file.file.seek(0)  # Reset file position
        is_csv = False
        is_excel = False
        
        if file.filename.lower().endswith('.csv'):
            is_csv = True
        elif file.filename.lower().endswith(('.xlsx', '.xls')):
            is_excel = True
        sample_hex = ' '.join(f'{b:02x}' for b in sample[:20])
        file_info = {
            "filename": file.filename,
            "content_type": file.content_type,
            "size": file.size if hasattr(file, 'size') else "unknown",
            "appears_to_be_csv": is_csv,
            "appears_to_be_excel": is_excel,
            "first_20_bytes_hex": sample_hex,
            "first_64_chars": sample.decode('utf-8', errors='replace')[:64] if sample else ""
        }
        
        return {
            "status": "success",
            "message": "File upload test successful",
            "file_info": file_info
        }
    except Exception as e:
        logger.error(f"Test upload error: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "status": "error",
            "message": f"File upload test failed: {str(e)}",
            "traceback": traceback.format_exc()
        }

def extract_year_from_data(df):
    """Extract year information from data if available"""
    year_columns = ['tahun', 'year', 'angkatan', 'thn', 'Year']
    found_years = {}
    for col in year_columns:
        if col in df.columns:
            found_years[col] = df[col].unique().tolist()
    if not found_years:
        for col in df.columns:
            col_lower = col.lower()
            if any(year_key in col_lower for year_key in year_columns):
                found_years[col] = df[col].unique().tolist()
    if not found_years:
        year_pattern = r'\b(20\d{2})\b'  # Match 4-digit years starting with 20
        for col in df.select_dtypes(include=['object']).columns:
            sample = df[col].dropna().astype(str).head(100)
            years = []
            for val in sample:
                matches = re.findall(year_pattern, str(val))
                years.extend(matches)
            
            if years:
                found_years[col] = list(set(years))
    
    return found_years

def transform_wide_to_long(df):
    """
    Mengubah data dari format wide (tahun sebagai kolom) ke format long
    """
    year_columns = []
    for col in df.columns:
        try:
            if str(col).isdigit() and 2000 <= int(col) <= 2099:
                year_columns.append(str(col))
            elif any(str(year) in str(col) for year in range(2000, 2100)):
                for year in range(2000, 2100):
                    if str(year) in str(col):
                        year_columns.append(str(col))
                        break
        except:
            continue
    
    logger.info(f"Detected potential year columns: {year_columns}")
    
    if not year_columns:
        logger.info("Data does not appear to be in wide format")
        return df, False
    if 'Program' not in df.columns:
        logger.info("No 'Program' column found in wide format data")
        return df, False
    
    try:
        id_vars = ['Program']
        for col in df.columns:
            if str(col) not in year_columns and col != 'Program':
                id_vars.append(col)
        long_df = pd.melt(
            df, 
            id_vars=id_vars,
            value_vars=year_columns,
            var_name='Year', 
            value_name='Reg_NIM'
        )
        long_df = long_df[long_df['Reg_NIM'].notna() & (long_df['Reg_NIM'] > 0)]
        
        logger.info(f"Successfully transformed wide format to long format: {long_df.shape}")
        
        return long_df, True
    except Exception as e:
        logger.error(f"Error transforming data format: {str(e)}")
        logger.error(traceback.format_exc())
        return df, False

def group_data_by_year(df, year_info):
    """Group data by year if year information is available"""
    if not year_info:
        return None
    if 'Program' not in df.columns:
        logger.warning("Program column not found in data for yearly grouping")
        return None
    year_col = list(year_info.keys())[0]
    all_years = df[year_col].dropna().unique()
    all_years = [str(year) for year in all_years]
    all_years.sort()
    grouped_data = []
    for year in all_years:
        year_df = df[df[year_col].astype(str) == year]
        if 'Reg_NIM' in df.columns:
            program_counts = year_df.groupby('Program')['Reg_NIM'].sum().to_dict()
        else:
            program_counts = year_df.groupby('Program').size().to_dict()
        top_programs = dict(sorted(program_counts.items(), key=lambda x: x[1], reverse=True)[:10])
        year_data = {
            "year": year,
            "data": [{"program": p, "count": c} for p, c in top_programs.items()]
        }
        
        grouped_data.append(year_data)
    grouped_data.sort(key=lambda x: x["year"])
    
    return grouped_data

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """Memprediksi distribusi program berdasarkan file yang diunggah"""
    try:
        logger.info(f"Received file: {file.filename}, type: {file.content_type}")
        df = None
        error_details = {}
        
        try:
            filename = file.filename.lower()
            if filename.endswith(".csv"):
                contents = await file.read()
                text_content = contents.decode('utf-8', errors='replace')
                logger.debug(f"CSV sample: {text_content[:100]}")
                
                try:
                    df = pd.read_csv(io.StringIO(text_content))
                    logger.info(f"Successfully read CSV with pandas: {df.shape}")
                except Exception as csv_err:
                    logger.warning(f"Standard CSV parsing failed: {str(csv_err)}")
                    error_details["csv_standard_error"] = str(csv_err)
                    try:
                        df = pd.read_csv(
                            io.StringIO(text_content),
                            sep=None,  # Auto-detect separator
                            engine='python',
                            on_bad_lines='skip'
                        )
                        logger.info(f"Successfully read CSV with flexible options: {df.shape}")
                    except Exception as csv_flex_err:
                        logger.error(f"Flexible CSV parsing also failed: {str(csv_flex_err)}")
                        error_details["csv_flexible_error"] = str(csv_flex_err)
                        raise Exception(f"Tidak dapat membaca file CSV: {str(csv_flex_err)}")
                        
            elif filename.endswith((".xlsx", ".xls")):
                contents = await file.read()
                try:
                    df = pd.read_excel(io.BytesIO(contents))
                    logger.info(f"Successfully read Excel: {df.shape}")
                except Exception as excel_err:
                    logger.error(f"Excel parsing failed: {str(excel_err)}")
                    error_details["excel_error"] = str(excel_err)
                    raise Exception(f"Tidak dapat membaca file Excel: {str(excel_err)}")
            else:
                logger.warning(f"Unsupported file type: {filename}")
                return {"error": "Hanya file CSV atau Excel (.xlsx) yang didukung."}
        except Exception as read_err:
            logger.error(f"File reading error: {str(read_err)}")
            return {
                "error": f"Gagal membaca file: {str(read_err)}",
                "detail": error_details
            }
        if df is None or df.empty:
            logger.warning("DataFrame is empty or None")
            return {"error": "File tidak berisi data yang valid atau kosong."}
        logger.info(f"DataFrame shape: {df.shape}")
        logger.info(f"Columns: {list(df.columns)}")
        if not jurusan_list:
            logger.error("No jurusan list available")
            return {"error": "Daftar jurusan tidak tersedia"}
        sample_str = df.head(2).to_string()
        logger.info(f"Data sample:\n{sample_str}")
        wide_format_df, is_transformed = transform_wide_to_long(df)
        if is_transformed:
            logger.info("Data was in wide format and has been transformed")
            df = wide_format_df
        year_info = extract_year_from_data(df)
        logger.info(f"Detected year columns: {year_info}")
        if 'Program' not in df.columns:
            logger.warning("Program column not found in data")
            return {
                "error": "Kolom 'Program' tidak ditemukan dalam data",
                "info": "Data Anda harus memiliki kolom 'Program'",
                "columns_found": list(df.columns)
            }
        result = df.to_dict(orient="records")
        grouped_data = None
        if year_info:
            grouped_data = group_data_by_year(df, year_info)
            logger.info(f"Grouped data by year: {len(grouped_data) if grouped_data else 0} years")
        visualization_data = {
            "program_counts": dict(Counter(df['Program']).most_common(10)),
            "level_counts": defaultdict(int),
            "yearly_data": grouped_data
        }
        for program in df['Program']:
            for level in ["D3", "D4", "S1", "S2", "S3"]:
                if str(program).startswith(level):
                    visualization_data["level_counts"][level] += 1
                    break
        visualization_data["level_counts"] = dict(visualization_data["level_counts"])
        
        logger.info("Successfully completed analysis")
        
        return {
            "status": "success",
            "result": result,
            "visualization": visualization_data,
            "meta": {
                "rows_processed": len(df),
                "years_detected": year_info
            }
        }
    except Exception as e:
        logger.error(f"Unexpected error in predict: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "error": f"Terjadi kesalahan tak terduga: {str(e)}",
            "code": 101,  # Custom error code
            "traceback": traceback.format_exc()
        }
app.include_router(compare_router)
app.mount("/", StaticFiles(directory="static", html=True), name="static")
logger.info(f"Application initialized, status: {app_info['status']}")
if jurusan_list:
    logger.info(f"Loaded {len(jurusan_list)} jurusan")
else:
    logger.warning("No jurusan loaded")

@app.get("/", response_class=HTMLResponse)
async def read_index():
    return FileResponse("static/index.html")