from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
import io
import tempfile
import os
import logging
import traceback
import re
logger = logging.getLogger(__name__)
export_router = APIRouter()

def extract_year_from_column(col_name):
    """Extract year from column name (e.g., 'Reg NIM '20/21' -> 2020)"""
    col_str = str(col_name)
    year_pattern = r"[\'\"]*(\d{2})[/\\](\d{2})[\'\"]*"
    match = re.search(year_pattern, col_str)
    if match:
        year = match.group(1)
        return 2000 + int(year)
    full_year_pattern = r"(20\d{2})"
    match = re.search(full_year_pattern, col_str)
    if match:
        return int(match.group(1))
    
    return None

def identify_program_column(df):
    """
    Find the most likely column containing program/jurusan information
    """
    common_names = ["Program", "PRODI", "Prodi", "program", "prodi", "Jurusan", "JURUSAN", "jurusan"]
    for col in common_names:
        if col in df.columns:
            logger.info(f"Found exact program column match: {col}")
            return col
    for col in df.columns:
        col_lower = str(col).lower()
        if any(name.lower() in col_lower for name in common_names):
            logger.info(f"Found partial program column match: {col}")
            return col
    str_columns = df.select_dtypes(include=['object']).columns
    if len(str_columns) > 0:
        unique_counts = [(col, df[col].nunique()) for col in str_columns]
        unique_counts.sort(key=lambda x: x[1], reverse=True)
        if unique_counts:
            best_col = unique_counts[0][0]
            logger.info(f"Using string column with most unique values as program column: {best_col}")
            return best_col
    return None

def identify_year_columns(df):
    """
    Find columns containing registration/enrollment data by year
    """
    year_columns = []
    for col in df.columns:
        col_str = str(col)
        if "Reg NIM" in col_str or "REG NIM" in col_str or "reg nim" in col_str.lower():
            year = extract_year_from_column(col_str)
            if year:
                year_columns.append((col_str, year))
                continue
        if "NIM" in col_str or "nim" in col_str.lower():
            year = extract_year_from_column(col_str)
            if year:
                year_columns.append((col_str, year))
                continue
        if str(col).isdigit() and 2000 <= int(col) <= 2100:
            year_columns.append((col_str, int(col)))
            continue
        year = extract_year_from_column(col_str)
        if year and any(term in col_str.lower() for term in ["reg", "nim", "daftar", "enrollment", "student"]):
            year_columns.append((col_str, year))
    
    return year_columns

def log_dataframe_info(df, label="DataFrame"):
    """Log detailed information about the DataFrame for debugging"""
    logger.info(f"--- {label} Info ---")
    logger.info(f"Shape: {df.shape}")
    logger.info(f"Columns: {list(df.columns)}")
    logger.info(f"Data types: {df.dtypes}")
    if not df.empty:
        sample = df.head(2).to_string()
        logger.info(f"Sample data:\n{sample}")
    missing = df.isnull().sum()
    if missing.sum() > 0:
        logger.info(f"Missing values by column:\n{missing}")

def transform_wide_to_long_for_export(df):
    """
    Transform data from wide format (years as columns) to long format for export
    With enhanced error handling and debugging
    """
    logger.info("Analyzing data format for export...")
    log_dataframe_info(df, "Input")
    df = df.copy()
    program_col = identify_program_column(df)
    if not program_col:
        logger.warning("No Program column found in data")
        return df, False, "Kolom program/prodi tidak ditemukan dalam data. Pastikan data Anda memiliki kolom 'Program', 'PRODI', atau serupa."
    
    logger.info(f"Using '{program_col}' as program column")
    year_columns = identify_year_columns(df)
    
    if not year_columns:
        logger.warning("No year columns detected in data")
        return df, False, "Tidak menemukan kolom tahun (seperti 'Reg NIM '20/21'). Pastikan data Anda memiliki kolom registrasi per tahun."
    
    logger.info(f"Detected {len(year_columns)} year columns: {year_columns}")
    df[program_col] = df[program_col].astype(str)
    transformed_data = []
    for idx, row in df.iterrows():
        program = row[program_col].strip()
        if not program or program == 'nan':
            logger.warning(f"Skipping row {idx} due to empty program name")
            continue
        for col_name, year in year_columns:
            try:
                val = row[col_name]
                if pd.notna(val):
                    if not isinstance(val, (int, float)):
                        try:
                            val = pd.to_numeric(val)
                        except:
                            logger.warning(f"Skipping non-numeric value in row {idx}, column {col_name}: {val}")
                            continue
                    if val > 0:
                        transformed_data.append({
                            'Program': program,
                            'Year': year,
                            'Reg_NIM': int(val)
                        })
            except Exception as e:
                logger.warning(f"Error processing row {idx}, column {col_name}: {str(e)}")
                continue
    if transformed_data:
        long_df = pd.DataFrame(transformed_data)
        logger.info(f"Successfully transformed data to long format: {long_df.shape}")
        log_dataframe_info(long_df, "Transformed")
        
        return long_df, True, None
    else:
        logger.warning("No valid data found for transformation")
        return df, False, "Tidak ada data valid yang dapat ditransformasi. Pastikan kolom tahun berisi nilai numerik positif."

