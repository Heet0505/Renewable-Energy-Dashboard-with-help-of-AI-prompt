# Renewable Energy Intelligence Platform & AI Energy Copilot
### Ahmedabad MSME Industrial Focus (Vatva, Naroda, Changodar, Odhav, Kathwada)

This climate-tech industrial platform helps MSMEs in Ahmedabad, Gujarat, optimize energy consumption, schedule heavy machinery around solar/wind peaks, manage battery storage systems, and perform tariff arbitrage under Torrent Power & PGVCL tariffs.

## 🚀 Key Features

1. **AI Energy Copilot (Chatbot):** Embedded expert advisor that analyzes the current weather, MSME sector profiles, energy trends, and provides natural-language energy auditing, machine scheduling, and carbon metrics.
2. **Gujarat / Ahmedabad GIS Map:** CartoDB dark matter map showing key GIDC clusters (Vatva, Naroda, Changodar, Odhav, Kathwada) with pulsing indicators representing energy loads.
3. **Weather Sliders & Dynamic Telemetry:** Simulates real-time solar panel heating losses, cloud cover degradation, wind turbine cutout speeds, and HVAC surge loads.
4. **Energy Mix & Time-Series Forecasting:** Beautiful charts displaying 24h, 7-day, and 30-day Solar, Wind, and Demand curves with confidence interval overlays.
5. **Storage Optimization Module:** Real-time charging/discharging battery state indicator with custom animations.
6. **Smart Recommendations:** Shift scheduling and battery scheduling strategies with estimated Rupee (₹) savings.
7. **Severity-based Alerts Center:** Triggers alerts for high cloud cover, thermal derating, turbine shutoffs, and peak tariffs.

---

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3 (Glassmorphism, custom dark styling), Javascript (ES6), Chart.js (Charts), Leaflet.js (Interactive Maps)
* **Backend:** Python 3, Flask, CORS, Python-dotenv, google-generativeai

---

## ⚙️ Setup & Execution

### 1. Install Dependencies
Ensure you have Python 3 installed. Run the following command in your terminal:
```bash
pip install -r backend/requirements.txt
```

### 2. Configure Environment (Optional for Gemini)
Create a `.env` file inside the `backend` directory (a template is provided at `backend/.env.example`):
```env
GEMINI_API_KEY=your_gemini_api_key_from_google_ai_studio
PORT=5000
FLASK_ENV=development
```
*Note: If no API key is provided, the platform automatically activates an intelligent local fallback engine loaded with detailed, context-aware energy advising logic specific to Ahmedabad MSMEs so that the demo works seamlessly.*

### 3. Run the Platform
Double-click `run.bat` at the root directory, or run the following command in the terminal:
```bash
python backend/app.py
```
Open your browser and navigate to:
👉 **[http://localhost:5000](http://localhost:5000)**

---

## 📂 Project Structure

```
resproject/
  ├── backend/
  │     ├── app.py              # Flask server, data generation, recommender, and Copilot APIs
  │     ├── requirements.txt    # Python backend package dependencies
  │     ├── .env                # App configurations (gitignored)
  │     └── .env.example        # Environment variable template
  ├── frontend/
  │     ├── index.html          # Dashboard HTML UI structure
  │     ├── css/
  │     │     └── style.css     # Dark futuristic premium styling
  │     └── js/
  │           ├── app.js        # Data binding, charts configuration, weather simulation, chat
  │           └── map.js        # Leaflet GIS Ahmedabad markers setup
  ├── run.bat                   # Batch file script to run backend & server static frontend
  └── README.md                 # Project documentation
```
