import os
import sys
import joblib
import pandas as pd
import numpy as np

def check_model_exists(model_path):
    """Cek apakah model ada di path yang diberikan"""
    if os.path.exists(model_path):
        print(f"✅ Model ditemukan: {model_path}")
        return True
    else:
        print(f"❌ Model tidak ditemukan: {model_path}")
        return False

def print_model_info(model_path):
    """Cetak informasi tentang model"""
    try:
        print(f"\nMemuat model dari {model_path}...")
        model = joblib.load(model_path)
        print(f"✅ Model berhasil dimuat! Tipe model: {type(model)}")
        if hasattr(model, 'predict'):
            print("✅ Model memiliki metode 'predict'")
        else:
            print("❌ Model TIDAK memiliki metode 'predict'")
        if callable(model):
            print("✅ Model adalah callable")
        else:
            print("❌ Model BUKAN callable")
        print("\nAtribut model:")
        for attr in dir(model):
            if not attr.startswith('_'):  # Skip private attributes
                print(f"- {attr}")
                
        return model
    except Exception as e:
        print(f"❌ Error saat memuat model: {str(e)}")
        return None

def test_prediction(model, test_data=None):
    """Tes prediksi dengan data sampel"""
    if model is None:
        print("❌ Tidak dapat melakukan prediksi karena model tidak dimuat")
        return
    
    print("\nMencoba prediksi dengan data sampel...")
    if test_data is None:
        test_data = pd.DataFrame({
            'Realisasi Pendaftar': [100, 200, 300],
            'Realisasi Registrasi (NIM)': [80, 150, 220]
        })
    
    print("Data sampel:")
    print(test_data)
    
    try:
        if hasattr(model, 'predict'):
            predictions = model.predict(test_data)
            print("\n✅ Prediksi berhasil!")
            print("Hasil prediksi:")
            print(predictions)
        elif callable(model):
            predictions = model(test_data)
            print("\n✅ Prediksi berhasil menggunakan callable!")
            print("Hasil prediksi:")
            print(predictions)
        else:
            print("❌ Tidak dapat melakukan prediksi: model tidak memiliki metode predict dan bukan callable")
    except Exception as e:
        print(f"❌ Error saat melakukan prediksi: {str(e)}")

def check_environment():
    """Periksa lingkungan Python dan library"""
    print("\n=== INFORMASI LINGKUNGAN ===")
    print(f"Python version: {sys.version}")
    print(f"Working directory: {os.getcwd()}")
    print(f"Files in directory: {os.listdir('.')}")
    
    if os.path.exists("model"):
        print(f"Files in model directory: {os.listdir('model')}")
    else:
        print("model directory not found")
    
    print(f"pandas version: {pd.__version__}")
    print(f"joblib version: {joblib.__version__}")
    print(f"numpy version: {np.__version__}")

def main():
    """Fungsi utama"""
    print("=== DEBUGGER MODEL predikTEL-U.joblib ===")
    check_environment()
    paths_to_check = [
        "predikTEL-U.joblib",       # Root directory
        "model/predikTEL-U.joblib", # Model directory
        "clean_model.joblib"        # Alternative model
    ]
    print("\n=== KEBERADAAN MODEL ===")
    found_models = []
    for path in paths_to_check:
        if check_model_exists(path):
            found_models.append(path)
    
    if not found_models:
        print("\n❌ MASALAH KRITIS: Tidak ada model yang ditemukan di semua path!")
        return
    for model_path in found_models:
        print(f"\n=== DETAIL MODEL: {model_path} ===")
        model = print_model_info(model_path)
        if model is not None:
            test_prediction(model)
    
    print("\n=== SARAN PERBAIKAN ===")
    if "predikTEL-U.joblib" in found_models or "model/predikTEL-U.joblib" in found_models:
        print("""
1. Pastikan model memiliki metode predict() atau callable.
2. Pastikan model mengharapkan kolom: 'Realisasi Pendaftar' dan 'Realisasi Registrasi (NIM)'.
3. Sesuaikan kode main.py untuk menggunakan model yang bekerja dengan benar.
        """)
    elif "clean_model.joblib" in found_models:
        print("""
1. Model predikTEL-U.joblib tidak ditemukan, tetapi clean_model.joblib tersedia.
2. Solusi: Salin clean_model.joblib ke nama baru dengan perintah:
   cp clean_model.joblib predikTEL-U.joblib
3. Atau ubah kode di main.py untuk menggunakan clean_model.joblib secara langsung.
        """)
    else:
        print("""
1. Tidak ada model yang ditemukan. Anda perlu:
   - Mengupload model ke server
   - Atau membuat model baru dan menyimpannya dengan nama yang benar
        """)

if __name__ == "__main__":
    main()