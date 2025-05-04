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
import zipfile
import shutil
logging.basicConfig(
    level=logging.DEBUG,  # Set to DEBUG for more detailed logs
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
export_lembaga_router = APIRouter()

def load_dataframe(contents, filename):
    """
    Load dataframe from uploaded file contents
    """
    logger.info(f"Loading dataframe from file: {filename}")
    if not contents:
        logger.error("File kosong, tidak ada data untuk dibaca")
        raise ValueError("File kosong, tidak ada data untuk dibaca")
    logger.info(f"Ukuran file: {len(contents)} bytes")
    if filename.lower().endswith('.csv'):
        encodings = ['utf-8', 'latin1', 'iso-8859-1', 'cp1252']
        for encoding in encodings:
            try:
                text_content = contents.decode(encoding, errors='replace')
                if not text_content.strip():
                    logger.error(f"File CSV kosong setelah decode dengan {encoding}")
                    continue
                logger.info(f"Membaca CSV dengan encoding {encoding}")
                df = pd.read_csv(io.StringIO(text_content))
                if df.empty:
                    logger.warning(f"CSV berhasil dibaca dengan {encoding} tetapi tidak memiliki data")
                    continue
                
                logger.info(f"Successfully read CSV with {encoding} encoding: {df.shape}")
                logger.info(f"DataFrame columns: {df.columns.tolist()}")
                logger.info(f"Sample data:\n{df.head(3).to_string()}")
                return df
            except Exception as e:
                logger.warning(f"Failed to read with {encoding}: {str(e)}")
                try:
                    logger.info(f"Mencoba membaca CSV dengan opsi fleksibel dan encoding {encoding}")
                    df = pd.read_csv(
                        io.StringIO(text_content),
                        sep=None,  # Auto-detect separator
                        engine='python',
                        on_bad_lines='skip'
                    )
                    if df.empty:
                        logger.warning(f"CSV berhasil dibaca dengan opsi fleksibel dan {encoding} tetapi tidak memiliki data")
                        continue
                    
                    logger.info(f"Successfully read CSV with flexible options and {encoding} encoding: {df.shape}")
                    logger.info(f"DataFrame columns: {df.columns.tolist()}")
                    logger.info(f"Sample data:\n{df.head(3).to_string()}")
                    return df
                except Exception as flex_e:
                    logger.warning(f"Flexible reading failed with {encoding}: {str(flex_e)}")
    
    elif filename.lower().endswith(('.xlsx', '.xls')):
        try:
            logger.info("Membaca file Excel")
            df = pd.read_excel(io.BytesIO(contents))
            if df.empty:
                logger.error("File Excel berhasil dibaca tetapi tidak memiliki data")
                raise ValueError("File Excel kosong, tidak memiliki data")
            
            logger.info(f"Successfully read Excel: {df.shape}")
            logger.info(f"DataFrame columns: {df.columns.tolist()}")
            logger.info(f"Sample data:\n{df.head(3).to_string()}")
            return df
        except Exception as e:
            logger.error(f"Failed to read Excel: {str(e)}")
            try:
                logger.info("Mencoba membaca Excel dengan opsi alternatif")
                df = pd.read_excel(io.BytesIO(contents), engine='openpyxl')
                
                if df.empty:
                    logger.error("File Excel berhasil dibaca dengan openpyxl tetapi tidak memiliki data")
                    raise ValueError("File Excel kosong, tidak memiliki data")
                
                logger.info(f"Successfully read Excel with openpyxl: {df.shape}")
                return df
            except Exception as alt_e:
                logger.error(f"Alternatif Excel reader gagal: {str(alt_e)}")
                raise ValueError(f"Tidak dapat membaca file Excel: {str(e)}")
    logger.error(f"Semua metode pembacaan gagal untuk file {filename}")
    raise ValueError("Tidak dapat membaca file. Coba periksa format atau encoding. Pastikan file tidak kosong dan memiliki format yang valid.")

def detect_numeric_columns(df):
    """
    Detect columns that contain numeric values
    """
    numeric_columns = []
    
    for col in df.columns:
        try:
            numeric_values = pd.to_numeric(df[col], errors='coerce')
            if numeric_values.notna().sum() > 0:
                numeric_columns.append(col)
        except:
            continue
    
    return numeric_columns

def find_year_column(df):
    """
    Find the most likely column containing year information
    """
    year_keywords = ['tahun', 'year', 'thn', 'angkatan']
    columns_lower = {col.lower(): col for col in df.columns}
    
    for keyword in year_keywords:
        if keyword in columns_lower:
            return columns_lower[keyword]
    numeric_columns = detect_numeric_columns(df)
    
    for col in numeric_columns:
        try:
            values = pd.to_numeric(df[col], errors='coerce')
            unique_values = values.dropna().unique()
            if all(2000 <= val <= 2030 for val in unique_values if not pd.isna(val)):
                if len(unique_values) > 0 and sum(2000 <= val <= 2030 for val in unique_values) / len(unique_values) > 0.8:
                    return col
        except:
            continue
    for col in df.columns:
        col_str = str(col).lower()
        if any(keyword in col_str for keyword in year_keywords):
            return col
    
    return None

def identify_columns(df, manual_columns=None):
    """
    Identify relevant columns in the dataframe
    Returns a dictionary with column mappings
    
    Args:
        df: DataFrame to analyze
        manual_columns: Dictionary with manual column mappings
    """
    logger.info("Identifying columns in the data")
    
    column_mapping = {
        'tahun': None,
        'lembaga': None,
        'pendaftar': None,
        'registrasi': None
    }
    if manual_columns:
        for key, value in manual_columns.items():
            if value and value in df.columns:
                column_mapping[key] = value
                logger.info(f"Using manual mapping for {key}: {value}")
    columns_lower = {col.lower(): col for col in df.columns}
    logger.info(f"Available columns: {list(df.columns)}")
    if column_mapping['tahun'] is None:
        year_col = find_year_column(df)
        if year_col:
            column_mapping['tahun'] = year_col
            logger.info(f"Identified tahun column using year detection: {column_mapping['tahun']}")
        else:
            year_keywords = ['tahun', 'year', 'thn', 'angkatan']
            for keyword in year_keywords:
                if keyword in columns_lower:
                    column_mapping['tahun'] = columns_lower[keyword]
                    logger.info(f"Identified tahun column: {column_mapping['tahun']}")
                    break
    if column_mapping['lembaga'] is None:
        lembaga_keywords = ['lembaga', 'institusi', 'fakultas', 'lemdikti', 'unit', 'school', 'jurusan', 'prodi', 'program']
        for keyword in lembaga_keywords:
            if keyword in columns_lower:
                column_mapping['lembaga'] = columns_lower[keyword]
                logger.info(f"Identified lembaga column: {column_mapping['lembaga']}")
                break
        if column_mapping['lembaga'] is None:
            for col in df.columns:
                col_lower = str(col).lower()
                if any(keyword in col_lower for keyword in lembaga_keywords):
                    column_mapping['lembaga'] = col
                    logger.info(f"Identified lembaga column by partial match: {column_mapping['lembaga']}")
                    break
            if column_mapping['lembaga'] is None:
                string_cols = df.select_dtypes(include=['object']).columns
                if len(string_cols) > 0:
                    unique_counts = [(col, df[col].nunique()) for col in string_cols]
                    unique_counts.sort(key=lambda x: x[1], reverse=True)
                    if unique_counts:
                        column_mapping['lembaga'] = unique_counts[0][0]
                        logger.info(f"Identified lembaga column by unique values: {column_mapping['lembaga']}")
    if column_mapping['pendaftar'] is None:
        pendaftar_keywords = ['pendaftar', 'applicant', 'up3', 'daftar', 'application', 'calon', 'peminat']
        for keyword in pendaftar_keywords:
            if keyword in columns_lower:
                column_mapping['pendaftar'] = columns_lower[keyword]
                logger.info(f"Identified pendaftar column: {column_mapping['pendaftar']}")
                break
            matches = [col for col in columns_lower if keyword in col]
            if matches:
                net_matches = [col for col in matches if 'net' in col or 'total' in col]
                if net_matches:
                    column_mapping['pendaftar'] = columns_lower[net_matches[0]]
                else:
                    column_mapping['pendaftar'] = columns_lower[matches[0]]
                logger.info(f"Identified pendaftar column by partial match: {column_mapping['pendaftar']}")
                break
    if column_mapping['registrasi'] is None:
        registrasi_keywords = ['registrasi', 'nim', 'reg_nim', 'reg nim', 'registered', 'maba', 'mahasiswa baru']
        for keyword in registrasi_keywords:
            if keyword in columns_lower:
                column_mapping['registrasi'] = columns_lower[keyword]
                logger.info(f"Identified registrasi column: {column_mapping['registrasi']}")
                break
            matches = [col for col in columns_lower if keyword in col.lower()]
            if matches:
                column_mapping['registrasi'] = columns_lower[matches[0]]
                logger.info(f"Identified registrasi column by partial match: {column_mapping['registrasi']}")
                break
        if column_mapping['registrasi'] is None:
            reg_pattern = r"(?:reg|nim).*\d{2}[/\\]\d{2}"
            for col in df.columns:
                if re.search(reg_pattern, str(col).lower()):
                    column_mapping['registrasi'] = col
                    logger.info(f"Identified registrasi column by pattern: {column_mapping['registrasi']}")
                    break
    missing_columns = [key for key, value in column_mapping.items() if value is None]
    if missing_columns:
        logger.warning(f"Missing required columns: {missing_columns}")
    
    return column_mapping

def transform_data(df, column_mapping):
    """
    Transform the data based on the identified columns
    """
    logger.info("Transforming data based on identified columns")
    missing_columns = [key for key, value in column_mapping.items() if value is None]
    if missing_columns:
        missing_str = ", ".join(missing_columns)
        raise ValueError(f"Kolom yang diperlukan tidak ditemukan: {missing_str}. Pastikan data Anda memiliki kolom tahun, lembaga, pendaftar, dan registrasi.")
    logger.info(f"Menggunakan kolom: Tahun={column_mapping['tahun']}, Lembaga={column_mapping['lembaga']}, " 
                f"Pendaftar={column_mapping['pendaftar']}, Registrasi={column_mapping['registrasi']}")
    for col_key, col_name in column_mapping.items():
        if col_name not in df.columns:
            raise ValueError(f"Kolom {col_name} tidak ditemukan dalam data untuk {col_key}")
    logger.info(f"Contoh data Tahun: {df[column_mapping['tahun']].head().tolist()}")
    logger.info(f"Contoh data Lembaga: {df[column_mapping['lembaga']].head().tolist()}")
    logger.info(f"Contoh data Pendaftar: {df[column_mapping['pendaftar']].head().tolist()}")
    logger.info(f"Contoh data Registrasi: {df[column_mapping['registrasi']].head().tolist()}")
    result_df = pd.DataFrame()
    result_df['Tahun'] = df[column_mapping['tahun']]
    result_df['Lembaga'] = df[column_mapping['lembaga']].astype(str).str.strip()
    result_df['Realisasi Pendaftar'] = df[column_mapping['pendaftar']]
    result_df['Realisasi Registrasi (NIM)'] = df[column_mapping['registrasi']]
    for col in ['Tahun', 'Realisasi Pendaftar', 'Realisasi Registrasi (NIM)']:
        logger.info(f"Sebelum konversi {col}: tipe={result_df[col].dtype}, nilai unik={result_df[col].unique()[:5]}")
        result_df[col] = pd.to_numeric(result_df[col], errors='coerce')
        logger.info(f"Setelah konversi {col}: tipe={result_df[col].dtype}, missing={result_df[col].isna().sum()}")
    result_df['Realisasi Pendaftar'] = result_df['Realisasi Pendaftar'].fillna(0)
    result_df['Realisasi Registrasi (NIM)'] = result_df['Realisasi Registrasi (NIM)'].fillna(0)
    before_drop = len(result_df)
    result_df = result_df.dropna(subset=['Tahun', 'Lembaga'])
    after_drop = len(result_df)
    logger.info(f"Dropped {before_drop - after_drop} rows with missing Tahun or Lembaga")
    if result_df.empty:
        raise ValueError("Tidak ada data yang valid setelah memfilter baris dengan Tahun atau Lembaga yang kosong")
    try:
        result_df['Tahun'] = result_df['Tahun'].astype(int)
        result_df['Realisasi Pendaftar'] = result_df['Realisasi Pendaftar'].astype(int)
        result_df['Realisasi Registrasi (NIM)'] = result_df['Realisasi Registrasi (NIM)'].astype(int)
    except Exception as e:
        logger.error(f"Gagal mengkonversi ke integer: {str(e)}")
        logger.error(f"Data contoh dengan masalah konversi:\n{result_df[result_df['Tahun'].isna()].head()}")
        raise ValueError(f"Gagal mengkonversi kolom ke integer: {str(e)}")
    result_df = result_df.groupby(['Tahun', 'Lembaga'], as_index=False).agg({
        'Realisasi Pendaftar': 'sum',
        'Realisasi Registrasi (NIM)': 'sum'
    })
    
    logger.info(f"Transformed data shape: {result_df.shape}")
    logger.info(f"Contoh hasil transformasi:\n{result_df.head().to_string()}")
    
    return result_df

def predict_future_values(df, years_to_predict=5):
    """
    Predict future values for each lembaga
    """
    logger.info(f"Predicting values for {years_to_predict} years into the future")
    if df.empty:
        logger.error("DataFrame kosong, tidak dapat melakukan prediksi")
        raise ValueError("Data kosong, tidak dapat melakukan prediksi")
    required_columns = ['Tahun', 'Lembaga', 'Realisasi Pendaftar', 'Realisasi Registrasi (NIM)']
    for col in required_columns:
        if col not in df.columns:
            logger.error(f"Kolom {col} tidak ditemukan dalam data")
            raise ValueError(f"Kolom {col} tidak ditemukan dalam data")
    lembaga_list = df['Lembaga'].unique()
    max_year = df['Tahun'].max()
    
    logger.info(f"Found {len(lembaga_list)} lembaga with data up to year {max_year}")
    logger.info(f"Distribusi tahun dalam data: {df['Tahun'].value_counts().to_dict()}")
    predictions = []
    prediction_success_count = 0
    
    for lembaga in lembaga_list:
        lembaga_data = df[df['Lembaga'] == lembaga]
        if len(lembaga_data) < 2:
            logger.warning(f"Insufficient data for {lembaga}, skipping predictions. Data points: {len(lembaga_data)}")
            continue
        
        try:
            logger.info(f"Data untuk prediksi {lembaga}:\n{lembaga_data[['Tahun', 'Realisasi Pendaftar', 'Realisasi Registrasi (NIM)']].to_string()}")
            pendaftar_model = LinearRegression()
            X = lembaga_data['Tahun'].values.reshape(-1, 1)
            y_pendaftar = lembaga_data['Realisasi Pendaftar'].values
            
            pendaftar_model.fit(X, y_pendaftar)
            pendaftar_coef = pendaftar_model.coef_[0]
            pendaftar_intercept = pendaftar_model.intercept_
            logger.info(f"Model pendaftar untuk {lembaga}: y = {pendaftar_coef:.2f}x + {pendaftar_intercept:.2f}")
            registrasi_model = LinearRegression()
            y_registrasi = lembaga_data['Realisasi Registrasi (NIM)'].values
            
            registrasi_model.fit(X, y_registrasi)
            registrasi_coef = registrasi_model.coef_[0]
            registrasi_intercept = registrasi_model.intercept_
            logger.info(f"Model registrasi untuk {lembaga}: y = {registrasi_coef:.2f}x + {registrasi_intercept:.2f}")
            future_years = range(max_year + 1, max_year + years_to_predict + 1)
            
            for year in future_years:
                future_X = np.array([[year]])
                pendaftar_pred = max(0, int(round(pendaftar_model.predict(future_X)[0])))
                registrasi_pred = max(0, int(round(registrasi_model.predict(future_X)[0])))
                predictions.append({
                    'Tahun': year,
                    'Lembaga': lembaga,
                    'Realisasi Pendaftar': pendaftar_pred,
                    'Realisasi Registrasi (NIM)': registrasi_pred
                })
            
            logger.info(f"Generated predictions for {lembaga}: {future_years}")
            logger.info(f"Sampel prediksi: Tahun {future_years[0]} - Pendaftar={pendaftar_pred}, Registrasi={registrasi_pred}")
            prediction_success_count += 1
            
        except Exception as e:
            logger.error(f"Error predicting for {lembaga}: {str(e)}")
            logger.error(traceback.format_exc())
    
    logger.info(f"Total berhasil prediksi: {prediction_success_count} dari {len(lembaga_list)} lembaga")
    if predictions:
        pred_df = pd.DataFrame(predictions)
        logger.info(f"Tabel prediksi dibuat dengan {len(pred_df)} baris")
        result_df = pd.concat([df, pred_df], ignore_index=True)
        result_df = result_df.sort_values(['Lembaga', 'Tahun'])
        
        logger.info(f"Final data with predictions: {result_df.shape}")
        logger.info(f"Sample final data:\n{result_df.head(10).to_string()}")
        
        return result_df
    else:
        logger.warning("No predictions were generated, returning original dataframe")
        return df.copy()

def export_by_lembaga(df, output_dir):
    """
    Export data for each lembaga to separate CSV files
    Returns a list of created files
    """
    logger.info(f"Exporting data by lembaga to {output_dir}")
    logger.info(f"DataFrame shape: {df.shape}")
    logger.info(f"DataFrame columns: {df.columns}")
    if df.empty:
        logger.error("DataFrame kosong! Tidak ada data untuk diekspor.")
        raise ValueError("Data kosong, tidak dapat melakukan ekspor.")
    required_columns = ['Tahun', 'Lembaga', 'Realisasi Pendaftar', 'Realisasi Registrasi (NIM)']
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        logger.error(f"Kolom yang diperlukan tidak ada: {missing_columns}")
        raise ValueError(f"Kolom yang diperlukan tidak ada: {missing_columns}")
    logger.info(f"Sample data:\n{df.head().to_string()}")
    os.makedirs(output_dir, exist_ok=True)
    lembaga_list = df['Lembaga'].unique()
    logger.info(f"Ditemukan {len(lembaga_list)} lembaga unik")
    created_files = []
    all_data_file = os.path.join(output_dir, "semua_lembaga_dengan_prediksi.csv")
    
    try:
        with open(all_data_file, 'w', encoding='utf-8', newline='') as f:
            df.to_csv(f, index=False)
        import time
        time.sleep(0.5)
        if os.path.exists(all_data_file):
            file_size = os.path.getsize(all_data_file)
            logger.info(f"Berhasil ekspor semua data ke {all_data_file} (ukuran: {file_size} bytes)")
            
            if file_size == 0:
                logger.warning(f"File {all_data_file} kosong (0 bytes)")
                logger.info("Mencoba tulis ulang dengan metode alternatif")
                df.to_csv(all_data_file, index=False, encoding='utf-8')
                if os.path.exists(all_data_file) and os.path.getsize(all_data_file) > 0:
                    logger.info(f"Berhasil tulis ulang ke {all_data_file} (ukuran: {os.path.getsize(all_data_file)} bytes)")
                else:
                    logger.error(f"Gagal tulis ulang ke {all_data_file}")
        else:
            logger.error(f"File {all_data_file} tidak ditemukan setelah penulisan")
            raise IOError(f"Gagal menulis ke file {all_data_file}")
        
        created_files.append(all_data_file)
    except Exception as e:
        logger.error(f"Error writing to {all_data_file}: {str(e)}")
        raise IOError(f"Gagal menulis ke file {all_data_file}: {str(e)}")
    try:
        test_df = pd.read_csv(all_data_file)
        logger.info(f"Berhasil baca ulang file, shape: {test_df.shape}")
    except Exception as e:
        logger.error(f"Gagal baca ulang file: {str(e)}")
    for lembaga in lembaga_list:
        try:
            lembaga_data = df[df['Lembaga'] == lembaga]
            if lembaga_data.empty:
                logger.warning(f"Data kosong untuk lembaga: {lembaga}, melewati ekspor")
                continue
            lembaga_filename = lembaga.strip().replace(' ', '_').replace('/', '_').replace('\\', '_')
            lembaga_filename = ''.join(c if c.isalnum() or c == '_' else '_' for c in lembaga_filename)
            lembaga_filename = f"{lembaga_filename}_prediksi.csv"
            
            output_file = os.path.join(output_dir, lembaga_filename)
            with open(output_file, 'w', encoding='utf-8', newline='') as f:
                lembaga_data.to_csv(f, index=False)
            if os.path.exists(output_file):
                file_size = os.path.getsize(output_file)
                if file_size > 0:
                    logger.info(f"Berhasil ekspor data untuk {lembaga} ke {output_file} (ukuran: {file_size} bytes)")
                    created_files.append(output_file)
                else:
                    logger.warning(f"File {output_file} kosong (0 bytes)")
            else:
                logger.error(f"File {output_file} tidak ditemukan setelah penulisan")
        except Exception as e:
            logger.error(f"Error exporting data for {lembaga}: {str(e)}")
            logger.error(traceback.format_exc())
    logger.info(f"Total {len(created_files)} file berhasil dibuat")
    if not created_files:
        raise ValueError("Tidak ada file yang berhasil dibuat")
        
    return created_files