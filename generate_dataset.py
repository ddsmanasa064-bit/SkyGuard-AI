import csv
import math
import random
from datetime import datetime, timedelta

def generate_demo_csv():
    stations = [
        {"id": "AWS-001", "name": "Visakhapatnam Coastal", "lat": 17.6868, "lon": 83.2185, "elev": 25.0},
        {"id": "AWS-002", "name": "Vijayawada Urban", "lat": 16.5062, "lon": 80.6480, "elev": 39.0},
        {"id": "AWS-003", "name": "Guntur Central", "lat": 16.3067, "lon": 80.4365, "elev": 33.0},
        {"id": "AWS-004", "name": "Tirupati Valley", "lat": 13.6288, "lon": 79.4192, "elev": 162.0},
        {"id": "AWS-005", "name": "Kurnool Plateau", "lat": 15.8281, "lon": 78.0373, "elev": 273.0},
        {"id": "AWS-006", "name": "Kakinada Port", "lat": 16.9891, "lon": 82.2475, "elev": 9.0},
        {"id": "AWS-007", "name": "Nellore South", "lat": 14.4426, "lon": 79.9865, "elev": 19.0},
        {"id": "AWS-008", "name": "Anantapur West", "lat": 14.6819, "lon": 77.6006, "elev": 335.0},
    ]

    fieldnames = [
        "timestamp", "station_id", "latitude", "longitude", "elevation",
        "temperature", "humidity", "pressure", "dew_point", "rainfall",
        "wind_speed", "wind_direction", "solar_radiation", "battery_voltage", "signal_strength"
    ]

    base_time = datetime(2026, 9, 19, 0, 0, 0)
    records = []

    # Generate 80 time steps per station (20 hours at 15-min intervals)
    for step in range(80):
        current_time = base_time + timedelta(minutes=step * 15)
        ts_str = current_time.strftime("%Y-%m-%d %H:%M:%S")

        # Diurnal thermal curve
        hour = current_time.hour + current_time.minute / 60.0
        diurnal_factor = math.sin((hour - 9) * math.pi / 12)  # Peak around 15:00

        for st in stations:
            # Elevation lapse rate adjustment: -0.0065 C per meter
            lapse_temp_adj = -0.0065 * (st["elev"] - 25.0)
            
            # Base temperature around 30 C
            t_base = 29.5 + 4.5 * diurnal_factor + lapse_temp_adj
            temp = round(t_base + random.uniform(-0.4, 0.4), 1)

            # Humidity inversely related to temp
            h_base = 72.0 - 15.0 * diurnal_factor
            hum = round(max(min(h_base + random.uniform(-1.5, 1.5), 98.0), 30.0), 1)

            # Barometric pressure formula considering elevation: ~1013 hPa at sea level
            # P = 1013.25 * (1 - 2.25577e-5 * elev)^5.25588
            p_sea = 1012.5 - 2.0 * diurnal_factor
            p_base = p_sea * math.pow(1.0 - 2.25577e-5 * st["elev"], 5.25588)
            pres = round(p_base + random.uniform(-0.3, 0.3), 1)

            # Dew point using Magnus-Tetens approximation
            # Tdp = T - ((100 - RH)/5) approx, or exact formula
            a = 17.27
            b = 237.7
            alpha = ((a * temp) / (b + temp)) + math.log(hum / 100.0)
            dew_point = round((b * alpha) / (a - alpha), 1)

            rainfall = round(max(0.0, random.gauss(0.0, 0.1)), 1)
            wind_speed = round(max(2.0, 12.0 + 5.0 * diurnal_factor + random.uniform(-2.0, 2.0)), 1)
            wind_direction = int((180 + step * 3 + random.randint(-15, 15)) % 360)
            
            solar_rad = round(max(0.0, 850.0 * math.sin((hour - 6) * math.pi / 12)) if 6 <= hour <= 18 else 0.0, 1)
            batt = round(13.6 - 0.4 * (step / 80.0) + random.uniform(-0.05, 0.05), 2)
            sig = int(random.uniform(-78, -62))

            records.append({
                "timestamp": ts_str,
                "station_id": st["id"],
                "latitude": st["lat"],
                "longitude": st["lon"],
                "elevation": st["elev"],
                "temperature": temp,
                "humidity": hum,
                "pressure": pres,
                "dew_point": dew_point,
                "rainfall": rainfall,
                "wind_speed": wind_speed,
                "wind_direction": wind_direction,
                "solar_radiation": solar_rad,
                "battery_voltage": batt,
                "signal_strength": sig
            })

    import os
    os.makedirs("c:/Users/HAI/OneDrive/Desktop/fsd/atmosguard-ai/data", exist_ok=True)
    with open("c:/Users/HAI/OneDrive/Desktop/fsd/atmosguard-ai/data/aws_demo_data.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)

    print(f"Generated {len(records)} records in aws_demo_data.csv for {len(stations)} AWS stations.")

if __name__ == "__main__":
    generate_demo_csv()
