import json
import unittest
from app import app, engine

class SkyGuardVerificationTests(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_01_kpis_endpoint(self):
        res = self.app.get('/api/kpis')
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['kpis']['total_stations'], 8)

    def test_02_stations_endpoint(self):
        res = self.app.get('/api/stations')
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data['status'], 'success')
        self.assertIn('AWS-001', data['stations'])
        self.assertIn('AWS-008', data['stations'])

    def test_03_magnus_tetens_physics_check(self):
        dp_calc = engine.physics_engine.calculate_magnus_dew_point(30.0, 70.0)
        self.assertIsNotNone(dp_calc)
        self.assertAlmostEqual(dp_calc, 23.9, delta=0.5)

    def test_04_hydrostatic_barometric_check(self):
        p_calc = engine.physics_engine.calculate_expected_pressure(25.0)
        self.assertAlmostEqual(p_calc, 1010.2, delta=1.5)

    def test_05_stuck_sensor_scenario(self):
        res = self.app.post('/api/scenario/inject', json={'scenario_name': 'stuck_sensor'})
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        st3 = data['stations']['AWS-003']
        self.assertEqual(st3['telemetry']['temperature'], 22.4)
        self.assertEqual(st3['is_anomaly'], True)

    def test_06_power_drop_scenario(self):
        res = self.app.post('/api/scenario/inject', json={'scenario_name': 'power_drop'})
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        st4 = data['stations']['AWS-004']
        self.assertLess(st4['telemetry']['battery_voltage'], 3.2)
        self.assertEqual(st4['is_anomaly'], True)

    def test_07_alert_lifecycle_and_notes(self):
        self.app.post('/api/scenario/inject', json={'scenario_name': 'sensor_drift'})
        res = self.app.get('/api/alerts')
        data = json.loads(res.data)
        self.assertGreater(data['count'], 0)
        alert_id = data['alerts'][0]['id']

        ack_res = self.app.post('/api/alerts/acknowledge', json={'alert_id': alert_id})
        self.assertEqual(ack_res.status_code, 200)

        inv_res = self.app.post('/api/alerts/investigate', json={'alert_id': alert_id})
        self.assertEqual(inv_res.status_code, 200)

        res_res = self.app.post('/api/alerts/resolve', json={'alert_id': alert_id, 'resolution_notes': 'Field recalibration completed by technician.'})
        self.assertEqual(res_res.status_code, 200)

    def test_08_reset_scenario(self):
        res = self.app.post('/api/scenario/reset')
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data['active_scenario'], 'normal')

    def test_09_sample_datasets_list(self):
        res = self.app.get('/api/sample-datasets')
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data['status'], 'success')
        self.assertEqual(len(data['datasets']), 6)

    def test_10_download_sample_dataset(self):
        res = self.app.get('/api/sample-datasets/download/dataset_1_baseline_normal.csv')
        self.assertEqual(res.status_code, 200)
        self.assertIn(b'AWS-001', res.data)

    def test_11_load_sample_dataset_mountain(self):
        res = self.app.post('/api/load-sample-dataset', json={'filename': 'dataset_3_mountain_network.csv'})
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['stations_count'], 6)
        self.assertIn('AWS-101', data['stations'])

    def test_12_load_sample_dataset_baseline(self):
        res = self.app.post('/api/load-sample-dataset', json={'filename': 'dataset_1_baseline_normal.csv'})
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['stations_count'], 8)
        self.assertIn('AWS-001', data['stations'])

if __name__ == '__main__':
    print("=== RUNNING SKYGUARD AI ENHANCED VERIFICATION SUITE ===")
    unittest.main()
