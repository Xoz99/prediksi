// Global variables
let currentModel = 'pendaftar';
let currentCampus = 'all';
let chart = null;
let csvData = [];
let fileUploaded = false;

// Function to toggle status section visibility
function toggleStatus() {
    const statusContent = document.getElementById('status-content');
    const toggleIcon = document.getElementById('toggle-icon');
    statusContent.classList.toggle('show');
    
    if (statusContent.classList.contains('show')) {
        toggleIcon.textContent = '▲';
    } else {
        toggleIcon.textContent = '▼';
    }
}

// Load application status
async function loadStatusCompare() {
    const statusDiv = document.getElementById('status-output');
    try {
        const res = await fetch("/status-compare");
        const data = await res.json();
        
        const statusHTML = `
            <p><strong>Status Aplikasi:</strong> 
                <span class="status-indicator ${data.app_info?.status === 'online' ? 'status-online' : 'status-offline'}"></span>
                ${data.app_info?.status ?? 'tidak ditemukan'}
            </p>
            <p><strong>Versi:</strong> ${data.app_info?.version ?? 'tidak ditemukan'}</p>
            <p><strong>Status Model predikTEL-U:</strong> 
                <span class="status-indicator ${data.model_predikTEL_U?.status === 'online' ? 'status-online' : 'status-offline'}"></span>
                ${data.model_predikTEL_U?.status ?? 'tidak ditemukan'}
            </p>
            <p><strong>Status Model predikYoY:</strong> 
                <span class="status-indicator ${data.model_predikYoY?.status === 'online' ? 'status-online' : 'status-offline'}"></span>
                ${data.model_predikYoY?.status ?? 'tidak ditemukan'}
            </p>
        `;
        statusDiv.innerHTML = statusHTML;
    } catch (err) {
        statusDiv.innerHTML = `<p style="color:red;">Gagal memuat status: ${err.message}</p>`;
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Load status information
    loadStatusCompare();
    
    // Set up file input change event
    document.getElementById('fileInput').addEventListener('change', function(e) {
        const fileName = e.target.files[0]?.name;
        if (fileName) {
            const fileInfo = document.getElementById('file-info');
            fileInfo.style.display = 'block';
            fileInfo.innerHTML = `<strong>File dipilih:</strong> ${fileName}`;
        }
    });
    
    // Update file format info
    document.getElementById('file-format-info').innerHTML = `
        <p>Aplikasi ini mendukung dua format file CSV:</p>
        <ol>
            <li><strong>Format Standar:</strong> File dengan kolom <code>Campus, Year, Applicants, Type</code></li>
            <li><strong>Format Mentah:</strong> File Data_PMB_Compare.csv dengan kolom PENDAFTAR dan Trend YoY Pendaftar</li>
        </ol>
        <p>Upload file dalam format apapun, aplikasi akan secara otomatis mendeteksi dan memproses data.</p>
    `;
    
    // Initialize with sample data for preview
    showNoDataMessage();
});

// Process uploaded file
function processFile() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Silakan pilih file CSV terlebih dahulu.');
        return;
    }
    
    // Show loading indicator
    const uploadSection = document.getElementById('upload-section');
    uploadSection.classList.add('loading');
    uploadSection.innerHTML += `
        <div class="loading-overlay">
            <div class="loading-spinner"></div>
            <p>Memproses file...</p>
        </div>
    `;
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const contents = e.target.result;
        
        // Gunakan processor baru untuk menangani berbagai format
        processCSVData(contents)
            .then(data => {
                // Update campus dropdown
                updateCampusDropdown(data);
                
                // Store data and update
                csvData = data;
                fileUploaded = true;
                
                // Update prediction
                updatePrediction();
                
                // Hide loading indicator
                removeLoadingIndicator();
            })
            .catch(error => {
                alert(error);
                // Hide loading indicator
                removeLoadingIndicator();
            });
    };
    
    reader.onerror = function() {
        alert('Terjadi kesalahan saat membaca file.');
        // Hide loading indicator
        removeLoadingIndicator();
    };
    
    reader.readAsText(file);
}

