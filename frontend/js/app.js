// AetherGrid Core Application Controller
let forecastChart = null;
let mixChart = null;
let demandChart = null;
let currentRange = "24h";

// Debounce timer for sliders
let sliderDebounceTimer = null;

document.addEventListener("DOMContentLoaded", () => {
    // 1. Initialize Map
    if (typeof initDashboardMap === "function") {
        initDashboardMap();
    }

    // 2. Initialize Clock
    startLiveClock();

    // 3. Initialize Charts
    initCharts();

    // 4. Load Initial Data
    refreshDashboardData();

    // 5. Setup UI Event Listeners
    setupEventListeners();
});

// Live Clock for Ahmedabad GIDC (IST)
function startLiveClock() {
    const clockEl = document.getElementById("live-time");
    
    function updateClock() {
        const now = new Date();
        // Force IST representation
        const options = {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        };
        const timeString = now.toLocaleTimeString('en-US', options);
        clockEl.innerHTML = `<i class="fa-regular fa-clock"></i> ${timeString} IST`;
    }
    
    setInterval(updateClock, 1000);
    updateClock();
}

// Chart Initializations
function initCharts() {
    const ctxForecast = document.getElementById('forecastChart').getContext('2d');
    const ctxMix = document.getElementById('mixChart').getContext('2d');
    const ctxDemand = document.getElementById('demandSegmentationChart').getContext('2d');

    // Forecast Chart (Dual Y-Axis Line Chart)
    forecastChart = new Chart(ctxForecast, {
        type: 'line',
        data: {
            labels: Array.from({length: 24}, (_, i) => `${String(i).padStart(2, '0')}:00`),
            datasets: [
                {
                    label: 'Demand (kW)',
                    data: [],
                    borderColor: '#EA580C', // Demand Rust Orange
                    backgroundColor: 'rgba(234, 88, 12, 0.05)',
                    borderWidth: 1.5,
                    fill: true,
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'Solar Gen (kW)',
                    data: [],
                    borderColor: '#E2B13C', // Solar Muted Gold
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'Wind Gen (kW)',
                    data: [],
                    borderColor: '#0EA5E9', // Wind Sky Blue
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'Battery Charge (%)',
                    data: [],
                    borderColor: '#6366F1', // Battery Indigo
                    backgroundColor: 'rgba(99, 102, 241, 0.03)',
                    borderWidth: 1.2,
                    borderDash: [4, 4],
                    tension: 0.2,
                    yAxisID: 'y1'
                },
                {
                    label: 'Grid Import (kW)',
                    data: [],
                    borderColor: '#10B981', // Grid Emerald Green
                    backgroundColor: 'transparent',
                    borderWidth: 1.2,
                    tension: 0.3,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        font: { family: 'Outfit', size: 11 },
                        color: '#9CA3AF'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { font: { family: 'Outfit', size: 10 }, color: '#9CA3AF' }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { font: { family: 'Outfit', size: 10 }, color: '#9CA3AF' },
                    title: { display: true, text: 'Power (kW)', color: '#9CA3AF', font: { family: 'Space Grotesk', size: 11 } }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    min: 0,
                    max: 100,
                    ticks: { font: { family: 'Outfit', size: 10 }, color: '#9CA3AF' },
                    title: { display: true, text: 'State of Charge (%)', color: '#9CA3AF', font: { family: 'Space Grotesk', size: 11 } }
                }
            }
        }
    });

    // Donut Mix Chart
    mixChart = new Chart(ctxMix, {
        type: 'doughnut',
        data: {
            labels: ['Solar', 'Wind', 'Battery', 'Grid'],
            datasets: [{
                data: [0, 0, 0, 0],
                backgroundColor: [
                    '#E2B13C', // Solar Muted Gold
                    '#0EA5E9', // Wind Sky Blue
                    '#6366F1', // Battery Indigo
                    '#10B981'  // Grid Emerald Green
                ],
                borderWidth: 1.5,
                borderColor: '#0a0d14'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: { display: false }
            }
        }
    });

    // Demand Segmentation Chart
    demandChart = new Chart(ctxDemand, {
        type: 'bar',
        data: {
            labels: ['HVAC Base', 'Thermal Systems', 'Mechanical Drives', 'Lighting & Aux'],
            datasets: [{
                label: 'Consumption Share (kW)',
                data: [0, 0, 0, 0],
                backgroundColor: 'rgba(234, 88, 12, 0.15)',
                borderColor: '#EA580C',
                borderWidth: 1.5,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'transparent' },
                    ticks: { font: { family: 'Outfit', size: 10 }, color: '#9CA3AF' }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { font: { family: 'Outfit', size: 10 }, color: '#9CA3AF' }
                }
            }
        }
    });
}

