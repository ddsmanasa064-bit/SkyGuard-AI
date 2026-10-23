import math
import numpy as np

class PhysicsConsistencyEngine:
    """
    Physics-Informed Validation Engine for AWS Sensor Telemetry.
    Implements:
    1. Psychrometric Check (Magnus-Tetens thermodynamic dew point approximation)
    2. Hydrostatic / Barometric Elevation Pressure Validation
    3. Combined Physics Score (0-100%)
    """
    def __init__(self):
        pass

    @staticmethod
    def calculate_magnus_dew_point(temp_c, rh_percent):
        """Calculates expected physical dew point using Magnus-Tetens formula."""
        if temp_c is None or rh_percent is None or rh_percent <= 0:
            return None
        
        try:
            a = 17.27
            b = 237.7
            rh_clamped = min(max(float(rh_percent), 1.0), 100.0)
            alpha = ((a * float(temp_c)) / (b + float(temp_c))) + math.log(rh_clamped / 100.0)
            if a - alpha == 0:
                return float(temp_c)
            dew_point = (b * alpha) / (a - alpha)
            return round(dew_point, 2)
        except (ValueError, OverflowError, ZeroDivisionError):
            return None

    @staticmethod
    def calculate_expected_pressure(elevation_m, sea_level_pressure=1013.25):
        """Calculates expected barometric pressure for station elevation."""
        try:
            h = float(elevation_m)
            p_expected = float(sea_level_pressure) * math.pow(1.0 - 2.25577e-5 * h, 5.25588)
            return round(p_expected, 2)
        except (ValueError, OverflowError):
            return 1013.25

    def validate_observation(self, obs, history_df=None):
        """
        Validates single observation against thermodynamic & barometric laws.
        Returns dict with:
        - psychrometric_score (0-100)
        - barometric_score (0-100)
        - temporal_score (0-100)
        - overall_physics_score (0-100)
        - dew_point_error (float)
        - pressure_error (float)
        - physics_violations (list of str)
        """
        temp = obs.get('temperature')
        rh = obs.get('humidity')
        pres = obs.get('pressure')
        dew_obs = obs.get('dew_point')
        elev = obs.get('elevation', 25.0)

        violations = []

        # Handle null/error readings
        if temp is None or rh is None or pres is None or temp == 'NULL' or pres == 'NULL' or rh == 'NULL':
            return {
                'psychrometric_score': 0.0,
                'barometric_score': 0.0,
                'temporal_score': 0.0,
                'overall_physics_score': 0.0,
                'dew_point_error': 99.0,
                'pressure_error': 99.0,
                'physics_violations': ['Missing or unreadable sensor telemetry']
            }

        try:
            temp = float(temp)
            rh = float(rh)
            pres = float(pres)
            elev = float(elev)
            dew_obs = float(dew_obs) if dew_obs is not None and dew_obs != 'NULL' else None
        except (ValueError, TypeError):
            return {
                'psychrometric_score': 0.0,
                'barometric_score': 0.0,
                'temporal_score': 0.0,
                'overall_physics_score': 0.0,
                'dew_point_error': 99.0,
                'pressure_error': 99.0,
                'physics_violations': ['Malformed telemetry numerical values']
            }

        # 1. Psychrometric Magnus-Tetens Check
        dew_calc = self.calculate_magnus_dew_point(temp, rh)
        dew_error = 0.0
        psych_score = 100.0

        if dew_obs is not None and dew_calc is not None:
            dew_error = abs(dew_obs - dew_calc)
            psych_score = max(0.0, round(100.0 - (dew_error * 18.0), 1))
            if dew_error > 2.5:
                violations.append(f"Psychrometric violation: Observed Dew Point ({dew_obs}°C) differs from Magnus-Tetens physical expectation ({dew_calc}°C) by {dew_error:.1f}°C")

        # Check physical boundary compatibility (e.g. RH > 90% when T > 45°C is non-physical)
        if temp > 45.0 and rh > 85.0:
            psych_score = max(0.0, psych_score - 40.0)
            violations.append(f"Non-physical thermodynamic state: Temp {temp}°C combined with RH {rh}% violates atmospheric boundary conditions")

        # 2. Hydrostatic / Barometric Elevation Check
        p_expected = self.calculate_expected_pressure(elev, sea_level_pressure=1012.5)
        p_error = abs(pres - p_expected)
        baro_score = max(0.0, round(100.0 - (p_error * 4.0), 1))

        if p_error > 8.0:
            violations.append(f"Hydrostatic barometric violation: Observed Pressure ({pres} hPa) deviates from elevation hydrostatic model ({p_expected} hPa) by {p_error:.1f} hPa")

        # 3. Temporal Rate-of-Change Physics Check
        temporal_score = 100.0
        if history_df is not None and len(history_df) > 0:
            last_obs = history_df.iloc[-1]
            try:
                last_t = float(last_obs['temperature'])
                t_step_roc = abs(temp - last_t)
                if t_step_roc > 8.0:
                    temporal_score = max(0.0, round(100.0 - (t_step_roc * 8.0), 1))
                    violations.append(f"Thermal inertia violation: Temperature change rate ({t_step_roc:+.1f}°C/step) exceeds atmospheric physical limits")
            except (ValueError, TypeError, KeyError):
                pass

        # 4. Overall Weighted Physics Score
        overall_score = round(0.45 * psych_score + 0.35 * baro_score + 0.20 * temporal_score, 1)

        return {
            'psychrometric_score': psych_score,
            'barometric_score': baro_score,
            'temporal_score': temporal_score,
            'overall_physics_score': overall_score,
            'dew_point_error': round(dew_error, 2),
            'calculated_dew_point': dew_calc,
            'pressure_error': round(p_error, 2),
            'expected_pressure': p_expected,
            'physics_violations': violations
        }
