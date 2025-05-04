// Konfigurasi API
const API_BASE_URL = 'http://localhost:8000'; // Ganti dengan URL server FastAPI Anda

// Data storage
let rawData = null;
let pendaftarData = null;
let up3Data = null;
let predictionData = null;

// DOM Elements
document.addEventListener('DOMContentLoaded', function() {
    // Check if required libraries are loaded
    checkRequiredLibraries();
    
    // Initialize elements
    initializeElements();
    
    // Check API status on load
    checkModelStatus();
});

// Check and load required libraries
function checkRequiredLibraries() {
    // PapaParse for CSV processing
    if (typeof Papa === 'undefined') {
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/papaparse/5.3.2/papaparse.min.js');
    }
    
    // FileSaver for downloading files
    if (typeof saveAs === 'undefined') {
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js');
    }
    
    // JSZip for creating ZIP archives
    if (typeof JSZip === 'undefined') {
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    }
}

// Load external scripts
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Initialize all DOM elements and event listeners
function initializeElements() {
    // Buttons
    const processBtn = document.getElementById('process-btn');
    const resetBtn = document.getElementById('reset-btn');
    const exportPendaftarBtn = document.getElementById('export-pendaftar-btn');
    const exportUp3Btn = document.getElementById('export-up3-btn');
    const exportCombinedBtn = document.getElementById('export-combined-btn');
    const predictBtn = document.getElementById('predict-btn');
    const exportPredictionBtn = document.getElementById('export-prediction-btn');
    const refreshStatusBtn = document.getElementById('refresh-status-btn');
    
    // Event Listeners
    processBtn.addEventListener('click', processData);
    resetBtn.addEventListener('click', resetAll);
    exportPendaftarBtn.addEventListener('click', exportPendaftarData);
    exportUp3Btn.addEventListener('click', exportUp3Data);
    exportCombinedBtn.addEventListener('click', exportCombinedData);
    predictBtn.addEventListener('click', predictWithModel);
    exportPredictionBtn.addEventListener('click', exportPredictionData);
    refreshStatusBtn.addEventListener('click', checkModelStatus);
}

