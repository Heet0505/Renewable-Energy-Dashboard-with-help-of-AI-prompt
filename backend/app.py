import os
import math
import random
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
gemini_available = False
if api_key and api_key.strip() != "" and "your_gemini_api_key" not in api_key:
    try:
        genai.configure(api_key=api_key)
        gemini_available = True
        print("Gemini API configured successfully.")
    except Exception as e:
        print(f"Failed to configure Gemini API: {e}")
else:
    print("Gemini API Key missing or default. Using local AI fallback engine.")

# Database of MSME sector profiles in Ahmedabad
MSME_PROFILES = {
    "textile": {
        "name": "Textile Manufacturing (Vatva GIDC)",
        "base_load": 250,  # kW
        "peak_load": 450,  # kW
        "peak_hours": [9, 10, 11, 12, 13, 14, 15, 16],
        "solar_capacity": 350,  # kWp installed on shed roofs
        "wind_capacity": 0,
        "battery_capacity": 500,  # kWh LFP battery
        "critical_load": 50,  # kW
        "tariff_type": "HT Industrial (Torrent Power)",
        "description": "High continuous loads from weaving and dyeing machinery. High solar roofing potential."
    },
    "pharmaceutical": {
        "name": "Pharmaceutical Formulation (Naroda GIDC)",
        "base_load": 300,
        "peak_load": 380,
        "peak_hours": [8, 9, 10, 11, 14, 15, 16, 17],
        "solar_capacity": 150,
        "wind_capacity": 0,
        "battery_capacity": 800,  # Large battery for backup
        "critical_load": 220,  # High critical load for cold rooms/HVAC
        "tariff_type": "HT Industrial (Torrent Power)",
        "description": "Requires 100% grid reliability. Heavy refrigeration, cleanroom HVAC, and batch mixing."
    },
    "chemical": {
        "name": "Chemical Process Plant (Vatva GIDC)",
        "base_load": 200,
        "peak_load": 480,
        "peak_hours": [10, 11, 12, 15, 16, 17, 18],
        "solar_capacity": 200,
        "wind_capacity": 100,  # Open-access wind power source
        "battery_capacity": 400,
        "critical_load": 120,  # Safety and reaction cooling loads
        "tariff_type": "HT Industrial (Torrent Power)",
        "description": "Continuous process batch reactions. Power dips cause chemical wastage. Moderate solar & wind mix."
    },
    "engineering": {
        "name": "Engineering & Fabrication (Odhav GIDC)",
        "base_load": 60,
        "peak_load": 280,
        "peak_hours": [9, 10, 11, 13, 14, 15, 16],
        "solar_capacity": 120,
        "wind_capacity": 0,
        "battery_capacity": 200,
        "critical_load": 15,
        "tariff_type": "LT Industrial (PGVCL/UGVCL)",
        "description": "Intermittent heavy loads from welding, CNC, and presses. Primarily daytime single-shift."
    },
    "packaging": {
        "name": "Packaging & Printing (Changodar)",
        "base_load": 100,
        "peak_load": 220,
        "peak_hours": [10, 11, 12, 13, 14, 15, 16, 17],
        "solar_capacity": 180,
        "wind_capacity": 50,
        "battery_capacity": 300,
        "critical_load": 30,
        "tariff_type": "LT Industrial",
        "description": "Medium load with rotogravure and offset printing lines. High daytime load alignment with solar."
    },
    "food_processing": {
        "name": "Food & Dairy Processing (Kathwada GIDC)",
        "base_load": 140,
        "peak_load": 260,
        "peak_hours": [6, 7, 8, 9, 17, 18, 19, 20],  # Morning pasteurization, evening packing
        "solar_capacity": 200,
        "wind_capacity": 0,
        "battery_capacity": 400,
        "critical_load": 90,  # Cold storage must remain powered
        "tariff_type": "HT Industrial",
        "description": "High refrigeration baseload. Daily thermal cycles require clean power."
    }
}

# Serve static frontend files
@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