// Remove loading indicator
function removeLoadingIndicator() {
    const uploadSection = document.getElementById('upload-section');
    uploadSection.classList.remove('loading');
    const overlay = uploadSection.querySelector('.loading-overlay');
    if (overlay) {
        overlay.remove();
    }
}

/**
 * Modul pemrosesan data untuk aplikasi Prediksi YoY Pendaftar
 * Mendukung format CSV standar dan format mentah Data_PMB_Compare.csv
 */

// Fungsi untuk mendeteksi format file CSV yang diupload
// Fungsi yang lebih baik untuk mendeteksi format file CSV
function detectCSVFormat(parsedData, headers) {
    console.log("Headers yang terdeteksi:", headers);
    
    // Cek apakah format sudah sesuai standar aplikasi
    // Cek apakah format sudah sesuai standar aplikasi
if (headers.includes('Campus') && headers.includes('Year') && 
(headers.includes('Applicants') || headers.includes('Enrollments')) && 
headers.includes('Type')) {
console.log("Format standar terdeteksi");
return 'standard';
}
    
    // Cek apakah ini format mentah Data_PMB
    // Lebih fleksibel dalam mendeteksi - cukup cari salah satu kolom kunci
    if (headers.includes('PENDAFTAR') || 
        headers.some(h => h && h.includes && h.includes('Trend YoY')) ||
        headers.some(h => h && h.includes && h.includes('REGISTRASI')) ||
        headers.some(h => h && h.includes && h.includes('KELULUSAN'))) {
        
        console.log("Format Data_PMB_Compare terdeteksi");
        return 'raw_pmb';
    }
    
    // Cek lebih lanjut - apakah ada kolom 'Unnamed' yang banyak
    // Ini karakteristik file Data_PMB_Compare.csv yang memiliki banyak kolom tanpa nama
    const unnamedColumns = headers.filter(h => h && h.includes && h.includes('Unnamed'));
    if (unnamedColumns.length > 10) {
        console.log("Format Data_PMB_Compare terdeteksi (berdasarkan kolom Unnamed)");
        return 'raw_pmb';
    }
    
    // Format lain tidak dikenali
    console.log("Format tidak dikenali");
    return 'unknown';
}

