// Global variables
let historicalData = [];
let predictions = {};
let charts = {};

// Helper functions
function formatNumber(num) {
    return new Intl.NumberFormat('id-ID').format(num);
}

function calculateGrowth(current, previous) {
    if (!previous || previous === 0) return 100;
    return ((current - previous) / previous) * 100;
}

// Parse CSV data
function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(header => header.trim());
    
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue; // Skip empty lines
        
        const values = lines[i].split(',');
        if (values.length !== headers.length) continue; // Skip malformed lines
        
        const entry = {};
        
        headers.forEach((header, index) => {
            // Try to convert numeric values
            const value = values[index].trim();
            const numValue = Number(value);
            
            entry[header] = isNaN(numValue) ? value : numValue;
        });
        
        data.push(entry);
    }
    
    return data;
}

// Upload and process historical data
async function uploadHistoricalData() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Silakan pilih file CSV terlebih dahulu');
        return;
    }
    
    // Display file info
    const fileInfo = document.getElementById('file-info');
    fileInfo.textContent = `File dipilih: ${file.name} (${formatFileSize(file.size)})`;
    fileInfo.style.display = 'block';
    
    // Display loading indicator
    const historicalContainer = document.getElementById('historical-data-container');
    historicalContainer.innerHTML = `
        <h3>Data Historis</h3>
        <div class="loading">
            <div class="spinner"></div>
            <p>Memproses data historis, mohon tunggu...</p>
        </div>
    `;
    
    try {
        // Read the file
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            const csvText = e.target.result;
            
            // In a real implementation, this would be sent to the backend
            // For now, we'll parse it on the client side
            try {
                // Parse CSV data
                const parsedData = parseCSV(csvText);
                
                // Validate CSV format
                if (!validateHistoricalData(parsedData)) {
                    throw new Error('Format data tidak valid. Pastikan file memiliki kolom Tahun, Lembaga, Realisasi Pendaftar, dan Realisasi Registrasi (NIM).');
                }
                
                // Store the data
                historicalData = parsedData;
                
                // Display the data
                displayHistoricalData();
                
                // Populate lembaga dropdown
                populateLembagaDropdown();
                
                // Create charts
                createHistoricalCharts();
                
                // In a real implementation, this would be an API call to the backend
                // const formData = new FormData();
                // formData.append('file', file);
                
                // const response = await fetch('/api/upload-historical-data', {
                //     method: 'POST',
                //     body: formData
                // });
                
                // if (!response.ok) {
                //     throw new Error(`HTTP error: ${response.status}`);
                // }
                
                // const responseData = await response.json();
                // historicalData = responseData.data;
                // displayHistoricalData();
                // populateLembagaDropdown();
                // createHistoricalCharts();
            } catch (error) {
                console.error('Error parsing CSV data:', error);
                historicalContainer.innerHTML = `
                    <h3>Data Historis</h3>
                    <div class="error-message">
                        <strong>Error:</strong> ${error.message}
                    </div>
                    <p>Silakan periksa format file CSV Anda dan coba lagi.</p>
                `;
            }
        };
        
        reader.onerror = function() {
            console.error('Error reading file');
            historicalContainer.innerHTML = `
                <h3>Data Historis</h3>
                <div class="error-message">
                    <strong>Error:</strong> Gagal membaca file CSV. Silakan coba lagi.
                </div>
            `;
        };
        
        // Read the file as text
        reader.readAsText(file);
        
    } catch (error) {
        console.error('Error processing file:', error);
        historicalContainer.innerHTML = `
            <h3>Data Historis</h3>
            <div class="error-message">
                <strong>Error:</strong> ${error.message}
            </div>
        `;
    }
}

// Validate historical data format
function validateHistoricalData(data) {
    if (!data || data.length === 0) return false;
    
    // Check required columns
    const requiredColumns = ['Tahun', 'Lembaga', 'Realisasi Pendaftar', 'Realisasi Registrasi (NIM)'];
    
    for (const column of requiredColumns) {
        if (!(column in data[0])) {
            return false;
        }
    }
    
    return true;
}