// Check API and model status
async function checkModelStatus() {
    setLoading(document.getElementById('refresh-status-btn'), true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/status-compare`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        updateStatusUI(data);
        
        return data;
    } catch (error) {
        showAPIError(error);
        return null;
    } finally {
        setLoading(document.getElementById('refresh-status-btn'), false);
    }
}

// Update Status UI
function updateStatusUI(status) {
    const statusContent = document.getElementById('model-status-content');
    
    if (!status) {
        statusContent.innerHTML = `
            <div class="alert alert-danger">
                <strong>Error:</strong> Tidak dapat terhubung ke API Model AI.
                <p>Pastikan server FastAPI berjalan di ${API_BASE_URL}</p>
            </div>
        `;
        return;
    }
    
    const isReady = status.app_info.status === 'ready';
    const pendaftarModelLoaded = status.model_predikTEL_U?.loaded;
    const up3ModelLoaded = status.model_predikYoY?.loaded;
    
    statusContent.innerHTML = `
        <div class="api-status ${isReady ? 'bg-success bg-opacity-10' : 'bg-danger bg-opacity-10'}">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h5 class="mb-1">
                        <span class="status-badge ${isReady ? 'status-active' : 'status-inactive'}"></span>
                        API: ${isReady ? 'Aktif' : 'Tidak Aktif'}
                    </h5>
                    <p class="mb-0 small">Versi: ${status.app_info.version}</p>
                </div>
                <div>
                    <span class="badge bg-${isReady ? 'success' : 'danger'} rounded-pill">
                        ${isReady ? 'ONLINE' : 'OFFLINE'}
                    </span>
                </div>
            </div>
        </div>
        
        <div class="table-responsive mt-3">
            <table class="table table-sm table-bordered">
                <thead class="table-light">
                    <tr>
                        <th>Model</th>
                        <th>Status</th>
                        <th>Info</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Model Pendaftar</td>
                        <td>
                            <span class="status-badge ${pendaftarModelLoaded ? 'status-active' : 'status-inactive'}"></span>
                            ${pendaftarModelLoaded ? 'Aktif' : 'Tidak Aktif'}
                        </td>
                        <td>${status.model_predikTEL_U?.name || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td>Model UP3</td>
                        <td>
                            <span class="status-badge ${up3ModelLoaded ? 'status-active' : 'status-inactive'}"></span>
                            ${up3ModelLoaded ? 'Aktif' : 'Tidak Aktif'}
                        </td>
                        <td>${status.model_predikYoY?.name || 'N/A'}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
    
    // Update predict button state based on API status
    const predictBtn = document.getElementById('predict-btn');
    predictBtn.disabled = !isReady || !pendaftarModelLoaded;
}

// Show API Error
function showAPIError(error) {
    const statusContent = document.getElementById('model-status-content');
    
    statusContent.innerHTML = `
        <div class="alert alert-danger">
            <strong>Error:</strong> Tidak dapat terhubung ke API Model AI.
            <p>${error.message}</p>
            <p>Pastikan server FastAPI berjalan di ${API_BASE_URL}</p>
        </div>
    `;
}

// Process Data from CSV
async function processData() {
    const fileInput = document.getElementById('file');
    const processBtn = document.getElementById('process-btn');
    
    // Validate file input
    if (!fileInput.files || fileInput.files.length === 0) {
        showError('Silakan pilih file CSV terlebih dahulu.');
        return;
    }
    
    const file = fileInput.files[0];
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showError('File harus berformat CSV.');
        return;
    }
    
    // Show loading state
    setLoading(processBtn, true);
    
    try {
        // Read file content
        const fileContent = await readFileAsText(file);
        
        // Parse CSV
        const parseResult = Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
            transformHeader: header => header.trim()
        });
        
        // Store raw data
        rawData = parseResult.data;
        
        if (rawData.length === 0) {
            throw new Error('File CSV tidak memiliki data yang valid.');
        }
        
        // Show preview of raw data
        showRawDataPreview(rawData);
        
        // Extract and transform data
        await extractDataFromRaw();
        
        // Show success message
        showSuccess(`Data berhasil diproses. ${pendaftarData?.length || 0} data pendaftar dan ${up3Data?.length || 0} data UP3 ditemukan.`);
        
        // Enable export buttons
        enableExportButtons();
        
        // Check if predict button should be enabled
        const modelStatus = await checkModelStatus();
        if (modelStatus && modelStatus.app_info.status === 'ready' && modelStatus.model_predikTEL_U?.loaded) {
            document.getElementById('predict-btn').disabled = false;
        }
        
    } catch (error) {
        showError(`Terjadi kesalahan: ${error.message}`);
    } finally {
        setLoading(processBtn, false);
    }
}

// Extract and transform data from raw CSV
async function extractDataFromRaw() {
    try {
        // Check if raw data exists
        if (!rawData || rawData.length === 0) {
            throw new Error('Tidak ada data mentah untuk diproses.');
        }
        
        // Extract campuses (rows)
        const campuses = extractCampusNames(rawData);
        
        // Extract years (columns)
        const years = extractYears(rawData);
        
        if (campuses.length === 0 || years.length === 0) {
            throw new Error('Tidak dapat mengekstrak kampus atau tahun dari data.');
        }
        
        // Create Pendaftar data
        pendaftarData = extractCategoryData(rawData, campuses, years, 'Trend YoY Pendaftar', 'Applicants');
        
        // Create UP3 data
        up3Data = extractCategoryData(rawData, campuses, years, 'Trend YoY Reg UP3', 'Enrollments');
        
        // Show previews
        showDataPreview('pendaftar-preview', pendaftarData, 'Data Pendaftar');
        showDataPreview('up3-preview', up3Data, 'Data UP3');
        
        return true;
    } catch (error) {
        console.error('Error extracting data:', error);
        showError(`Gagal mengekstrak data: ${error.message}`);
        return false;
    }
}

// Extract campus names from raw data
function extractCampusNames(data) {
    const campuses = [];
    
    // Try different possible column names for campus
    const possibleColumns = ['PENDAFTAR', 'Unnamed: 1', 'Kampus', 'Campus'];
    
    data.forEach(row => {
        for (const col of possibleColumns) {
            if (row[col] && typeof row[col] === 'string') {
                const campus = row[col].trim();
                // Exclude headers, totals, and empty values
                if (campus && 
                    !campus.toLowerCase().includes('total') && 
                    !campus.toLowerCase().includes('pendaftar') &&
                    !campus.toLowerCase().includes('kampus') &&
                    !campus.toLowerCase().includes('campus') &&
                    !campuses.includes(campus)) {
                    campuses.push(campus);
                }
            }
        }
    });
    
    return campuses;
}