// Fungsi pemrosesan file csv yang diupload
function processFile() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Silakan pilih file CSV terlebih dahulu.');
        return;
    }
    
    // Tampilkan indikator loading
    const uploadSection = document.getElementById('upload-section');
    uploadSection.classList.add('loading');
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `
        <div class="loading-spinner"></div>
        <p>Memproses file...</p>
    `;
    uploadSection.appendChild(loadingOverlay);
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const contents = e.target.result;
        
        // Log informasi tentang konten file
        console.log("File loaded, size:", contents.length, "bytes");
        console.log("First 200 characters:", contents.substring(0, 200));
        
        // Gunakan PapaParse dengan opsi yang lebih kuat
        Papa.parse(contents, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            delimiter: '', // auto-detect
            delimitersToGuess: [',', '\t', '|', ';'],
            complete: function(results) {
                console.log("PapaParse results:", results);
                
                if (results.errors && results.errors.length > 0) {
                    console.error("CSV parsing errors:", results.errors);
                    alert(`Error parsing CSV: ${results.errors[0].message}`);
                    removeLoadingIndicator();
                    return;
                }
                
                const headers = results.meta.fields || [];
                console.log("Detected headers:", headers);
                
                // Deteksi format file
                const format = detectCSVFormat(results.data, headers);
                console.log("Detected format:", format);
                
                let processedData;
                
                switch (format) {
                    case 'standard':
    processedData = results.data.filter(row => {
        return row.Campus && 
              !isNaN(row.Year) && 
              (!isNaN(row.Applicants) || !isNaN(row.Enrollments)) && 
              row.Type;
    });
    
    // Konversi Enrollments ke Applicants jika diperlukan
    processedData = processedData.map(row => {
        if (row.Enrollments && !row.Applicants) {
            row.Applicants = row.Enrollments;
        }
        return row;
    });
    break;
                        
                    case 'raw_pmb':
                        try {
                            processedData = processRawPMBData(results.data, headers);
                        } catch (error) {
                            console.error("Error processing raw PMB data:", error);
                            alert(`Error saat memproses data mentah: ${error.message}. Lihat console untuk detail.`);
                            removeLoadingIndicator();
                            return;
                        }
                        break;
                        
                    default:
                        alert(`Format CSV tidak dikenali. Pastikan file berisi kolom yang diperlukan. 
                        File memiliki kolom berikut: ${headers.slice(0, 5).join(', ')}... dari total ${headers.length} kolom.`);
                        removeLoadingIndicator();
                        return;
                }
                
                if (!processedData || processedData.length === 0) {
                    alert('Tidak ada data valid yang ditemukan dalam file.');
                    removeLoadingIndicator();
                    return;
                }
                
                console.log(`Data berhasil diproses: ${processedData.length} baris`);
                console.log("Sample processed data:", processedData.slice(0, 3));
                
                // Update campus dropdown
                updateCampusDropdown(processedData);
                
                // Store data and update
                csvData = processedData;
                fileUploaded = true;
                
                // Update prediction
                updatePrediction();
                
                // Tampilkan notifikasi sukses
                alert(`Berhasil memproses ${processedData.length} data dari format ${format === 'standard' ? 'standar' : 'mentah'}.`);
                
                // Hapus indikator loading
                removeLoadingIndicator();
            },
            error: function(error) {
                console.error("Error reading file:", error);
                alert(`Error reading file: ${error}`);
                removeLoadingIndicator();
            }
        });
    };
    
    reader.onerror = function(error) {
        console.error("FileReader error:", error);
        alert('Terjadi kesalahan saat membaca file.');
        removeLoadingIndicator();
    };
    
    reader.readAsText(file);
}

