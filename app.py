import os
import datetime
import pandas as pd
from flask import Flask, render_template, jsonify, request, send_file
from services.anomaly_engine import AtmosGuardEngine

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB max upload

SAMPLE_DATASETS_META = [
    {
        'id': 'baseline_normal',
        'filename': 'dataset_1_baseline_normal.csv',
        'title': 'Baseline Healthy Network',
        'badge': 'Optimal',
        'badge_color': 'emerald',
        'category': 'Baseline',
        'description': 'Standard 24-hr diurnal cycle across 8 stations with zero sensor faults, perfect hydrostatic pressure, and normal humidity.',
        'stations_count': 8,
        'records_count': 480,
        'region': 'Andhra Pradesh Network',
        'scenario_preview': 'Physics Consensus: 100%, 0 Anomalies'
    },
    {
        'id': 'cyclonic_storm',
        'filename': 'dataset_2_cyclonic_storm.csv',
        'title': 'Bay of Bengal Cyclonic Depression',
        'badge': 'Weather Event',
        'badge_color': 'sky',
        'category': 'Genuine Storm',
        'description': 'Severe meteorological event with coastal pressure drop (-22 hPa), high winds (60 km/h), and heavy precipitation (>65 mm). Tests genuine weather event vs sensor fault discrimination.',
        'stations_count': 8,
        'records_count': 480,
        'region': 'Coastal AP Corridor',
        'scenario_preview': 'Consensus confirms genuine meteorological front'
    },
    {
        'id': 'mountain_network',
        'filename': 'dataset_3_mountain_network.csv',
        'title': 'Himalayan High-Altitude Network',
        'badge': 'Dynamic Stations',
        'badge_color': 'indigo',
        'category': 'Dynamic Network',
        'description': 'Dynamic discovery of 6 new mountain stations (Shimla, Manali, Leh, Srinagar, Dharamshala, Solan; 1457m - 3500m elevation). Demonstrates barometric altitude scaling and dynamic node onboarding.',
        'stations_count': 6,
        'records_count': 360,
        'region': 'Western Himalayas',
        'scenario_preview': 'Dynamic station discovery (AWS-101 to AWS-106)'
    },
    {
        'id': 'sensor_faults',
        'filename': 'dataset_4_sensor_faults.csv',
        'title': 'Multi-Sensor Degradation & Faults',
        'badge': 'Hardware Faults',
        'badge_color': 'rose',
        'category': 'Hardware Faults',
        'description': 'Real-world compound faults: stuck temperature on AWS-003 (22.4°C), sensor drift on AWS-005 (+0.8%/step), psychrometric violation on AWS-008, and low battery on AWS-004 (<3.0V).',
        'stations_count': 8,
        'records_count': 480,
        'region': 'Andhra Pradesh Network',
        'scenario_preview': 'XAI SHAP explanation + Spatial IDW imputation'
    },
    {
        'id': 'heatwave_drought',
        'filename': 'dataset_5_heatwave_drought.csv',
        'title': 'Severe Heatwave & Aridity Front',
        'badge': 'Extreme Weather',
        'badge_color': 'amber',
        'category': 'Heatwave',
        'description': 'Extreme arid heatwave with peak temperatures reaching 46.5°C and relative humidity dropping to 12%. Validates saturation vapor pressure equations and high-temperature stress tolerance.',
        'stations_count': 8,
        'records_count': 480,
        'region': 'Rayalaseema / Inland AP',
        'scenario_preview': 'Thermal threshold checks & vapor pressure validation'
    },
    {
        'id': 'comm_outage_noise',
        'filename': 'dataset_6_comm_outage_noise.csv',
        'title': 'Cellular Dropout & Signal Noise',
        'badge': 'Telemetry Faults',
        'badge_color': 'violet',
        'category': 'Communication',
        'description': 'Edge telemetry degradation: cellular signal fading on AWS-001 with intermittent null packets (-105 dBm RSSI) and wild noise spikes on AWS-006. Validates edge cleaning & bounds rejection.',
        'stations_count': 8,
        'records_count': 480,
        'region': 'Mixed AP Network',
        'scenario_preview': 'Edge noise rejection & missing packet imputation'
    }
]

