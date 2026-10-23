import os
import csv
import math
import random
from datetime import datetime, timedelta

DATA_DIR = "c:/Users/HAI/OneDrive/Desktop/fsd/atmosguard-ai/data"
SAMPLE_DIR = "c:/Users/HAI/OneDrive/Desktop/fsd/atmosguard-ai/sample_datasets"

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(SAMPLE_DIR, exist_ok=True)

fieldnames = [
    "timestamp", "station_id", "latitude", "longitude", "elevation",
    "temperature", "humidity", "pressure", "dew_point", "rainfall",
    "wind_speed", "wind_direction", "solar_radiation", "battery_voltage", "signal_strength"
]

ap_stations = [
    {"id": "AWS-001", "name": "Visakhapatnam Coastal", "lat": 17.6868, "lon": 83.2185, "elev": 25.0},
    {"id": "AWS-002", "name": "Vijayawada Urban", "lat": 16.5062, "lon": 80.6480, "elev": 39.0},
    {"id": "AWS-003", "name": "Guntur Central", "lat": 16.3067, "lon": 80.4365, "elev": 33.0},
    {"id": "AWS-004", "name": "Tirupati Valley", "lat": 13.6288, "lon": 79.4192, "elev": 162.0},
    {"id": "AWS-005", "name": "Kurnool Plateau", "lat": 15.8281, "lon": 78.0373, "elev": 273.0},
    {"id": "AWS-006", "name": "Kakinada Port", "lat": 16.9891, "lon": 82.2475, "elev": 9.0},
    {"id": "AWS-007", "name": "Nellore South", "lat": 14.4426, "lon": 79.9865, "elev": 19.0},
    {"id": "AWS-008", "name": "Anantapur West", "lat": 14.6819, "lon": 77.6006, "elev": 335.0},
]

mountain_stations = [
    {"id": "AWS-101", "name": "Shimla Observatory", "lat": 31.1048, "lon": 77.1734, "elev": 2276.0},
    {"id": "AWS-102", "name": "Manali Ridge", "lat": 32.2432, "lon": 77.1892, "elev": 2050.0},
    {"id": "AWS-103", "name": "Leh High Altitude", "lat": 34.1526, "lon": 77.5771, "elev": 3500.0},
    {"id": "AWS-104", "name": "Srinagar Valley", "lat": 34.0837, "lon": 74.7973, "elev": 1585.0},
    {"id": "AWS-105", "name": "Dharamshala Hills", "lat": 32.2190, "lon": 76.3234, "elev": 1457.0},
    {"id": "AWS-106", "name": "Solan Agro Node", "lat": 30.9084, "lon": 77.0999, "elev": 1600.0},
]

def calc_dew_point(temp, hum):
    a = 17.27
    b = 237.7
    alpha = ((a * temp) / (b + temp)) + math.log(max(hum, 1.0) / 100.0)
    return round((b * alpha) / (a - alpha), 1)

def calc_baro_pressure(elev, diurnal_factor=0.0, storm_drop=0.0):
    p_sea = 1012.5 - 2.0 * diurnal_factor - storm_drop
    return round(p_sea * math.pow(1.0 - 2.25577e-5 * elev, 5.25588), 1)

# --- 1. Dataset 1: Baseline Normal ---
def generate_baseline_normal():
    base_time = datetime(2026, 9, 23, 0, 0, 0)
    records = []
    for step in range(60):
        t_curr = base_time + timedelta(minutes=step * 15)
        ts_str = t_curr.strftime("%Y-%m-%d %H:%M:%S")
        hour = t_curr.hour + t_curr.minute / 60.0
        diurnal = math.sin((hour - 9) * math.pi / 12)

        for st in ap_stations:
            temp = round(29.0 + 4.0 * diurnal - 0.0065 * (st["elev"] - 25.0) + random.uniform(-0.3, 0.3), 1)
            hum = round(max(35.0, min(95.0, 70.0 - 14.0 * diurnal + random.uniform(-1.0, 1.0))), 1)
            pres = calc_baro_pressure(st["elev"], diurnal)
            dp = calc_dew_point(temp, hum)
            records.append({
                "timestamp": ts_str, "station_id": st["id"], "latitude": st["lat"], "longitude": st["lon"], "elevation": st["elev"],
                "temperature": temp, "humidity": hum, "pressure": pres, "dew_point": dp, "rainfall": 0.0,
                "wind_speed": round(10.0 + 4.0 * diurnal + random.uniform(-1.0, 1.0), 1),
                "wind_direction": int((180 + step * 2) % 360),
                "solar_radiation": round(max(0.0, 800.0 * math.sin((hour - 6) * math.pi / 12)) if 6 <= hour <= 18 else 0.0, 1),
                "battery_voltage": round(13.5 - 0.2 * (step / 60.0), 2), "signal_strength": -68
            })
    return records