// Fungsi yang lebih kuat untuk memproses data mentah
function processRawPMBData(parsedData, headers) {
    console.log("Memproses data mentah format Data_PMB_Compare...");
    
    // Pastikan parsedData adalah array dan tidak kosong
    if (!Array.isArray(parsedData) || parsedData.length === 0) {
        throw new Error("Data tidak valid atau kosong");
    }
    
    const result = [];
    const campusPatterns = [
        { pattern: /TELU(?!\s+(?:PWT|SBY|JKT))/i, name: "TELU" },
        { pattern: /TELU\s+PWT/i, name: "TELU PWT" },
        { pattern: /TELU\s+SBY/i, name: "TELU SBY" },
        { pattern: /TELU\s+JKT/i, name: "TELU JKT" }
    ];
    
    // Debug - Tampilkan beberapa baris pertama data untuk analisa
    console.log("Sample data rows:", parsedData.slice(0, 3));
    
    // Cari kolom-kolom yang penting
    let pendaftarIndex = -1; // Untuk kolom PENDAFTAR
    let trendYoYIndex = -1;  // Untuk kolom Trend YoY Pendaftar
    
    // Kita akan mencari berbagai kemungkinan nama kolom
    headers.forEach((header, index) => {
        if (!header) return; // Skip undefined atau null
        
        const headerStr = String(header).toUpperCase();
        if (headerStr === 'PENDAFTAR') {
            pendaftarIndex = index;
            console.log("Kolom PENDAFTAR ditemukan pada indeks", index);
        }
        
        if (headerStr.includes('TREND') && headerStr.includes('YOY') && headerStr.includes('PENDAFTAR')) {
            trendYoYIndex = index;
            console.log("Kolom Trend YoY Pendaftar ditemukan pada indeks", index);
        }
    });
    
    // Jika tidak menemukan kolom yang diharapkan, coba pendekatan berbeda
    if (pendaftarIndex === -1 && trendYoYIndex === -1) {
        // Coba cari berdasarkan posisi kolom (Data_PMB_Compare biasanya memiliki pola tertentu)
        pendaftarIndex = 0; // Biasanya kolom pertama
        trendYoYIndex = 60; // Biasanya di sekitar kolom ke-60
        
        console.log("Menggunakan indeks default: PENDAFTAR=0, Trend YoY Pendaftar=60");
    }
    
    const mainIndex = pendaftarIndex !== -1 ? pendaftarIndex : trendYoYIndex;
    if (mainIndex === -1) {
        throw new Error("Tidak dapat menemukan kolom yang berisi data pendaftar");
    }
    
    // Tahun yang akan diproses
    const actualYears = [2021, 2022, 2023, 2024];
    const predictedYears = [2025, 2026, 2027, 2028, 2029, 2030];
    
    // Cari kolom untuk setiap tahun - berdasarkan posisi relatif
    // Asumsi: Jika Trend YoY Pendaftar di kolom 60, maka tahun-tahun berikutnya di 61, 62, dst
    // Jika PENDAFTAR di kolom 0, tahun mungkin di berbagai posisi - coba deteksi
    
    const yearColumns = {};
    
    // Jika kita memiliki trendYoYIndex, maka lebih mudah memetakan kolom tahun
    if (trendYoYIndex !== -1) {
        actualYears.forEach((year, idx) => {
            yearColumns[year] = String(headers[trendYoYIndex + idx + 1]);
            console.log(`Memetakan tahun ${year} ke kolom ${yearColumns[year]}`);
        });
    } else {
        // Coba deteksi berdasarkan konten headers
        headers.forEach((header, idx) => {
            if (!header) return;
            
            // Cek apakah header berisi tahun (2021-2030)
            const yearMatch = String(header).match(/20(2[1-9]|30)/);
            if (yearMatch) {
                const year = parseInt(yearMatch[0]);
                yearColumns[year] = String(header);
                console.log(`Tahun ${year} terdeteksi di kolom ${header}`);
            }
        });
        
        // Jika masih belum menemukan kolom tahun, gunakan pendekatan default
        if (Object.keys(yearColumns).length === 0) {
            // Asumsi: tahun 2021-2024 berada di kolom 1-4 setelah PENDAFTAR
            actualYears.forEach((year, idx) => {
                yearColumns[year] = String(headers[mainIndex + idx + 1] || `Unnamed: ${mainIndex + idx + 1}`);
                console.log(`Default mapping: tahun ${year} ke kolom ${yearColumns[year]}`);
            });
        }
    }
    
    // Mencari data untuk setiap kampus
    let campusCount = 0;
    let dataPoints = 0;
    
    campusPatterns.forEach(campusInfo => {
        console.log(`Mencari data untuk kampus ${campusInfo.name}...`);
        
        // Cari baris yang berisi nama kampus
        parsedData.forEach((row, rowIndex) => {
            // Dapatkan nilai dari kolom PENDAFTAR atau Trend YoY Pendaftar
            let pendaftarValue = '';
            
            // Coba ambil nilai menggunakan nama kolom atau indeks
            if (mainIndex !== -1) {
                const mainColumn = String(headers[mainIndex]);
                pendaftarValue = row[mainColumn] || '';
            }
            
            // Jika masih kosong, coba cara alternatif
            if (!pendaftarValue) {
                // Coba akses langsung melalui array
                const values = Object.values(row);
                pendaftarValue = values[mainIndex] || '';
            }
            
            // Convert to string to ensure pattern matching works
            pendaftarValue = String(pendaftarValue);
            
            // Debug
            if (rowIndex < 10) {
                console.log(`Row ${rowIndex}, Column ${mainIndex}, Value: "${pendaftarValue}"`);
            }
            
            if (pendaftarValue && campusInfo.pattern.test(pendaftarValue)) {
                console.log(`Menemukan ${campusInfo.name} di baris ${rowIndex}`);
                campusCount++;
                
                // Untuk tahun aktual
                actualYears.forEach(year => {
                    const columnKey = yearColumns[year];
                    if (columnKey) {
                        // Coba dapatkan nilai menggunakan nama kolom
                        let value = row[columnKey];
                        
                        // Jika tidak berhasil, coba cara alternatif
                        if (value === undefined || value === null) {
                            // Fallback ke akses indeks
                            const columnIndex = headers.indexOf(columnKey);
                            if (columnIndex !== -1) {
                                const values = Object.values(row);
                                value = values[columnIndex];
                            }
                        }
                        
                        // Pastikan nilai adalah numerik - bersihkan dari karakter non-numerik
                        if (value !== undefined && value !== null) {
                            // Jika string, bersihkan format
                            if (typeof value === 'string') {
                                value = value.replace(/[^\d.-]/g, '');
                            }
                            
                            const numValue = parseFloat(value);
                            
                            if (!isNaN(numValue)) {
                                console.log(`${campusInfo.name}, ${year}: ${numValue}`);
                                result.push({
                                    Campus: campusInfo.name,
                                    Year: year,
                                    Applicants: Math.round(numValue),
                                    Type: "Actual"
                                });
                                dataPoints++;
                            }
                        }
                    }
                });
                
                // Buat prediksi hanya jika kita sudah memproses beberapa data aktual
                const campusActualData = result.filter(item => 
                    item.Campus === campusInfo.name && item.Type === "Actual");
                
                if (campusActualData.length > 0) {
                    // Cari data aktual terakhir
                    campusActualData.sort((a, b) => b.Year - a.Year);
                    const lastActualData = campusActualData[0];
                    
                    // Hitung tingkat pertumbuhan dari data aktual
                    let growthRate = 0.06; // Default 6%
                    
                    if (campusActualData.length > 1) {
                        // Jika ada lebih dari 1 data aktual, hitung average growth rate
                        campusActualData.sort((a, b) => a.Year - b.Year);
                        let totalGrowth = 0;
                        let growthPoints = 0;
                        
                        for (let i = 1; i < campusActualData.length; i++) {
                            const prevItem = campusActualData[i-1];
                            const currItem = campusActualData[i];
                            
                            if (prevItem.Applicants > 0) {
                                const yearGrowth = (currItem.Applicants - prevItem.Applicants) / prevItem.Applicants;
                                console.log(`Growth ${prevItem.Year}-${currItem.Year}: ${(yearGrowth * 100).toFixed(2)}%`);
                                totalGrowth += yearGrowth;
                                growthPoints++;
                            }
                        }
                        
                        if (growthPoints > 0) {
                            growthRate = totalGrowth / growthPoints;
                            console.log(`Average growth rate: ${(growthRate * 100).toFixed(2)}%`);
                        }
                    }
                    
                    // Buat prediksi untuk tahun-tahun berikutnya
                    predictedYears.forEach(year => {
                        const yearsSinceLastActual = year - lastActualData.Year;
                        const predictedValue = Math.round(
                            lastActualData.Applicants * Math.pow(1 + growthRate, yearsSinceLastActual)
                        );
                        
                        console.log(`Prediksi ${campusInfo.name}, ${year}: ${predictedValue}`);
                        result.push({
                            Campus: campusInfo.name,
                            Year: year,
                            Applicants: predictedValue,
                            Type: "Predicted"
                        });
                        dataPoints++;
                    });
                }
            }
        });
    });
    
    console.log(`Berhasil memproses ${dataPoints} data pendaftar dari ${campusCount} kampus`);
    
    if (result.length === 0) {
        throw new Error("Tidak dapat menemukan data pendaftar yang valid. Periksa format file Anda.");
    }
    
    return result;
}
// Fungsi utama untuk memproses file CSV yang diupload
function processCSVData(contents) {
    return new Promise((resolve, reject) => {
        Papa.parse(contents, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: function(results) {
                if (results.errors.length > 0) {
                    reject(`Error parsing CSV: ${results.errors[0].message}`);
                    return;
                }
                
                const headers = results.meta.fields || [];
                const format = detectCSVFormat(results.data, headers);
                
                let processedData;
                
                switch (format) {
                    case 'standard':
    processedData = results.data.filter(row => {
        return row.Campus && 
              !isNaN(row.Year) && 
              (!isNaN(row.Applicants) || !isNaN(row.Enrollments)) && 
              row.Type;
    });
    
    // Konversi Enrollments ke Applicants jika diperlukan
    processedData = processedData.map(row => {
        if (row.Enrollments && !row.Applicants) {
            row.Applicants = row.Enrollments;
        }
        return row;
    });
    break;
                        
                    case 'raw_pmb':
                        processedData = processRawPMBData(results.data, headers);
                        break;
                        
                    default:
                        reject('Format CSV tidak dikenali. Pastikan file berisi kolom yang diperlukan.');
                        return;
                }
                
                if (processedData.length === 0) {
                    reject('Tidak ada data valid yang ditemukan dalam file.');
                    return;
                }
                
                console.log(`Data berhasil diproses: ${processedData.length} baris`);
                resolve(processedData);
            },
            error: function(error) {
                reject(`Error reading file: ${error}`);
            }
        });
    });
}