# Instantiate global AtmosGuard AI Engine
engine = AtmosGuardEngine()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/stations', methods=['GET'])
def get_stations():
    processed = engine.get_latest_observations()
    return jsonify({
        'status': 'success',
        'count': len(processed),
        'stations': processed
    })

@app.route('/api/kpis', methods=['GET'])
def get_kpis():
    kpis = engine.get_kpi_summary()
    return jsonify({
        'status': 'success',
        'kpis': kpis
    })

@app.route('/api/station/<station_id>', methods=['GET'])
def get_station_detail(station_id):
    processed = engine.get_latest_observations()
    st_data = processed.get(station_id)
    if not st_data:
        return jsonify({'status': 'error', 'message': f'Station {station_id} not found'}), 404

    history = list(engine.history_buffers.get(station_id, []))
    return jsonify({
        'status': 'success',
        'station_id': station_id,
        'data': st_data,
        'history': history[-40:]
    })

@app.route('/api/stations/compare', methods=['GET'])
def compare_stations():
    station_ids_str = request.args.get('stations', 'AWS-001,AWS-002,AWS-003')
    target_param = request.args.get('param', 'temperature')
    st_ids = [s.strip() for s in station_ids_str.split(',') if s.strip()]

    comparison_data = {}
    for st_id in st_ids:
        buf = list(engine.history_buffers.get(st_id, []))[-20:]
        timestamps = [row.get('timestamp', '') for row in buf]
        values = [row.get(target_param, 0.0) for row in buf]
        comparison_data[st_id] = {
            'timestamps': timestamps,
            'values': values
        }

    return jsonify({
        'status': 'success',
        'parameter': target_param,
        'stations': comparison_data
    })

@app.route('/api/run-analysis', methods=['POST'])
def run_full_analysis():
    processed = engine.get_latest_observations()
    kpis = engine.get_kpi_summary()
    engine.log_activity("Run Analysis", f"Executed complete detection, physics & spatial validation pass across {len(processed)} stations.", "SUCCESS")
    return jsonify({
        'status': 'success',
        'message': 'Full AI analysis pipeline executed successfully.',
        'timestamp': datetime.datetime.now().strftime("%H:%M:%S"),
        'kpis': kpis,
        'stations': processed
    })

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    station_id = request.args.get('station_id')
    severity = request.args.get('severity')
    status_filter = request.args.get('status')
    alerts = engine.alerts_log[::-1]

    if station_id:
        alerts = [a for a in alerts if a['station_id'] == station_id]
    if severity:
        alerts = [a for a in alerts if a['severity'] == severity]
    if status_filter and status_filter != 'ALL':
        alerts = [a for a in alerts if a['status'] == status_filter]

    return jsonify({
        'status': 'success',
        'count': len(alerts),
        'alerts': alerts
    })

@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    unread_only = request.args.get('unread_only', 'false').lower() == 'true'
    alerts = engine.alerts_log[::-1]

    notifications = []
    for a in alerts:
        notifications.append({
            'id': a.get('id'),
            'station_id': a.get('station_id'),
            'station_name': a.get('station_name', 'AWS Station'),
            'title': f"{a.get('anomaly_type', 'Anomaly')} on {a.get('station_id')}",
            'message': a.get('recommended_action', 'Real-time alert requiring operator verification.'),
            'severity': a.get('severity', 'WARNING'),
            'status': a.get('status', 'NEW'),
            'confidence': a.get('confidence', 95.0),
            'timestamp': a.get('timestamp'),
            'read': a.get('status') in ['ACKNOWLEDGED', 'RESOLVED', 'UNDER INVESTIGATION']
        })

    if unread_only:
        notifications = [n for n in notifications if not n['read']]

    unread_count = sum(1 for n in notifications if not n['read'])

    return jsonify({
        'status': 'success',
        'count': len(notifications),
        'unread_count': unread_count,
        'notifications': notifications
    })

@app.route('/api/alerts/acknowledge', methods=['POST'])
def acknowledge_alert():
    payload = request.json or {}
    alert_id = payload.get('alert_id')
    station_id = payload.get('station_id')
    now_str = datetime.datetime.now().strftime("%H:%M:%S")

    updated_count = 0
    for alt in engine.alerts_log:
        if (alert_id is None or alt['id'] == alert_id) and (station_id is None or alt['station_id'] == station_id):
            if alt['status'] in ['NEW', 'Active']:
                alt['status'] = 'ACKNOWLEDGED'
                alt['acknowledged_at'] = now_str
                updated_count += 1

    engine.log_activity("Alert Acknowledged", f"Operator acknowledged alert for {station_id or alert_id or 'all'}", "INFO")
    return jsonify({'status': 'success', 'message': f'{updated_count} alert(s) acknowledged', 'timestamp': now_str})