# Helper function to generate simulated telemetry data
def generate_telemetry(profile_id, weather, days_count=1):
    profile = MSME_PROFILES.get(profile_id, MSME_PROFILES["textile"])
    
    # Extract weather values
    temp = float(weather.get("temperature", 32.0))
    cloud_cover = float(weather.get("cloud_cover", 20.0))
    wind_speed = float(weather.get("wind_speed", 15.0))
    humidity = float(weather.get("humidity", 60.0))
    
    # Calculate multipliers
    # Temperature effect on Solar: efficiency drops by 0.4% per degree above 25C
    temp_solar_coef = 1.0
    if temp > 25.0:
        temp_solar_coef = max(0.7, 1.0 - 0.004 * (temp - 25.0))
        
    # Cloud cover directly reduces solar
    cloud_solar_coef = max(0.05, 1.0 - (cloud_cover / 100.0) * 0.9)
    
    # Wind speed generation profile (Cut-in at 5, full power at 25, cut-out at 60 km/h)
    wind_coef = 0.0
    if 5.0 <= wind_speed <= 25.0:
        wind_coef = (wind_speed - 5.0) / 20.0
    elif 25.0 < wind_speed <= 55.0:
        wind_coef = 1.0
    elif 55.0 < wind_speed < 60.0:
        wind_coef = 1.0 - (wind_speed - 55.0) / 5.0
        
    # Demand temperature adjustment (HVAC works harder in extreme heat)
    temp_demand_coef = 1.0
    if temp > 30.0:
        temp_demand_coef = 1.0 + 0.02 * (temp - 30.0)
    elif temp < 20.0:
        temp_demand_coef = 1.0 + 0.01 * (20.0 - temp) # light heating (rare in Ahmedabad)

    records = []
    
    # Hourly simulation for days_count
    total_hours = days_count * 24
    
    # Track battery charge
    battery_charge = profile["battery_capacity"] * 0.4  # Start at 40%
    
    for h in range(total_hours):
        hour_of_day = h % 24
        
        # Calculate solar intensity curve based on hour of day
        solar_intensity = 0.0
        if 6 <= hour_of_day <= 18:
            # Sine wave matching day solar curve
            solar_intensity = math.sin(math.pi * (hour_of_day - 6) / 12)
            solar_intensity = max(0.0, solar_intensity)
            
        # Calculate base generation
        solar_gen = profile["solar_capacity"] * solar_intensity * cloud_solar_coef * temp_solar_coef
        # Add slight random noise
        solar_gen = max(0.0, solar_gen + random.uniform(-2, 2) if solar_gen > 0 else 0.0)
        
        wind_gen = profile["wind_capacity"] * wind_coef * (0.8 + 0.4 * random.uniform(0.8, 1.2))
        wind_gen = max(0.0, wind_gen)
        
        # Calculate base demand curve
        if hour_of_day in profile["peak_hours"]:
            demand_intensity = 0.85 + 0.15 * math.sin(math.pi * (hour_of_day - min(profile["peak_hours"])) / len(profile["peak_hours"]))
            demand = profile["base_load"] + (profile["peak_load"] - profile["base_load"]) * demand_intensity
        else:
            demand = profile["base_load"] * (0.85 + 0.15 * random.uniform(0.9, 1.1))
            
        # Adjust demand for temperature
        demand = demand * temp_demand_coef
        
        # Grid health: stability drops slightly during peak hours in summer (temp > 38)
        grid_stability = 98.5
        if 18 <= hour_of_day <= 22:
            grid_stability -= random.uniform(1.0, 3.0)
            if temp > 38.0:
                grid_stability -= random.uniform(2.0, 5.0)
        grid_stability = max(50.0, min(100.0, grid_stability))
        
        # Battery charging/discharging logic
        # Charge battery with excess solar/wind (generation > demand)
        # Discharge battery during peak demand grid hours (usually 18:00 - 22:00)
        generation = solar_gen + wind_gen
        surplus = generation - demand
        battery_action = "Idle"
        
        if surplus > 0:
            # We have excess renewable energy! Store it in battery.
            charge_rate = min(surplus, profile["battery_capacity"] * 0.25) # Max charge rate 0.25C
            room_in_battery = profile["battery_capacity"] - battery_charge
            actual_charge = min(charge_rate, room_in_battery)
            battery_charge += actual_charge
            battery_action = "Charging" if actual_charge > 0.5 else "Idle"
            surplus -= actual_charge
        else:
            # Deficit: generation < demand.
            # Discharge during high tariff or peak demand periods
            deficit = abs(surplus)
            is_peak_tariff_hours = (18 <= hour_of_day <= 22) or (7 <= hour_of_day <= 11)
            
            if is_peak_tariff_hours and battery_charge > (profile["battery_capacity"] * 0.15): # Don't drain below 15%
                discharge_rate = min(deficit, profile["battery_capacity"] * 0.25) # Max discharge rate
                actual_discharge = min(discharge_rate, battery_charge - (profile["battery_capacity"] * 0.15))
                battery_charge -= actual_discharge
                battery_action = "Discharging" if actual_discharge > 0.5 else "Idle"
                surplus += actual_discharge # offsets grid demand
                
        battery_soc = (battery_charge / profile["battery_capacity"]) * 100.0
        
        # Grid Draw (Net Grid Dependency)
        net_grid_draw = 0.0
        if surplus < 0:
            net_grid_draw = abs(surplus)
            
        # Financial Calculations (Gujarat Industrial Tariff: approx. ₹7.5 / kWh, Peak addition: ₹1.5/kWh, Night discount: ₹0.8/kWh)
        tariff_rate = 7.5
        if 18 <= hour_of_day <= 22 or 7 <= hour_of_day <= 11:
            tariff_rate = 9.0  # Peak pricing
        elif 22 < hour_of_day or hour_of_day < 6:
            tariff_rate = 6.7  # Night discount pricing
            
        cost_without_renewables = demand * tariff_rate
        cost_with_renewables = net_grid_draw * tariff_rate
        
        # Carbon savings: standard grid is approx 0.82 kg CO2 per kWh in India
        co2_saved = (demand - net_grid_draw) * 0.82
        
        # Build confidence interval bands for chart
        confidence_upper_dem = demand * (1.05 + 0.03 * math.sin(h/10))
        confidence_lower_dem = demand * (0.95 - 0.03 * math.sin(h/10))
        confidence_upper_gen = generation * (1.10 + 0.05 * math.sin(h/8))
        confidence_lower_gen = generation * (0.90 - 0.05 * math.sin(h/8))
        
        records.append({
            "hour": hour_of_day,
            "index": h,
            "solar_gen": round(solar_gen, 1),
            "wind_gen": round(wind_gen, 1),
            "generation": round(generation, 1),
            "demand": round(demand, 1),
            "net_grid_draw": round(net_grid_draw, 1),
            "battery_soc": round(battery_soc, 1),
            "battery_action": battery_action,
            "grid_health": round(grid_stability, 2),
            "cost_without_renewables": round(cost_without_renewables, 2),
            "cost_with_renewables": round(cost_with_renewables, 2),
            "co2_saved": round(max(0, co2_saved), 1),
            "confidence_upper_demand": round(confidence_upper_dem, 1),
            "confidence_lower_demand": round(confidence_lower_dem, 1),
            "confidence_upper_generation": round(confidence_upper_gen, 1),
            "confidence_lower_generation": round(max(0, confidence_lower_gen), 1)
        })
        
    return records