def predict_future_enrollments(df, years_to_predict=5):
    """Predict future enrollments based on historical data"""
    logger.info(f"Predicting enrollments for {years_to_predict} years into the future...")
    programs = df['Program'].unique()
    max_year = df['Year'].max()
    
    logger.info(f"Found {len(programs)} programs with data up to year {max_year}")
    prediction_data = []
    
    for program in programs:
        program_data = df[df['Program'] == program]
        if len(program_data) >= 2:
            try:
                X = program_data['Year'].values.reshape(-1, 1)
                y = program_data['Reg_NIM'].values
                model = LinearRegression()
                model.fit(X, y)
                future_years = np.array(range(max_year + 1, max_year + years_to_predict + 1))
                future_X = future_years.reshape(-1, 1)
                predictions = model.predict(future_X)
                for i, year in enumerate(future_years):
                    predicted_value = max(0, int(round(predictions[i])))
                    
                    prediction_data.append({
                        'Program': program,
                        'Year': year,
                        'Reg_NIM': predicted_value
                    })
            except Exception as e:
                logger.warning(f"Error predicting for program {program}: {str(e)}")
                continue
    if prediction_data:
        pred_df = pd.DataFrame(prediction_data)
        combined_df = pd.concat([df, pred_df], ignore_index=True)
        combined_df = combined_df.sort_values(['Program', 'Year'])
        
        logger.info(f"Added predictions for {len(prediction_data)} program-year combinations")
        return combined_df
    else:
        logger.warning("No predictions generated")
        return df

@export_router.post("/export-data")
async def export_data(file: UploadFile = File(...), predict_years: int = Form(5)):
    """Export data from wide format to long format with predictions"""
    try:
        logger.info(f"Received file for export: {file.filename}, type: {file.content_type}")
        contents = await file.read()
        df = None
        error_details = {}
        if file.filename.lower().endswith('.csv'):
            encodings = ['utf-8', 'latin1', 'iso-8859-1', 'cp1252']
            for encoding in encodings:
                try:
                    text_content = contents.decode(encoding, errors='replace')
                    df = pd.read_csv(io.StringIO(text_content))
                    logger.info(f"Successfully read CSV with {encoding} encoding: {df.shape}")
                    break
                except Exception as e:
                    error_details[f"csv_{encoding}"] = str(e)
                    
                    try:
                        df = pd.read_csv(
                            io.StringIO(text_content),
                            sep=None,  # Auto-detect separator
                            engine='python',
                            on_bad_lines='skip'
                        )
                        logger.info(f"Successfully read CSV with flexible options and {encoding} encoding: {df.shape}")
                        break
                    except Exception as flex_e:
                        error_details[f"csv_flex_{encoding}"] = str(flex_e)
        
        elif file.filename.lower().endswith(('.xlsx', '.xls')):
            try:
                df = pd.read_excel(io.BytesIO(contents))
                logger.info(f"Successfully read Excel: {df.shape}")
            except Exception as e:
                error_details["excel"] = str(e)
        if df is None or df.empty:
            logger.error("Failed to read the file with any method")
            return JSONResponse(
                status_code=400,
                content={
                    "error": "Tidak dapat membaca file. Pastikan format file valid.",
                    "details": error_details
                }
            )
        transformed_df, transformed, error_message = transform_wide_to_long_for_export(df)
        
        if not transformed:
            logger.error(f"Transformation failed: {error_message}")
            return JSONResponse(
                status_code=400,
                content={
                    "error": error_message or "Tidak dapat mengubah data ke format yang diperlukan.",
                    "help": "Pastikan file Anda memiliki kolom Program/PRODI dan kolom registrasi per tahun (seperti 'Reg NIM')."
                }
            )
        if predict_years > 0:
            result_df = predict_future_enrollments(transformed_df, predict_years)
        else:
            result_df = transformed_df
        with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as tmp:
            temp_filename = tmp.name
            result_df.to_csv(temp_filename, index=False)
        base_name = os.path.splitext(file.filename)[0]
        download_filename = f"{base_name}_transformed_dengan_prediksi.csv"
        
        logger.info(f"Transformation complete, returning file: {download_filename}")
        return FileResponse(
            path=temp_filename,
            filename=download_filename,
            media_type="text/csv"
        )
        
    except Exception as e:
        logger.error(f"Unexpected error in export_data: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "error": f"Terjadi kesalahan: {str(e)}",
                "traceback": traceback.format_exc()
            }
        )
@export_router.post("/analyze-format")
async def analyze_format(file: UploadFile = File(...)):
    """Analyze the format of an uploaded file without full transformation"""
    try:
        logger.info(f"Analyzing format of: {file.filename}")
        contents = await file.read()
        df = None
        if file.filename.lower().endswith('.csv'):
            try:
                text_content = contents.decode('utf-8', errors='replace')
                df = pd.read_csv(io.StringIO(text_content))
            except:
                try:
                    text_content = contents.decode('latin1', errors='replace')
                    df = pd.read_csv(io.StringIO(text_content))
                except Exception as e:
                    return {"error": f"Tidak dapat membaca file CSV: {str(e)}"}
        elif file.filename.lower().endswith(('.xlsx', '.xls')):
            try:
                df = pd.read_excel(io.BytesIO(contents))
            except Exception as e:
                return {"error": f"Tidak dapat membaca file Excel: {str(e)}"}
        else:
            return {"error": "Format file tidak didukung. Gunakan CSV atau Excel."}
        columns = list(df.columns)
        program_col = identify_program_column(df)
        year_columns = identify_year_columns(df)
        year_info = [{"column": col, "year": year} for col, year in year_columns]
        return {
            "status": "success",
            "file_info": {
                "filename": file.filename,
                "rows": len(df),
                "columns": len(columns)
            },
            "detected_format": {
                "program_column": program_col,
                "year_columns": year_info,
                "all_columns": columns
            },
            "transformation_possible": program_col is not None and len(year_info) > 0
        }
        
    except Exception as e:
        logger.error(f"Error analyzing format: {str(e)}")
        logger.error(traceback.format_exc())
        return {"error": f"Terjadi kesalahan: {str(e)}"}