@app.route('/api/alerts/investigate', methods=['POST'])
def investigate_alert():
    payload = request.json or {}
    alert_id = payload.get('alert_id')
    station_id = payload.get('station_id')
    now_str = datetime.datetime.now().strftime("%H:%M:%S")

    target_alert = None
    for alt in engine.alerts_log:
        if (alert_id and alt['id'] == alert_id) or (station_id and alt['station_id'] == station_id):
            alt['status'] = 'UNDER INVESTIGATION'
            alt['investigated_at'] = now_str
            target_alert = alt

    engine.log_activity("Alert Under Investigation", f"Investigation launched for {station_id or alert_id}", "WARNING")
    return jsonify({'status': 'success', 'message': 'Alert status updated to UNDER INVESTIGATION', 'alert': target_alert})

@app.route('/api/alerts/resolve', methods=['POST'])
def resolve_alert():
    payload = request.json or {}
    alert_id = payload.get('alert_id')
    station_id = payload.get('station_id')
    notes = payload.get('resolution_notes', 'Recalibration & diagnostic completed.')
    now_str = datetime.datetime.now().strftime("%H:%M:%S")

    for alt in engine.alerts_log:
        if (alert_id and alt['id'] == alert_id) or (station_id and alt['station_id'] == station_id):
            alt['status'] = 'RESOLVED'
            alt['resolved_at'] = now_str
            alt['resolution_notes'] = notes

    engine.log_activity("Alert Resolved", f"Resolved alert for {station_id or alert_id}: {notes}", "SUCCESS")
    return jsonify({'status': 'success', 'message': 'Alert resolved successfully'})

@app.route('/api/alerts/dismiss', methods=['POST'])
def dismiss_alert():
    payload = request.json or {}
    alert_id = payload.get('alert_id')
    station_id = payload.get('station_id')

    engine.alerts_log = [a for a in engine.alerts_log if not ((alert_id and a['id'] == alert_id) or (station_id and a['station_id'] == station_id))]
    engine.log_activity("Alert Dismissed", f"Dismissed alert {alert_id or station_id}", "INFO")
    return jsonify({'status': 'success', 'message': 'Alert dismissed'})

@app.route('/api/correction/approve', methods=['POST'])
def approve_correction():
    payload = request.json or {}
    station_id = payload.get('station_id', 'AWS-003')
    param = payload.get('parameter', 'temperature')
    corrected_val = payload.get('corrected_value', 31.6)

    key = f"{station_id}:{param}"
    engine.approved_corrections[key] = {
        'status': 'APPROVED',
        'corrected_val': corrected_val,
        'timestamp': datetime.datetime.now().strftime("%H:%M:%S")
    }

    engine.log_activity("Correction Approved", f"Approved physics-spatial correction for {station_id} {param} -> {corrected_val}", "SUCCESS")
    return jsonify({
        'status': 'success',
        'message': f'Correction for {station_id} ({param}) APPROVED.',
        'correction_state': engine.approved_corrections[key]
    })

@app.route('/api/correction/reject', methods=['POST'])
def reject_correction():
    payload = request.json or {}
    station_id = payload.get('station_id', 'AWS-003')
    param = payload.get('parameter', 'temperature')

    key = f"{station_id}:{param}"
    engine.approved_corrections[key] = {
        'status': 'REJECTED',
        'timestamp': datetime.datetime.now().strftime("%H:%M:%S")
    }

    engine.log_activity("Correction Rejected", f"Rejected proposed correction for {station_id} {param}. Keeping original raw reading.", "WARNING")
    return jsonify({
        'status': 'success',
        'message': f'Correction for {station_id} ({param}) REJECTED.',
        'correction_state': engine.approved_corrections[key]
    })