// Format file size
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

// Display historical data in a table
function displayHistoricalData() {
    const container = document.getElementById('historical-data-container');
    
    if (!container) return;
    
    const years = [...new Set(historicalData.map(item => item.Tahun))].sort();
    const lembagaList = [...new Set(historicalData.map(item => item.Lembaga))].sort();
    
    let html = `
        <h3>Data Historis Pendaftaran dan Registrasi (${years[0]}-${years[years.length-1]})</h3>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Tahun</th>
                        <th>Lembaga</th>
                        <th>Pendaftar</th>
                        <th>Registrasi (NIM)</th>
                        <th>Rasio Konversi</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    historicalData.forEach(item => {
        const conversionRate = ((item["Realisasi Registrasi (NIM)"] / item["Realisasi Pendaftar"]) * 100).toFixed(1);
        
        html += `
            <tr>
                <td>${item.Tahun}</td>
                <td>${item.Lembaga}</td>
                <td>${formatNumber(item["Realisasi Pendaftar"])}</td>
                <td>${formatNumber(item["Realisasi Registrasi (NIM)"])}</td>
                <td>${conversionRate}%</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}

// Populate lembaga dropdown
function populateLembagaDropdown() {
    const lembagaSelect = document.getElementById('lembaga-prediksi');
    
    if (!lembagaSelect) return;
    
    // Clear existing options except the first one (Semua)
    while (lembagaSelect.options.length > 1) {
        lembagaSelect.remove(1);
    }
    
    const lembagaList = [...new Set(historicalData.map(item => item.Lembaga))].sort();
    
    lembagaList.forEach(lembaga => {
        const option = document.createElement('option');
        option.value = lembaga;
        option.textContent = lembaga;
        lembagaSelect.appendChild(option);
    });
}