@app.route('/api/energy-data', methods=['GET'])
def get_energy_data():
    profile_id = request.args.get("profile", "textile")
    range_type = request.args.get("range", "24h") # 24h, 7d, 30d
    
    # Weather parameters
    weather = {
        "temperature": request.args.get("temperature", 32.0),
        "cloud_cover": request.args.get("cloud_cover", 20.0),
        "wind_speed": request.args.get("wind_speed", 15.0),
        "humidity": request.args.get("humidity", 60.0)
    }
    
    days = 1
    if range_type == "7d":
        days = 7
    elif range_type == "30d":
        days = 30
        
    data = generate_telemetry(profile_id, weather, days)
    
    # Aggregated metrics for hero cards
    total_demand = sum(r["demand"] for r in data)
    total_grid_draw = sum(r["net_grid_draw"] for r in data)
    total_gen = sum(r["generation"] for r in data)
    total_cost_saved = sum(r["cost_without_renewables"] - r["cost_with_renewables"] for r in data)
    total_co2_saved = sum(r["co2_saved"] for r in data)
    
    avg_grid_health = sum(r["grid_health"] for r in data) / len(data)
    
    # Calculate Forecast Accuracy (simulated high accuracy, slightly variable based on cloud/wind speed)
    base_accuracy = 95.8
    if float(weather["cloud_cover"]) > 60:
        base_accuracy -= random.uniform(1.5, 3.5)
    if float(weather["wind_speed"]) > 35:
        base_accuracy -= random.uniform(2.0, 4.0)
        
    surplus_deficit = total_gen - total_demand
    
    metrics = {
        "total_demand_kwh": round(total_demand, 1),
        "total_grid_draw_kwh": round(total_grid_draw, 1),
        "total_gen_kwh": round(total_gen, 1),
        "total_cost_saved_inr": round(total_cost_saved, 0),
        "total_co2_saved_kg": round(total_co2_saved, 1),
        "grid_stability_score": round(avg_grid_health, 2),
        "forecast_accuracy": round(base_accuracy, 1),
        "net_balance_kwh": round(surplus_deficit, 1),
        "renewable_utilization_pct": round((1.0 - (total_grid_draw / (total_demand + 0.1))) * 100.0, 1)
    }
    
    return jsonify({
        "profile": MSME_PROFILES.get(profile_id, MSME_PROFILES["textile"]),
        "metrics": metrics,
        "time_series": data
    })

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    profile_id = request.args.get("profile", "textile")
    cloud_cover = float(request.args.get("cloud_cover", 20.0))
    wind_speed = float(request.args.get("wind_speed", 15.0))
    temp = float(request.args.get("temperature", 32.0))
    
    profile = MSME_PROFILES.get(profile_id, MSME_PROFILES["textile"])
    alerts = []
    
    # Weather-related alert
    if cloud_cover > 75:
        alerts.append({
            "id": "alert_solar_drop",
            "type": "warning",
            "category": "Weather Disruption",
            "title": "Solar Output Drop Anticipated",
            "message": f"Cloud cover is very high ({cloud_cover}%). Solar generation is estimated to drop by {int(cloud_cover * 0.9)}% today. Charge storage now.",
            "severity": "medium",
            "time": "Just now"
        })
        
    if temp > 42.0:
        alerts.append({
            "id": "alert_heat_efficiency",
            "type": "warning",
            "category": "Thermal Derating",
            "title": "Solar Panel Thermal Derating Active",
            "message": f"Extreme local temperatures ({temp}°C) are causing solar panel thermal losses of {round(0.4 * (temp - 25), 1)}%. Panel temperatures exceed 65°C.",
            "severity": "medium",
            "time": "15m ago"
        })
        
    if wind_speed > 55.0:
        alerts.append({
            "id": "alert_wind_cutout",
            "type": "critical",
            "category": "Weather Risk",
            "title": "Wind Turbine Safety Cut-Out",
            "message": f"High wind speeds ({wind_speed} km/h) approaching safety limits. Micro-turbines may auto-feather to prevent structural failure.",
            "severity": "high",
            "time": "5m ago"
        })

    # Sector specific alerts
    if profile_id == "pharmaceutical":
        alerts.append({
            "id": "alert_pharma_grid",
            "type": "info",
            "category": "Grid Stability",
            "title": "Continuous Cleanroom Stability Alert",
            "message": "Continuous HVAC drawing 220 kW. Battery reserves verified at 80% to absorb grid voltage transients.",
            "severity": "low",
            "time": "1h ago"
        })
    elif profile_id == "chemical":
        alerts.append({
            "id": "alert_chemical_safety",
            "type": "warning",
            "category": "Process Security",
            "title": "Batch Phase Safety Backup",
            "message": "High-temperature reaction cycle scheduled for 15:00. Ensure battery remains above 40% for safety cooling backup.",
            "severity": "medium",
            "time": "30m ago"
        })
        
    # Standard battery/grid alert
    alerts.append({
        "id": "alert_peak_pricing",
        "type": "critical",
        "category": "Tariff Risk",
        "title": "Torrent Power Peak Tariff Window Approaching",
        "message": "High-tariff window (18:00 - 22:00) starts soon. System will discharge battery storage to offset grid import.",
        "severity": "high",
        "time": "Just now"
    })
    
    return jsonify(alerts)

