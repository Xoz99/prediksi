from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
import pandas as pd
import numpy as np
from io import StringIO
import tempfile
import os
import logging
import traceback
import zipfile
import json
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
pendaftar_up3_router = APIRouter()

def read_csv_file(contents, filename):
    """
    Read CSV file content and return DataFrame
    """
    logger.info(f"Reading file: {filename}")
    
    try:
        df = pd.read_csv(StringIO(contents.decode('utf-8')))
    except UnicodeDecodeError:
        logger.info("UTF-8 decoding failed, trying latin-1")
        df = pd.read_csv(StringIO(contents.decode('latin-1')))
    
    logger.info(f"File read successfully. Shape: {df.shape}")
    return df

def process_pendaftar_up3_data(df):
    """
    Process raw data and extract pendaftar & UP3 data
    """
    logger.info("Processing data to extract pendaftar and UP3 information")
    pendaftar_data = []
    up3_data = []
    data_rows = df[df["PENDAFTAR"] != "Tahun"].copy()
    pendaftar_col_map = {
        2021: "Unnamed: 63", # R 2021
        2022: "Unnamed: 64", # R 2022
        2023: "Unnamed: 65", # R 2023
        2024: "Unnamed: 66", # R 2024
        2025: "Unnamed: 67", # R 2025
        2026: "Unnamed: 68", # R 2026
        2027: "Unnamed: 69", # R 2027
        2028: "Unnamed: 70"  # R 2028
    }
    up3_col_map = {
        2021: "Unnamed: 43", # R 2021
        2022: "Unnamed: 44", # R 2022
        2023: "Unnamed: 45", # R 2023
        2024: "Unnamed: 46", # R 2024
        2025: "Unnamed: 47", # R 2025
        2026: "Unnamed: 48", # R 2026
        2027: "Unnamed: 49", # R 2027
        2028: "Unnamed: 50"  # R 2028
    }
    for _, row in data_rows.iterrows():
        campus = row["Unnamed: 2"]
        
        if pd.isna(campus) or not campus:
            continue
        for year, col_name in pendaftar_col_map.items():
            value = row[col_name]
            if pd.notna(value) and value != 0:
                pendaftar_data.append({
                    "Campus": campus,
                    "Year": int(year),
                    "Applicants": value,
                    "Type": "Actual"
                })
        for year, col_name in up3_col_map.items():
            value = row[col_name]
            if pd.notna(value) and value != 0:
                up3_data.append({
                    "Campus": campus,
                    "Year": int(year),
                    "Enrollments": value,
                    "Type": "Actual"
                })
    pendaftar_df = pd.DataFrame(pendaftar_data)
    up3_df = pd.DataFrame(up3_data)
    
    logger.info(f"Extracted {len(pendaftar_data)} pendaftar records")
    logger.info(f"Extracted {len(up3_data)} UP3 records")
    
    return pendaftar_df, up3_df

def create_zip_with_csv_files(pendaftar_df, up3_df):
    """
    Create a zip file containing pendaftar and UP3 CSV files
    """
    logger.info("Creating ZIP file with CSV data")
    temp_dir = tempfile.mkdtemp()
    logger.info(f"Created temp directory: {temp_dir}")
    pendaftar_path = os.path.join(temp_dir, "processed_pendaftar.csv")
    up3_path = os.path.join(temp_dir, "processed_up3.csv")
    
    pendaftar_df.to_csv(pendaftar_path, index=False)
    up3_df.to_csv(up3_path, index=False)
    zip_path = os.path.join(temp_dir, "pendaftar_up3_data.zip")
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        zipf.write(pendaftar_path, os.path.basename(pendaftar_path))
        zipf.write(up3_path, os.path.basename(up3_path))
    
    logger.info(f"ZIP file created: {zip_path}")
    
    return zip_path, temp_dir

