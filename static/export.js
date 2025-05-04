// Process the uploaded or sample data
function processData() {
    if (rawData.length === 0) {
        // Try to get data from file upload
        const fileInput = document.getElementById('fileInput');
        const file = fileInput.files[0];
        
        if (!file) {
            alert('Silakan pilih file CSV terlebih dahulu atau gunakan data contoh');
            return;
        }
        
        // Display loading message
        const previewContainer = document.getElementById('data-preview-content');
        previewContainer.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>Memproses data, mohon tunggu...</p>
            </div>
        `;
        
        // Read the file
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const csvText = e.target.result;
            
            // Parse CSV data
            rawData = parseCSV(csvText);
            
            // Continue processing
            processRawData();
        };
        
        reader.onerror = function() {
            console.error('Error reading file');
            document.getElementById('data-preview-content').innerHTML = `
                <div class="error-message">
                    <strong>Error:</strong> Gagal membaca file CSV. Silakan coba lagi.
                </div>
            `;
        };
        
        // Read the file as text
        reader.readAsText(file);
    } else {
        // We already have raw data (e.g., from sample data)
        processRawData();
    }
}

// Process the raw data into processed data
function processRawData() {
    try {
        // Validate the data format
        if (!validateDataFormat(rawData)) {
            throw new Error('Format data tidak valid. Pastikan file memiliki kolom Tahun, Lembaga, Realisasi Pendaftar, dan Realisasi Registrasi (NIM).');
        }
        
        // Transform raw data into processed data
        processedData = transformData(rawData);
        
        // Generate predictions for future years
        generatePredictions();
        
        // Display the processed data
        displayProcessedData();
        
        // Show export options
        document.getElementById('export-options-section').style.display = 'block';
        
    } catch (error) {
        console.error('Error processing data:', error);
        document.getElementById('data-preview-content').innerHTML = `
            <div class="error-message">
                <strong>Error:</strong> ${error.message}
            </div>
        `;
    }
}

// Validate the format of the data
function validateDataFormat(data) {
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

// Transform raw data into processed data format
function transformData(data) {
    const result = [];
    
    // Copy and sort data by year and lembaga
    const sortedData = [...data].sort((a, b) => {
        if (a.Tahun !== b.Tahun) {
            return a.Tahun - b.Tahun;
        }
        return a.Lembaga.localeCompare(b.Lembaga);
    });
    
    // Get unique years and lembaga
    const years = [...new Set(sortedData.map(item => item.Tahun))];
    const lembagaList = [...new Set(sortedData.map(item => item.Lembaga))];
    
    // For each lembaga, calculate additional metrics
    lembagaList.forEach(lembaga => {
        const lembagaData = sortedData.filter(item => item.Lembaga === lembaga);
        
        lembagaData.forEach((item, index) => {
            const entry = { ...item };
            
            // Calculate conversion rate
            entry['Rasio Konversi'] = (item['Realisasi Registrasi (NIM)'] / item['Realisasi Pendaftar'] * 100).toFixed(2);
            
            // Calculate year-over-year growth
            if (index > 0) {
                const prevYear = lembagaData[index - 1];
                entry['Pertumbuhan Pendaftar'] = calculateGrowth(
                    item['Realisasi Pendaftar'], 
                    prevYear['Realisasi Pendaftar']
                ).toFixed(2);
                
                entry['Pertumbuhan Registrasi'] = calculateGrowth(
                    item['Realisasi Registrasi (NIM)'], 
                    prevYear['Realisasi Registrasi (NIM)']
                ).toFixed(2);
            } else {
                entry['Pertumbuhan Pendaftar'] = '0.00';
                entry['Pertumbuhan Registrasi'] = '0.00';
            }
            
            // Add to processed data
            result.push(entry);
        });
    });
    
    return result;
}

// Generate predictions for future years
function generatePredictions() {
    predictionData = [];
    
    // Get the most recent year in the data
    const latestYear = Math.max(...processedData.map(item => item.Tahun));
    
    // Get unique lembaga
    const lembagaList = [...new Set(processedData.map(item => item.Lembaga))];
    
    // For each lembaga, generate predictions
    lembagaList.forEach(lembaga => {
        // Get historical data for this lembaga
        const lembagaData = processedData.filter(item => item.Lembaga === lembaga)
            .sort((a, b) => a.Tahun - b.Tahun);
        
        if (lembagaData.length < 2) {
            console.warn(`Not enough historical data for ${lembaga} to make predictions`);
            return;
        }
        
        // Calculate average growth rates (from last 3 years or all available data)
        const pendaftarGrowthRates = lembagaData
            .slice(1)
            .map((item, index) => {
                const prevYear = lembagaData[index];
                return (item['Realisasi Pendaftar'] - prevYear['Realisasi Pendaftar']) / prevYear['Realisasi Pendaftar'];
            });
        
        const registrasiGrowthRates = lembagaData
            .slice(1)
            .map((item, index) => {
                const prevYear = lembagaData[index];
                return (item['Realisasi Registrasi (NIM)'] - prevYear['Realisasi Registrasi (NIM)']) / prevYear['Realisasi Registrasi (NIM)'];
            });
        
        // Use last 3 years or all available data, whichever is less
        const lastNYears = Math.min(3, pendaftarGrowthRates.length);
        const avgPendaftarGrowth = pendaftarGrowthRates.slice(-lastNYears).reduce((a, b) => a + b, 0) / lastNYears;
        const avgRegistrasiGrowth = registrasiGrowthRates.slice(-lastNYears).reduce((a, b) => a + b, 0) / lastNYears;
        
        // Get the most recent data for this lembaga
        const latestData = lembagaData[lembagaData.length - 1];
        
        // Generate predictions for future years (up to 5 years beyond the latest)
        for (let year = latestYear + 1; year <= latestYear + 5; year++) {
            const yearsSinceLatest = year - latestYear;
            
            // Apply exponential growth model with damping factor
            const dampingFactor = Math.max(0.5, 1 - yearsSinceLatest * 0.1); // Reduces growth rate by 10% each year
            
            // Calculate predicted values
            const predictedPendaftar = Math.round(
                latestData['Realisasi Pendaftar'] * 
                Math.pow(1 + avgPendaftarGrowth * dampingFactor, yearsSinceLatest)
            );
            
            const predictedRegistrasi = Math.round(
                latestData['Realisasi Registrasi (NIM)'] * 
                Math.pow(1 + avgRegistrasiGrowth * dampingFactor, yearsSinceLatest)
            );
            
            // Calculate conversion rate
            const conversionRate = (predictedRegistrasi / predictedPendaftar * 100).toFixed(2);
            
            // Calculate growth vs. previous year
            let pendaftarGrowth, registrasiGrowth;
            
            if (year === latestYear + 1) {
                // Compare to the latest historical data
                pendaftarGrowth = calculateGrowth(predictedPendaftar, latestData['Realisasi Pendaftar']).toFixed(2);
                registrasiGrowth = calculateGrowth(predictedRegistrasi, latestData['Realisasi Registrasi (NIM)']).toFixed(2);
            } else {
                // Compare to the previous prediction
                const prevYearPrediction = predictionData.find(
                    item => item.Lembaga === lembaga && item.Tahun === year - 1
                );
                
                pendaftarGrowth = calculateGrowth(predictedPendaftar, prevYearPrediction['Prediksi Pendaftar']).toFixed(2);
                registrasiGrowth = calculateGrowth(predictedRegistrasi, prevYearPrediction['Prediksi Registrasi']).toFixed(2);
            }
            
            // Add to prediction data
            predictionData.push({
                Tahun: year,
                Lembaga: lembaga,
                'Prediksi Pendaftar': predictedPendaftar,
                'Prediksi Registrasi': predictedRegistrasi,
                'Rasio Konversi': conversionRate,
                'Pertumbuhan Pendaftar': pendaftarGrowth,
                'Pertumbuhan Registrasi': registrasiGrowth
            });
        }
    });
}

// Display the processed data
function displayProcessedData() {
    const previewContainer = document.getElementById('data-preview-content');
    const previewPlaceholder = document.getElementById('preview-placeholder');
    
    if (previewPlaceholder) {
        previewPlaceholder.style.display = 'none';
    }
    
    // Sort data by year (descending) and lembaga
    const sortedData = [...processedData].sort((a, b) => {
        if (a.Tahun !== b.Tahun) {
            return b.Tahun - a.Tahun; // Descending year
        }
        return a.Lembaga.localeCompare(b.Lembaga);
    });
    
    // Get years for column headers
    const years = [...new Set(sortedData.map(item => item.Tahun))].sort((a, b) => b - a);
    
    let html = `
        <h4>Data Historis Pendaftaran dan Registrasi</h4>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Lembaga</th>
                        <th>Metrik</th>
                        ${years.map(year => `<th>${year}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Get unique lembaga
    const lembagaList = [...new Set(sortedData.map(item => item.Lembaga))].sort();
    
    // For each lembaga, display data for each metric
    lembagaList.forEach(lembaga => {
        // Pendaftar row
        html += `
            <tr>
                <td rowspan="3">${lembaga}</td>
                <td>Pendaftar</td>
        `;
        
        years.forEach(year => {
            const yearData = sortedData.find(item => item.Lembaga === lembaga && item.Tahun === year);
            if (yearData) {
                html += `<td>${formatNumber(yearData['Realisasi Pendaftar'])}</td>`;
            } else {
                html += `<td>-</td>`;
            }
        });
        
        html += `</tr>`;
        
        // Registrasi row
        html += `
            <tr>
                <td>Registrasi</td>
        `;
        
        years.forEach(year => {
            const yearData = sortedData.find(item => item.Lembaga === lembaga && item.Tahun === year);
            if (yearData) {
                html += `<td>${formatNumber(yearData['Realisasi Registrasi (NIM)'])}</td>`;
            } else {
                html += `<td>-</td>`;
            }
        });
        
        html += `</tr>`;
        
        // Conversion rate row
        html += `
            <tr>
                <td>Rasio Konversi</td>
        `;
        
        years.forEach(year => {
            const yearData = sortedData.find(item => item.Lembaga === lembaga && item.Tahun === year);
            if (yearData) {
                html += `<td>${yearData['Rasio Konversi']}%</td>`;
            } else {
                html += `<td>-</td>`;
            }
        });
        
        html += `</tr>`;
    });
    
    html += `
                </tbody>
            </table>
        </div>
        
        <h4>Tren Pertumbuhan</h4>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Lembaga</th>
                        <th>Metrik</th>
                        ${years.slice(0, years.length - 1).map(year => `<th>${year}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;
    
    // For each lembaga, display growth data
    lembagaList.forEach(lembaga => {
        // Pendaftar growth row
        html += `
            <tr>
                <td rowspan="2">${lembaga}</td>
                <td>Pertumbuhan Pendaftar</td>
        `;
        
        years.slice(0, years.length - 1).forEach(year => {
            const yearData = sortedData.find(item => item.Lembaga === lembaga && item.Tahun === year);
            if (yearData && yearData['Pertumbuhan Pendaftar']) {
                const growthValue = parseFloat(yearData['Pertumbuhan Pendaftar']);
                const cellClass = growthValue >= 0 ? 'success-message' : 'error-message';
                html += `<td class="${cellClass}">${growthValue}%</td>`;
            } else {
                html += `<td>-</td>`;
            }
        });
        
        html += `</tr>`;
        
        // Registrasi growth row
        html += `
            <tr>
                <td>Pertumbuhan Registrasi</td>
        `;
        
        years.slice(0, years.length - 1).forEach(year => {
            const yearData = sortedData.find(item => item.Lembaga === lembaga && item.Tahun === year);
            if (yearData && yearData['Pertumbuhan Registrasi']) {
                const growthValue = parseFloat(yearData['Pertumbuhan Registrasi']);
                const cellClass = growthValue >= 0 ? 'success-message' : 'error-message';
                html += `<td class="${cellClass}">${growthValue}%</td>`;
            } else {
                html += `<td>-</td>`;
            }
        });
        
        html += `</tr>`;
    });
    
    html += `
                </tbody>
            </table>
        </div>
        
        <h4>Prediksi Untuk Tahun Mendatang</h4>
        <p>Hasil prediksi menggunakan model pertumbuhan berbasis tren historis. Diperbarui terakhir: ${new Date().toLocaleDateString('id-ID')}</p>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Lembaga</th>
                        <th>Metrik</th>
    `;
    
    // Get future years for prediction columns
    const predictionYears = [...new Set(predictionData.map(item => item.Tahun))].sort();
    
    // Add prediction year columns
    predictionYears.forEach(year => {
        html += `<th>${year}</th>`;
    });
    
    html += `
                    </tr>
                </thead>
                <tbody>
    `;
    
    // For each lembaga, display prediction data
    lembagaList.forEach(lembaga => {
        // Pendaftar prediction row
        html += `
            <tr>
                <td rowspan="3">${lembaga}</td>
                <td>Prediksi Pendaftar</td>
        `;
        
        predictionYears.forEach(year => {
            const yearData = predictionData.find(item => item.Lembaga === lembaga && item.Tahun === year);
            if (yearData) {
                html += `<td>${formatNumber(yearData['Prediksi Pendaftar'])}</td>`;
            } else {
                html += `<td>-</td>`;
            }
        });
        
        html += `</tr>`;
        
        // Registrasi prediction row
        html += `
            <tr>
                <td>Prediksi Registrasi</td>
        `;
        
        predictionYears.forEach(year => {
            const yearData = predictionData.find(item => item.Lembaga === lembaga && item.Tahun === year);
            if (yearData) {
                html += `<td>${formatNumber(yearData['Prediksi Registrasi'])}</td>`;
            } else {
                html += `<td>-</td>`;
            }
        });
        
        html += `</tr>`;
        
        // Conversion rate row
        html += `
            <tr>
                <td>Rasio Konversi</td>
        `;
        
        predictionYears.forEach(year => {
            const yearData = predictionData.find(item => item.Lembaga === lembaga && item.Tahun === year);
            if (yearData) {
                html += `<td>${yearData['Rasio Konversi']}%</td>`;
            } else {
                html += `<td>-</td>`;
            }
        });
        
        html += `</tr>`;
    });
    
    html += `
                </tbody>
            </table>
        </div>
        
        <div class="success-message">
            <strong>Transformasi Selesai:</strong> Data mentah telah berhasil diubah menjadi data matang dengan metrik tambahan dan prediksi. Silakan pilih opsi ekspor yang diinginkan.
        </div>
    `;
    
    // Display the processed data
    previewContainer.innerHTML = html;
}

// Select export format
function selectExportOption(format) {
    // Remove selected class from all options
    document.querySelectorAll('.export-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    // Add selected class to the selected option
    document.getElementById(`option-${format}`).classList.add('selected');
    
    // Update selected format
    selectedExportFormat = format;
}

// Export data to selected format
function exportData() {
    const tahunPrediksi = parseInt(document.getElementById('tahun-prediksi').value);
    
    if (!tahunPrediksi || tahunPrediksi < 2023) {
        alert('Silakan masukkan tahun prediksi yang valid (2023 atau lebih baru)');
        return;
    }
    
    // Filter prediction data to include only up to the selected year
    const filteredPredictions = predictionData.filter(item => item.Tahun <= tahunPrediksi);
    
    // Show export preview section
    document.getElementById('export-preview').style.display = 'block';
    
    // Handle different export formats
    switch (selectedExportFormat) {
        case 'csv':
            exportToCSV(filteredPredictions, tahunPrediksi);
            break;
        case 'excel':
            exportToExcel(filteredPredictions, tahunPrediksi);
            break;
        case 'json':
            exportToJSON(filteredPredictions, tahunPrediksi);
            break;
        case 'report':
            exportToReport(filteredPredictions, tahunPrediksi);
            break;
        default:
            alert('Format ekspor tidak valid');
    }
}

// Export data to CSV format
function exportToCSV(predictions, tahunPrediksi) {
    // Combined historical and prediction data
    const combinedData = [...processedData, ...predictions];
    
    // Get unique lembaga
    const lembagaList = [...new Set(combinedData.map(item => item.Lembaga))].sort();
    
    // Create matured data in a tabular format
    const maturedData = [];
    
    lembagaList.forEach(lembaga => {
        // Get data for this lembaga
        const lembagaData = combinedData.filter(item => item.Lembaga === lembaga).sort((a, b) => a.Tahun - b.Tahun);
        
        // Create pendaftar row
        const pendaftarRow = {
            'Lembaga': lembaga,
            'Metrik': 'Pendaftar'
        };
        
        // Create registrasi row
        const registrasiRow = {
            'Lembaga': lembaga,
            'Metrik': 'Registrasi'
        };
        
        // Create conversion rate row
        const conversionRow = {
            'Lembaga': lembaga,
            'Metrik': 'Rasio Konversi'
        };
        
        // Add data for each year
        lembagaData.forEach(item => {
            const year = item.Tahun;
            
            if ('Realisasi Pendaftar' in item) {
                pendaftarRow[year] = item['Realisasi Pendaftar'];
                registrasiRow[year] = item['Realisasi Registrasi (NIM)'];
                conversionRow[year] = item['Rasio Konversi'] + '%';
            } else if ('Prediksi Pendaftar' in item) {
                pendaftarRow[year] = item['Prediksi Pendaftar'];
                registrasiRow[year] = item['Prediksi Registrasi'];
                conversionRow[year] = item['Rasio Konversi'] + '%';
            }
        });
        
        // Add rows to matured data
        maturedData.push(pendaftarRow, registrasiRow, conversionRow);
    });
    
    // Get all years
    const years = [...new Set(combinedData.map(item => item.Tahun))].sort();
    
    // Create headers for CSV
    const headers = ['Lembaga', 'Metrik', ...years];
    
    // Create CSV rows
    const csvRows = [
        headers.join(','),
        ...maturedData.map(row => 
            headers.map(header => {
                const value = row[header] || '';
                // Quote strings with commas
                return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
            }).join(',')
        )
    ];
    
    const csvContent = csvRows.join('\n');
    
    // Show preview
    const previewContent = document.getElementById('export-preview-content');
    previewContent.innerHTML = `
        <h4>Preview CSV (${maturedData.length} baris data)</h4>
        <pre>${csvContent.substring(0, 1000)}${csvContent.length > 1000 ? '...' : ''}</pre>
        <p>Ukuran file: ${formatFileSize(csvContent.length)}</p>
    `;
    
    // Set up download button
    const downloadButton = document.getElementById('download-button');
    downloadButton.innerHTML = 'Download CSV';
    downloadButton.onclick = function() {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `prediksi_pendaftaran_registrasi_tel-u_${tahunPrediksi}.csv`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
}

// Export data to Excel format
function exportToExcel(predictions, tahunPrediksi) {
    // In a real implementation, this would use a library like SheetJS
    // For this example, we'll use CSV as a fallback
    
    const previewContent = document.getElementById('export-preview-content');
    previewContent.innerHTML = `
        <h4>Export ke Excel</h4>
        <p>Dalam implementasi sebenarnya, ini akan menghasilkan file Excel dengan formula dan formatting.</p>
        <p>Untuk contoh ini, kita akan menggunakan format CSV sebagai alternatif.</p>
    `;
    
    // Fall back to CSV export
    exportToCSV(predictions, tahunPrediksi);
}

// Export data to JSON format
function exportToJSON(predictions, tahunPrediksi) {
    // Combined historical and prediction data
    const combinedData = [...processedData, ...predictions];
    
    // Format data for JSON
    const jsonData = {
        metadata: {
            generated_at: new Date().toISOString(),
            prediction_year: tahunPrediksi,
            data_count: combinedData.length
        },
        historical_data: processedData,
        prediction_data: predictions
    };
    
    // Convert to JSON string
    const jsonString = JSON.stringify(jsonData, null, 2);
    
    // Show preview
    const previewContent = document.getElementById('export-preview-content');
    previewContent.innerHTML = `
        <h4>Preview JSON</h4>
        <pre>${jsonString.substring(0, 1000)}${jsonString.length > 1000 ? '...' : ''}</pre>
        <p>Ukuran file: ${formatFileSize(jsonString.length)}</p>
    `;
    
    // Set up download button
    const downloadButton = document.getElementById('download-button');
    downloadButton.innerHTML = 'Download JSON';
    downloadButton.onclick = function() {
        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `prediksi_pendaftaran_registrasi_tel-u_${tahunPrediksi}.json`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
}

// Export data to PDF report format
function exportToReport(predictions, tahunPrediksi) {
    // In a real implementation, this would generate a PDF report
    // For this example, we'll just show a preview of what would be included
    
    const previewContent = document.getElementById('export-preview-content');
    previewContent.innerHTML = `
        <h4>Laporan Analisis Prediksi Pendaftaran dan Registrasi Tel-U ${tahunPrediksi}</h4>
        
        <div class="meta-info">
            <p><strong>Tanggal Laporan:</strong> ${new Date().toLocaleDateString('id-ID')}</p>
            <p><strong>Periode Data Historis:</strong> ${Math.min(...processedData.map(item => item.Tahun))} - ${Math.max(...processedData.map(item => item.Tahun))}</p>
            <p><strong>Periode Prediksi:</strong> ${Math.min(...predictions.map(item => item.Tahun))} - ${tahunPrediksi}</p>
        </div>
        
        <p>Dalam implementasi sebenarnya, ini akan menghasilkan laporan PDF lengkap dengan analisis komprehensif, grafik tren, dan rekomendasi strategis.</p>
        
        <p>Laporan akan mencakup:</p>
        <ul>
            <li>Tren historis pendaftaran dan registrasi</li>
            <li>Analisis pertumbuhan per lembaga</li>
            <li>Prediksi untuk ${tahunPrediksi} dengan interval kepercayaan</li>
            <li>Rasio konversi dan analisis efektivitas</li>
            <li>Rekomendasi untuk strategi penerimaan mahasiswa baru</li>
            <li>Grafik dan visualisasi data</li>
        </ul>
    `;
    
    // Set up download button (in real implementation, this would generate and download a PDF)
    const downloadButton = document.getElementById('download-button');
    downloadButton.innerHTML = 'Download Laporan PDF';
    downloadButton.onclick = function() {
        alert('Dalam implementasi sebenarnya, ini akan mengunduh laporan PDF lengkap.');
    };
}

// Reset the form
function resetForm() {
    document.getElementById('fileInput').value = '';
    document.getElementById('file-info').style.display = 'none';
    document.getElementById('data-preview-content').innerHTML = '';
    document.getElementById('preview-placeholder').style.display = 'block';
    document.getElementById('export-options-section').style.display = 'none';
    document.getElementById('export-preview').style.display = 'none';
    
    // Reset selected export format
    selectedExportFormat = 'csv';
    document.querySelectorAll('.export-option').forEach(option => {
        option.classList.remove('selected');
    });
    document.getElementById('option-csv').classList.add('selected');
    
    // Clear data
    rawData = [];
    processedData = [];
    predictionData = [];
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing data export application...');
    
    // Set default year to next year
    const nextYear = new Date().getFullYear() + 1;
    document.getElementById('tahun-prediksi').value = nextYear;
    
    // Select CSV format by default
    document.getElementById('option-csv').classList.add('selected');
    
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
});// Global variables
let rawData = [];
let processedData = [];
let predictionData = [];
let selectedExportFormat = 'csv';

// Helper functions
function formatNumber(num) {
    return new Intl.NumberFormat('id-ID').format(num);
}

function calculateGrowth(current, previous) {
    if (!previous || previous === 0) return 100;
    return ((current - previous) / previous) * 100;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
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

// Load sample data for demonstration
function loadSampleData() {
    const sampleData = [
        { Tahun: 2020, Lembaga: "Fakultas Teknik Elektro", "Realisasi Pendaftar": 5320, "Realisasi Registrasi (NIM)": 3192 },
        { Tahun: 2020, Lembaga: "Fakultas Rekayasa Industri", "Realisasi Pendaftar": 4830, "Realisasi Registrasi (NIM)": 2898 },
        { Tahun: 2020, Lembaga: "Fakultas Informatika", "Realisasi Pendaftar": 7950, "Realisasi Registrasi (NIM)": 4770 },
        { Tahun: 2020, Lembaga: "Fakultas Ekonomi dan Bisnis", "Realisasi Pendaftar": 4150, "Realisasi Registrasi (NIM)": 2490 },
        { Tahun: 2020, Lembaga: "Fakultas Komunikasi dan Bisnis", "Realisasi Pendaftar": 3780, "Realisasi Registrasi (NIM)": 2268 },
        { Tahun: 2021, Lembaga: "Fakultas Teknik Elektro", "Realisasi Pendaftar": 5680, "Realisasi Registrasi (NIM)": 3408 },
        { Tahun: 2021, Lembaga: "Fakultas Rekayasa Industri", "Realisasi Pendaftar": 5120, "Realisasi Registrasi (NIM)": 3072 },
        { Tahun: 2021, Lembaga: "Fakultas Informatika", "Realisasi Pendaftar": 8320, "Realisasi Registrasi (NIM)": 4992 },
        { Tahun: 2021, Lembaga: "Fakultas Ekonomi dan Bisnis", "Realisasi Pendaftar": 4380, "Realisasi Registrasi (NIM)": 2628 },
        { Tahun: 2021, Lembaga: "Fakultas Komunikasi dan Bisnis", "Realisasi Pendaftar": 3950, "Realisasi Registrasi (NIM)": 2370 },
        { Tahun: 2022, Lembaga: "Fakultas Teknik Elektro", "Realisasi Pendaftar": 6120, "Realisasi Registrasi (NIM)": 3672 },
        { Tahun: 2022, Lembaga: "Fakultas Rekayasa Industri", "Realisasi Pendaftar": 5580, "Realisasi Registrasi (NIM)": 3348 },
        { Tahun: 2022, Lembaga: "Fakultas Informatika", "Realisasi Pendaftar": 8950, "Realisasi Registrasi (NIM)": 5370 },
        { Tahun: 2022, Lembaga: "Fakultas Ekonomi dan Bisnis", "Realisasi Pendaftar": 4750, "Realisasi Registrasi (NIM)": 2850 },
        { Tahun: 2022, Lembaga: "Fakultas Komunikasi dan Bisnis", "Realisasi Pendaftar": 4280, "Realisasi Registrasi (NIM)": 2568 },
        { Tahun: 2023, Lembaga: "Fakultas Teknik Elektro", "Realisasi Pendaftar": 6680, "Realisasi Registrasi (NIM)": 4008 },
        { Tahun: 2023, Lembaga: "Fakultas Rekayasa Industri", "Realisasi Pendaftar": 6150, "Realisasi Registrasi (NIM)": 3690 },
        { Tahun: 2023, Lembaga: "Fakultas Informatika", "Realisasi Pendaftar": 9850, "Realisasi Registrasi (NIM)": 5910 },
        { Tahun: 2023, Lembaga: "Fakultas Ekonomi dan Bisnis", "Realisasi Pendaftar": 5180, "Realisasi Registrasi (NIM)": 3108 },
        { Tahun: 2023, Lembaga: "Fakultas Komunikasi dan Bisnis", "Realisasi Pendaftar": 4620, "Realisasi Registrasi (NIM)": 2772 },
        { Tahun: 2024, Lembaga: "Fakultas Teknik Elektro", "Realisasi Pendaftar": 7120, "Realisasi Registrasi (NIM)": 4272 },
        { Tahun: 2024, Lembaga: "Fakultas Rekayasa Industri", "Realisasi Pendaftar": 6780, "Realisasi Registrasi (NIM)": 4068 },
        { Tahun: 2024, Lembaga: "Fakultas Informatika", "Realisasi Pendaftar": 10720, "Realisasi Registrasi (NIM)": 6432 },
        { Tahun: 2024, Lembaga: "Fakultas Ekonomi dan Bisnis", "Realisasi Pendaftar": 5620, "Realisasi Registrasi (NIM)": 3372 },
        { Tahun: 2024, Lembaga: "Fakultas Komunikasi dan Bisnis", "Realisasi Pendaftar": 4980, "Realisasi Registrasi (NIM)": 2988 }
    ];
    
    rawData = sampleData;
    
    // Display file info
    const fileInfo = document.getElementById('file-info');
    fileInfo.textContent = 'Menggunakan data contoh';
    fileInfo.style.display = 'block';
    
    // Process the data
    processData();
}