// Update campus dropdown based on data
function updateCampusDropdown(data) {
    const campuses = ['all', ...new Set(data.map(item => item.Campus))];
    const select = document.getElementById('campus-select');
    
    select.innerHTML = '';
    
    campuses.forEach(campus => {
        const option = document.createElement('option');
        option.value = campus;
        option.textContent = campus === 'all' ? 'Semua Kampus' : campus;
        select.appendChild(option);
    });
}

// Use sample data
function generateSampleData() {
    csvData = [...sampleData];
    fileUploaded = true;
    updateCampusDropdown(csvData);
    updatePrediction();
}

// Show no data message
function showNoDataMessage() {
    document.getElementById('chart-container').innerHTML = `
        <div style="height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
            <p style="font-size: 18px; color: #888;">Tidak ada data yang ditampilkan</p>
            <p style="color: #888;">Upload file CSV atau gunakan data contoh untuk memulai</p>
        </div>
    `;
    
    // Clear stats
    document.getElementById('stat-average').textContent = '0';
    document.getElementById('stat-growth').textContent = '0%';
    document.getElementById('stat-max').textContent = '0';
    document.getElementById('max-year').textContent = '';
    document.getElementById('stat-prediction').textContent = '0';
    
    // Clear table
    document.getElementById('table-body').innerHTML = '';
}