@app.route('/api/recommendations', methods=['GET'])
def get_recommendations():
    profile_id = request.args.get("profile", "textile")
    cloud_cover = float(request.args.get("cloud_cover", 20.0))
    profile = MSME_PROFILES.get(profile_id, MSME_PROFILES["textile"])
    
    recommendations = []
    
    # Determine solar conditions
    solar_status = "Excellent" if cloud_cover < 30 else "Moderate" if cloud_cover < 70 else "Poor"
    
    # Recommendation 1: Shift heavy loads
    if profile_id == "textile":
        rec_title = "Shift Spinning & Weaving Shifts"
        rec_msg = "Shift 75 kW of batch spinning load from evening hours (19:00 - 21:00) to peak solar window (11:00 - 14:00)."
        savings = 4200
        impact = "Reduces grid demand charges and utilizes surplus solar generation."
    elif profile_id == "pharmaceutical":
        rec_title = "Pre-cool Cold Storage Buffers"
        rec_msg = "Sub-cool critical cold chambers by 2°C during high solar output hours (11:00 - 15:00) to throttle HVAC down during evening peak rates."
        savings = 5800
        impact = "Leverages thermal energy storage to reduce peak grid dependency."
    elif profile_id == "chemical":
        rec_title = "Sync Electrolysis with Solar Peak"
        rec_msg = "Run modular chemical reactors at 100% capacity during solar peak, and ramp down to 40% baseline during night shifts."
        savings = 7200
        impact = "Optimizes specific energy cost per kg of throughput."
    elif profile_id == "engineering":
        rec_title = "Shift Heavy Arc Welding Operations"
        rec_msg = "Conduct heavy fabrication welding cycles before 16:00 to maximize direct solar usage and avoid PGVCL peak demand charges."
        savings = 1900
        impact = "Cuts maximum demand penalty on LT industrial tariff."
    elif profile_id == "packaging":
        rec_title = "Run High-Speed Printing Lines"
        rec_msg = "Schedule rotogravure runs between 11:00 and 15:00. Excess solar capacity currently stands at 80 kW."
        savings = 3100
        impact = "Maximizes direct solar self-consumption, minimizing back-feed losses."
    else:
        rec_title = "Shift Batch Processing Cycles"
        rec_msg = "Schedule highest power drawing cycles during high solar window (10:00 - 15:00)."
        savings = 2500
        impact = "Avoids peak-hour surcharge tariffs."
        
    recommendations.append({
        "id": "rec_shift",
        "title": rec_title,
        "action": rec_msg,
        "savings_inr": savings,
        "impact": impact,
        "urgency": "High",
        "type": "Load Shifting"
    })
    
    # Recommendation 2: Battery Strategy
    battery_savings = int(profile["battery_capacity"] * 0.8 * 1.5) # simple arbitrage calculation
    recommendations.append({
        "id": "rec_battery",
        "title": "Optimized Battery Charge Cycle",
        "action": f"Program battery to charge during morning hours (08:00 - 10:00) via grid + early solar, and discharge 80% capacity during high-demand period (18:00 - 22:00).",
        "savings_inr": battery_savings,
        "impact": "Shaves peak demand spikes and performs economic tariff arbitrage.",
        "urgency": "Medium",
        "type": "Storage Arbitrage"
    })
    
    # Recommendation 3: Solar Cleaning (Ahmedabad specific, high dust factor)
    recommendations.append({
        "id": "rec_cleaning",
        "title": "Perform Solar Array Maintenance",
        "action": "Schedule panel washing. Local dust levels (PM10) in Ahmedabad industrial zones have increased, leading to an estimated 6% soiling loss.",
        "savings_inr": int(profile["solar_capacity"] * 3.5),
        "impact": "Restores optimal solar panel generation and thermal dissipation.",
        "urgency": "Low",
        "type": "Maintenance"
    })
    
    return jsonify(recommendations)

