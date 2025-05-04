
let errorCounter = 0;


function logError(source, message, details = null) {
    console.error(`[${source}] ${message}`, details);
    errorCounter++;
    

    const errorLogEl = document.getElementById('error-log');
    if (errorLogEl) {
        const timestamp = new Date().toLocaleTimeString();
        const errorEntry = document.createElement('div');
        errorEntry.className = 'error-entry';
        errorEntry.innerHTML = `
            <strong>${timestamp} - ${source}:</strong> ${message}
            ${details ? `<pre>${JSON.stringify(details, null, 2)}</pre>` : ''}
        `;
        errorLogEl.appendChild(errorEntry);
        errorLogEl.scrollTop = errorLogEl.scrollHeight;
    }
}
function predictPMBCompare() {
    window.location.href = "predikTELU.html";
}


async function checkAppStatus() {
    try {
        const statusDiv = document.getElementById('app-status');
        if (!statusDiv) return;
        
        statusDiv.innerHTML = '<p>Memeriksa status aplikasi...</p>';
        
        const response = await fetch('https://web-production-68c4e.up.railway.app/status');
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        
        const data = await response.json();
        console.log('App status:', data);
        

        let statusHtml = '<h3>Status Aplikasi</h3>';
        

        const statusColor = data.app_info.status === 'ready' ? 'green' : 
                           (data.app_info.status === 'error' ? 'red' : 'orange');
        
        statusHtml += `
            <div class="status-indicator">
                <div class="status-badge" style="background-color: ${statusColor};"></div>
                <div class="status-text">
                    <strong>Status:</strong> ${data.app_info.status}
                    <br>
                    <strong>Versi:</strong> ${data.app_info.version}
                </div>
            </div>
        `;
        

        if (data.app_info.error) {
            statusHtml += `
                <div class="error-message">
                    <strong>Error:</strong> ${data.app_info.error}
                </div>
            `;
        }
        

        statusHtml += `
            <div class="status-detail">
                <strong>Jumlah Program Studi:</strong> ${data.jurusan_count} program studi
            </div>
        `;
        

        statusHtml += `
            <details>
                <summary>Informasi Lingkungan</summary>
                <div class="env-info">
                    <p><strong>Python:</strong> ${data.environment.python_version}</p>
                    <p><strong>Pandas:</strong> ${data.environment.pandas_version}</p>
                    <p><strong>Joblib:</strong> ${data.environment.joblib_version}</p>
                    <p><strong>Working Directory:</strong> ${data.environment.cwd}</p>
                    <p><strong>Files in Directory:</strong></p>
                    <ul>
                        ${data.environment.files_in_cwd.map(file => `<li>${file}</li>`).join('')}
                    </ul>
                </div>
            </details>
        `;
        
        statusDiv.innerHTML = statusHtml;
        

        if (data.app_info.status === 'error') {
            logError('App Initialization', data.app_info.error);
        }
        

        fetchJurusanList();
        
    } catch (err) {
        console.error('Error checking app status:', err);
        const statusDiv = document.getElementById('app-status');
        if (statusDiv) {
            statusDiv.innerHTML = `
                <h3>Status Aplikasi</h3>
                <div class="error-message">
                    <strong>Error:</strong> Gagal memeriksa status aplikasi: ${err.message}
                </div>
                <p>Silakan refresh halaman atau periksa koneksi server.</p>
            `;
        }
        logError('App Status Check', err.message);
    }
}


async function fetchJurusanList() {
    try {
        const response = await fetch("https://web-production-68c4e.up.railway.app/status")

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Jurusan data:', data);
        
        const outputDiv = document.getElementById("jurusan-list");
        if (!outputDiv) return;
        

        if (data.jurusan && data.jurusan.length > 0) {
            let html = "<h3>Daftar Program Studi Tersedia</h3>";
            

            if (data.categories && data.counts) {
                html += `<div class="stats-grid">`;
                
                for (const [level, count] of Object.entries(data.counts)) {
                    html += `
                        <div class="stat-card">
                            <div class="stat-value">${count}</div>
                            <div class="stat-label">Program ${level}</div>
                        </div>
                    `;
                }
                
                html += `</div>`;
            }
            
            html += "<details><summary>Lihat Daftar Program Studi Lengkap</summary>";
            

            if (data.categories) {
                for (const [level, jurusanList] of Object.entries(data.categories)) {
                    if (jurusanList.length > 0) {
                        html += `<h4>Program ${level} (${jurusanList.length})</h4>`;
                        html += `<ul class='jurusan-list'>`;
                        
                        jurusanList.forEach(jurusan => {
                            html += `<li>${jurusan}</li>`;
                        });
                        
                        html += `</ul>`;
                    }
                }
            } else {

                html += "<ul class='jurusan-list'>";
                data.jurusan.forEach(jurusan => {
                    html += `<li>${jurusan}</li>`;
                });
                html += "</ul>";
            }
            
            html += "</details>";
            outputDiv.innerHTML = html;
        } else {
            outputDiv.innerHTML = `
                <h3>Daftar Program Studi</h3>
                <div class="warning-message">
                    <strong>Peringatan:</strong> Tidak dapat memuat daftar program studi!
                </div>
                <p>Aplikasi mungkin tidak berfungsi dengan benar. Silakan periksa file model.</p>
            `;
            logError('Program List', 'Tidak dapat memuat daftar program studi', data);
        }
    } catch (err) {
        console.error("Error fetching jurusan:", err);
        const outputDiv = document.getElementById("jurusan-list");
        if (outputDiv) {
            outputDiv.innerHTML = `
                <h3>Daftar Program Studi</h3>
                <div class="error-message">
                    <strong>Error:</strong> ${err.message}
                </div>
                <p>Gagal memuat daftar program studi. Periksa koneksi server.</p>
            `;
        }
        logError('Program Fetch', err.message);
    }
}


