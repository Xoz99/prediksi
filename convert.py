import joblib
print("🚀 Mulai load model...")

model = joblib.load("all_program_models.joblib")
print("✅ Model berhasil dibaca.")

joblib.dump(model, "clean_model.joblib", compress=3)
print("💾 Model berhasil disimpan ulang sebagai clean_model.joblib")