# --- 2. Dataset 2: Cyclonic Storm Monsoon ---
def generate_cyclonic_storm():
    base_time = datetime(2026, 9, 23, 0, 0, 0)
    records = []
    for step in range(60):
        t_curr = base_time + timedelta(minutes=step * 15)
        ts_str = t_curr.strftime("%Y-%m-%d %H:%M:%S")
        hour = t_curr.hour + t_curr.minute / 60.0
        diurnal = math.sin((hour - 9) * math.pi / 12)
        storm_intensity = math.sin((step / 60.0) * math.pi) # peaks mid-dataset

        for st in ap_stations:
            is_coastal = st["id"] in ["AWS-001", "AWS-006", "AWS-007"]
            storm_drop = 22.0 * storm_intensity if is_coastal else 8.0 * storm_intensity
            temp = round(25.0 - 3.0 * storm_intensity + random.uniform(-0.3, 0.3), 1)
            hum = round(min(99.0, 85.0 + 14.0 * storm_intensity + random.uniform(-0.5, 0.5)), 1)
            pres = calc_baro_pressure(st["elev"], diurnal, storm_drop)
            dp = calc_dew_point(temp, hum)
            rain = round((45.0 * storm_intensity + random.uniform(5.0, 15.0)) if is_coastal else (10.0 * storm_intensity), 1)
            wind = round((35.0 + 25.0 * storm_intensity + random.uniform(-3.0, 3.0)) if is_coastal else (15.0 + 10.0 * storm_intensity), 1)

            records.append({
                "timestamp": ts_str, "station_id": st["id"], "latitude": st["lat"], "longitude": st["lon"], "elevation": st["elev"],
                "temperature": temp, "humidity": hum, "pressure": pres, "dew_point": dp, "rainfall": rain,
                "wind_speed": wind, "wind_direction": 90 if is_coastal else 120,
                "solar_radiation": 40.0, "battery_voltage": round(13.2 - 0.4 * storm_intensity, 2), "signal_strength": -78
            })
    return records

# --- 3. Dataset 3: Himalayan Mountain Network ---
def generate_mountain_network():
    base_time = datetime(2026, 9, 23, 0, 0, 0)
    records = []
    for step in range(60):
        t_curr = base_time + timedelta(minutes=step * 15)
        ts_str = t_curr.strftime("%Y-%m-%d %H:%M:%S")
        hour = t_curr.hour + t_curr.minute / 60.0
        diurnal = math.sin((hour - 9) * math.pi / 12)

        for st in mountain_stations:
            temp = round(10.0 + 5.0 * diurnal - 0.0065 * (st["elev"] - 1000.0) + random.uniform(-0.4, 0.4), 1)
            hum = round(max(20.0, min(85.0, 55.0 - 10.0 * diurnal + random.uniform(-2.0, 2.0))), 1)
            pres = calc_baro_pressure(st["elev"], diurnal)
            dp = calc_dew_point(temp, hum)
            records.append({
                "timestamp": ts_str, "station_id": st["id"], "latitude": st["lat"], "longitude": st["lon"], "elevation": st["elev"],
                "temperature": temp, "humidity": hum, "pressure": pres, "dew_point": dp, "rainfall": 0.0,
                "wind_speed": round(15.0 + 8.0 * diurnal + random.uniform(-2.0, 2.0), 1),
                "wind_direction": 310, "solar_radiation": round(max(0.0, 950.0 * math.sin((hour - 6) * math.pi / 12)) if 6 <= hour <= 18 else 0.0, 1),
                "battery_voltage": round(12.8 - 0.1 * (step / 60.0), 2), "signal_strength": -82
            })
    return records