// Extract years from column headers
function extractYears(data) {
    if (!data || data.length === 0) return [];
    
    const years = [];
    const yearRegex = /\b20\d{2}\b/; // Match years like 2018, 2019, etc.
    
    // Get all headers
    const firstRow = data[0];
    if (!firstRow) return [];
    
    Object.keys(firstRow).forEach(key => {
        const match = key.match(yearRegex);
        if (match && !years.includes(match[0])) {
            years.push(match[0]);
        }
    });
    
    // Sort years
    years.sort();
    
    return years;
}

// Extract data for a specific category (Pendaftar or UP3)
function extractCategoryData(data, campuses, years, categoryName, valueFieldName) {
    const result = [];
    
    // Find columns that contain the category
    const categoryColumns = findColumnsWithCategory(data, categoryName);
    
    if (categoryColumns.length === 0) {
        console.warn(`Tidak ditemukan kolom untuk kategori: ${categoryName}`);
        return result;
    }
    
    // Process each campus
    campuses.forEach(campus => {
        // Process each year
        years.forEach(year => {
            // Find the value for this campus and year
            let foundValue = null;
            
            // Look through all rows to find matching campus
            data.forEach(row => {
                // Check if this row contains the campus
                if (isCampusRow(row, campus)) {
                    // Find column that matches the year and category
                    const yearColumn = findYearColumn(row, year, categoryColumns);
                    
                    if (yearColumn && row[yearColumn]) {
                        // Extract numeric value
                        foundValue = extractNumericValue(row[yearColumn]);
                    }
                }
            });
            
            // Add to result if value found
            if (foundValue !== null) {
                result.push({
                    Campus: campus,
                    Year: parseInt(year, 10),
                    [valueFieldName]: foundValue,
                    Type: "Actual" // Set all as "Actual" type
                });
            }
        });
    });
    
    return result;
}

// Check if a row is for a specific campus
function isCampusRow(row, campus) {
    // Check common campus column names
    const campusColumns = ['PENDAFTAR', 'Unnamed: 1', 'Kampus', 'Campus'];
    
    for (const col of campusColumns) {
        if (row[col] && row[col].trim() === campus) {
            return true;
        }
    }
    
    return false;
}

// Find column that matches year and is in category columns
function findYearColumn(row, year, categoryColumns) {
    for (const col of categoryColumns) {
        if (col.includes(year)) {
            return col;
        }
    }
    return null;
}

// Extract numeric value from string (remove non-digits)
function extractNumericValue(valueStr) {
    if (!valueStr) return null;
    
    // Handle if already a number
    if (typeof valueStr === 'number') return valueStr;
    
    // Extract digits from string
    const numStr = valueStr.toString().replace(/\D/g, '');
    
    return numStr ? parseInt(numStr, 10) : null;
}

// Find columns related to a specific category
function findColumnsWithCategory(data, category) {
    const columns = [];
    
    // Check if data exists
    if (!data || data.length === 0 || !data[0]) {
        return columns;
    }
    
    // Get all available column names
    const allColumns = Object.keys(data[0]);
    
    // 1. Check if category is an exact column name
    if (allColumns.includes(category)) {
        // Find column index
        const categoryIndex = allColumns.indexOf(category);
        
        // Add subsequent columns until another main category is found
        for (let i = categoryIndex + 1; i < allColumns.length; i++) {
            const col = allColumns[i];
            
            // Stop if we hit another main category
            if (isMainCategory(col)) {
                break;
            }
            
            columns.push(col);
        }
    }
    
    // 2. Check if category is contained in any column name
    allColumns.forEach(col => {
        if (col.includes(category)) {
            columns.push(col);
        }
    });
    
    // 3. If still not found, look for year columns after the category row
    if (columns.length === 0) {
        // Find row with category
        const categoryRow = data.find(row => {
            return Object.values(row).some(value => 
                value && typeof value === 'string' && value.includes(category)
            );
        });
        
        if (categoryRow) {
            // Find year columns
            allColumns.forEach(col => {
                if (/\b20\d{2}\b/.test(col)) {
                    columns.push(col);
                }
            });
        }
    }
    
    return columns;
}

