import numpy as np

class SensorKalmanFilter:
    """
    Lightweight 1D Kalman Filter & Exponential Smoothing for Sensor Noise Filtering.
    """
    def __init__(self, process_variance=1e-4, measurement_variance=1e-2):
        self.q = process_variance
        self.r = measurement_variance
        self.post_estimate = 31.0
        self.post_error = 1.0

    def filter_signal(self, measurement):
        """Applies 1D Kalman filter step to incoming sensor measurement."""
        try:
            val = float(measurement)
        except (ValueError, TypeError):
            return measurement

        # Prediction step
        priori_estimate = self.post_estimate
        priori_error = self.post_error + self.q

        # Update step
        kalman_gain = priori_error / (priori_error + self.r)
        self.post_estimate = priori_estimate + kalman_gain * (val - priori_estimate)
        self.post_error = (1.0 - kalman_gain) * priori_error

        return round(self.post_estimate, 2)