// Create historical data charts
function createHistoricalCharts() {
    const container = document.getElementById('visualization-container');
    
    if (!container) return;
    
    // Clear previous charts
    container.innerHTML = '';
    
    // Create trend chart for pendaftar
    const pendaftarChartDiv = document.createElement('div');
    pendaftarChartDiv.className = 'chart-container';
    pendaftarChartDiv.innerHTML = '<h4>Tren Pendaftar Berdasarkan Lembaga</h4>';
    
    const pendaftarCanvas = document.createElement('canvas');
    pendaftarCanvas.id = 'pendaftar-chart';
    pendaftarChartDiv.appendChild(pendaftarCanvas);
    container.appendChild(pendaftarChartDiv);
    
    // Create trend chart for registrasi
    const registrasiChartDiv = document.createElement('div');
    registrasiChartDiv.className = 'chart-container';
    registrasiChartDiv.innerHTML = '<h4>Tren Registrasi (NIM) Berdasarkan Lembaga</h4>';
    
    const registrasiCanvas = document.createElement('canvas');
    registrasiCanvas.id = 'registrasi-chart';
    registrasiChartDiv.appendChild(registrasiCanvas);
    container.appendChild(registrasiChartDiv);
    
    // Create data for charts
    const years = [...new Set(historicalData.map(item => item.Tahun))].sort();
    const lembagaList = [...new Set(historicalData.map(item => item.Lembaga))];
    
    const pendaftarData = {};
    const registrasiData = {};
    
    lembagaList.forEach(lembaga => {
        pendaftarData[lembaga] = [];
        registrasiData[lembaga] = [];
        
        years.forEach(year => {
            const yearData = historicalData.find(item => item.Tahun === year && item.Lembaga === lembaga);
            
            if (yearData) {
                pendaftarData[lembaga].push(yearData["Realisasi Pendaftar"]);
                registrasiData[lembaga].push(yearData["Realisasi Registrasi (NIM)"]);
            } else {
                pendaftarData[lembaga].push(null);
                registrasiData[lembaga].push(null);
            }
        });
    });
    
    // Generate colors for each lembaga
    const colors = [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(75, 192, 192, 1)',
        'rgba(153, 102, 255, 1)'
    ];
    
    // Create datasets for pendaftar chart
    const pendaftarDatasets = lembagaList.map((lembaga, index) => {
        return {
            label: lembaga,
            data: pendaftarData[lembaga],
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length].replace('1)', '0.2)'),
            borderWidth: 2,
            fill: false,
            tension: 0.1
        };
    });
    
    // Create datasets for registrasi chart
    const registrasiDatasets = lembagaList.map((lembaga, index) => {
        return {
            label: lembaga,
            data: registrasiData[lembaga],
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length].replace('1)', '0.2)'),
            borderWidth: 2,
            fill: false,
            tension: 0.1
        };
    });
    
    // Create pendaftar chart
    if (charts.pendaftar) {
        charts.pendaftar.destroy();
    }
    
    charts.pendaftar = new Chart(pendaftarCanvas, {
        type: 'line',
        data: {
            labels: years,
            datasets: pendaftarDatasets
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Tren Jumlah Pendaftar Per Tahun'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatNumber(context.parsed.y)} pendaftar`;
                        }
                    }
                },
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Jumlah Pendaftar'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Tahun'
                    }
                }
            }
        }
    });
    
    // Create registrasi chart
    if (charts.registrasi) {
        charts.registrasi.destroy();
    }
    
    charts.registrasi = new Chart(registrasiCanvas, {
        type: 'line',
        data: {
            labels: years,
            datasets: registrasiDatasets
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Tren Jumlah Registrasi (NIM) Per Tahun'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatNumber(context.parsed.y)} registrasi`;
                        }
                    }
                },
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Jumlah Registrasi (NIM)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Tahun'
                    }
                }
            }
        }
    });
    
    // Create conversion rate chart
    const conversionChartDiv = document.createElement('div');
    conversionChartDiv.className = 'chart-container';
    conversionChartDiv.innerHTML = '<h4>Rasio Konversi Pendaftar ke Registrasi</h4>';
    
    const conversionCanvas = document.createElement('canvas');
    conversionCanvas.id = 'conversion-chart';
    conversionChartDiv.appendChild(conversionCanvas);
    container.appendChild(conversionChartDiv);
    
    // Calculate conversion rates
    const conversionData = {};
    
    lembagaList.forEach(lembaga => {
        conversionData[lembaga] = [];
        
        years.forEach(year => {
            const yearData = historicalData.find(item => item.Tahun === year && item.Lembaga === lembaga);
            
            if (yearData) {
                const rate = (yearData["Realisasi Registrasi (NIM)"] / yearData["Realisasi Pendaftar"]) * 100;
                conversionData[lembaga].push(rate.toFixed(1));
            } else {
                conversionData[lembaga].push(null);
            }
        });
    });
    
    // Create datasets for conversion chart
    const conversionDatasets = lembagaList.map((lembaga, index) => {
        return {
            label: lembaga,
            data: conversionData[lembaga],
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length].replace('1)', '0.2)'),
            borderWidth: 2,
            fill: false,
            tension: 0.1
        };
    });
    
    // Create conversion chart
    if (charts.conversion) {
        charts.conversion.destroy();
    }
    
    charts.conversion = new Chart(conversionCanvas, {
        type: 'line',
        data: {
            labels: years,
            datasets: conversionDatasets
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Tren Rasio Konversi Per Tahun'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y}%`;
                        }
                    }
                },
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Rasio Konversi (%)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Tahun'
                    }
                }
            }
        }
    });
}