# Offline AI Fallback Engine
def local_ai_copilot(prompt, msme_id, weather):
    prompt_lower = prompt.lower()
    profile = MSME_PROFILES.get(msme_id, MSME_PROFILES["textile"])
    weather_desc = f"Temperature: {weather.get('temperature')}°C, Cloud Cover: {weather.get('cloud_cover')}%, Wind Speed: {weather.get('wind_speed')} km/h"
    
    # Contextual knowledge injection based on Ahmedabad and MSME profiles
    intro = f"**[AI Copilot - Ahmedabad Smart Factory Advisor]**\n\nI have analyzed your **{profile['name']}** facility under current weather conditions ({weather_desc}). Here is your personalized optimization strategy:\n\n"
    
    # Key matching rules
    if "machine" in prompt_lower or "schedule" in prompt_lower or "when" in prompt_lower or "shift" in prompt_lower:
        if msme_id == "textile":
            return intro + (
                "### Industrial Machine Scheduling Advice\n"
                "* **High-Energy Cycles (Spinning/Dyeing):** The Torrent Power Peak demand window is 18:00 - 22:00 (charges are higher by ₹1.50/kWh). We advise scheduling your high-load spinning frames between **11:00 AM and 3:00 PM**.\n"
                "* **Solar Alignment:** Today's cloud cover is low. You will generate a solar peak of around **320 kW** around 12:30 PM. Shifting your main load here will yield ₹4,500 daily savings in direct grid draw.\n"
                "* **Night Operations:** Schedule the lighter looms for the night shift (22:00 - 06:00) to take advantage of Torrent Power's Off-Peak discount (₹0.80/kWh reduction)."
            )
        elif msme_id == "pharmaceutical":
            return intro + (
                "### Pharma Climate Control & Scheduling Strategy\n"
                "* **Continuous Cold Storage:** Your HVAC baseline load of 220 kW is non-negotiable. To optimize, you should **pre-cool your formulation storage bays** by an extra 2.0°C during the solar peak window (11:00 AM - 15:00 PM).\n"
                "* **Peak-Hour Strategy:** During peak hours (18:00 - 22:00), you can throttle the HVAC compressors to minimum flow and let the thermal buffer maintain temperature, saving approx ₹5,800/day in peak charges.\n"
                "* **Grid Failure Safeguard:** Ensure the battery charging profile reserves at least 40% capacity (320 kWh) for cleanroom backup."
            )
        elif msme_id == "chemical":
            return intro + (
                "### Chemical Batch Processing & Load Sync\n"
                "* **Thermal & Mixing Cycles:** Since chemical batch reactions cannot be interrupted, align the start of a 4-hour batch reactor cycle to **10:30 AM**. This allows the solar array and the micro-wind source (currently active at 15 km/h) to power the heavy mixing pumps.\n"
                "* **Peak Load Management:** Do not start a new high-power batch after 15:30, as it will spill into the Torrent Power Peak Surcharge hour (18:00), costing an additional ₹1,800 per batch."
            )
        else:
            return intro + (
                "### MSME Machine Scheduling Guidelines\n"
                "* **Heavy Equipment Scheduling:** Run heavy machines between **10:00 AM and 3:00 PM** to directly consume the solar generation. This maximizes self-consumption and avoids export losses.\n"
                "* **Peak Hour Mitigation:** Avoid turning on high-surge machinery (welding stations, hydraulic presses) during the grid peak periods of **07:00 - 11:00 AM** and **06:00 - 10:00 PM**."
            )
            
    elif "solar" in prompt_lower or "weather" in prompt_lower or "tomorrow" in prompt_lower:
        cloud = float(weather.get('cloud_cover', 20.0))
        temp = float(weather.get('temperature', 32.0))
        
        solar_capacity = profile['solar_capacity']
        soiling_loss_text = ""
        if "clean" in prompt_lower or "dust" in prompt_lower or "soiling" in prompt_lower:
            soiling_loss_text = "\n* **Ahmedabad Soiling Factor:** Being in an industrial GIDC zone, dust accumulation is high. If panels haven't been cleaned in 2 weeks, you are losing approximately 8% efficiency (approx 20 kW during peak solar hours). We recommend washing panels weekly."

        if cloud > 60:
            return intro + (
                "### Weather & Solar Performance Analysis\n"
                f"* **Cloud Cover Warning:** Cloud cover is high ({cloud}%). Your solar generation will be limited to about **{int(solar_capacity * 0.35)} kW** (a 65% drop from theoretical maximum).\n"
                "* **Action Required:** We recommend charging your battery using grid power during the low-tariff morning hour (before 07:00 AM) to compensate for the solar deficit later in the day." + soiling_loss_text
            )
        else:
            return intro + (
                "### Solar Outlook: Clear Skies\n"
                f"* **Solar Availability:** Weather conditions are excellent for solar generation. Peak solar output will reach **{int(solar_capacity * temp_solar_coef_calc(temp))} kW** at approximately 12:45 PM.\n"
                f"* **Optimized Dispatch:** Your solar capacity is more than enough to cover your base load of {profile['base_load']} kW. We estimate you will have a clean energy surplus of {int(solar_capacity * 0.5)} kW for battery storage." + soiling_loss_text
            )
            
    elif "bill" in prompt_lower or "save" in prompt_lower or "reduce" in prompt_lower or "cost" in prompt_lower:
        tariff_details = ""
        if msme_id in ["textile", "pharmaceutical", "chemical"]:
            tariff_details = "Torrent Power HT-Industrial Tariffs (Peak surcharge: +₹1.50/kWh, Night discount: -₹0.80/kWh)."
        else:
            tariff_details = "PGVCL LT-Industrial Tariffs (Demand charges based on peak kVA)."
            
        return intro + (
            f"### Cost Saving & Tariff Optimization Plan\n"
            f"* **Active Tariff Model:** {tariff_details}\n"
            f"* **Strategy 1 (Peak Shaving):** Use your {profile['battery_capacity']} kWh battery to power operations during the evening peak window (18:00 - 22:00). This offsets grid draw when power costs ₹9.0/kWh. Estimated daily savings: **₹3,500 - ₹5,000**.\n"
            f"* **Strategy 2 (Direct Solar):** Ensure that at least 80% of your daytime operations run on self-generated solar energy. Buying grid power during the day costs ₹7.5/kWh, while solar costs close to ₹2.2/kWh levelized cost.\n"
            f"* **Strategy 3 (Power Factor Correction):** Maintain your capacitor banks to keep your Power Factor above 0.98. Torrent Power offers a rebate of up to 3% on energy charges for high power factor, which can save ₹8,000 to ₹12,000 per month for your size of operation."
        )
        
    elif "battery" in prompt_lower or "storage" in prompt_lower or "charge" in prompt_lower:
        return intro + (
            "### Storage Optimization Strategy (500 kWh LFP Battery)\n"
            f"* **Charging Slot 1 (Solar Surplus):** Schedule battery charging between **11:00 AM and 2:30 PM**. Utilize the excess generation from your {profile['solar_capacity']} kW solar system.\n"
            f"* **Charging Slot 2 (Grid Off-Peak):** If weather forecasts show high cloud cover, configure grid-charging from **02:00 AM to 05:00 AM** at the night discounted tariff rate of ₹6.7/kWh.\n"
            "* **Discharging Slot:** Discharge from **18:00 to 22:00** during peak tariff hours. Avoid letting the battery charge drop below 15% (State of Health protection threshold)."
        )
        
    elif "report" in prompt_lower or "summary" in prompt_lower:
        return intro + (
            "### Daily Energy Performance Audit (Ahmedabad MSME)\n"
            f"* **MSME Sector:** {profile['name']}\n"
            "* **Renewable Share:** 46.8% of daily energy needs met by clean energy.\n"
            "* **Financial Impact:** Saved ₹5,830 today compared to running on 100% grid.\n"
            "* **Carbon Reduction:** Prevented 420.5 kg of CO2 emissions.\n"
            "* **Grid Stability:** No voltage dip disruptions detected. Grid stability maintained at 98.4%."
        )
        
    else:
        return intro + (
            "I'm your **AI Energy Copilot** specialized in Ahmedabad's industrial GIDC areas. You can ask me specific questions about:\n"
            "1. **Machine Scheduling:** 'When is the best time to run heavy machines?'\n"
            "2. **Solar Generation & Weather:** 'How will cloud cover affect my solar output?' or 'How does Ahmedabad dust impact efficiency?'\n"
            "3. **Cost Savings:** 'How can I reduce my Torrent Power electricity bill?'\n"
            "4. **Battery Optimization:** 'How should I schedule my battery storage?'\n"
            "5. **Reports:** 'Generate a summary report of my savings.'\n\n"
            "Please ask any energy-related question to optimize your factory footprint!"
        )

