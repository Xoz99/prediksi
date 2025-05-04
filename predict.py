import pandas as pd
from sklearn.linear_model import LinearRegression
import numpy as np
from fastapi import UploadFile, File
from fastapi.responses import JSONResponse
import io
import random

def predict_multi_year_grouped(df, target_column, start_year, end_year):
    """
    Melakukan prediksi per lembaga terhadap kolom target_column (Pendaftar atau Registrasi)
    untuk rentang tahun yang diinginkan.
    """
    hasil_prediksi = []
    grouped = df.groupby('Lembaga')
    
    # Tampilkan debug info
    print(f"Prediksi dari {start_year} hingga {end_year}")
    
    for lembaga, group in grouped:
        group = group.copy()
        group = group.sort_values('Tahun')
        
        # Hanya ambil data sampai tahun prediksi awal
        group = group[group['Tahun'] <= start_year] if start_year else group
        
        if group.shape[0] < 2:
            continue  # Skip jika data terlalu sedikit
        
        X = group[['Tahun']]
        y = group[target_column]
        model = LinearRegression()
        model.fit(X, y)
        
        # PENTING: Pastikan future_years mencakup semua tahun dari start_year+1 hingga end_year
        future_years = list(range(start_year + 1, end_year + 1))
        print(f"Lembaga {lembaga}: Prediksi untuk tahun {future_years}")
        
        # Buat DataFrame terpisah untuk setiap tahun prediksi
        for year in future_years:
            future_df = pd.DataFrame({'Tahun': [year]})
            future_df['Lembaga'] = lembaga
            
            # Prediksi untuk tahun ini
            predicted_value = model.predict(pd.DataFrame({'Tahun': [year]}))[0]
            future_df[target_column] = round(predicted_value)
            
            # Tambahkan ke hasil
            hasil_prediksi.append(future_df)
    
    if hasil_prediksi:
        return pd.concat(hasil_prediksi, ignore_index=True)
    else:
        return pd.DataFrame(columns=['Tahun', 'Lembaga', target_column])
def predict_telu_data(df, start_year=None, end_year=2030):
    """
    Prediksi pendaftar dan registrasi berdasarkan data input dengan pertumbuhan yang bervariasi.
    Harus punya kolom: Tahun, Lembaga, Realisasi Pendaftar, Realisasi Registrasi (NIM)
    """
    df = df.copy()
    df['Tahun'] = df['Tahun'].astype(int)
    
    if start_year is None:
        start_year = df['Tahun'].max()
    
    # Set seed untuk konsistensi random
    random.seed(42)
    
    # Prediksi pendaftar
    pred_pendaftar = predict_multi_year_grouped(df, 'Realisasi Pendaftar', start_year, end_year)
    
    # Reset seed untuk variasi yang berbeda pada registrasi
    random.seed(43)
    
    # Prediksi registrasi
    pred_registrasi = predict_multi_year_grouped(df, 'Realisasi Registrasi (NIM)', start_year, end_year)
    
    # Gabungkan hasil
    hasil = pd.merge(pred_pendaftar, pred_registrasi, on=['Tahun', 'Lembaga'], how='inner')
    
    # Pastikan registrasi tidak lebih besar dari pendaftar
    for idx, row in hasil.iterrows():
        if row['Realisasi Registrasi (NIM)'] > row['Realisasi Pendaftar']:
            # Koreksi registrasi agar tidak melebihi pendaftar (maksimal 95%)
            hasil.at[idx, 'Realisasi Registrasi (NIM)'] = int(row['Realisasi Pendaftar'] * 0.95)
    
    return hasil

# FastAPI-compatible endpoint
async def predict_telu(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        required_cols = ['Tahun', 'Lembaga', 'Realisasi Pendaftar', 'Realisasi Registrasi (NIM)']
        if not all(col in df.columns for col in required_cols):
            return JSONResponse(
                content={"error": f"Data harus mengandung kolom: {', '.join(required_cols)}"},
                status_code=400
            )
            
        # Lakukan prediksi
        pred_df = predict_telu_data(df)
        
        if pred_df.empty:
            return JSONResponse(
                content={"error": "Tidak dapat menghasilkan prediksi dari data yang diberikan"},
                status_code=400
            )
            
        # Tambahkan data historis untuk referensi
        result_df = pd.concat([
            df[['Tahun', 'Lembaga', 'Realisasi Pendaftar', 'Realisasi Registrasi (NIM)']],
            pred_df
        ], ignore_index=True)
        
        return {"data": result_df.to_dict(orient="records")}
        
    except Exception as e:
        return JSONResponse(
            content={"error": f"Terjadi kesalahan: {str(e)}"},
            status_code=500
        )