// Generate example data file for download
function generateSampleData() {
    const sampleData = [
        { Tahun: 2020, Lembaga: "Fakultas Teknik Elektro", "Realisasi Pendaftar": 5320, "Realisasi Registrasi (NIM)": 3192 },
        { Tahun: 2020, Lembaga: "Fakultas Rekayasa Industri", "Realisasi Pendaftar": 4830, "Realisasi Registrasi (NIM)": 2898 },
        { Tahun: 2020, Lembaga: "Fakultas Informatika", "Realisasi Pendaftar": 7950, "Realisasi Registrasi (NIM)": 4770 },
        { Tahun: 2021, Lembaga: "Fakultas Teknik Elektro", "Realisasi Pendaftar": 5680, "Realisasi Registrasi (NIM)": 3408 },
        { Tahun: 2021, Lembaga: "Fakultas Rekayasa Industri", "Realisasi Pendaftar": 5120, "Realisasi Registrasi (NIM)": 3072 },
        { Tahun: 2021, Lembaga: "Fakultas Informatika", "Realisasi Pendaftar": 8320, "Realisasi Registrasi (NIM)": 4992 },
        { Tahun: 2022, Lembaga: "Fakultas Teknik Elektro", "Realisasi Pendaftar": 6120, "Realisasi Registrasi (NIM)": 3672 },
        { Tahun: 2022, Lembaga: "Fakultas Rekayasa Industri", "Realisasi Pendaftar": 5580, "Realisasi Registrasi (NIM)": 3348 },
        { Tahun: 2022, Lembaga: "Fakultas Informatika", "Realisasi Pendaftar": 8950, "Realisasi Registrasi (NIM)": 5370 }
    ];
    
    // Convert to CSV
    const headers = Object.keys(sampleData[0]);
    const csvRows = [
        headers.join(','),
        ...sampleData.map(row => 
            headers.map(field => row[field]).join(',')
        )
    ];
    const csvString = csvRows.join('\n');
    
    // Create blob and download link
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = "contoh_data_pendaftaran.csv";
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Show sample data in the output area
    const outputDiv = document.getElementById('historical-data-container');
    
    if (!outputDiv) return;
    
    let html = `
        <h3>Contoh Format Data</h3>
        <p>Berikut adalah contoh format data CSV yang dapat Anda gunakan:</p>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        ${headers.map(h => `<th>${h}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${sampleData.map(row => `
                        <tr>
                            ${headers.map(h => `<td>${row[h]}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="meta-info">
            <p>File CSV contoh telah diunduh. Anda dapat menggunakan file ini sebagai template untuk data Anda sendiri.</p>
            <p>Pastikan data yang Anda upload memiliki format yang sama dengan contoh di atas.</p>
        </div>
    `;
    
    outputDiv.innerHTML = html;
}

// Generate prediction based on selected parameters
async function generatePrediction() {
    const tahunPrediksi = parseInt(document.getElementById('tahun-prediksi').value);
    const lembagaPrediksi = document.getElementById('lembaga-prediksi').value;
    
    if (!historicalData || historicalData.length === 0) {
        alert('Silakan upload data historis terlebih dahulu');
        return;
    }
    
    if (!tahunPrediksi || tahunPrediksi < 2023) {
        alert('Silakan masukkan tahun prediksi yang valid (2023 atau lebih baru)');
        return;
    }
    
    document.getElementById('prediction-placeholder').style.display = 'none';
    document.getElementById('prediction-output').innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Menghasilkan prediksi untuk tahun ${tahunPrediksi}...</p>
        </div>
    `;
    
    try {
        // In a real implementation, this would be an API call to backend
        // Simulate API call with setTimeout
        setTimeout(async () => {
            try {
                // Create the request body
                const requestBody = {
                    historicalData: historicalData,
                    tahunPrediksi: tahunPrediksi,
                    lembagaPrediksi: lembagaPrediksi
                };
                
                // In a real implementation, this would be a fetch request
                // const response = await fetch('/api/generate-prediction', {
                //     method: 'POST',
                //     headers: {
                //         'Content-Type': 'application/json'
                //     },
                //     body: JSON.stringify(requestBody)
                // });
                
                // if (!response.ok) {
                //     throw new Error(`HTTP error: ${response.status}`);
                // }
                
                // const responseData = await response.json();
                // predictions = responseData.predictions;
                
                // For now, we'll generate predictions client-side
                predictions = makePredictions(tahunPrediksi, lembagaPrediksi);
                
                // Display results
                displayPredictionResults(predictions, tahunPrediksi, lembagaPrediksi);
                createPredictionCharts(predictions, tahunPrediksi, lembagaPrediksi);
                
            } catch (error) {
                console.error('Error generating predictions:', error);
                document.getElementById('prediction-output').innerHTML = `
                    <div class="error-message">
                        <strong>Error:</strong> Gagal menghasilkan prediksi: ${error.message}
                    </div>
                `;
            }
        }, 1500); // Simulate server processing delay
        
    } catch (error) {
        console.error('Error sending prediction request:', error);
        document.getElementById('prediction-output').innerHTML = `
            <div class="error-message">
                <strong>Error:</strong> Gagal mengirim permintaan prediksi: ${error.message}
            </div>
        `;
    }
}

// Make predictions using a simple model (client-side implementation)
function makePredictions(year, selectedLembaga) {
    const predictionResults = [];
    
    // Get list of lembaga to predict
    const lembagaList = selectedLembaga === 'Semua' 
        ? [...new Set(historicalData.map(item => item.Lembaga))]
        : [selectedLembaga];
    
    // For each lembaga, calculate predictions
    lembagaList.forEach(lembaga => {
        // Get historical data for this lembaga
        const lembagaData = historicalData.filter(item => item.Lembaga === lembaga);
        
        // Sort by year
        lembagaData.sort((a, b) => a.Tahun - b.Tahun);
        
        // Calculate growth rates
        const pendaftarGrowth = [];
        const registrasiGrowth = [];
        
        for (let i = 1; i < lembagaData.length; i++) {
            const prevYear = lembagaData[i-1];
            const currentYear = lembagaData[i];
            
            const pendaftarRate = (currentYear["Realisasi Pendaftar"] - prevYear["Realisasi Pendaftar"]) / prevYear["Realisasi Pendaftar"];
            const registrasiRate = (currentYear["Realisasi Registrasi (NIM)"] - prevYear["Realisasi Registrasi (NIM)"]) / prevYear["Realisasi Registrasi (NIM)"];
            
            pendaftarGrowth.push(pendaftarRate);
            registrasiGrowth.push(registrasiRate);
        }
        
        // Calculate average growth rates (from last 2 years for more recent trend)
        const avgPendaftarGrowth = pendaftarGrowth.length > 0 ? 
            pendaftarGrowth.slice(-2).reduce((a, b) => a + b, 0) / Math.min(pendaftarGrowth.length, 2) : 0.05;
        
        const avgRegistrasiGrowth = registrasiGrowth.length > 0 ? 
            registrasiGrowth.slice(-2).reduce((a, b) => a + b, 0) / Math.min(registrasiGrowth.length, 2) : 0.05;
        
        // Get last year's data
        const lastYear = lembagaData[lembagaData.length - 1];
        
        if (!lastYear) {
            console.error(`No historical data found for lembaga: ${lembaga}`);
            return;
        }
        
        // Apply growth model for the prediction years
        let pendaftarPrediction = lastYear["Realisasi Pendaftar"];
        let registrasiPrediction = lastYear["Realisasi Registrasi (NIM)"];
        
        // Calculate predictions for each year up to the target year
        for (let y = lastYear.Tahun + 1; y <= year; y++) {
            // Apply growth rates with some random variability (to simulate real-world variations)
            const variability = 0.2; // 20% variability
            const pendaftarVariation = 1 + (Math.random() * variability - variability/2);
            const registrasiVariation = 1 + (Math.random() * variability - variability/2);
            
            pendaftarPrediction = Math.round(pendaftarPrediction * (1 + avgPendaftarGrowth * pendaftarVariation));
            registrasiPrediction = Math.round(registrasiPrediction * (1 + avgRegistrasiGrowth * registrasiVariation));
            
            // Ensure registrasi doesn't exceed pendaftar
            registrasiPrediction = Math.min(registrasiPrediction, pendaftarPrediction * 0.85);
        }
        
        // Add prediction result
        predictionResults.push({
            Lembaga: lembaga,
            "Prediksi Pendaftar": pendaftarPrediction,
            "Prediksi Registrasi": registrasiPrediction,
            "Rasio Konversi": (registrasiPrediction / pendaftarPrediction * 100).toFixed(1),
            "Pertumbuhan Pendaftar": ((pendaftarPrediction / lastYear["Realisasi Pendaftar"] - 1) * 100).toFixed(1),
            "Pertumbuhan Registrasi": ((registrasiPrediction / lastYear["Realisasi Registrasi (NIM)"] - 1) * 100).toFixed(1)
        });
    });
    
    return predictionResults;
}

// Display prediction results
function displayPredictionResults(results, year, selectedLembaga) {
    const outputDiv = document.getElementById('prediction-output');
    
    if (!outputDiv) return;
    
    let html = `
        <div class="success-message">
            <strong>Sukses:</strong> Prediksi untuk tahun ${year} telah dihasilkan
        </div>
        
        <div class="prediction-result">
            <h4>Hasil Prediksi ${selectedLembaga === 'Semua' ? 'Semua Lembaga' : selectedLembaga} - Tahun ${year}</h4>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Lembaga</th>
                            <th>Prediksi Pendaftar</th>
                            <th>Δ %</th>
                            <th>Prediksi Registrasi</th>
                            <th>Δ %</th>
                            <th>Rasio Konversi</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    results.forEach(result => {
        html += `
            <tr>
                <td>${result.Lembaga}</td>
                <td>${formatNumber(result["Prediksi Pendaftar"])}</td>
                <td class="${parseFloat(result["Pertumbuhan Pendaftar"]) >= 0 ? 'success-message' : 'error-message'}">
                    ${result["Pertumbuhan Pendaftar"]}%
                </td>
                <td>${formatNumber(result["Prediksi Registrasi"])}</td>
                <td class="${parseFloat(result["Pertumbuhan Registrasi"]) >= 0 ? 'success-message' : 'error-message'}">
                    ${result["Pertumbuhan Registrasi"]}%
                </td>
                <td>${result["Rasio Konversi"]}%</td>
            </tr>
        `;
    });
    
    html += `
                    </tbody>
                </table>
            </div>
            
            <div class="meta-info">
                <p><strong>Catatan:</strong> Prediksi ini didasarkan pada analisis tren historis dan dipengaruhi oleh berbagai faktor. Gunakan sebagai referensi untuk perencanaan strategis.</p>
            </div>
        </div>
    `;
    
    outputDiv.innerHTML = html;
}

// Create prediction charts
function createPredictionCharts(predictions, year, selectedLembaga) {
    const container = document.getElementById('visualization-container');
    
    if (!container) return;
    
    // Clear container
    container.innerHTML = '';
    
    // Compare predictions with historical data
    const predictionChartDiv = document.createElement('div');
    predictionChartDiv.className = 'chart-container';
    predictionChartDiv.innerHTML = '<h4>Prediksi vs. Realisasi - Pendaftar</h4>';
    
    const predictionCanvas = document.createElement('canvas');
    predictionCanvas.id = 'prediction-chart';
    predictionChartDiv.appendChild(predictionCanvas);
    container.appendChild(predictionChartDiv);
    
    // Create registrasi prediction chart
    const registrasiPredictionChartDiv = document.createElement('div');
    registrasiPredictionChartDiv.className = 'chart-container';
    registrasiPredictionChartDiv.innerHTML = '<h4>Prediksi vs. Realisasi - Registrasi (NIM)</h4>';
    
    const registrasiPredictionCanvas = document.createElement('canvas');
    registrasiPredictionCanvas.id = 'registrasi-prediction-chart';
    registrasiPredictionChartDiv.appendChild(registrasiPredictionCanvas);
    container.appendChild(registrasiPredictionChartDiv);
    
    // Get list of lembaga to display
    const lembagaList = selectedLembaga === 'Semua' 
        ? predictions.map(p => p.Lembaga)
        : [selectedLembaga];
    
    // Get years from historical data
    const historicalYears = [...new Set(historicalData.map(item => item.Tahun))].sort();
    const allYears = [...new Set([...historicalYears, year])].sort();
    
    // Create datasets for pendaftar chart
    const pendaftarDatasets = [];
    
    lembagaList.forEach((lembaga, index) => {
        const historicalDataPoints = [];
        const predictionDataPoints = [];
        
        allYears.forEach(y => {
            if (y < year) {
                // Get historical value
                const yearData = historicalData.find(item => item.Tahun === y && item.Lembaga === lembaga);
                historicalDataPoints.push(yearData ? yearData["Realisasi Pendaftar"] : null);
                predictionDataPoints.push(null);
            } else {
                // Get prediction value
                const predictionData = predictions.find(p => p.Lembaga === lembaga);
                historicalDataPoints.push(null);
                predictionDataPoints.push(predictionData ? predictionData["Prediksi Pendaftar"] : null);
            }
        });
        
        // Color based on index
        const colors = [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)'
        ];
        
        // Add historical dataset
        pendaftarDatasets.push({
            label: `${lembaga} (Realisasi)`,
            data: historicalDataPoints,
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length].replace('1)', '0.2)'),
            borderWidth: 2,
            fill: false
        });
        
        // Add prediction dataset
        pendaftarDatasets.push({
            label: `${lembaga} (Prediksi)`,
            data: predictionDataPoints,
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length].replace('1)', '0.2)'),
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false
        });
    });
    
    // Create pendaftar chart
    if (charts.predictionPendaftar) {
        charts.predictionPendaftar.destroy();
    }
    
    charts.predictionPendaftar = new Chart(predictionCanvas, {
        type: 'line',
        data: {
            labels: allYears,
            datasets: pendaftarDatasets
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: `Prediksi vs. Realisasi Pendaftar (${year})`
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatNumber(context.parsed.y)} pendaftar`;
                        }
                    }
                },
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Jumlah Pendaftar'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Tahun'
                    }
                }
            }
        }
    });
    
    // Create datasets for registrasi chart
    const registrasiDatasets = [];
    
    lembagaList.forEach((lembaga, index) => {
        const historicalDataPoints = [];
        const predictionDataPoints = [];
        
        allYears.forEach(y => {
            if (y < year) {
                // Get historical value
                const yearData = historicalData.find(item => item.Tahun === y && item.Lembaga === lembaga);
                historicalDataPoints.push(yearData ? yearData["Realisasi Registrasi (NIM)"] : null);
                predictionDataPoints.push(null);
            } else {
                // Get prediction value
                const predictionData = predictions.find(p => p.Lembaga === lembaga);
                historicalDataPoints.push(null);
                predictionDataPoints.push(predictionData ? predictionData["Prediksi Registrasi"] : null);
            }
        });
        
        // Color based on index
        const colors = [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)'
        ];
        
        // Add historical dataset
        registrasiDatasets.push({
            label: `${lembaga} (Realisasi)`,
            data: historicalDataPoints,
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length].replace('1)', '0.2)'),
            borderWidth: 2,
            fill: false
        });
        
        // Add prediction dataset
        registrasiDatasets.push({
            label: `${lembaga} (Prediksi)`,
            data: predictionDataPoints,
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length].replace('1)', '0.2)'),
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false
        });
    });
    
    // Create registrasi chart
    if (charts.predictionRegistrasi) {
        charts.predictionRegistrasi.destroy();
    }
    
    charts.predictionRegistrasi = new Chart(registrasiPredictionCanvas, {
        type: 'line',
        data: {
            labels: allYears,
            datasets: registrasiDatasets
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: `Prediksi vs. Realisasi Registrasi (${year})`
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatNumber(context.parsed.y)} registrasi`;
                        }
                    }
                },
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Jumlah Registrasi (NIM)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Tahun'
                    }
                }
            }
        }
    });
    
    // Create summary chart for prediction year
    const summaryChartDiv = document.createElement('div');
    summaryChartDiv.className = 'chart-container';
    summaryChartDiv.innerHTML = `<h4>Prediksi Pendaftaran dan Registrasi ${year}</h4>`;
    
    const summaryCanvas = document.createElement('canvas');
    summaryCanvas.id = 'summary-chart';
    summaryChartDiv.appendChild(summaryCanvas);
    container.appendChild(summaryChartDiv);
    
    // Prepare data for summary chart
    const lembagaLabels = predictions.map(p => p.Lembaga);
    const pendaftarValues = predictions.map(p => p["Prediksi Pendaftar"]);
    const registrasiValues = predictions.map(p => p["Prediksi Registrasi"]);
    
    // Create summary chart
    if (charts.summary) {
        charts.summary.destroy();
    }
    
    charts.summary = new Chart(summaryCanvas, {
        type: 'bar',
        data: {
            labels: lembagaLabels,
            datasets: [
                {
                    label: 'Pendaftar',
                    data: pendaftarValues,
                    backgroundColor: 'rgba(54, 162, 235, 0.7)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Registrasi (NIM)',
                    data: registrasiValues,
                    backgroundColor: 'rgba(255, 99, 132, 0.7)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: `Prediksi Pendaftaran dan Registrasi - Tahun ${year}`
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatNumber(context.parsed.y)}`;
                        }
                    }
                },
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Jumlah'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Lembaga'
                    }
                }
            }
        }
    });
    
    // Create conversion rate chart
    const conversionChartDiv = document.createElement('div');
    conversionChartDiv.className = 'chart-container';
    conversionChartDiv.innerHTML = `<h4>Prediksi Rasio Konversi ${year}</h4>`;
    
    const conversionCanvas = document.createElement('canvas');
    conversionCanvas.id = 'conversion-summary-chart';
    conversionChartDiv.appendChild(conversionCanvas);
    container.appendChild(conversionChartDiv);
    
    // Prepare data for conversion chart
    const conversionValues = predictions.map(p => parseFloat(p["Rasio Konversi"]));
    
    // Create conversion chart
    if (charts.conversionSummary) {
        charts.conversionSummary.destroy();
    }
    
    charts.conversionSummary = new Chart(conversionCanvas, {
        type: 'bar',
        data: {
            labels: lembagaLabels,
            datasets: [
                {
                    label: 'Rasio Konversi (%)',
                    data: conversionValues,
                    backgroundColor: 'rgba(75, 192, 192, 0.7)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: `Prediksi Rasio Konversi Pendaftar ke Registrasi - Tahun ${year}`
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `Rasio Konversi: ${context.parsed.y}%`;
                        }
                    }
                },
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Rasio Konversi (%)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Lembaga'
                    }
                }
            }
        }
    });
}