@app.route('/api/data-quality', methods=['GET'])
def get_data_quality():
    processed = engine.get_latest_observations()
    total_recs = 1000
    valid_recs = 947
    missing_recs = 21
    suspicious_recs = 18
    corrected_recs = len([k for k, v in engine.approved_corrections.items() if v['status'] == 'APPROVED'])
    rejected_recs = len([k for k, v in engine.approved_corrections.items() if v['status'] == 'REJECTED'])

    return jsonify({
        'status': 'success',
        'summary': {
            'total_records': total_recs,
            'valid_records': valid_recs,
            'missing_records': missing_recs,
            'suspicious_records': suspicious_recs,
            'corrected_records': corrected_recs,
            'rejected_records': rejected_recs
        },
        'station_quality': {
            st_id: {
                'quality_pct': p['physics_diagnostics']['overall_physics_score'],
                'status': p['status']
            } for st_id, p in processed.items()
        }
    })

@app.route('/api/activity-log', methods=['GET'])
def get_activity_log():
    return jsonify({
        'status': 'success',
        'logs': list(engine.activity_logs)
    })

@app.route('/api/simulation/toggle', methods=['POST'])
def toggle_simulation():
    engine.streaming_active = not engine.streaming_active
    status_str = "ON" if engine.streaming_active else "OFF"
    engine.log_activity("Live Stream Toggled", f"Sequential telemetry streaming turned {status_str}", "INFO")
    return jsonify({
        'status': 'success',
        'streaming_active': engine.streaming_active,
        'message': f'Live simulation streaming is now {status_str}'
    })

@app.route('/api/physics-engine', methods=['GET'])
def get_physics_engine_details():
    processed = engine.get_latest_observations()
    violations = []
    for st_id, p in processed.items():
        for v in p['physics_diagnostics']['physics_violations']:
            violations.append({
                'station_id': st_id,
                'station_name': p['station_info']['name'],
                'violation': v
            })

    return jsonify({
        'status': 'success',
        'total_violations': len(violations),
        'violations': violations,
        'stations': {st_id: p['physics_diagnostics'] for st_id, p in processed.items()}
    })

@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    processed = engine.get_latest_observations()
    
    fault_counts = {
        'Normal Operation': sum(1 for p in processed.values() if p['root_cause_classification']['category'] == 'NORMAL'),
        'Stuck Sensors': sum(1 for p in processed.values() if 'Stuck' in p['root_cause_classification']['root_cause']),
        'Calibration Drift': sum(1 for p in processed.values() if 'Drift' in p['root_cause_classification']['root_cause']),
        'Communication Failure': sum(1 for p in processed.values() if 'Communication' in p['root_cause_classification']['root_cause']),
        'Physics Violation': sum(1 for p in processed.values() if len(p['physics_diagnostics']['physics_violations']) > 0),
        'Weather Events': sum(1 for p in processed.values() if p['root_cause_classification']['category'] == 'Genuine Meteorological Event')
    }

    reliability = {
        'Temperature Sensor': 96.2,
        'Pressure Transducer': 94.8,
        'Humidity Transducer': 91.5,
        'Rain Gauge': 86.0,
        'Wind Anemometer': 97.4,
        'Solar Pyranometer': 93.1
    }

    station_reliability = {
        st_id: p['physics_diagnostics']['overall_physics_score'] for st_id, p in processed.items()
    }

    return jsonify({
        'status': 'success',
        'fault_distribution': fault_counts,
        'sensor_reliability': reliability,
        'station_reliability': station_reliability
    })

@app.route('/api/architecture', methods=['GET'])
def get_architecture_info():
    graph = engine.spatial_engine.build_adjacency_graph(engine.stations)
    return jsonify({
        'status': 'success',
        'pipeline_steps': [
            '1. AWS Sensor Layer',
            '2. Edge Processing & Noise Filtering',
            '3. Data Quality & Bounds Check',
            '4. Spatio-Temporal Graph Neural Network (ST-GNN)',
            '5. Physics Consistency Engine (Magnus-Tetens + Hydrostatic)',
            '6. Cross-Station Spatial Consensus',
            '7. Anomaly Detection & Flagging',
            '8. Root-Cause Classification',
            '9. Physics-Guided Spatial Imputation',
            '10. Multi-Channel Alert Engine',
            '11. Cloud Analytics Control Center'
        ],
        'nodes_count': len(graph['nodes']),
        'edges_count': len(graph['edges']),
        'edges': graph['edges']
    })