@pendaftar_up3_router.post("/analyze-pendaftar-up3")
async def analyze_pendaftar_up3(file: UploadFile = File(...)):
    """
    Analyze uploaded file and return summary of pendaftar and UP3 data
    """
    try:
        logger.info(f"Analyzing file: {file.filename}")
        contents = await file.read()
        if file.filename.lower().endswith('.csv'):
            df = read_csv_file(contents, file.filename)
        else:
            return JSONResponse(
                status_code=400,
                content={"error": "Unsupported file type. Please upload a CSV file."}
            )
        pendaftar_df, up3_df = process_pendaftar_up3_data(df)
        pendaftar_stats = {
            "totalRecords": len(pendaftar_df),
            "yearStats": pendaftar_df.groupby("Year")["Applicants"].agg(["count", "sum"]).to_dict(),
            "campusStats": pendaftar_df.groupby("Campus")["Applicants"].agg(["count", "sum"]).to_dict()
        }
        
        up3_stats = {
            "totalRecords": len(up3_df),
            "yearStats": up3_df.groupby("Year")["Enrollments"].agg(["count", "sum"]).to_dict(),
            "campusStats": up3_df.groupby("Campus")["Enrollments"].agg(["count", "sum"]).to_dict()
        }
        return {
            "status": "success",
            "pendaftar": {
                "totalRecords": len(pendaftar_df),
                "sampleData": pendaftar_df.head(5).to_dict(orient="records"),
                "stats": pendaftar_stats
            },
            "up3": {
                "totalRecords": len(up3_df),
                "sampleData": up3_df.head(5).to_dict(orient="records"),
                "stats": up3_stats
            }
        }
    
    except Exception as e:
        logger.error(f"Error analyzing file: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"error": f"Error processing file: {str(e)}"}
        )

@pendaftar_up3_router.post("/export-pendaftar-up3")
async def export_pendaftar_up3(file: UploadFile = File(...)):
    """
    Process uploaded file and export pendaftar and UP3 data as separate CSV files in a ZIP
    """
    try:
        logger.info(f"Processing file for export: {file.filename}")
        contents = await file.read()
        if file.filename.lower().endswith('.csv'):
            df = read_csv_file(contents, file.filename)
        else:
            return JSONResponse(
                status_code=400,
                content={"error": "Unsupported file type. Please upload a CSV file."}
            )
        pendaftar_df, up3_df = process_pendaftar_up3_data(df)
        zip_path, temp_dir = create_zip_with_csv_files(pendaftar_df, up3_df)
        base_name = os.path.splitext(file.filename)[0]
        download_filename = f"{base_name}_pendaftar_up3_data.zip"
        response = FileResponse(
            path=zip_path,
            filename=download_filename,
            media_type="application/zip"
        )
        response._temp_dir = temp_dir
        
        return response
    
    except Exception as e:
        logger.error(f"Error exporting data: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"error": f"Error exporting data: {str(e)}"}
        )

@pendaftar_up3_router.post("/export-pendaftar")
async def export_pendaftar(file: UploadFile = File(...)):
    """
    Process uploaded file and export only pendaftar data as CSV
    """
    try:
        logger.info(f"Processing file for pendaftar export: {file.filename}")
        contents = await file.read()
        if file.filename.lower().endswith('.csv'):
            df = read_csv_file(contents, file.filename)
        else:
            return JSONResponse(
                status_code=400,
                content={"error": "Unsupported file type. Please upload a CSV file."}
            )
        pendaftar_df, _ = process_pendaftar_up3_data(df)
        temp_dir = tempfile.mkdtemp()
        csv_path = os.path.join(temp_dir, "processed_pendaftar.csv")
        pendaftar_df.to_csv(csv_path, index=False)
        base_name = os.path.splitext(file.filename)[0]
        download_filename = f"{base_name}_pendaftar.csv"
        response = FileResponse(
            path=csv_path,
            filename=download_filename,
            media_type="text/csv"
        )
        response._temp_dir = temp_dir
        
        return response
    
    except Exception as e:
        logger.error(f"Error exporting pendaftar data: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"error": f"Error exporting pendaftar data: {str(e)}"}
        )

@pendaftar_up3_router.post("/export-up3")
async def export_up3(file: UploadFile = File(...)):
    """
    Process uploaded file and export only UP3 data as CSV
    """
    try:
        logger.info(f"Processing file for UP3 export: {file.filename}")
        contents = await file.read()
        if file.filename.lower().endswith('.csv'):
            df = read_csv_file(contents, file.filename)
        else:
            return JSONResponse(
                status_code=400,
                content={"error": "Unsupported file type. Please upload a CSV file."}
            )
        _, up3_df = process_pendaftar_up3_data(df)
        temp_dir = tempfile.mkdtemp()
        csv_path = os.path.join(temp_dir, "processed_up3.csv")
        up3_df.to_csv(csv_path, index=False)
        base_name = os.path.splitext(file.filename)[0]
        download_filename = f"{base_name}_up3.csv"
        response = FileResponse(
            path=csv_path,
            filename=download_filename,
            media_type="text/csv"
        )
        response._temp_dir = temp_dir
        
        return response
    
    except Exception as e:
        logger.error(f"Error exporting UP3 data: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"error": f"Error exporting UP3 data: {str(e)}"}
        )