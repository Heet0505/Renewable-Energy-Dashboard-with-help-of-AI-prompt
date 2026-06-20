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
                    borderColor: '#FF8C42', // Demand Orange
                    backgroundColor: 'rgba(255, 140, 66, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'Solar Gen (kW)',
                    data: [],
                    borderColor: '#FFC857', // Solar Yellow
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'Wind Gen (kW)',
                    data: [],
                    borderColor: '#2EC4B6', // Wind Cyan
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'Battery Charge (%)',
                    data: [],
                    borderColor: '#7B61FF', // Battery Purple
                    backgroundColor: 'rgba(123, 97, 255, 0.05)',
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    tension: 0.2,
                    yAxisID: 'y1'
                },
                {
                    label: 'Grid Import (kW)',
                    data: [],
                    borderColor: '#2ECC71', // Grid Health Green
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
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
                    '#FFC857', // Solar Warm Yellow
                    '#2EC4B6', // Wind Cyan
                    '#7B61FF', // Battery Purple
                    '#2ECC71'  // Grid Green
                ],
                borderWidth: 1,
                borderColor: '#131926'
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
                backgroundColor: 'rgba(255, 140, 66, 0.75)',
                borderColor: '#FF8C42',
                borderWidth: 1,
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
        batteryStatusLabel.className = "text-risk";
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
}