async function testUpload() {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];
    const outputDiv = document.getElementById("output");
    
    if (!file) {
        outputDiv.innerHTML = `
            <div class="warning-message">
                <strong>Peringatan:</strong> Silakan pilih file terlebih dahulu.
            </div>
        `;
        return;
    }
    

    outputDiv.innerHTML = "<p>Menguji upload file, mohon tunggu...</p>";
    
    try {
        const formData = new FormData();
        formData.append("file", file);
        
        const response = await fetch("https://web-production-68c4e.up.railway.app/test-upload", {
            method: "POST",
            body: formData,
        });
        
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Test upload response:', data);
        

        let resultHtml = `
            <h3>Hasil Test Upload</h3>
            <div class="card-content">
        `;
        
        if (data.status === 'success') {
            resultHtml += `
                <div class="success-message">
                    <strong>Sukses:</strong> ${data.message}
                </div>
                <h4>Informasi File:</h4>
                <table class="info-table">
                    <tr><td>Nama File:</td><td>${data.file_info.filename}</td></tr>
                    <tr><td>Tipe Konten:</td><td>${data.file_info.content_type}</td></tr>
                    <tr><td>Ukuran:</td><td>${data.file_info.size}</td></tr>
                    <tr><td>Tampaknya CSV:</td><td>${data.file_info.appears_to_be_csv}</td></tr>
                    <tr><td>Tampaknya Excel:</td><td>${data.file_info.appears_to_be_excel}</td></tr>
                </table>
                
                <details>
                    <summary>Informasi Teknis</summary>
                    <pre>${JSON.stringify(data.file_info, null, 2)}</pre>
                </details>
                
                <p>File tampaknya valid. Anda dapat melanjutkan dengan analisis.</p>
                <button onclick="uploadFile()" class="primary-button">Lakukan Analisis</button>
            `;
        } else {
            resultHtml += `
                <div class="error-message">
                    <strong>Error:</strong> ${data.message}
                </div>
                <details>
                    <summary>Detail Error</summary>
                    <pre>${data.traceback || JSON.stringify(data, null, 2)}</pre>
                </details>
                <p>Silakan pilih file lain atau periksa format file.</p>
            `;
            logError('Test Upload', data.message, data);
        }
        
        resultHtml += `</div>`;
        outputDiv.innerHTML = resultHtml;
        
    } catch (err) {
        console.error('Test upload error:', err);
        outputDiv.innerHTML = `
            <h3>Hasil Test Upload</h3>
            <div class="error-message">
                <strong>Error:</strong> ${err.message}
            </div>
            <p>Gagal menguji upload file. Periksa koneksi server.</p>
        `;
        logError('Test Upload', err.message);
    }
}