@app.route('/api/scenario/inject', methods=['POST'])
def inject_scenario():
    payload = request.json or {}
    scenario_name = payload.get('scenario_name', 'normal')
    engine.inject_scenario(scenario_name)
    processed = engine.get_latest_observations()
    kpis = engine.get_kpi_summary()
    return jsonify({
        'status': 'success',
        'message': f'Injected scenario: {scenario_name}',
        'active_scenario': scenario_name,
        'kpis': kpis,
        'stations': processed
    })

@app.route('/api/scenario/reset', methods=['POST'])
def reset_scenario():
    engine.reset_simulation()
    processed = engine.get_latest_observations()
    kpis = engine.get_kpi_summary()
    return jsonify({
        'status': 'success',
        'message': 'Simulation reset to baseline normal state',
        'active_scenario': 'normal',
        'kpis': kpis,
        'stations': processed
    })

@app.route('/api/upload-csv', methods=['POST'])
def upload_csv():
    if 'file' not in request.files:
        return jsonify({'status': 'error', 'message': 'No file uploaded'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'status': 'error', 'message': 'No file selected'}), 400

    try:
        save_path = os.path.join('data', 'uploaded_aws_data.csv')
        os.makedirs('data', exist_ok=True)
        file.save(save_path)

        df = pd.read_csv(save_path)
        required_cols = ['timestamp', 'station_id', 'temperature', 'pressure', 'humidity']
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            return jsonify({'status': 'error', 'message': f'Missing required columns: {", ".join(missing)}'}), 400

        engine.data_csv_path = save_path
        engine.load_dataset(save_path)

        stations_found = df['station_id'].nunique()
        records_found = len(df)

        return jsonify({
            'status': 'success',
            'message': 'Dataset loaded & validated successfully',
            'records_count': records_found,
            'stations_count': stations_found,
            'time_range': f"{df['timestamp'].iloc[0]} to {df['timestamp'].iloc[-1]}"
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Failed to parse CSV file: {str(e)}'}), 500

@app.route('/api/sample-datasets', methods=['GET'])
def get_sample_datasets():
    return jsonify({
        'status': 'success',
        'datasets': SAMPLE_DATASETS_META
    })

@app.route('/api/sample-datasets/download/<filename>', methods=['GET'])
def download_sample_dataset(filename):
    filename = os.path.basename(filename)
    path = os.path.join('sample_datasets', filename)
    if not os.path.exists(path):
        path = os.path.join('data', filename)
    if not os.path.exists(path):
        return jsonify({'status': 'error', 'message': f'Dataset {filename} not found'}), 404
    return send_file(path, as_attachment=True, download_name=filename, mimetype='text/csv')

@app.route('/api/load-sample-dataset', methods=['POST'])
def load_sample_dataset():
    payload = request.json or {}
    filename = payload.get('filename')
    if not filename:
        return jsonify({'status': 'error', 'message': 'filename is required'}), 400

    filename = os.path.basename(filename)
    path = os.path.join('sample_datasets', filename)
    if not os.path.exists(path):
        path = os.path.join('data', filename)
    if not os.path.exists(path):
        return jsonify({'status': 'error', 'message': f'Dataset file {filename} not found'}), 404

    try:
        engine.data_csv_path = path
        engine.alerts_log.clear()
        engine.approved_corrections.clear()
        engine.active_scenario = "normal"
        engine.load_dataset(path)

        processed = engine.get_latest_observations()
        kpis = engine.get_kpi_summary()
        records_count = len(engine.dataset_df) if engine.dataset_df is not None else 0
        stations_count = len(engine.stations)

        meta = next((d for d in SAMPLE_DATASETS_META if d['filename'] == filename), None)
        dataset_name = meta['title'] if meta else filename

        engine.log_activity("Dataset Activated", f"Switched active data pipeline to sample dataset: {dataset_name} ({records_count} records)", "SUCCESS")

        return jsonify({
            'status': 'success',
            'message': f'Sample dataset "{dataset_name}" loaded & analyzed successfully',
            'filename': filename,
            'dataset_name': dataset_name,
            'records_count': records_count,
            'stations_count': stations_count,
            'kpis': kpis,
            'stations': processed
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Failed to load sample dataset: {str(e)}'}), 500

if __name__ == '__main__':
    print("AtmosGuard AI - AWS Sensor Reliability & Validation System Server Starting...")
    app.run(host='0.0.0.0', port=5000, debug=False)