// Check if a column name is a main category header
function isMainCategory(columnName) {
    const mainCategories = [
        'PENDAFTAR', 'REGISTRASI', 'KELULUSAN', 'UNDUR DIRI',
        'Trend YoY Pendaftar', 'Trend YoY Reg UP3'
    ];
    
    return mainCategories.some(category => 
        columnName && columnName.includes(category)
    );
}

// Show raw data preview
function showRawDataPreview(data) {
    if (!data || data.length === 0) {
        document.getElementById('raw-preview').innerHTML = '<p class="text-muted">Tidak ada data mentah.</p>';
        return;
    }
    
    // Get a subset of columns for cleaner display
    const sample = data.slice(0, 10);
    
    // Find important columns
    const firstRow = data[0];
    const allColumns = Object.keys(firstRow);
    const importantColumns = allColumns.filter(col => {
        return col === 'PENDAFTAR' || 
               col === 'Unnamed: 1' || 
               col.includes('Trend YoY') || 
               /\b20\d{2}\b/.test(col);
    });
    
    // Use only important columns if there are too many
    const columnsToShow = allColumns.length > 10 ? importantColumns : allColumns;
    
    // Create table HTML
    let tableHtml = `
        <div class="table-responsive">
            <table class="table table-sm table-bordered table-striped">
                <thead class="table-light">
                    <tr>
                        ${columnsToShow.map(col => `<th>${col}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Add rows
    sample.forEach(row => {
        tableHtml += '<tr>';
        columnsToShow.forEach(col => {
            tableHtml += `<td>${row[col] || ''}</td>`;
        });
        tableHtml += '</tr>';
    });
    
    tableHtml += `
                </tbody>
            </table>
        </div>
        <p class="text-muted small">Menampilkan ${sample.length} dari ${data.length} baris data mentah.</p>
    `;
    
    document.getElementById('raw-preview').innerHTML = tableHtml;
}

// Show data preview (Pendaftar or UP3)
function showDataPreview(containerId, data, title) {
    const container = document.getElementById(containerId);
    
    if (!data || data.length === 0) {
        container.innerHTML = `<p class="text-muted">Tidak ada ${title.toLowerCase()} yang diproses.</p>`;
        return;
    }
    
    // Get columns
    const columns = Object.keys(data[0]);
    
    // Create table HTML
    let tableHtml = `
        <div class="alert alert-success py-2">
            <strong>${title}:</strong> ${data.length} baris data berhasil diproses
        </div>
        <div class="table-responsive">
            <table class="table table-sm table-bordered table-hover">
                <thead class="table-light">
                    <tr>
                        ${columns.map(col => `<th>${col}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Add rows (show max 10 rows)
    const samplesToShow = data.slice(0, 10);
    samplesToShow.forEach(row => {
        tableHtml += '<tr>';
        columns.forEach(col => {
            tableHtml += `<td>${row[col] || ''}</td>`;
        });
        tableHtml += '</tr>';
    });
    
    tableHtml += `
                </tbody>
            </table>
        </div>
        <p class="text-muted small">Menampilkan ${samplesToShow.length} dari ${data.length} baris data.</p>
    `;
    
    container.innerHTML = tableHtml;
}

// Enable export buttons
function enableExportButtons() {
    const exportPendaftarBtn = document.getElementById('export-pendaftar-btn');
    const exportUp3Btn = document.getElementById('export-up3-btn');
    const exportCombinedBtn = document.getElementById('export-combined-btn');
    
    exportPendaftarBtn.disabled = !(pendaftarData && pendaftarData.length > 0);
    exportUp3Btn.disabled = !(up3Data && up3Data.length > 0);
    exportCombinedBtn.disabled = !(pendaftarData && up3Data && pendaftarData.length > 0 && up3Data.length > 0);
}