// Model selection function
function selectModel(model) {
    // Update active class
    document.getElementById('model-pendaftar').classList.remove('active');
    document.getElementById('model-up3').classList.remove('active');
    document.getElementById('model-' + model).classList.add('active');
    
    // Update current model
    currentModel = model;
    
    // Update model description
    if (model === 'pendaftar') {
        document.getElementById('model-description').textContent = 'Model AI Trend Pendaftar menggunakan data historis untuk memproyeksikan jumlah pendaftar di masa depan berdasarkan pola pertumbuhan yang terlihat dalam data aktual.';
    } else {
        document.getElementById('model-description').textContent = 'Model AI Trend UP3 menggunakan algoritma yang lebih agresif dengan mempertimbangkan faktor pertumbuhan yang lebih tinggi berdasarkan strategi pengembangan universitas.';
    }
    
    // Update prediction
    updatePrediction();
}

// Update prediction based on selected model and campus
function updatePrediction() {
    // Check if data is loaded
    if (!fileUploaded || csvData.length === 0) {
        showNoDataMessage();
        return;
    }
    
    // Get selected campus
    currentCampus = document.getElementById('campus-select').value;
    
    // Update campus title
    document.getElementById('campus-title').textContent = currentCampus === 'all' ? 'Semua Kampus' : currentCampus;
    
    // Filter data based on campus
    let filteredData = [...csvData];
    if (currentCampus !== 'all') {
        filteredData = filteredData.filter(item => item.Campus === currentCampus);
    } else {
        // Aggregate data by year for all campuses
        const yearData = {};
        csvData.forEach(item => {
            if (!yearData[item.Year]) {
                yearData[item.Year] = { 
                    Year: item.Year, 
                    Applicants: 0, 
                    Type: item.Type 
                };
            }
            yearData[item.Year].Applicants += item.Applicants;
        });
        filteredData = Object.values(yearData);
    }
    
    // Sort by year
    filteredData.sort((a, b) => a.Year - b.Year);
    
    // Process data for UP3 model if selected
    let processedData = [];
    if (currentModel === 'up3') {
        const actualData = filteredData.filter(item => item.Type === 'Actual');
        
        // Calculate average growth rate for actual data
        let growthRate = 0;
        if (actualData.length > 1) {
            let totalGrowth = 0;
            for (let i = 1; i < actualData.length; i++) {
                const prevYear = actualData[i-1];
                const currYear = actualData[i];
                if (prevYear.Applicants > 0) {
                    totalGrowth += (currYear.Applicants - prevYear.Applicants) / prevYear.Applicants;
                }
            }
            growthRate = totalGrowth / (actualData.length - 1);
        }
        
        // Apply UP3 model multiplier (15% higher growth rate for demonstration)
        const up3Multiplier = 1.15;
        const up3GrowthRate = growthRate * up3Multiplier;
        
        // Generate predictions using the UP3 model
        const lastActualYear = Math.max(...actualData.map(item => item.Year));
        const lastActualData = actualData.find(item => item.Year === lastActualYear);
        
        const predictedYears = Array.from({length: 6}, (_, i) => lastActualYear + i + 1);
        const up3Predictions = [];
        
        let baseValue = lastActualData ? lastActualData.Applicants : 0;
        
        predictedYears.forEach(year => {
            const yearsSinceLastActual = year - lastActualYear;
            // Compound growth formula: A = P(1 + r)^t
            const predictedValue = Math.round(baseValue * Math.pow(1 + up3GrowthRate, yearsSinceLastActual));
            
            up3Predictions.push({
                Year: year,
                Applicants: predictedValue,
                Type: 'Predicted'
            });
        });
        
        processedData = [...actualData, ...up3Predictions];
    } else {
        processedData = filteredData;
    }
    
    // Calculate statistics
    const actualData = processedData.filter(item => item.Type === 'Actual');
    const averageApplicants = processedData.reduce((sum, item) => sum + item.Applicants, 0) / processedData.length;
    
    // Calculate growth rate
    let growthRate = 0;
    if (actualData.length > 1) {
        let totalGrowth = 0;
        for (let i = 1; i < actualData.length; i++) {
            const prevYear = actualData[i-1];
            const currYear = actualData[i];
            if (prevYear.Applicants > 0) {
                totalGrowth += (currYear.Applicants - prevYear.Applicants) / prevYear.Applicants;
            }
        }
        growthRate = totalGrowth / (actualData.length - 1);
    }
    
    const maxData = processedData.reduce((max, item) => (item.Applicants > max.value ? { year: item.Year, value: item.Applicants } : max), { year: null, value: 0 });
    const prediction2030 = processedData.find(item => item.Year === 2030)?.Applicants || 0;
    
    // Update stats
    document.getElementById('stat-average').textContent = Math.round(averageApplicants).toLocaleString();
    document.getElementById('stat-growth').textContent = (growthRate * 100).toFixed(2) + '%';
    document.getElementById('stat-max').textContent = maxData.value.toLocaleString();
    document.getElementById('max-year').textContent = `(${maxData.year})`;
    document.getElementById('stat-prediction').textContent = prediction2030.toLocaleString();
    
    // Update table
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';
    
    processedData.forEach(item => {
        const row = document.createElement('tr');
        row.className = item.Type === 'Actual' ? 'actual-row' : 'predicted-row';
        
        row.innerHTML = `
            <td>${item.Year}</td>
            <td>${item.Applicants.toLocaleString()}</td>
            <td>
                ${item.Type === 'Actual' 
                    ? '<span style="padding: 5px 10px; background-color: #2ecc71; color: white; border-radius: 20px; font-size: 0.8em;">Aktual</span>' 
                    : '<span style="padding: 5px 10px; background-color: #e74c3c; color: white; border-radius: 20px; font-size: 0.8em;">Prediksi</span>'
                }
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Update chart
    updateChart(processedData);
}

// Create or update the chart
function updateChart(data) {
    const years = data.map(item => item.Year);
    const applicants = data.map(item => item.Applicants);
    const types = data.map(item => item.Type);
    
    // Create background colors array based on type
    const backgroundColor = types.map(type => 
        type === 'Actual' ? 'rgba(46, 204, 113, 0.8)' : 'rgba(231, 76, 60, 0.8)'
    );
    
    // Create border colors array based on type
    const borderColor = types.map(type => 
        type === 'Actual' ? 'rgba(39, 174, 96, 1)' : 'rgba(192, 57, 43, 1)'
    );
    
    // Define point styles based on type
    const pointStyle = types.map(type => 
        type === 'Actual' ? 'circle' : 'triangle'
    );
    
    // Define point radius based on type
    const pointRadius = types.map(type => 
        type === 'Actual' ? 6 : 4
    );
    
    // Create dataset
    const dataset = {
        label: currentModel === 'pendaftar' ? 'Pendaftar' : 'Pendaftar (Model UP3)',
        data: applicants,
        borderColor: 'rgb(255, 0, 0)',
        backgroundColor: 'rgba(255, 0, 0, 0.1)',
        fill: false,
        tension: 0.1,
        borderWidth: 2,
        pointBackgroundColor: backgroundColor,
        pointBorderColor: borderColor,
        pointStyle: pointStyle,
        pointRadius: pointRadius,
        pointHoverRadius: 8
    };
    
    // Destroy previous chart if exists
    if (chart) {
        chart.destroy();
    }
    
    // Create new chart
    const ctx = document.createElement('canvas');
    document.getElementById('chart-container').innerHTML = '';
    document.getElementById('chart-container').appendChild(ctx);
    
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [dataset]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Jumlah Pendaftar'
                    },
                    grid: {
                        color: 'rgba(200, 200, 200, 0.2)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Tahun'
                    },
                    grid: {
                        color: 'rgba(200, 200, 200, 0.2)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const type = types[context.dataIndex];
                            return `${currentModel === 'pendaftar' ? 'Pendaftar' : 'Pendaftar (UP3)'} (${type}): ${context.parsed.y.toLocaleString()}`;
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            animations: {
                tension: {
                    duration: 1000,
                    easing: 'linear'
                }
            }
        }
    });
}

// Tambahkan fitur ekspor hasil ke CSV
function exportToCSV() {
    if (!fileUploaded || csvData.length === 0) {
        alert('Tidak ada data untuk diekspor. Harap upload file atau gunakan data contoh terlebih dahulu.');
        return;
    }
    
    // Get data based on current selection
    let dataToExport = [...csvData];
    
    // Filter by campus if needed
    if (currentCampus !== 'all') {
        dataToExport = dataToExport.filter(item => item.Campus === currentCampus);
    }
    
    // Sort by campus and year
    dataToExport.sort((a, b) => {
        if (a.Campus === b.Campus) {
            return a.Year - b.Year;
        }
        return a.Campus.localeCompare(b.Campus);
    });
    
    // Convert to CSV
    let csvContent = "Campus,Year,Applicants,Type\n";
    
    dataToExport.forEach(item => {
        csvContent += `${item.Campus},${item.Year},${item.Applicants},${item.Type}\n`;
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'TrendYoY_Pendaftar_Exported.csv');
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