// Fetch dashboard simulated data
function refreshDashboardData() {
    const profileId = document.getElementById("msme-profile-selector").value;
    const temp = document.getElementById("slider-temp").value;
    const clouds = document.getElementById("slider-clouds").value;
    const wind = document.getElementById("slider-wind").value;
    const humidity = document.getElementById("slider-humidity").value;

    const url = `/api/energy-data?profile=${profileId}&range=${currentRange}&temperature=${temp}&cloud_cover=${clouds}&wind_speed=${wind}&humidity=${humidity}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            updateDashboardDOM(data);
            fetchRecommendations(profileId, clouds);
            fetchAlerts(profileId, clouds, wind, temp);
        })
        .catch(err => {
            console.error("Error fetching telemetry:", err);
        });
}

// Update DOM elements with new telemetry data
function updateDashboardDOM(data) {
    const metrics = data.metrics;
    const profile = data.profile;
    const series = data.time_series;

    // Update Header
    document.getElementById("facility-title").textContent = profile.name;
    document.getElementById("profile-description").textContent = profile.description;
    document.getElementById("tariff-label").textContent = profile.tariff_type;
    
    // Color code and label Grid health
    const gridStatusLabel = document.getElementById("grid-status-label");
    const gridVal = metrics.grid_stability_score;
    gridStatusLabel.textContent = gridVal > 98 ? `Optimal (${gridVal}%)` : gridVal > 96 ? `Stable (${gridVal}%)` : `Fluctuating (${gridVal}%)`;
    const pulseDot = document.querySelector(".pulse-dot");
    if (gridVal > 98) {
        pulseDot.className = "pulse-dot green-glow";
        gridStatusLabel.style.color = "var(--color-grid)";
    } else if (gridVal > 96) {
        pulseDot.className = "pulse-dot orange-glow"; // Needs style rules if we want to change color dynamically
        gridStatusLabel.style.color = "var(--color-demand)";
    } else {
        pulseDot.className = "pulse-dot red-glow";
        gridStatusLabel.style.color = "var(--color-risk)";
    }

    // Update KPIs
    document.getElementById("metric-renew-pct").textContent = metrics.renewable_utilization_pct;
    document.getElementById("metric-gen-kwh").textContent = Math.round(metrics.total_gen_kwh).toLocaleString();
    document.getElementById("metric-stability").textContent = metrics.grid_stability_score;
    document.getElementById("metric-accuracy").textContent = metrics.forecast_accuracy;
    
    // Net Balance coloring
    const balanceWrapper = document.getElementById("balance-value-wrapper");
    const balanceSub = document.getElementById("balance-sub");
    const netBal = metrics.net_balance_kwh;
    
    if (netBal >= 0) {
        balanceWrapper.textContent = `+${Math.round(netBal)} kW`;
        balanceWrapper.className = "kpi-value text-green";
        balanceSub.textContent = "Injecting surplus to battery";
    } else {
        balanceWrapper.textContent = `${Math.round(netBal)} kW`;
        balanceWrapper.className = "kpi-value text-orange";
        balanceSub.textContent = "Drawing dependency from Grid";
    }

    // Impact / ESG score card
    document.getElementById("esg-savings").textContent = Math.round(metrics.total_cost_saved_inr).toLocaleString();
    document.getElementById("esg-co2").textContent = (metrics.total_co2_saved_kg / 1000.0).toFixed(1);
    document.getElementById("esg-trees").textContent = Math.round(metrics.total_co2_saved_kg * 0.045).toLocaleString(); // 1 tree = ~22kg capture/year
    document.getElementById("esg-eff").textContent = (metrics.renewable_utilization_pct * 0.31).toFixed(1);

    // Weather impact scores
    const tempVal = parseFloat(document.getElementById("slider-temp").value);
    const cloudVal = parseFloat(document.getElementById("slider-clouds").value);
    const windVal = parseFloat(document.getElementById("slider-wind").value);
    
    // Calculate Solar Impact Score (drops with cloud and temp > 25)
    let solarLoss = 0;
    if (tempVal > 25) {
        solarLoss = 0.4 * (tempVal - 25);
    }
    const solarScore = Math.max(0, Math.round(100 - (cloudVal * 0.8) - solarLoss));
    document.getElementById("impact-solar-score").textContent = solarScore;
    document.getElementById("bar-solar-impact").style.width = `${solarScore}%`;
    document.getElementById("solar-impact-note").innerHTML = `Peak solar capacity at ${profile.solar_capacity} kW. Thermal losses: <strong>${solarLoss.toFixed(1)}%</strong>. Cloud block: <strong>${Math.round(cloudVal * 0.8)}%</strong>.`;

    // Calculate Wind Impact Score
    let windScore = 0;
    let windMsg = "";
    if (profile.wind_capacity > 0) {
        if (windVal < 5) {
            windScore = 0;
            windMsg = "Breeze below turbine cut-in speed.";
        } else if (windVal <= 25) {
            windScore = Math.round(((windVal - 5) / 20) * 100);
            windMsg = "Partial turbine output active.";
        } else if (windVal <= 55) {
            windScore = 100;
            windMsg = "Turbines running at full nameplate capacity.";
        } else {
            windScore = 0;
            windMsg = "Severe wind safety cutout triggered.";
        }
    } else {
        windScore = 0;
        windMsg = "No wind turbines installed at this GIDC site.";
    }
    document.getElementById("impact-wind-score").textContent = windScore;
    document.getElementById("bar-wind-impact").style.width = `${windScore}%`;
    document.getElementById("wind-impact-note").textContent = windMsg;

    // Risk levels
    const riskLabel = document.getElementById("impact-risk-label");
    if (cloudVal > 75 || windVal > 55 || tempVal > 43) {
        riskLabel.textContent = "High Risk";
        riskLabel.className = "impact-metric text-red";
    } else if (cloudVal > 50 || windVal > 40 || tempVal > 38) {
        riskLabel.textContent = "Elevated Risk";
        riskLabel.className = "impact-metric text-orange";
    } else {
        riskLabel.textContent = "Nominal";
        riskLabel.className = "impact-metric text-green";
    }

    // Update Battery Status Visuals
    const lastRecord = series[series.length - 1] || { battery_soc: 40, battery_action: "Idle", solar_gen: 0, wind_gen: 0, demand: 250, net_grid_draw: 150 };
    
    // Average State of Charge in series to represent current
    const currentSoc = Math.round(lastRecord.battery_soc);
    document.getElementById("battery-fill-level").style.height = `${currentSoc}%`;
    document.getElementById("battery-percentage-display").textContent = `${currentSoc}%`;
    document.getElementById("battery-cap-display").textContent = `${profile.battery_capacity} kWh`;
    
    const batteryStatusLabel = document.getElementById("battery-status-action");
    const batteryRateLabel = document.getElementById("battery-status-rate");
    batteryStatusLabel.textContent = lastRecord.battery_action;
    
    if (lastRecord.battery_action === "Charging") {
        batteryStatusLabel.className = "text-green";
        const flowKw = Math.max(5, Math.round((lastRecord.solar_gen + lastRecord.wind_gen - lastRecord.demand) * 0.6));
        batteryRateLabel.textContent = `Storing +${flowKw} kW excess power`;
    } else if (lastRecord.battery_action === "Discharging") {
        batteryStatusLabel.className = "text-red";
        const flowKw = Math.round(lastRecord.demand - (lastRecord.solar_gen + lastRecord.wind_gen));
        batteryRateLabel.textContent = `Discharging ${flowKw} kW to load`;
    } else {
        batteryStatusLabel.className = "text-battery";
        batteryRateLabel.textContent = `Standby mode`;
    }

    // Update Forecast Chart Data
    let labels = [];
    if (currentRange === "24h") {
        labels = series.map(r => `${String(r.hour).padStart(2, '0')}:00`);
    } else if (currentRange === "7d") {
        labels = series.map((r, i) => i % 24 === 0 ? `Day ${Math.floor(i/24) + 1}` : '');
    } else {
        labels = series.map((r, i) => i % 24 === 0 ? `D${Math.floor(i/24) + 1}` : '');
    }
    
    forecastChart.data.labels = labels;
    forecastChart.data.datasets[0].data = series.map(r => r.demand);
    forecastChart.data.datasets[1].data = series.map(r => r.solar_gen);
    forecastChart.data.datasets[2].data = series.map(r => r.wind_gen);
    forecastChart.data.datasets[3].data = series.map(r => r.battery_soc);
    forecastChart.data.datasets[4].data = series.map(r => r.net_grid_draw);
    forecastChart.update();

    // Update Energy Mix Donut Data
    const totalSolar = series.reduce((sum, r) => sum + r.solar_gen, 0);
    const totalWind = series.reduce((sum, r) => sum + r.wind_gen, 0);
    const totalGrid = series.reduce((sum, r) => sum + r.net_grid_draw, 0);
    // battery total action representation
    const totalBatteryDischarge = series.filter(r => r.battery_action === "Discharging").reduce((sum, r) => sum + (r.demand - (r.solar_gen + r.wind_gen)), 0);

    mixChart.data.datasets[0].data = [
        Math.round(totalSolar),
        Math.round(totalWind),
        Math.round(totalBatteryDischarge),
        Math.round(totalGrid)
    ];
    mixChart.update();

    // Update Legends in DOM
    const currentHourData = series[new Date().getHours()] || lastRecord;
    document.getElementById("legend-solar").textContent = `${Math.round(currentHourData.solar_gen)} kW`;
    document.getElementById("legend-wind").textContent = `${Math.round(currentHourData.wind_gen)} kW`;
    document.getElementById("legend-battery").textContent = `${currentHourData.battery_action === "Discharging" ? "-" : currentHourData.battery_action === "Charging" ? "+" : ""}${Math.round(Math.abs(currentHourData.demand - currentHourData.solar_gen - currentHourData.wind_gen))} kW`;
    document.getElementById("legend-grid").textContent = `${Math.round(currentHourData.net_grid_draw)} kW`;

    // Dynamic Segmentations (Mock proportions based on GIDC profiles)
    const profileId = document.getElementById("msme-profile-selector").value;
    let segments = [0, 0, 0, 0];
    let hvacLabel = "42 kW";
    let peakLabel = "12:00 PM";
    if (profileId === "textile") {
        segments = [50, 40, 280, 30]; // Heavy mechanical drives for loom
        hvacLabel = "50 kW";
        peakLabel = "11:00 AM";
    } else if (profileId === "pharmaceutical") {
        segments = [210, 20, 100, 30]; // High HVAC for cleanroom
        hvacLabel = "210 kW";
        peakLabel = "02:00 PM";
    } else if (profileId === "chemical") {
        segments = [80, 190, 160, 20]; // High thermal process heating
        hvacLabel = "80 kW";
        peakLabel = "04:00 PM";
    } else if (profileId === "engineering") {
        segments = [15, 10, 210, 15]; // Intermittent welding loads
        hvacLabel = "15 kW";
        peakLabel = "10:00 AM";
    } else if (profileId === "packaging") {
        segments = [30, 20, 140, 20]; // Mechanical printing lines
        hvacLabel = "30 kW";
        peakLabel = "12:00 PM";
    } else {
        segments = [90, 50, 80, 15]; // Dairy pasteurization thermal/refrig
        hvacLabel = "90 kW";
        peakLabel = "08:00 AM";
    }
    
    demandChart.data.datasets[0].data = segments;
    demandChart.update();

    document.getElementById("hvac-draw-label").textContent = hvacLabel;
    document.getElementById("peak-hour-label").textContent = peakLabel;

    // Trigger visual connection lines flow animations speed
    adjustFlowLineAnimation(lastRecord);
}

// Control animation speed/visibility based on battery active flow state
function adjustFlowLineAnimation(record) {
    const arrowSolar = document.querySelector(".arrow-solar");
    const arrowWind = document.querySelector(".arrow-wind");
    const arrowBattery = document.querySelector(".arrow-battery");
    const arrowFactory = document.querySelector(".arrow-factory");

    // Clear previous dynamic anims
    if (record.solar_gen > 2) {
        arrowSolar.style.animation = "flow-line 1.2s linear infinite";
        arrowSolar.style.display = "block";
    } else {
        arrowSolar.style.display = "none";
    }

    if (record.wind_gen > 2) {
        arrowWind.style.animation = "flow-line 1.5s linear infinite";
        arrowWind.style.display = "block";
    } else {
        arrowWind.style.display = "none";
    }

    if (record.battery_action === "Charging") {
        arrowBattery.style.animation = "flow-line 1.8s linear infinite reverse";
        arrowBattery.style.display = "block";
    } else if (record.battery_action === "Discharging") {
        arrowBattery.style.animation = "flow-line 1.8s linear infinite";
        arrowBattery.style.display = "block";
    } else {
        arrowBattery.style.display = "none";
    }

    if (record.demand > 10) {
        arrowFactory.style.animation = "flow-line 1s linear infinite";
        arrowFactory.style.display = "block";
    } else {
        arrowFactory.style.display = "none";
    }
}

// Fetch dynamic optimization recommendations
function fetchRecommendations(profileId, clouds) {
    const listWrapper = document.getElementById("recommendations-list-wrapper");
    const url = `/api/recommendations?profile=${profileId}&cloud_cover=${clouds}`;

    fetch(url)
        .then(res => res.json())
        .then(recs => {
            listWrapper.innerHTML = "";
            if (recs.length === 0) {
                listWrapper.innerHTML = `<div class="rec-loading">All systems operating optimally. No actions recommended.</div>`;
                return;
            }
            recs.forEach(rec => {
                const card = document.createElement("div");
                card.className = "rec-card";
                
                // Color mapping
                if (rec.type === "Load Shifting") {
                    card.style.borderLeftColor = "var(--color-demand)";
                } else if (rec.type === "Storage Arbitrage") {
                    card.style.borderLeftColor = "var(--color-battery)";
                } else {
                    card.style.borderLeftColor = "var(--color-grid)";
                }

                card.innerHTML = `
                    <div class="rec-title-row">
                        <h4>${rec.title}</h4>
                        <span class="rec-savings">₹${rec.savings_inr.toLocaleString()} Saved</span>
                    </div>
                    <p class="rec-msg">${rec.action}</p>
                    <div class="rec-sub">
                        <span>Impact: ${rec.impact}</span>
                    </div>
                `;
                listWrapper.appendChild(card);
            });
        })
        .catch(err => {
            console.error("Error fetching recommendations:", err);
        });
}

// Fetch dynamic warnings & alerts
function fetchAlerts(profileId, clouds, wind, temp) {
    const listWrapper = document.getElementById("alerts-list-wrapper");
    const url = `/api/alerts?profile=${profileId}&cloud_cover=${clouds}&wind_speed=${wind}&temperature=${temp}`;

    fetch(url)
        .then(res => res.json())
        .then(alerts => {
            listWrapper.innerHTML = "";
            if (alerts.length === 0) {
                listWrapper.innerHTML = `
                    <div style="text-align: center; color: var(--color-text-secondary); font-size: 12px; padding: 20px;">
                        <i class="fa-solid fa-circle-check text-green" style="font-size: 20px; margin-bottom: 6px; display: block;"></i>
                        No active anomalies or grid risks.
                    </div>
                `;
                return;
            }
            alerts.forEach(alert => {
                const div = document.createElement("div");
                div.className = `alert-item alert-severity-${alert.severity}`;
                div.innerHTML = `
                    <div class="alert-icon-col ${alert.severity}">
                        <i class="fa-solid ${alert.severity === 'high' ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i>
                    </div>
                    <div class="alert-info-col">
                        <h4>${alert.title}</h4>
                        <p>${alert.message}</p>
                        <span>${alert.category} • ${alert.time}</span>
                    </div>
                `;
                listWrapper.appendChild(div);
            });
        })
        .catch(err => {
            console.error("Error fetching alerts:", err);
        });
}

// Chatbot Event Binding and Functions
let chatHistory = [];

function appendChatMessage(sender, text, isHtml = false) {
    const chatLog = document.getElementById("chat-history-log");
    const messageEl = document.createElement("div");
    messageEl.className = `chat-message ${sender === 'user' ? 'user-msg' : 'bot-msg'}`;
    
    const avatar = sender === 'user' ? 
        `<div class="user-avatar"><i class="fa-solid fa-user"></i></div>` : 
        `<div class="bot-avatar"><i class="fa-solid fa-robot"></i></div>`;
        
    const content = isHtml ? text : `<p>${escapeHTML(text)}</p>`;

    messageEl.innerHTML = `
        ${avatar}
        <div class="msg-bubble">
            ${content}
        </div>
    `;

    chatLog.appendChild(messageEl);
    chatLog.scrollTop = chatLog.scrollHeight;
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// Convert markdown text to browser renderable HTML structure
function formatMarkdownToHTML(text) {
    // Bold
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Ordered Lists
    formatted = formatted.replace(/^\s*\d\.\s+(.*)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>)/g, '<ol>$1</ol>');
    
    // Bullet Lists
    formatted = formatted.replace(/^\s*[\-\*]\s+(.*)$/gm, '<li>$1</li>');
    // Group adjacent lists
    formatted = formatted.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');

    // Remove empty tag wrappers nested incorrectly
    formatted = formatted.replace(/<\/ul>\s*<ul>/g, '');
    formatted = formatted.replace(/<\/ol>\s*<ol>/g, '');

    // Headers
    formatted = formatted.replace(/### (.*?)$/gm, '<h3>$1</h3>');
    formatted = formatted.replace(/## (.*?)$/gm, '<h2>$1</h2>');

    // Paragraph splits
    const paragraphs = formatted.split("\n\n");
    formatted = paragraphs.map(p => {
        if (p.trim().startsWith("<h") || p.trim().startsWith("<u") || p.trim().startsWith("<o")) {
            return p;
        }
        return `<p>${p.replace(/\n/g, "<br>")}</p>`;
    }).join("");

    return formatted;
}

function sendChatMessage(text) {
    if (!text.trim()) return;

    // Append User message
    appendChatMessage('user', text);
    chatHistory.push({ sender: 'user', text: text });
    
    // Clear input
    document.getElementById("chat-input-text").value = "";

    // Append loading state bubble
    const chatLog = document.getElementById("chat-history-log");
    const loaderId = "loader_" + Date.now();
    const loaderEl = document.createElement("div");
    loaderEl.className = "chat-message bot-msg";
    loaderEl.id = loaderId;
    loaderEl.innerHTML = `
        <div class="bot-avatar"><i class="fa-solid fa-robot"></i></div>
        <div class="msg-bubble">
            <p><i class="fa-solid fa-circle-notch fa-spin"></i> Copilot is analyzing Ahmedabad telemetry...</p>
        </div>
    `;
    chatLog.appendChild(loaderEl);
    chatLog.scrollTop = chatLog.scrollHeight;

    // Fetch data from Copilot API
    const profileId = document.getElementById("msme-profile-selector").value;
    const temp = document.getElementById("slider-temp").value;
    const clouds = document.getElementById("slider-clouds").value;
    const wind = document.getElementById("slider-wind").value;
    const humidity = document.getElementById("slider-humidity").value;

    const payload = {
        prompt: text,
        profile: profileId,
        weather: {
            temperature: temp,
            cloud_cover: clouds,
            wind_speed: wind,
            humidity: humidity
        },
        history: chatHistory
    };

    fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        // Remove loader
        const loader = document.getElementById(loaderId);
        if (loader) loader.remove();

        const formattedResponse = formatMarkdownToHTML(data.response);
        appendChatMessage('bot', formattedResponse, true);
        chatHistory.push({ sender: 'bot', text: data.response });
    })
    .catch(err => {
        console.error("Copilot communication error:", err);
        const loader = document.getElementById(loaderId);
        if (loader) loader.remove();
        appendChatMessage('bot', "Apologies, I encountered a communication error with the energy processing service. Please check that the backend server is running.");
    });
}

// Bind GUI components
function setupEventListeners() {
    // Industry Selector
    const selector = document.getElementById("msme-profile-selector");
    selector.addEventListener("change", (e) => {
        const val = e.target.value;
        refreshDashboardData();
        
        // Pan and trigger Leaflet map change
        if (typeof focusMapOnCluster === "function") {
            focusMapOnCluster(val);
        }
    });

    // Range Sliders
    const sliders = ["temp", "clouds", "wind", "humidity"];
    sliders.forEach(id => {
        const slider = document.getElementById(`slider-${id}`);
        const display = document.getElementById(`val-${id}`);
        
        slider.addEventListener("input", (e) => {
            display.textContent = e.target.value;
            
            // Debounce slider updates to avoid flooding API requests
            clearTimeout(sliderDebounceTimer);
            sliderDebounceTimer = setTimeout(() => {
                refreshDashboardData();
            }, 300);
        });
    });

    // Tab buttons for Forecast Center
    const tabBtns = document.querySelectorAll(".tab-btn");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            tabBtns.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            currentRange = e.target.getAttribute("data-range");
            refreshDashboardData();
        });
    });

    // Chatbot submissions
    const sendBtn = document.getElementById("btn-send-message");
    const chatInput = document.getElementById("chat-input-text");

    sendBtn.addEventListener("click", () => {
        sendChatMessage(chatInput.value);
    });

    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            sendChatMessage(chatInput.value);
        }
    });

    // Suggestion chips
    const chipContainer = document.querySelector(".suggestion-chips-container");
    chipContainer.addEventListener("click", (e) => {
        if (e.target.classList.contains("chip-btn")) {
            const query = e.target.getAttribute("data-query");
            sendChatMessage(query);
        }
    });

    // Reset Chatbot history
    const resetChatBtn = document.getElementById("btn-clear-chat");
    resetChatBtn.addEventListener("click", () => {
        const chatLog = document.getElementById("chat-history-log");
        chatHistory = [];
        chatLog.innerHTML = `
            <div class="chat-message bot-msg">
                <div class="bot-avatar"><i class="fa-solid fa-robot"></i></div>
                <div class="msg-bubble">
                    <p>Namaste! I am your <strong>AetherGrid AI Copilot</strong> specialized in Ahmedabad GIDC energy optimization. How can I assist you with your machine scheduling, solar predictions, or Torrent Power bills today?</p>
                </div>
            </div>
        `;
    });

    // Export PDF Audit Report
    const exportBtn = document.getElementById("btn-export-report");
    exportBtn.addEventListener("click", () => {
        const profileId = document.getElementById("msme-profile-selector").value;
        const profileText = document.getElementById("msme-profile-selector").options[document.getElementById("msme-profile-selector").selectedIndex].text;
        
        const timestamp = new Date().toLocaleString();
        
        let reportWindow = window.open("", "_blank");
        reportWindow.document.write(`
            <html>
            <head>
                <title>AetherGrid Energy Audit - ${profileText}</title>
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
                    h1 { color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 5px; }
                    .subtitle { font-size: 14px; color: #666; margin-bottom: 30px; }
                    .section { margin-bottom: 20px; }
                    h3 { color: #1e3a8a; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                    th { background-color: #f3f4f6; color: #1e3a8a; }
                    .footer { margin-top: 50px; font-size: 11px; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
                </style>
            </head>
            <body>
                <h1>AETHERGRID ENERGY PERFORMANCE AUDIT</h1>
                <div class="subtitle">Generated on ${timestamp} for ${profileText} • Ahmedabad Industrial Zone</div>
                
                <div class="section">
                    <h3>1. Executive Operations Summary</h3>
                    <p>This automated energy report audits current power dispatch optimization metrics based on active GIDC telemetry interfaces. The grid stability coefficient stands at <strong>${document.getElementById("metric-stability").textContent}%</strong>.</p>
                    
                    <table>
                        <tr>
                            <th>Performance Metric</th>
                            <th>Current Value</th>
                            <th>Operational Impact</th>
                        </tr>
                        <tr>
                            <td>Renewable Energy Share</td>
                            <td>${document.getElementById("metric-renew-pct").textContent}%</td>
                            <td>Proportion of factory operations powered by solar/wind arrays</td>
                        </tr>
                        <tr>
                            <td>Calculated Financial Savings</td>
                            <td>₹${document.getElementById("esg-savings").textContent}</td>
                            <td>Cumulative savings achieved through peak tariff arbitrage</td>
                        </tr>
                        <tr>
                            <td>ESG Carbon Displacement</td>
                            <td>${document.getElementById("esg-co2").textContent} Tons CO₂</td>
                            <td>Equivalent carbon emission offsets in state coal generation</td>
                        </tr>
                        <tr>
                            <td>Simulation Load Offset</td>
                            <td>${document.getElementById("metric-balance").textContent}</td>
                            <td>Net electrical balance with the state grid hub</td>
                        </tr>
                    </table>
                </div>

                <div class="section">
                    <h3>2. Dynamic AI Advisory Insights</h3>
                    <p>Based on current ambient conditions of <strong>${document.getElementById("val-temp").textContent}°C</strong>, solar capacity performance is adjusted to solar coefficient: <strong>${document.getElementById("impact-solar-score").textContent}/100</strong>.</p>
                    <p><strong>Load Shifting Recommendation:</strong> We recommend shifting batch cycles out of peak-tariff hours (18:00 - 22:00) to peak solar output slots. Estimated monthly savings: ₹${(parseFloat(document.getElementById("esg-savings").textContent.replace(/,/g, '')) * 0.25).toFixed(0)}.</p>
                </div>
                
                <div class="footer">
                    AetherGrid Climate-Tech Industrial Platform • Ahmedabad MSME Clean Energy Initiative. Confidential Report for Internal Audits.
                </div>
                <script>window.print();</script>
            </body>
            </html>
        `);
        reportWindow.document.close();
    });

    // --- Energy Audit & Calculator Event Listeners ---
    
    const navDashboard = document.getElementById("nav-dashboard");
    const navAudit = document.getElementById("nav-audit");
    const viewDashboard = document.getElementById("view-dashboard");
    const viewAudit = document.getElementById("view-audit");

    navDashboard.addEventListener("click", (e) => {
        e.preventDefault();
        navAudit.classList.remove("active");
        navDashboard.classList.add("active");
        viewAudit.style.display = "none";
        viewDashboard.style.display = "block";
        
        // Force Leaflet map layout redraw since container display was none
        if (typeof map !== "undefined" && map) {
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }
    });

    navAudit.addEventListener("click", (e) => {
        e.preventDefault();
        navDashboard.classList.remove("active");
        navAudit.classList.add("active");
        viewDashboard.style.display = "none";
        viewAudit.style.display = "block";
        
        // If inventory is empty, auto-load template of currently selected profile
        if (auditInventory.length === 0) {
            const profileVal = document.getElementById("msme-profile-selector").value;
            loadAuditTemplate(profileVal);
        }
    });

    document.getElementById("btn-load-template").addEventListener("click", () => {
        const profileVal = document.getElementById("msme-profile-selector").value;
        loadAuditTemplate(profileVal);
    });

    document.getElementById("btn-clear-audit-rows").addEventListener("click", () => {
        auditInventory = [];
        renderAuditTable();
        calculateAuditTotals();
    });

    document.getElementById("btn-sync-audit").addEventListener("click", () => {
        syncAuditToCopilot();
    });

    document.getElementById("add-audit-item-form").addEventListener("submit", (e) => {
        e.preventDefault();
        
        const nameInput = document.getElementById("audit-item-name");
        const catInput = document.getElementById("audit-item-category");
        const powerInput = document.getElementById("audit-item-power");
        const qtyInput = document.getElementById("audit-item-qty");
        const hoursInput = document.getElementById("audit-item-hours");
        
        const name = nameInput.value.trim();
        const category = catInput.value;
        const power = parseFloat(powerInput.value);
        const qty = parseInt(qtyInput.value);
        const hours = parseFloat(hoursInput.value);
        
        if (name && !isNaN(power) && !isNaN(qty) && !isNaN(hours)) {
            auditInventory.push({
                id: "item_" + Math.random().toString(36).substr(2, 9),
                name: name,
                category: category,
                power: power,
                qty: qty,
                hours: hours
            });
            
            // Reset form fields
            nameInput.value = "";
            powerInput.value = "15";
            qtyInput.value = "1";
            hoursInput.value = "8";
            
            renderAuditTable();
            calculateAuditTotals();
        }
    });
}

// --- Energy Audit Calculator Engine & Data ---

const AUDIT_TEMPLATES = {
    textile: [
        { name: "Ring Spinning Frames", category: "Mechanical", power: 45, qty: 6, hours: 16 },
        { name: "Weaving Looms", category: "Mechanical", power: 15, qty: 12, hours: 16 },
        { name: "Dyeing Jet Machines", category: "Process Heating", power: 75, qty: 2, hours: 8 },
        { name: "Air Compressors", category: "Mechanical", power: 30, qty: 2, hours: 24 },
        { name: "Humidification Plant", category: "HVAC", power: 40, qty: 1, hours: 24 },
        { name: "Factory Shed Lighting", category: "Lighting", power: 8, qty: 1, hours: 12 }
    ],
    pharmaceutical: [
        { name: "AHU Cleanroom HVAC", category: "HVAC", power: 110, qty: 2, hours: 24 },
        { name: "Cold Storage Compression", category: "HVAC", power: 45, qty: 2, hours: 24 },
        { name: "Formulation Mixers", category: "Mechanical", power: 25, qty: 4, hours: 8 },
        { name: "Autoclave Sterilizer", category: "Process Heating", power: 60, qty: 2, hours: 6 },
        { name: "Blister Packaging Lines", category: "Mechanical", power: 15, qty: 3, hours: 12 },
        { name: "Laboratory HVAC & Aux", category: "HVAC", power: 35, qty: 1, hours: 12 }
    ],
    chemical: [
        { name: "Glass Lined Reactors", category: "Mechanical", power: 18, qty: 8, hours: 24 },
        { name: "Boiler Feed Pumps", category: "Mechanical", power: 30, qty: 2, hours: 24 },
        { name: "Steam Heat Exchanger", category: "Process Heating", power: 120, qty: 1, hours: 12 },
        { name: "Cooling Towers", category: "HVAC", power: 22, qty: 3, hours: 24 },
        { name: "Centrifuge Extractors", category: "Mechanical", power: 15, qty: 4, hours: 10 },
        { name: "Effluent Treatment Plant", category: "Mechanical", power: 25, qty: 1, hours: 24 }
    ],
    engineering: [
        { name: "MIG/TIG Welding Stations", category: "Other", power: 12, qty: 15, hours: 8 },
        { name: "CNC Turning Lathes", category: "Mechanical", power: 22, qty: 6, hours: 12 },
        { name: "Hydraulic Press (100T)", category: "Mechanical", power: 45, qty: 2, hours: 8 },
        { name: "Air Plasma Cutter", category: "Other", power: 30, qty: 1, hours: 6 },
        { name: "Overhead Gantry Cranes", category: "Mechanical", power: 15, qty: 2, hours: 4 },
        { name: "Workshop Ventilation & Aux", category: "HVAC", power: 12, qty: 1, hours: 10 }
    ],
    packaging: [
        { name: "Rotogravure Printing Line", category: "Mechanical", power: 85, qty: 1, hours: 16 },
        { name: "High Speed Slitting Machines", category: "Mechanical", power: 12, qty: 4, hours: 12 },
        { name: "Dry Lamination Machine", category: "Process Heating", power: 45, qty: 2, hours: 16 },
        { name: "Extrusion Coating Line", category: "Mechanical", power: 60, qty: 1, hours: 24 },
        { name: "Air Chiller Systems", category: "HVAC", power: 30, qty: 1, hours: 24 },
        { name: "Warehouse Highbay Lights", category: "Lighting", power: 5, qty: 1, hours: 10 }
    ],
    food_processing: [
        { name: "Pasteurization System", category: "Process Heating", power: 90, qty: 1, hours: 8 },
        { name: "Blast Freezer Compressors", category: "HVAC", power: 55, qty: 2, hours: 24 },
        { name: "Cold Storage Rooms", category: "HVAC", power: 25, qty: 4, hours: 24 },
        { name: "Homogenizer Pump", category: "Mechanical", power: 30, qty: 1, hours: 6 },
        { name: "Bottling & Packing Conveyors", category: "Mechanical", power: 11, qty: 4, hours: 12 },
        { name: "CIP Cleaning Heater", category: "Process Heating", power: 40, qty: 1, hours: 4 }
    ]
};

let auditInventory = [];
let auditChart = null;

function loadAuditTemplate(sectorId) {
    const template = AUDIT_TEMPLATES[sectorId] || AUDIT_TEMPLATES["textile"];
    auditInventory = template.map(item => ({
        id: "item_" + Math.random().toString(36).substr(2, 9),
        name: item.name,
        category: item.category,
        power: item.power,
        qty: item.qty,
        hours: item.hours
    }));
    renderAuditTable();
    calculateAuditTotals();
}

function renderAuditTable() {
    const tbody = document.getElementById("audit-table-tbody");
    tbody.innerHTML = "";
    
    if (auditInventory.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: var(--color-text-secondary); padding: 30px 10px;">
                    <i class="fa-solid fa-calculator" style="font-size: 24px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
                    No machinery added yet. Click "Load MSME Template" or fill the form below.
                </td>
            </tr>
        `;
        return;
    }
    
    auditInventory.forEach(item => {
        const row = document.createElement("tr");
        row.style.borderBottom = "1px solid var(--border-color)";
        
        const dailyKwh = (item.power * item.qty * item.hours).toFixed(1);
        
        row.innerHTML = `
            <td style="padding: 10px 8px; font-weight: 500; color: var(--color-text-primary);">${escapeHTML(item.name)}</td>
            <td style="padding: 10px 8px; color: var(--color-text-secondary);"><span class="legend-dot" style="background-color: ${getCategoryColor(item.category)}; margin-right: 6px; display: inline-block; width: 6px; height: 6px; border-radius: 50%;"></span>${item.category}</td>
            <td style="padding: 10px 8px;">
                <input type="number" step="0.1" min="0.1" value="${item.power}" class="custom-input" style="width: 70px; padding: 4px 6px; background: rgba(0,0,0,0.15);" onchange="updateAuditRow('${item.id}', 'power', this.value)">
            </td>
            <td style="padding: 10px 8px;">
                <input type="number" step="1" min="1" value="${item.qty}" class="custom-input" style="width: 55px; padding: 4px 6px; background: rgba(0,0,0,0.15);" onchange="updateAuditRow('${item.id}', 'qty', this.value)">
            </td>
            <td style="padding: 10px 8px;">
                <input type="number" step="0.5" min="0.5" max="24" value="${item.hours}" class="custom-input" style="width: 55px; padding: 4px 6px; background: rgba(0,0,0,0.15);" onchange="updateAuditRow('${item.id}', 'hours', this.value)">
            </td>
            <td style="padding: 10px 8px; font-weight: 600; color: var(--color-text-primary);">${dailyKwh} kWh</td>
            <td style="padding: 10px 8px; text-align: center;">
                <button class="action-btn" style="border: none; background: transparent; padding: 4px; color: var(--color-risk); cursor: pointer;" onclick="deleteAuditRow('${item.id}')">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function getCategoryColor(category) {
    switch (category) {
        case "HVAC": return "var(--color-wind)";
        case "Process Heating": return "var(--color-demand)";
        case "Mechanical": return "var(--color-battery)";
        case "Lighting": return "var(--color-solar)";
        default: return "var(--color-text-secondary)";
    }
}

function updateAuditRow(id, field, value) {
    const item = auditInventory.find(i => i.id === id);
    if (item) {
        const val = parseFloat(value);
        if (!isNaN(val) && val >= 0) {
            item[field] = val;
            calculateAuditTotals();
            const tbody = document.getElementById("audit-table-tbody");
            const rows = tbody.getElementsByTagName("tr");
            const idx = auditInventory.indexOf(item);
            if (idx !== -1 && rows[idx]) {
                const cells = rows[idx].getElementsByTagName("td");
                const dailyCell = cells[5];
                dailyCell.textContent = `${(item.power * item.qty * item.hours).toFixed(1)} kWh`;
            }
        }
    }
}

function deleteAuditRow(id) {
    auditInventory = auditInventory.filter(item => item.id !== id);
    renderAuditTable();
    calculateAuditTotals();
}

function calculateAuditTotals() {
    let totalLoad = 0;
    let totalDailyKwh = 0;
    let categoryLoads = { HVAC: 0, "Process Heating": 0, Mechanical: 0, Lighting: 0, Other: 0 };
    
    auditInventory.forEach(item => {
        const load = item.power * item.qty;
        const daily = load * item.hours;
        totalLoad += load;
        totalDailyKwh += daily;
        
        const cat = categoryLoads[item.category] !== undefined ? item.category : "Other";
        categoryLoads[cat] += daily;
    });
    
    const monthlyCost = totalDailyKwh * 30 * 7.5;
    const annualCarbon = (totalDailyKwh * 365 * 0.82) / 1000.0;
    
    document.getElementById("audit-total-load").textContent = totalLoad.toFixed(1);
    document.getElementById("audit-total-daily-kwh").textContent = Math.round(totalDailyKwh).toLocaleString();
    document.getElementById("audit-total-cost").textContent = Math.round(monthlyCost).toLocaleString();
    document.getElementById("audit-total-co2").textContent = annualCarbon.toFixed(1);
    
    updateAuditChart(categoryLoads);
}

function updateAuditChart(categoryLoads) {
    const ctx = document.getElementById("auditChart").getContext("2d");
    const categories = Object.keys(categoryLoads);
    const dataValues = categories.map(cat => Math.round(categoryLoads[cat]));
    
    if (auditChart) {
        auditChart.data.datasets[0].data = dataValues;
        auditChart.update();
    } else {
        auditChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categories,
                datasets: [{
                    data: dataValues,
                    backgroundColor: [
                        '#0EA5E9', // HVAC
                        '#EA580C', // Process Heating
                        '#6366F1', // Mechanical
                        '#E2B13C', // Lighting
                        '#94A3B8'  // Other
                    ],
                    borderWidth: 1.5,
                    borderColor: '#0a0d14'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 8,
                            font: { family: 'Outfit', size: 9.5 },
                            color: '#94A3B8'
                        }
                    }
                }
            }
        });
    }
}

function syncAuditToCopilot() {
    if (auditInventory.length === 0) {
        alert("Please add machinery to your audit list before syncing.");
        return;
    }
    
    const navDashboard = document.getElementById("nav-dashboard");
    const navAudit = document.getElementById("nav-audit");
    const viewDashboard = document.getElementById("view-dashboard");
    const viewAudit = document.getElementById("view-audit");
    
    navAudit.classList.remove("active");
    navDashboard.classList.add("active");
    viewAudit.style.display = "none";
    viewDashboard.style.display = "block";
    
    if (typeof map !== "undefined" && map) {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }
    
    document.getElementById("copilot-panel").scrollIntoView({ behavior: "smooth" });
    
    const profileText = document.getElementById("msme-profile-selector").options[document.getElementById("msme-profile-selector").selectedIndex].text;
    const totalLoad = document.getElementById("audit-total-load").textContent;
    const totalKwh = document.getElementById("audit-total-daily-kwh").textContent;
    const monthlyCost = document.getElementById("audit-total-cost").textContent;
    const co2 = document.getElementById("audit-total-co2").textContent;
    
    let summaryText = `I have completed an Energy Audit for my ${profileText} facility. Here is my machinery profile:\n` +
                      `- Connected Load: ${totalLoad} kW\n` +
                      `- Daily consumption: ${totalKwh} kWh\n` +
                      `- Estimated monthly cost: ₹${monthlyCost}\n` +
                      `- Estimated carbon footprint: ${co2} tCO2/year\n\n` +
                      `Equipment breakdown:\n`;
                      
    auditInventory.forEach(item => {
        summaryText += `- ${item.name} (${item.category}): ${item.power} kW x ${item.qty} units running ${item.hours}h/day\n`;
    });
    
    summaryText += `\nPlease audit this inventory and provide customized load-shifting and efficiency recommendations for my factory.`;
    
    document.getElementById("chat-input-text").value = summaryText;
    sendChatMessage(summaryText);
}

// Bind to window context for inline events
window.updateAuditRow = updateAuditRow;
window.deleteAuditRow = deleteAuditRow;