function createCharts(visualizationData, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    

    container.innerHTML = '';
    

    console.log("Visualization data received:", visualizationData);
    

    if (visualizationData.rawData && Array.isArray(visualizationData.rawData)) {
        createProgramSpecificCharts(visualizationData.rawData, container);
    }
    

    if (visualizationData.level_counts && Object.keys(visualizationData.level_counts).length > 0) {
        const levelChartDiv = document.createElement('div');
        levelChartDiv.className = 'chart-container';
        levelChartDiv.innerHTML = '<h4>Distribusi Berdasarkan Jenjang</h4>';
        
        const levelCanvas = document.createElement('canvas');
        levelCanvas.id = 'level-chart';
        levelChartDiv.appendChild(levelCanvas);
        container.appendChild(levelChartDiv);
        

        const labels = Object.keys(visualizationData.level_counts);
        const values = Object.values(visualizationData.level_counts);
        

        const backgroundColors = [
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)'
        ];
        

        new Chart(levelCanvas, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(color => color.replace('0.6', '1')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Distribusi Jenjang Pendidikan'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} mahasiswa (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    

    if (visualizationData.yearly_data && visualizationData.yearly_data.length > 0) {
        createYearlyTrendCharts(visualizationData, container);
    } else {
        console.log("Tidak ada data tahunan untuk divisualisasikan");
        const noYearlyDataMessage = document.createElement('div');
        noYearlyDataMessage.className = 'info-message';
        noYearlyDataMessage.innerHTML = '<p>Tidak ada data tren tahunan yang tersedia untuk divisualisasikan</p>';
        container.appendChild(noYearlyDataMessage);
    }
}


function createYearlyTrendCharts(visualizationData, container) {

    const trendChartDiv = document.createElement('div');
    trendChartDiv.className = 'chart-container';
    trendChartDiv.innerHTML = '<h4>Tren Program Studi Berdasarkan Tahun</h4>';
    
    const trendCanvas = document.createElement('canvas');
    trendCanvas.id = 'trend-chart';
    trendChartDiv.appendChild(trendCanvas);
    container.appendChild(trendChartDiv);
    

    const allProgramCounts = {};
    


    const propertyName = 'program';
    

    visualizationData.yearly_data.forEach(yearData => {
        if (yearData.data && Array.isArray(yearData.data)) {
            yearData.data.forEach(item => {
                if (item && item[propertyName]) {
                    const programName = item[propertyName];
                    if (!allProgramCounts[programName]) {
                        allProgramCounts[programName] = 0;
                    }
                    allProgramCounts[programName] += item.count || 0;
                }
            });
        }
    });
    

    const top5Programs = Object.entries(allProgramCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(entry => entry[0]);
        
    if (top5Programs.length === 0) {
        console.error("Tidak ada program studi yang ditemukan untuk tren tahunan");
        return;
    }
    

    const years = visualizationData.yearly_data.map(year => year.year);
    

    const datasets = top5Programs.map((program, index) => {
        const colors = [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)'
        ];
        

        const data = years.map(year => {
            const yearData = visualizationData.yearly_data.find(y => y.year === year);
            if (!yearData || !yearData.data) return 0;
            
            const programData = yearData.data.find(j => j[propertyName] === program);
            return programData ? programData.count || 0 : 0;
        });
        
        return {
            label: program,
            data: data,
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length].replace('1)', '0.2)'),
            borderWidth: 2,
            fill: false,
            tension: 0.1
        };
    });
    

    new Chart(trendCanvas, {
        type: 'line',
        data: {
            labels: years,
            datasets: datasets
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Tren Program Studi Populer Antar Tahun'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y} mahasiswa`;
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
                        text: 'Jumlah Mahasiswa'
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
    

    const yearlyChartSection = document.createElement('div');
    yearlyChartSection.className = 'yearly-charts-section';
    yearlyChartSection.innerHTML = '<h4>Distribusi Program Studi Per Tahun</h4>';  
    container.appendChild(yearlyChartSection);
    

    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'year-tabs';
    yearlyChartSection.appendChild(tabsContainer);
    

    const tabContentContainer = document.createElement('div');
    tabContentContainer.className = 'year-tab-content';
    yearlyChartSection.appendChild(tabContentContainer);
    

    visualizationData.yearly_data.forEach((yearData, index) => {
        if (!yearData.data || !Array.isArray(yearData.data) || yearData.data.length === 0) {
            console.log(`Melewati tahun ${yearData.year} karena tidak ada data yang valid`);
            return;
        }
        
        const year = yearData.year;
        

        const tab = document.createElement('button');
        tab.className = 'year-tab';
        if (index === 0) tab.classList.add('active');
        tab.textContent = year;
        tab.onclick = function() {

            document.querySelectorAll('.year-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            

            document.querySelectorAll('.year-content').forEach(c => c.style.display = 'none');
            document.getElementById(`year-content-${year}`).style.display = 'block';
        };
        tabsContainer.appendChild(tab);
        

        const yearContent = document.createElement('div');
        yearContent.className = 'year-content';
        yearContent.id = `year-content-${year}`;
        yearContent.style.display = index === 0 ? 'block' : 'none';
        tabContentContainer.appendChild(yearContent);
        

        const yearlyCanvas = document.createElement('canvas');
        yearlyCanvas.id = `chart-year-${year}`;
        yearContent.appendChild(yearlyCanvas);
        


        const sortedData = [...yearData.data].sort((a, b) => (b.count || 0) - (a.count || 0));
        

        const displayData = sortedData.slice(0, 10);
        
        const programLabels = displayData.map(item => item[propertyName] || 'Tidak Ada Nama');
        const programValues = displayData.map(item => item.count || 0);
        

        new Chart(yearlyCanvas, {
            type: 'bar',
            data: {
                labels: programLabels,
                datasets: [{
                    label: `Tahun ${year}`,
                    data: programValues,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                indexAxis: 'y',  // Horizontal bar chart
                plugins: {
                    title: {
                        display: true,
                        text: `Distribusi Program Studi - Tahun ${year}`
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.x} mahasiswa`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                const label = this.getLabelForValue(value);
                                if (label && label.length > 30) {
                                    return label.substring(0, 27) + '...';
                                }
                                return label;
                            }
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Jumlah Mahasiswa'
                        }
                    }
                }
            }
        });
    });
}


function createProgramSpecificCharts(rawData, container) {

    const programGroups = {};
    

    let programColumn = '';
    let yearColumn = '';
    let countColumn = '';
    

    if (rawData.length > 0) {
        const columns = Object.keys(rawData[0]);
        

        programColumn = columns.find(col => 
            col.toLowerCase() === 'program' || 
            col.toLowerCase().includes('prodi') ||
            col.toLowerCase().includes('jurusan')
        ) || columns[0]; // Default to first column
        

        yearColumn = columns.find(col => 
            col.toLowerCase() === 'year' || 
            col.toLowerCase() === 'tahun' ||
            col.toLowerCase().includes('angkatan')
        );
        

        countColumn = columns.find(col => 
            col.toLowerCase().includes('nim') || 
            col.toLowerCase().includes('jumlah') ||
            col.toLowerCase().includes('count') ||
            col.toLowerCase().includes('total')
        );
        
        console.log(`Detected columns - Program: ${programColumn}, Year: ${yearColumn}, Count: ${countColumn}`);
        

        if (!yearColumn) {

            for (const col of columns) {
                const sample = String(rawData[0][col]);
                if (/^(19|20)\d{2}$/.test(sample)) { // Match years like 1900-2099
                    yearColumn = col;
                    break;
                }
            }
            

            if (!yearColumn && columns.length > 1) {
                yearColumn = columns[1];
            }
        }
        

        if (!countColumn) {
            for (let i = columns.length - 1; i >= 0; i--) {
                const col = columns[i];
                const sample = rawData[0][col];
                if (typeof sample === 'number' || !isNaN(Number(sample))) {
                    countColumn = col;
                    break;
                }
            }
            

            if (!countColumn) {
                countColumn = columns.length > 2 ? columns[2] : columns[columns.length - 1];
            }
        }
    }
    

    rawData.forEach(row => {
        const program = row[programColumn];
        const year = row[yearColumn];

        const count = countColumn ? Number(row[countColumn]) : 1;
        
        if (!program || !year) return;
        
        if (!programGroups[program]) {
            programGroups[program] = [];
        }
        
        programGroups[program].push({
            year: String(year),
            count: isNaN(count) ? 1 : count
        });
    });
    

    const programs = Object.keys(programGroups);
    

    const programSelectorDiv = document.createElement('div');
    programSelectorDiv.className = 'program-selector';
    programSelectorDiv.innerHTML = `
        <h4>Analisis Tren Per Program Studi</h4>
        <div class="form-group">
            <label for="program-select">Pilih Program Studi:</label>
            <select id="program-select" class="program-select">
                ${programs.map(program => `<option value="${program}">${program}</option>`).join('')}
            </select>
        </div>
        <div id="program-trend-container" class="program-trend-chart"></div>
    `;
    
    container.appendChild(programSelectorDiv);
    

    function updateProgramChart(programName) {
        const programData = programGroups[programName];
        if (!programData || !programData.length) return;
        

        programData.sort((a, b) => {

            const yearA = parseInt(a.year);
            const yearB = parseInt(b.year);
            
            if (!isNaN(yearA) && !isNaN(yearB)) {
                return yearA - yearB;
            }
            

            return a.year.localeCompare(b.year);
        });
        
        const chartContainer = document.getElementById('program-trend-container');
        chartContainer.innerHTML = '';
        

        const titleDiv = document.createElement('div');
        titleDiv.className = 'chart-title';
        titleDiv.textContent = `Tren Jumlah Mahasiswa: ${programName}`;
        chartContainer.appendChild(titleDiv);
        

        const canvas = document.createElement('canvas');
        canvas.id = 'program-specific-chart';
        chartContainer.appendChild(canvas);
        

        const years = programData.map(d => d.year);
        const counts = programData.map(d => d.count);
        

        new Chart(canvas, {
            type: 'line',
            data: {
                labels: years,
                datasets: [{
                    label: programName,
                    data: counts,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointRadius: 5,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: `Perkembangan Jumlah Mahasiswa ${programName}`
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y} mahasiswa`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Jumlah Mahasiswa'
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
        

        const analysisDiv = document.createElement('div');
        analysisDiv.className = 'trend-analysis';
        

        const firstYear = programData[0];
        const lastYear = programData[programData.length - 1];
        

        const overall = lastYear.count - firstYear.count;
        const percentChange = ((lastYear.count / firstYear.count) - 1) * 100;
        

        const highest = programData.reduce((max, item) => item.count > max.count ? item : max, {count: -Infinity});
        const lowest = programData.reduce((min, item) => item.count < min.count ? item : min, {count: Infinity});
        

        const total = programData.reduce((sum, item) => sum + item.count, 0);
        const average = total / programData.length;
        

        let trendDirection = '';
        if (percentChange > 0) trendDirection = 'meningkat';
        else if (percentChange < 0) trendDirection = 'menurun';
        else trendDirection = 'stabil';
        
        let analysisText = `
            <h4>Analisis Tren ${programName}</h4>
            <p>Berdasarkan data dari tahun ${firstYear.year} hingga ${lastYear.year}:</p>
            <ul>
                <li>Jumlah mahasiswa <strong>${trendDirection}</strong> sebesar ${Math.abs(overall)} orang 
                    (${percentChange.toFixed(1)}%) dari ${firstYear.count} menjadi ${lastYear.count}.</li>
                <li>Jumlah mahasiswa tertinggi terjadi pada tahun ${highest.year} dengan ${highest.count} orang.</li>
                <li>Jumlah mahasiswa terendah terjadi pada tahun ${lowest.year} dengan ${lowest.count} orang.</li>
                <li>Rata-rata jumlah mahasiswa per tahun adalah ${average.toFixed(1)} orang.</li>
            </ul>
        `;
        

        let patternText = '<p><strong>Pola Tren:</strong> ';
        

        let increasing = true;
        let decreasing = true;
        let fluctuating = false;
        
        for (let i = 1; i < programData.length; i++) {
            if (programData[i].count < programData[i-1].count) increasing = false;
            if (programData[i].count > programData[i-1].count) decreasing = false;
            if (programData[i].count !== programData[i-1].count) fluctuating = true;
        }
        
        if (increasing) {
            patternText += 'Tren konsisten naik selama periode ini. ';
            patternText += 'Hal ini menunjukkan minat yang terus meningkat terhadap program studi ini.';
        } else if (decreasing) {
            patternText += 'Tren konsisten menurun selama periode ini. ';
            patternText += 'Program studi ini mungkin perlu strategi untuk meningkatkan daya tariknya.';
        } else if (fluctuating) {

            let cyclical = true;
            if (programData.length >= 4) {
                for (let i = 2; i < programData.length; i++) {
                    if ((programData[i].count > programData[i-1].count) !== 
                        (programData[i-2].count > programData[i-3].count)) {
                        cyclical = false;
                        break;
                    }
                }
            } else {
                cyclical = false;
            }
            
            if (cyclical) {
                patternText += 'Tren menunjukkan pola siklus yang berulang. ';
                patternText += 'Hal ini mungkin terkait dengan faktor periodik seperti perubahan kebijakan pendaftaran.';
            } else {
                patternText += 'Tren berfluktuasi tanpa pola yang jelas. ';
                patternText += 'Faktor eksternal seperti perubahan kebijakan atau kondisi sosial-ekonomi mungkin mempengaruhi minat.';
            }
        } else {
            patternText += 'Jumlah mahasiswa relatif stabil selama periode ini.';
        }
        
        patternText += '</p>';
        

        let recommendationsText = '<p><strong>Rekomendasi:</strong> ';
        
        if (increasing) {
            recommendationsText += 'Dengan tren positif ini, direkomendasikan untuk meningkatkan kapasitas dan sumber daya untuk mengakomodasi pertumbuhan.';
        } else if (decreasing) {
            recommendationsText += 'Direkomendasikan evaluasi kurikulum dan strategi pemasaran untuk meningkatkan daya tarik program studi.';
        } else if (fluctuating) {
            recommendationsText += 'Diperlukan penelitian lebih lanjut tentang faktor-faktor yang mempengaruhi fluktuasi untuk perencanaan yang lebih baik.';
        } else {
            recommendationsText += 'Mempertahankan kualitas program sambil mencari peluang untuk pertumbuhan yang berkelanjutan.';
        }
        
        recommendationsText += '</p>';
        
        analysisDiv.innerHTML = analysisText + patternText + recommendationsText;
        chartContainer.appendChild(analysisDiv);
    }
    

    setTimeout(() => {
        const selectElement = document.getElementById('program-select');
        if (selectElement) {
            selectElement.addEventListener('change', (e) => {
                updateProgramChart(e.target.value);
            });
            

            if (programs.length > 0) {
                updateProgramChart(programs[0]);
            }
        }
    }, 100);
}


function generateSampleData() {
    const outputDiv = document.getElementById("output");
    outputDiv.innerHTML = "<p>Membuat data contoh...</p>";
    

    const sampleData = [
        { nama: "Siswa 1", nilai_matematika: 85, nilai_ipa: 90, nilai_bahasa: 75, minat: "Teknik", tahun: "2021" },
        { nama: "Siswa 2", nilai_matematika: 70, nilai_ipa: 65, nilai_bahasa: 90, minat: "Sosial", tahun: "2021" },
        { nama: "Siswa 3", nilai_matematika: 90, nilai_ipa: 85, nilai_bahasa: 80, minat: "Sains", tahun: "2021" },
        { nama: "Siswa 4", nilai_matematika: 75, nilai_ipa: 80, nilai_bahasa: 85, minat: "Komputer", tahun: "2021" },
        { nama: "Siswa 5", nilai_matematika: 65, nilai_ipa: 75, nilai_bahasa: 95, minat: "Bahasa", tahun: "2021" },
        { nama: "Siswa 6", nilai_matematika: 95, nilai_ipa: 92, nilai_bahasa: 88, minat: "Teknik", tahun: "2022" },
        { nama: "Siswa 7", nilai_matematika: 60, nilai_ipa: 70, nilai_bahasa: 85, minat: "Seni", tahun: "2022" },
        { nama: "Siswa 8", nilai_matematika: 78, nilai_ipa: 76, nilai_bahasa: 82, minat: "Bisnis", tahun: "2022" },
        { nama: "Siswa 9", nilai_matematika: 82, nilai_ipa: 78, nilai_bahasa: 90, minat: "Hukum", tahun: "2022" },
        { nama: "Siswa 10", nilai_matematika: 88, nilai_ipa: 84, nilai_bahasa: 79, minat: "Kedokteran", tahun: "2022" },
        { nama: "Siswa 11", nilai_matematika: 92, nilai_ipa: 88, nilai_bahasa: 70, minat: "Teknik", tahun: "2023" },
        { nama: "Siswa 12", nilai_matematika: 68, nilai_ipa: 72, nilai_bahasa: 88, minat: "Komunikasi", tahun: "2023" },
        { nama: "Siswa 13", nilai_matematika: 75, nilai_ipa: 80, nilai_bahasa: 85, minat: "Psikologi", tahun: "2023" },
        { nama: "Siswa 14", nilai_matematika: 85, nilai_ipa: 75, nilai_bahasa: 80, minat: "Ekonomi", tahun: "2023" },
        { nama: "Siswa 15", nilai_matematika: 72, nilai_ipa: 68, nilai_bahasa: 92, minat: "Sastra", tahun: "2023" },
        { nama: "Siswa 16", nilai_matematika: 65, nilai_ipa: 88, nilai_bahasa: 75, minat: "Komputer", tahun: "2024" },
        { nama: "Siswa 17", nilai_matematika: 90, nilai_ipa: 86, nilai_bahasa: 70, minat: "Teknik", tahun: "2024" },
        { nama: "Siswa 18", nilai_matematika: 82, nilai_ipa: 78, nilai_bahasa: 86, minat: "Kedokteran", tahun: "2024" },
        { nama: "Siswa 19", nilai_matematika: 77, nilai_ipa: 73, nilai_bahasa: 89, minat: "Hukum", tahun: "2024" },
        { nama: "Siswa 20", nilai_matematika: 70, nilai_ipa: 90, nilai_bahasa: 85, minat: "Sains", tahun: "2024" },
        { nama: "Siswa 21", nilai_matematika: 76, nilai_ipa: 82, nilai_bahasa: 88, minat: "Bisnis", tahun: "2025" },
        { nama: "Siswa 22", nilai_matematika: 89, nilai_ipa: 91, nilai_bahasa: 75, minat: "Teknik", tahun: "2025" },
        { nama: "Siswa 23", nilai_matematika: 72, nilai_ipa: 68, nilai_bahasa: 90, minat: "Sastra", tahun: "2025" },
        { nama: "Siswa 24", nilai_matematika: 83, nilai_ipa: 80, nilai_bahasa: 92, minat: "Komunikasi", tahun: "2025" },
        { nama: "Siswa 25", nilai_matematika: 93, nilai_ipa: 89, nilai_bahasa: 78, minat: "Teknik", tahun: "2025" }
    ];
    

    const headers = Object.keys(sampleData[0]);
    const csvRows = [
        headers.join(','),
        ...sampleData.map(row => 
            headers.map(field => row[field]).join(',')
        )
    ];
    const csvString = csvRows.join('\n');
    

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    

    const link = document.createElement('a');
    link.href = url;
    link.download = "contoh_data_input.csv";
    link.className = "download-button";
    link.innerHTML = '<i class="icon-download"></i> Download File CSV Contoh';
    

    const tableHtml = `
        <h3>Data Contoh Input</h3>
        <p>Berikut adalah contoh format data input untuk analisis distribusi program studi:</p>
        
        <div class="table-container">
            <table class="sample-table">
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
        
        <div class="download-container">
            <p>Anda dapat mengunduh file CSV contoh ini dan menguploadnya untuk menguji sistem analisis:</p>
        </div>
    `;
    
    outputDiv.innerHTML = tableHtml;
    
    const downloadContainer = document.querySelector('.download-container');
    downloadContainer.appendChild(link);
    

    const instructions = document.createElement('div');
    instructions.className = 'instructions';
    instructions.innerHTML = `
        <h4>Cara Penggunaan:</h4>
        <ol>
            <li>Download file CSV contoh dengan mengklik tombol di atas</li>
            <li>Pilih file tersebut melalui form upload di halaman ini</li>
            <li>Klik "Upload dan Analisis" untuk memproses data</li>
            <li>Sistem akan melakukan prediksi program studi berdasarkan nilai dan minat</li>
            <li>Lihat hasil analisis dan tren berdasarkan tahun pada tab visualisasi</li>
        </ol>
        <p><strong>Catatan:</strong> Data contoh ini tidak berisi kolom Program karena kolom tersebut akan dihasilkan oleh model prediksi berdasarkan nilai dan minat mahasiswa.</p>
    `;
    
    outputDiv.appendChild(instructions);
}


function switchTab(event, tabId) {

    const tabContents = document.getElementsByClassName('tab-content');
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].style.display = 'none';
    }
    

    const tabButtons = document.getElementsByClassName('tab-button');
    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].className = tabButtons[i].className.replace(' active', '');
    }
    

    document.getElementById(tabId).style.display = 'block';
    event.currentTarget.className += ' active';
}


function clearErrorLog() {
    const errorLogEl = document.getElementById('error-log');
    if (errorLogEl) {
        errorLogEl.innerHTML = '';
        errorCounter = 0;
    }
}


function toggleDevTools() {
    const devTools = document.getElementById('dev-tools-panel');
    if (devTools) {
        devTools.classList.toggle('visible');
        
        const toggleBtn = document.getElementById('toggle-dev-tools');
        if (toggleBtn) {
            if (devTools.classList.contains('visible')) {
                toggleBtn.textContent = 'Tutup Dev Tools';
            } else {
                toggleBtn.textContent = 'Buka Dev Tools';
            }
        }
    }
}


async function uploadFile() {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];
    const outputDiv = document.getElementById("output");
    
    if (!file) {
        outputDiv.innerHTML = `
            <div class="warning-message">
                <strong>Peringatan:</strong> Silakan pilih file terlebih dahulu.
            </div>
        `;
        return;
    }
    

    outputDiv.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Memproses data dan melakukan analisis, mohon tunggu...</p>
        </div>
    `;
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
        console.log('Sending analysis request...');
        const startTime = performance.now();
        
        const response = await fetch("https://web-production-68c4e.up.railway.app/predict", {
            method: "POST",
            body: formData,
        });
        
        
        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`Analysis request completed in ${duration} seconds`);
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Analysis response:', data);
        

        if (data.error) {
            let errorHtml = `
                <h3>Error Analisis</h3>
                <div class="error-message">
                    <strong>Error:</strong> ${data.error}
                </div>
            `;
            

            if (data.code) {
                errorHtml += `<p>Kode Error: ${data.code}</p>`;
            }
            
            if (data.detail) {
                errorHtml += `
                    <details>
                        <summary>Detail Error</summary>
                        <pre>${JSON.stringify(data.detail, null, 2)}</pre>
                    </details>
                `;
            }
            
            if (data.traceback) {
                errorHtml += `
                    <details>
                        <summary>Stack Trace</summary>
                        <pre>${data.traceback}</pre>
                    </details>
                `;
            }
            
            errorHtml += `
                <div class="action-buttons">
                    <button onclick="testUpload()" class="secondary-button">Tes Upload File</button>
                </div>
            `;
            
            outputDiv.innerHTML = errorHtml;
            logError('Analysis', data.error, data);
            return;
        }
        

        if (data.status === 'success' && data.result && data.result.length > 0) {
            const result = data.result;
            

            let resultHtml = `
                <h3>Hasil Analisis Program Studi</h3>
                <div class="success-message">
                    <strong>Sukses:</strong> Analisis berhasil dilakukan dalam ${duration} detik
                </div>
                
                <div class="meta-info">
                    <p><strong>Jumlah data:</strong> ${result.length} baris</p>
                </div>
            `;
            

            resultHtml += `
                <div class="result-tabs">
                    <button class="tab-button active" onclick="switchTab(event, 'visualization-tab')">Visualisasi</button>
                    <button class="tab-button" onclick="switchTab(event, 'data-tab')">Data Table</button>
                </div>
                
                <div id="visualization-tab" class="tab-content" style="display: block;">
                    <div id="visualization-container">
                        <p>Memuat visualisasi...</p>
                    </div>
                </div>
                
                <div id="data-tab" class="tab-content" style="display: none;">
                    <div class="table-container">
                    </div>
                </div>
            `;
            
            outputDiv.innerHTML = resultHtml;
            

            const columns = Object.keys(result[0]);
            

            const tableContainer = document.querySelector('#data-tab .table-container');
            tableContainer.innerHTML = `
                <table class="result-table">
                    <thead>
                        <tr>
                            ${columns.map(col => `<th>${col}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${result.slice(0, 100).map(row => `
                            <tr>
                                ${columns.map(col => `<td>${row[col]}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${result.length > 100 ? `<p class="table-note">Menampilkan 100 dari ${result.length} baris data.</p>` : ''}
            `;
            

            if (data.visualization) {

                if (!window.Chart) {
                    const scriptPromise = new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
                        script.onload = resolve;
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                    
                    await scriptPromise;
                }
                

                data.visualization.rawData = result;





data.visualization.rawData = result;


if (result.length > 0) {
    const firstRow = result[0];
    const keys = Object.keys(firstRow);
    

    const yearColumns = keys.filter(key => {

        return /^(20\d{2})$/.test(key);
    });
    
    if (yearColumns.length > 0 && keys.includes('Program')) {
        console.log("Detected wide format data with years as columns:", yearColumns);
        

        const yearlyData = [];
        

        yearColumns.forEach(year => {

            const programCounts = {};
            

            result.forEach(row => {
                const program = row.Program;
                const count = parseFloat(row[year]);
                

                if (!program || isNaN(count) || count <= 0) return;
                
                if (!programCounts[program]) {
                    programCounts[program] = 0;
                }
                
                programCounts[program] += count;
            });
            

            const topPrograms = Object.entries(programCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([program, count]) => ({ program, count }));
            

            yearlyData.push({
                year: year,
                data: topPrograms
            });
        });
        

        yearlyData.sort((a, b) => a.year.localeCompare(b.year));
        

        data.visualization.yearly_data = yearlyData;
        
        console.log("Created custom yearly_data structure:", yearlyData);
    }
}


document.getElementById('visualization-container').innerHTML = '<div id="charts-container"></div>';
createCharts(data.visualization, 'charts-container');
                

                document.getElementById('visualization-container').innerHTML = '<div id="charts-container"></div>';
                createCharts(data.visualization, 'charts-container');
            } else {


                document.getElementById('visualization-container').innerHTML = '<div id="charts-container"></div>';
                

                const visualizationData = {
                    rawData: result
                };
                

                try {

                    const programCol = Object.keys(result[0]).find(col => 
                        col.toLowerCase() === 'program' || 
                        col.toLowerCase().includes('prodi') ||
                        col.toLowerCase().includes('jurusan')
                    );
                    
                    if (programCol) {

                        const programCounts = {};
                        result.forEach(row => {
                            const program = row[programCol];
                            if (program) {
                                programCounts[program] = (programCounts[program] || 0) + 1;
                            }
                        });
                        
                        visualizationData.program_counts = programCounts;
                    }
                } catch (e) {
                    console.error('Error counting programs', e);
                }
                
                createCharts(visualizationData, 'charts-container');
            }
            
        } else {

            outputDiv.innerHTML = `
                <h3>Hasil Analisis</h3>
                <div class="warning-message">
                    <strong>Peringatan:</strong> Tidak ada hasil analisis yang dapat ditampilkan.
                </div>
                <pre>${JSON.stringify(data, null, 2)}</pre>
            `;
            logError('Analysis Result', 'No analysis results', data);
        }
        
    } catch (err) {
        console.error('Analysis error:', err);
        outputDiv.innerHTML = `
            <h3>Error Analisis</h3>
            <div class="error-message">
                <strong>Error:</strong> ${err.message}
            </div>
            <p>Gagal melakukan analisis. Coba cek koneksi server atau format file.</p>
            <div class="action-buttons">
                <button onclick="testUpload()" class="secondary-button">Tes Upload File</button>
            </div>
        `;
        logError('Analysis Request', err.message);
    }
}



async function loadChartJs() {
    if (window.Chart) return Promise.resolve(); // Already loaded
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}


function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}


function enableDevMode() {
    const devToolsToggle = document.getElementById('toggle-dev-tools');
    if (devToolsToggle) {
        devToolsToggle.style.display = 'block';
    }
    
    console.log('Developer tools available');
}


document.addEventListener("DOMContentLoaded", async function() {
    console.log('Initializing application...');
    

    try {
        await loadChartJs();
        console.log('Chart.js loaded successfully');
    } catch (err) {
        console.error('Failed to load Chart.js:', err);
    }
    

    checkAppStatus();
    

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
    

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('dev') && urlParams.get('dev') === 'true') {
        console.log('Developer mode enabled');
        enableDevMode();
    }
});