# --- 4. Dataset 4: Sensor Degradation Faults ---
def generate_sensor_faults():
    records = generate_baseline_normal()
    # Inject faults into step >= 20
    for r in records:
        ts_idx = int(r["timestamp"].split(":")[1]) # approx step
        st_id = r["station_id"]

        # AWS-003: Stuck Temperature at 22.4 C
        if st_id == "AWS-003" and ts_idx >= 20:
            r["temperature"] = 22.4
        # AWS-005: Humidity Drift upwards to 98%
        if st_id == "AWS-005" and ts_idx >= 15:
            r["humidity"] = min(99.0, round(r["humidity"] + (ts_idx - 15) * 1.2, 1))
            r["dew_point"] = calc_dew_point(r["temperature"], r["humidity"])
        # AWS-008: Psychrometric Violation (high RH 96% with low dewpoint 5.0 C)
        if st_id == "AWS-008" and ts_idx >= 25:
            r["humidity"] = 96.0
            r["dew_point"] = 5.0
        # AWS-004: Solar Battery Drop < 3.0V
        if st_id == "AWS-004" and ts_idx >= 30:
            r["battery_voltage"] = 2.85

    return records

# --- 5. Dataset 5: Heatwave & Arid Front ---
def generate_heatwave_drought():
    base_time = datetime(2026, 9, 23, 0, 0, 0)
    records = []
    for step in range(60):
        t_curr = base_time + timedelta(minutes=step * 15)
        ts_str = t_curr.strftime("%Y-%m-%d %H:%M:%S")
        hour = t_curr.hour + t_curr.minute / 60.0
        diurnal = math.sin((hour - 9) * math.pi / 12)

        for st in ap_stations:
            # Heatwave surge: 41 - 46.5 C
            heat_boost = 7.5 if st["id"] in ["AWS-005", "AWS-008", "AWS-002", "AWS-003"] else 4.0
            temp = round(37.0 + heat_boost * diurnal - 0.0065 * (st["elev"] - 25.0) + random.uniform(-0.4, 0.4), 1)
            # Arid humidity drop: 14% - 28%
            hum = round(max(10.0, min(35.0, 32.0 - 18.0 * diurnal + random.uniform(-1.0, 1.0))), 1)
            pres = calc_baro_pressure(st["elev"], diurnal)
            dp = calc_dew_point(temp, hum)
            records.append({
                "timestamp": ts_str, "station_id": st["id"], "latitude": st["lat"], "longitude": st["lon"], "elevation": st["elev"],
                "temperature": temp, "humidity": hum, "pressure": pres, "dew_point": dp, "rainfall": 0.0,
                "wind_speed": round(14.0 + 6.0 * diurnal + random.uniform(-1.5, 1.5), 1),
                "wind_direction": 240,
                "solar_radiation": round(max(0.0, 960.0 * math.sin((hour - 6) * math.pi / 12)) if 6 <= hour <= 18 else 0.0, 1),
                "battery_voltage": round(13.6 - 0.1 * (step / 60.0), 2), "signal_strength": -65
            })
    return records

# --- 6. Dataset 6: Communication Outage & Sensor Noise ---
def generate_comm_outage():
    records = generate_baseline_normal()
    for r in records:
        ts_idx = int(r["timestamp"].split(":")[1])
        st_id = r["station_id"]

        # AWS-001 has cellular signal fade and packet loss (null fields)
        if st_id == "AWS-001" and ts_idx in [15, 30, 45]:
            r["temperature"] = ""
            r["humidity"] = ""
            r["pressure"] = ""
            r["signal_strength"] = -105
        # AWS-006 has noisy communication spikes
        if st_id == "AWS-006" and ts_idx == 35:
            r["temperature"] = round(r["temperature"] + random.choice([25.0, -18.0]), 1)
            r["signal_strength"] = -98

    return records

def save_csv(filename, records):
    path_data = os.path.join(DATA_DIR, filename)
    path_sample = os.path.join(SAMPLE_DIR, filename)
    for path in [path_data, path_sample]:
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(records)
    print(f"[OK] Saved {len(records)} records to {filename}")

if __name__ == "__main__":
    print("Generating SkyGuard AI Sample Datasets...")
    save_csv("dataset_1_baseline_normal.csv", generate_baseline_normal())
    save_csv("dataset_2_cyclonic_storm.csv", generate_cyclonic_storm())
    save_csv("dataset_3_mountain_network.csv", generate_mountain_network())
    save_csv("dataset_4_sensor_faults.csv", generate_sensor_faults())
    save_csv("dataset_5_heatwave_drought.csv", generate_heatwave_drought())
    save_csv("dataset_6_comm_outage_noise.csv", generate_comm_outage())
    print("All sample datasets generated successfully!")