def temp_solar_coef_calc(temp):
    if temp > 25.0:
        return max(0.7, 1.0 - 0.004 * (temp - 25.0))
    return 1.0

# API Copilot Chat Route
@app.route('/api/copilot', methods=['POST'])
def run_copilot():
    data = request.json or {}
    user_prompt = data.get("prompt", "")
    msme_id = data.get("profile", "textile")
    weather = data.get("weather", {})
    history = data.get("history", []) # chat history for contextual prompt
    
    if not user_prompt:
        return jsonify({"response": "No prompt provided"}), 400
        
    profile = MSME_PROFILES.get(msme_id, MSME_PROFILES["textile"])
    
    # Use real Gemini API if configured
    if gemini_available:
        try:
            # Construct a rich system prompt
            system_prompt = (
                f"You are the AI Energy Copilot, a startup-grade industrial energy advisor for MSMEs in Ahmedabad, Gujarat, India. "
                f"You specialize in Ahmedabad's GIDC industrial zones (Vatva, Naroda, Changodar, Odhav, Kathwada) and know details about Torrent Power and PGVCL tariffs. "
                f"You are currently analyzing a '{profile['name']}' facility. "
                f"Factory profile details: Base load {profile['base_load']} kW, Peak load {profile['peak_load']} kW, Solar Capacity {profile['solar_capacity']} kWp, "
                f"Wind Capacity {profile['wind_capacity']} kW, Battery Capacity {profile['battery_capacity']} kWh. "
                f"Current local weather conditions: Temperature {weather.get('temperature')}C, Cloud Cover {weather.get('cloud_cover')}%, "
                f"Wind Speed {weather.get('wind_speed')} km/h, Humidity {weather.get('humidity')}%. "
                f"Provide highly detailed, actionable recommendations in a professional, consulting tone. "
                f"Focus on time-of-use tariffs, load shifting, solar cleaning due to dust, battery charging, and financial savings (using ₹ currency)."
            )
            
            # Format history
            formatted_history = []
            for msg in history:
                role = "user" if msg.get("sender") == "user" else "model"
                formatted_history.append({"role": role, "parts": [{"text": msg.get("text")}]})
                
            model = genai.GenerativeModel('gemini-1.5-flash')
            
            # Start chat session or simple content generation
            chat = model.start_chat(history=formatted_history)
            full_prompt = f"System Context: {system_prompt}\n\nUser Question: {user_prompt}"
            response = chat.send_message(full_prompt)
            
            # Clean up the output if the model repeats system context
            answer = response.text
            return jsonify({
                "response": answer,
                "engine": "gemini-1.5-flash"
            })
            
        except Exception as e:
            print(f"Gemini generation error: {e}. Falling back to local engine.")
            answer = local_ai_copilot(user_prompt, msme_id, weather)
            return jsonify({
                "response": answer,
                "engine": "local-fallback",
                "error": str(e)
            })
    else:
        # Local AI Rule Engine fallback
        answer = local_ai_copilot(user_prompt, msme_id, weather)
        return jsonify({
            "response": answer,
            "engine": "local-fallback"
        })

# Serve the application on configured port
if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    debug_mode = os.getenv("FLASK_ENV") == "development"
    print(f"Starting Renewable Energy Intelligence Platform on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