// Predict with AI model
async function predictWithModel() {
    // Check if we have data to predict
    if (!pendaftarData || pendaftarData.length === 0) {
        showError('Tidak ada data pendaftar untuk diprediksi.');
        return;
    }
    
    const predictBtn = document.getElementById('predict-btn');
    setLoading(predictBtn, true);
    
    try {
        // Create CSV from pendaftarData
        const csv = Papa.unparse(pendaftarData);
        const blob = new Blob([csv], { type: 'text/csv' });
        const file = new File([blob], "compare_TrendYoYPendaftar.csv");
        
        // Create FormData
        const formData = new FormData();
        formData.append('file', file);
        
        // Send to API
        const response = await fetch(`${API_BASE_URL}/predict-compare`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error (${response.status}): ${errorText}`);
        }
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        // Store prediction result
        predictionData = result.data;
        
        // Show prediction result
        showPredictionResult(predictionData);
        
        // Enable export prediction button
        document.getElementById('export-prediction-btn').disabled = false;
        
        // Show success message
        showSuccess('Prediksi berhasil dilakukan dengan model AI.');
        
    } catch (error) {
        showError(`Gagal melakukan prediksi: ${error.message}`);
    } finally {
        setLoading(predictBtn, false);
    }
}

// Show prediction results
function showPredictionResult(data) {
    if (!data || data.length === 0) {
        document.getElementById('prediction-preview').innerHTML = 
            '<p class="text-muted">Tidak ada hasil prediksi.</p>';
        return;
    }
    
    // Show prediction tab if hidden
    document.getElementById('prediction-tab-container').style.display = 'block';
    
    // Get columns
    const columns = Object.keys(data[0]);
    
    // Create table HTML
    let tableHtml = `
        <div class="alert alert-primary py-2">
            <strong>Hasil Prediksi AI:</strong> ${data.length} baris data hasil prediksi
        </div>
        <div class="table-responsive">
            <table class="table table-sm table-bordered table-hover">
                <thead class="table-light">
                    <tr>
                        ${columns.map(col => `<th>${col}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Add rows (show max 10 rows)
    const samplesToShow = data.slice(0, 10);
    samplesToShow.forEach(row => {
        tableHtml += '<tr>';
        columns.forEach(col => {
            tableHtml += `<td>${row[col] || ''}</td>`;
        });
        tableHtml += '</tr>';
    });
    
    tableHtml += `
                </tbody>
            </table>
        </div>
        <p class="text-muted small">Menampilkan ${samplesToShow.length} dari ${data.length} baris data prediksi.</p>
    `;
    
    document.getElementById('prediction-preview').innerHTML = tableHtml;
    
    // Activate prediction tab
    const predictionTab = document.getElementById('prediction-tab');
    const tab = new bootstrap.Tab(predictionTab);
    tab.show();
}

// Export pendaftar data
function exportPendaftarData() {
    if (!pendaftarData || pendaftarData.length === 0) {
        showError('Tidak ada data pendaftar untuk diekspor.');
        return;
    }
    
    const exportBtn = document.getElementById('export-pendaftar-btn');
    setLoading(exportBtn, true);
    
    try {
        // Convert to CSV
        const csv = Papa.unparse(pendaftarData);
        
        // Create and download file
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, 'compare_TrendYoYPendaftar.csv');
        
        showSuccess('File compare_TrendYoYPendaftar.csv berhasil diunduh.');
    } catch (error) {
        showError(`Terjadi kesalahan saat ekspor: ${error.message}`);
    } finally {
        setLoading(exportBtn, false);
    }
}

// Export UP3 data
function exportUp3Data() {
    if (!up3Data || up3Data.length === 0) {
        showError('Tidak ada data UP3 untuk diekspor.');
        return;
    }
    
    const exportBtn = document.getElementById('export-up3-btn');
    setLoading(exportBtn, true);
    
    try {
        // Convert to CSV
        const csv = Papa.unparse(up3Data);
        
        // Create and download file
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, 'compare_TrendYoYUP3.csv');
        
        showSuccess('File compare_TrendYoYUP3.csv berhasil diunduh.');
    } catch (error) {
        showError(`Terjadi kesalahan saat ekspor: ${error.message}`);
    } finally {
        setLoading(exportBtn, false);
    }
}

// Export combined data as ZIP
async function exportCombinedData() {
    if (!pendaftarData || !up3Data || pendaftarData.length === 0 || up3Data.length === 0) {
        showError('Data tidak lengkap untuk diekspor.');
        return;
    }
    
    const exportBtn = document.getElementById('export-combined-btn');
    setLoading(exportBtn, true);
    
    try {
        // Create a new JSZip instance
        const zip = new JSZip();
        
        // Add files to the zip
        zip.file('compare_TrendYoYPendaftar.csv', Papa.unparse(pendaftarData));
        zip.file('compare_TrendYoYUP3.csv', Papa.unparse(up3Data));
        
        // Add readme file
        zip.file('README.txt', 
            'Data PMB Tel-U yang telah diproses\n' +
            '==============================\n\n' +
            'Berisi file:\n' +
            '1. compare_TrendYoYPendaftar.csv - Data pendaftar untuk model AI\n' +
            '2. compare_TrendYoYUP3.csv - Data UP3 untuk model AI\n\n' +
            'Diekspor pada: ' + new Date().toLocaleString()
        );
        
        // Generate the zip file
        const content = await zip.generateAsync({ type: 'blob' });
        
        // Save the zip file
        saveAs(content, 'TelU_PMB_Data.zip');
        
        showSuccess('Semua file berhasil diunduh dalam format ZIP.');
    } catch (error) {
        showError(`Terjadi kesalahan saat ekspor: ${error.message}`);
    } finally {
        setLoading(exportBtn, false);
    }
}

// Export prediction data
function exportPredictionData() {
    if (!predictionData || predictionData.length === 0) {
        showError('Tidak ada hasil prediksi untuk diekspor.');
        return;
    }
    
    const exportBtn = document.getElementById('export-prediction-btn');
    setLoading(exportBtn, true);
    
    try {
        // Convert to CSV
        const csv = Papa.unparse(predictionData);
        
        // Create and download file
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, 'hasil_prediksi_ai.csv');
        
        showSuccess('File hasil_prediksi_ai.csv berhasil diunduh.');
    } catch (error) {
        showError(`Terjadi kesalahan saat ekspor: ${error.message}`);
    } finally {
        setLoading(exportBtn, false);
    }
}

// Read file as text
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = event => resolve(event.target.result);
        reader.onerror = error => reject(error);
        reader.readAsText(file);
    });
}

// Reset all data and UI
function resetAll() {
    // Reset file input
    document.getElementById('file').value = '';
    
    // Reset data storage
    rawData = null;
    pendaftarData = null;
    up3Data = null;
    predictionData = null;
    
    // Reset UI elements
    document.getElementById('raw-preview').innerHTML = '<p class="text-muted">Belum ada data mentah yang diupload.</p>';
    document.getElementById('pendaftar-preview').innerHTML = '<p class="text-muted">Belum ada data pendaftar yang diproses.</p>';
    document.getElementById('up3-preview').innerHTML = '<p class="text-muted">Belum ada data UP3 yang diproses.</p>';
    document.getElementById('prediction-preview').innerHTML = '<p class="text-muted">Belum ada hasil prediksi dari model AI.</p>';
    document.getElementById('result-container').innerHTML = '<p class="text-muted">Upload file CSV dan klik "Proses Data" untuk memulai konversi data.</p>';
    
    // Hide prediction tab
    document.getElementById('prediction-tab-container').style.display = 'none';
    
    // Reset to first tab
    const rawTab = document.getElementById('raw-tab');
    const tab = new bootstrap.Tab(rawTab);
    tab.show();
    
    // Disable export buttons
    document.getElementById('export-pendaftar-btn').disabled = true;
    document.getElementById('export-up3-btn').disabled = true;
    document.getElementById('export-combined-btn').disabled = true;
    document.getElementById('predict-btn').disabled = true;
    document.getElementById('export-prediction-btn').disabled = true;
    
    // Show reset message
    showSuccess('Aplikasi telah direset. Silakan upload file baru.');
}

// Set loading state for button
function setLoading(button, isLoading) {
    if (!button) return;
    
    const spinner = button.querySelector('.spinner-border');
    
    if (isLoading) {
        button.disabled = true;
        if (spinner) spinner.style.display = 'inline-block';
    } else {
        button.disabled = false;
        if (spinner) spinner.style.display = 'none';
    }
}

// Show error message
function showError(message) {
    const resultContainer = document.getElementById('result-container');
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger alert-dismissible fade show';
    errorDiv.innerHTML = `
        <strong>Error:</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Add to top of container
    if (resultContainer.firstChild) {
        resultContainer.insertBefore(errorDiv, resultContainer.firstChild);
    } else {
        resultContainer.appendChild(errorDiv);
    }
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Show success message
function showSuccess(message) {
    const resultContainer = document.getElementById('result-container');
    
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success alert-dismissible fade show';
    successDiv.innerHTML = `
        <strong>Sukses:</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Add to top of container
    if (resultContainer.firstChild) {
        resultContainer.insertBefore(successDiv, resultContainer.firstChild);
    } else {
        resultContainer.appendChild(successDiv);
    }
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        successDiv.remove();
    }, 5000);
}