// Reset the form
function resetForm() {
    document.getElementById('tahun-prediksi').value = new Date().getFullYear() + 1;
    document.getElementById('lembaga-prediksi').value = 'Semua';
    document.getElementById('prediction-placeholder').style.display = 'block';
    document.getElementById('prediction-output').innerHTML = '';
    
    // Reset the visualization to show historical data
    if (historicalData && historicalData.length > 0) {
        createHistoricalCharts();
    } else {
        document.getElementById('visualization-container').innerHTML = '<p>Visualisasi akan muncul setelah prediksi dihasilkan.</p>';
    }
}

// Scroll to top function
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Show back to top button when scrolling down
window.onscroll = function() {
    const backToTopButton = document.getElementById('backToTop');
    if (backToTopButton) {
        if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
            backToTopButton.style.display = 'block';
        } else {
            backToTopButton.style.display = 'none';
        }
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing prediction application...');
    
    // Set default year to next year
    const nextYear = new Date().getFullYear() + 1;
    document.getElementById('tahun-prediksi').value = nextYear;
    
    // Show file info when file is selected
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            const fileInfo = document.getElementById('file-info');
            if (fileInfo && this.files[0]) {
                fileInfo.textContent = `File dipilih: ${this.files[0].name} (${formatFileSize(this.files[0].size)})`;
                fileInfo.style.display = 'block';
            }
        });
    }
});
