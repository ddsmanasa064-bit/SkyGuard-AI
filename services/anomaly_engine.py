import os
import random
import datetime
import pandas as pd
import numpy as np
from collections import deque
from services.physics_engine import PhysicsConsistencyEngine
from services.spatial_consensus import SpatioTemporalGraphEngine
from services.root_cause import RootCauseClassifier
from services.imputation import PhysicsGuidedImputationEngine
from services.edge_simulator import EdgeProcessingSimulator

class AtmosGuardEngine:
    def __init__(self, data_csv_path="data/aws_demo_data.csv"):
        self.data_csv_path = data_csv_path
        
        # Engines
        self.physics_engine = PhysicsConsistencyEngine()
        self.spatial_engine = SpatioTemporalGraphEngine(neighbor_radius_km=450.0)
        self.root_cause_classifier = RootCauseClassifier()
        self.imputation_engine = PhysicsGuidedImputationEngine()
        self.edge_simulator = EdgeProcessingSimulator()

        # 8 Station Metadata (Andhra Pradesh Region)
        self.stations = [
            {"id": "AWS-001", "name": "Visakhapatnam Coastal", "latitude": 17.6868, "longitude": 83.2185, "elevation": 25.0},
            {"id": "AWS-002", "name": "Vijayawada Urban", "latitude": 16.5062, "longitude": 80.6480, "elevation": 39.0},
            {"id": "AWS-003", "name": "Guntur Central", "latitude": 16.3067, "longitude": 80.4365, "elevation": 33.0},
            {"id": "AWS-004", "name": "Tirupati Valley", "latitude": 13.6288, "longitude": 79.4192, "elevation": 162.0},
            {"id": "AWS-005", "name": "Kurnool Plateau", "latitude": 15.8281, "longitude": 78.0373, "elevation": 273.0},
            {"id": "AWS-006", "name": "Kakinada Port", "latitude": 16.9891, "longitude": 82.2475, "elevation": 9.0},
            {"id": "AWS-007", "name": "Nellore South", "latitude": 14.4426, "longitude": 79.9865, "elevation": 19.0},
            {"id": "AWS-008", "name": "Anantapur West", "latitude": 14.6819, "longitude": 77.6006, "elevation": 335.0},
        ]

        # Active Scenario State & Incremental Counters
        self.active_scenario = "normal"
        self.drift_offset_hum5 = 0.0
        self.streaming_active = False
        
        # State tracking: history buffers, alerts log, approved corrections, activity logs
        self.history_buffers = {st['id']: deque(maxlen=100) for st in self.stations}
        self.alerts_log = []
        self.approved_corrections = {}
        self.activity_logs = deque(maxlen=200)

        self.load_dataset(self.data_csv_path)
        self.log_activity("System Initialized", "SkyGuard AI backend engine loaded with 8 AWS AP station nodes.")

    def log_activity(self, action, detail, level="INFO"):
        ts = datetime.datetime.now().strftime("%H:%M:%S")
        self.activity_logs.appendleft({
            "timestamp": ts,
            "action": action,
            "detail": detail,
            "level": level
        })

    def load_dataset(self, csv_path):
        """Loads demo CSV dataset or initializes default history buffers."""
        STATION_NAMES = {
            "AWS-001": "Visakhapatnam Coastal", "AWS-002": "Vijayawada Urban", "AWS-003": "Guntur Central",
            "AWS-004": "Tirupati Valley", "AWS-005": "Kurnool Plateau", "AWS-006": "Kakinada Port",
            "AWS-007": "Nellore South", "AWS-008": "Anantapur West",
            "AWS-101": "Shimla Observatory", "AWS-102": "Manali Ridge", "AWS-103": "Leh High Altitude",
            "AWS-104": "Srinagar Valley", "AWS-105": "Dharamshala Hills", "AWS-106": "Solan Agro Node"
        }

        if os.path.exists(csv_path):
            try:
                self.dataset_df = pd.read_csv(csv_path)
                csv_st_ids = list(self.dataset_df['station_id'].unique())

                new_stations = []
                for st_id in csv_st_ids:
                    st_df = self.dataset_df[self.dataset_df['station_id'] == st_id]
                    first_row = st_df.iloc[0]
                    name = STATION_NAMES.get(st_id, f"Station {st_id}")
                    lat = float(first_row['latitude']) if 'latitude' in first_row and pd.notnull(first_row['latitude']) else 16.0
                    lon = float(first_row['longitude']) if 'longitude' in first_row and pd.notnull(first_row['longitude']) else 80.0
                    elev = float(first_row['elevation']) if 'elevation' in first_row and pd.notnull(first_row['elevation']) else 50.0

                    new_stations.append({
                        "id": st_id,
                        "name": name,
                        "latitude": lat,
                        "longitude": lon,
                        "elevation": elev
                    })

                if new_stations:
                    self.stations = new_stations

                self.history_buffers = {}
                for st in self.stations:
                    self.history_buffers[st['id']] = deque(maxlen=100)
                    st_df = self.dataset_df[self.dataset_df['station_id'] == st['id']]
                    if not st_df.empty:
                        for _, row in st_df.iterrows():
                            row_dict = row.to_dict()
                            for k, v in list(row_dict.items()):
                                if pd.isna(v):
                                    row_dict[k] = None
                            self.history_buffers[st['id']].append(row_dict)

                self.log_activity("Dataset Loaded", f"Successfully loaded {len(self.dataset_df)} records from {os.path.basename(csv_path)} across {len(self.stations)} stations.", "SUCCESS")
            except Exception as e:
                print(f"Error loading CSV {csv_path}: {e}")
                self._generate_fallback_history()
        else:
            self._generate_fallback_history()


    def _generate_fallback_history(self):
        now = datetime.datetime.now()
        for st in self.stations:
            for i in range(40, 0, -1):
                ts = (now - datetime.timedelta(minutes=i*15)).strftime("%Y-%m-%d %H:%M:%S")
                self.history_buffers[st['id']].append({
                    "timestamp": ts,
                    "station_id": st['id'],
                    "latitude": st['latitude'],
                    "longitude": st['longitude'],
                    "elevation": st['elevation'],
                    "temperature": round(31.0 + random.uniform(-0.5, 0.5), 1),
                    "humidity": round(68.0 + random.uniform(-1.0, 1.0), 1),
                    "pressure": round(1012.5 - (0.012 * st['elevation']), 1),
                    "dew_point": 24.5,
                    "rainfall": 0.0,
                    "wind_speed": 12.0,
                    "wind_direction": 180,
                    "solar_radiation": 450.0,
                    "battery_voltage": 13.4,
                    "signal_strength": -70
                })

    def reset_simulation(self):
        """Resets active scenario, clears alerts, corrections and resets to baseline."""
        self.active_scenario = "normal"
        self.drift_offset_hum5 = 0.0
        self.streaming_active = False
        self.alerts_log.clear()
        self.approved_corrections.clear()
        self.load_dataset(self.data_csv_path)
        self.log_activity("Reset System", "All scenarios cleared. Baseline healthy operation restored across all 8 AWS stations.", "SUCCESS")

    def inject_scenario(self, scenario_name):
        """
        Triggers exact 9 SkyGuard AI simulation scenarios:
        1. normal: All 8 stations healthy
        2. stuck_sensor: Station #3 (AWS-003) Temp drops to 22.4°C and stays flat
        3. sensor_drift: Station #5 (AWS-005) Humidity drifts +0.8% per step
        4. comm_failure: Station #1 (AWS-001) flatlines to null values
        5. heavy_rainfall: Station #7 (AWS-007) severe precipitation verified by neighbors as genuine event
        6. weather_front: Rapid temp drop sweeping Stations 2, 4, 6
        7. physics_violation: Station #8 (AWS-008) high RH with zero dewpoint convergence
        8. power_drop: Station #4 (AWS-004) edge battery drops below 3.2V
        9. reset_system: Clears scenarios, restores baseline healthy operation
        """
        self.active_scenario = scenario_name
        if scenario_name == "sensor_drift":
            self.drift_offset_hum5 = 12.0
        elif scenario_name == "normal" or scenario_name == "reset_system":
            self.reset_simulation()
            return

        self.log_activity("Scenario Triggered", f"Active simulation scenario changed to: {scenario_name.upper()}", "WARNING")

    def get_latest_observations(self):
        """
        Gets latest observations across all 8 stations, applying active scenario transformations.
        Returns dict of station_id -> processed obs object with AI diagnostics.
        """
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        all_latest = {}

        # First pass: collect baseline readings and apply exact 9 scenarios
        for st in self.stations:
            st_id = st['id']
            buf = self.history_buffers[st_id]
            base_obs = dict(buf[-1]) if len(buf) > 0 else {
                'timestamp': now_str,
                'station_id': st_id,
                'latitude': st['latitude'],
                'longitude': st['longitude'],
                'elevation': st['elevation'],
                'temperature': 31.2,
                'pressure': 1012.6,
                'humidity': 67.0,
                'dew_point': 24.2,
                'rainfall': 0.0,
                'wind_speed': 12.0,
                'wind_direction': 180,
                'solar_radiation': 450.0,
                'battery_voltage': 13.5,
                'signal_strength': -68
            }

            # Scenario 2: Stuck Sensor (Station #3 / AWS-003 temp drops to 22.4°C and stays completely flat)
            if self.active_scenario == "stuck_sensor" and st_id == "AWS-003":
                base_obs['temperature'] = 22.4
                base_obs['timestamp'] = now_str

            # Scenario 3: Sensor Drift (Station #5 / AWS-005 humidity slowly drifts upward +0.8% per step)
            elif self.active_scenario == "sensor_drift" and st_id == "AWS-005":
                self.drift_offset_hum5 += 0.8
                base_obs['humidity'] = round(min(98.0, 68.0 + self.drift_offset_hum5), 1)
                base_obs['timestamp'] = now_str

            # Scenario 4: Comm Failure (Station #1 / AWS-001 flatlines to null values)
            elif self.active_scenario == "comm_failure" and st_id == "AWS-001":
                base_obs['temperature'] = None
                base_obs['pressure'] = None
                base_obs['humidity'] = None
                base_obs['battery_voltage'] = 0.0
                base_obs['signal_strength'] = -120
                base_obs['timestamp'] = now_str

            # Scenario 5: Heavy Rain (Station #7 / AWS-007 severe precipitation, verified by neighbor AWS-006 as genuine event)
            elif self.active_scenario == "heavy_rainfall":
                if st_id == "AWS-007":
                    base_obs['rainfall'] = 68.5
                    base_obs['humidity'] = 96.0
                    base_obs['wind_speed'] = 34.0
                elif st_id == "AWS-006":
                    base_obs['rainfall'] = 52.0
                    base_obs['humidity'] = 94.0
                    base_obs['wind_speed'] = 30.0
                base_obs['timestamp'] = now_str

            # Scenario 6: Weather Front (Rapid temperature drop sweeping across Stations 2, 4, and 6)
            elif self.active_scenario == "weather_front" and st_id in ["AWS-002", "AWS-004", "AWS-006"]:
                base_obs['temperature'] = round(21.5 - (0.0065 * st['elevation']), 1)
                base_obs['pressure'] = round(1003.8 - (0.012 * st['elevation']), 1)
                base_obs['humidity'] = 92.0
                base_obs['wind_speed'] = 29.0
                base_obs['timestamp'] = now_str

            # Scenario 7: Physics Violation (Station #8 / AWS-008 high RH (94%) but zero dewpoint convergence)
            elif self.active_scenario == "physics_violation" and st_id == "AWS-008":
                base_obs['temperature'] = 46.0
                base_obs['humidity'] = 94.0
                base_obs['dew_point'] = 2.0  # Psychrometric law violation
                base_obs['timestamp'] = now_str

            # Scenario 8: Power Drop (Station #4 / AWS-004 edge node battery drops below 3.2V)
            elif self.active_scenario == "power_drop" and st_id == "AWS-004":
                base_obs['battery_voltage'] = 2.9  # Imminent solar panel failure (< 3.2V)
                base_obs['timestamp'] = now_str

            all_latest[st_id] = base_obs

        # Second pass: Process through full SkyGuard AI Pipeline
        processed_stations = {}
        for st in self.stations:
            st_id = st['id']
            obs = all_latest[st_id]
            hist_df = pd.DataFrame(list(self.history_buffers[st_id]))

            # 1. Physics Engine Check
            physics_res = self.physics_engine.validate_observation(obs, hist_df)

            # 2. Spatial ST-GNN Consensus Check
            spatial_res = self.spatial_engine.compute_spatial_consensus(obs, all_latest, self.stations)

            # 3. Root Cause Classification (Framed for Technician Consultation)
            rc_res = self.root_cause_classifier.classify(obs, physics_res, spatial_res, hist_df)

            # 4. Imputation Engine
            imp_res = self.imputation_engine.reconstruct_observation(obs, all_latest, self.stations, physics_res)

            # 5. Edge Processing Simulation
            edge_res = self.edge_simulator.get_edge_metrics(obs)

            is_anomaly = rc_res['category'] != "NORMAL"

            # Check if technician approved or rejected data reconstruction
            corr_key = f"{st_id}:{imp_res['target_parameter']}"
            corr_state = self.approved_corrections.get(corr_key, {'status': 'PENDING'})

            # Technician consultation action wording
            rec_action = "Routine station monitoring. Data within baseline."
            if rc_res['root_cause'] == 'Calibration Drift':
                rec_action = f"Diagnostic Suggestion: Inspect relative humidity/temperature transducer on {st_id} ({st['name']}) and perform field recalibration check."
            elif rc_res['root_cause'] == 'Stuck Sensor':
                rec_action = f"Diagnostic Suggestion: Temperature reading frozen at 22.4°C. Check ADC transducer latch circuit on {st_id}."
            elif rc_res['root_cause'] == 'Communication Failure':
                rec_action = f"Diagnostic Suggestion: Telemetry packet loss detected on {st_id}. Inspect RS485 Modbus gateway & cellular signal antenna."
            elif rc_res['root_cause'] == 'Power Drop':
                rec_action = f"Diagnostic Suggestion: Edge node battery dropped to {obs.get('battery_voltage', 2.9)}V (< 3.2V threshold). Check solar panel battery charge controller."
            elif rc_res['root_cause'] == 'Physics Violation':
                rec_action = f"Diagnostic Suggestion: Severe dewpoint-humidity psychrometric inconsistency on {st_id}. Recalibrate psychrometric sensor probe."
            elif rc_res['category'] == 'Genuine Meteorological Event':
                rec_action = "Diagnostic Suggestion: Cross-station consensus confirms genuine regional meteorological event. Issue weather advisory."

            raw_val = obs.get(imp_res['target_parameter'], 0.0)
            expected_val = imp_res['reconstructed_value']
            corrected_val = expected_val if corr_state['status'] == 'APPROVED' else raw_val

            processed_obs = {
                'station_info': st,
                'telemetry': obs,
                'physics_diagnostics': physics_res,
                'spatial_diagnostics': spatial_res,
                'root_cause_classification': rc_res,
                'imputation': imp_res,
                'edge_metrics': edge_res,
                'is_anomaly': is_anomaly,
                'correction_state': corr_state,
                'raw_value': raw_val,
                'expected_value': expected_val,
                'corrected_value': corrected_val,
                'recommended_action': rec_action,
                'status': 'FAULT' if rc_res['category'] == 'Hard Failure' else ('WARNING' if rc_res['category'] == 'Soft Failure' else ('EVENT' if rc_res['category'] == 'Genuine Meteorological Event' else 'HEALTHY'))
            }

            processed_stations[st_id] = processed_obs

            # Log active alert if anomaly detected
            if is_anomaly:
                severity = rc_res['severity']
                
                existing_alert = next((a for a in self.alerts_log if a['station_id'] == st_id and a['anomaly_type'] == rc_res['root_cause'] and a['status'] != 'RESOLVED'), None)
                
                if not existing_alert and rc_res['category'] != 'NORMAL':
                    alert_entry = {
                        'id': f"ALT-{int(datetime.datetime.now().timestamp()*1000)%100000}",
                        'timestamp': obs.get('timestamp', now_str),
                        'station_id': st_id,
                        'station_name': st['name'],
                        'anomaly_type': rc_res['root_cause'],
                        'category': rc_res['category'],
                        'severity': severity,
                        'confidence': rc_res['confidence'],
                        'physics_score': physics_res['overall_physics_score'],
                        'spatial_consensus': spatial_res['consensus_score'],
                        'status': 'NEW' if rc_res['category'] != 'Genuine Meteorological Event' else 'METEOROLOGICAL_EVENT',
                        'why_reasons': rc_res.get('reasoning', []),
                        'recommended_action': rec_action,
                        'target_parameter': imp_res['target_parameter'],
                        'raw_val': raw_val,
                        'expected_val': expected_val,
                        'corrected_val': corrected_val,
                        'acknowledged_at': None,
                        'investigated_at': None,
                        'resolved_at': None,
                        'resolution_notes': None
                    }
                    self.alerts_log.append(alert_entry)
                    self.log_activity("Alert Generated", f"[{severity}] {rc_res['root_cause']} on {st_id} ({st['name']})", level="ERROR" if severity=="CRITICAL" else "WARNING")

        return processed_stations

    def get_kpi_summary(self):
        """Computes top dashboard KPI metrics across all 8 stations."""
        processed = self.get_latest_observations()
        total_stations = len(self.stations)
        healthy_count = sum(1 for p in processed.values() if p['status'] == 'HEALTHY')
        active_alerts_count = len([a for a in self.alerts_log if a['status'] in ['NEW', 'ACKNOWLEDGED', 'UNDER INVESTIGATION']])

        avg_physics = round(np.mean([p['physics_diagnostics']['overall_physics_score'] for p in processed.values()]), 1)
        avg_spatial = round(np.mean([p['spatial_diagnostics']['consensus_score'] for p in processed.values()]), 1)
        data_quality = round(max(0.0, min(100.0, (healthy_count / total_stations) * 100.0 * 0.5 + avg_physics * 0.3 + avg_spatial * 0.2)), 1)

        return {
            'total_stations': total_stations,
            'healthy_stations': healthy_count,
            'active_alerts': active_alerts_count,
            'data_quality_pct': data_quality,
            'physics_consistency_pct': avg_physics,
            'spatial_consensus_pct': avg_spatial,
            'active_scenario': self.active_scenario,
            'streaming_active': self.streaming_active
        }
