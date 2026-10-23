# SkyGuard AI: Physics-Informed Spatio-Temporal Intelligence & Explainable AI for AWS Weather Sensor Networks

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Backend-Flask%20API-lightgrey.svg?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TailwindCSS-61DAFB.svg?logo=react&logoColor=white)](https://react.dev/)
[![ML & XAI](https://img.shields.io/badge/AI%2FML-Isolation%20Forest%20%7C%20SHAP%20%7C%20LIME-orange.svg)](https://scikit-learn.org/)
[![Physics](https://img.shields.io/badge/Physics-Magnus--Tetens%20%7C%20Hydrostatic-green.svg)](https://en.wikipedia.org/wiki/Tetens_equation)
[![Tests](https://img.shields.io/badge/Tests-12%20Passing-brightgreen.svg)](verify_atmosguard.py)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**SkyGuard AI** is an industrial-grade, physics-guided intelligence platform designed for **Automatic Weather Station (AWS) Sensor Reliability, Real-Time Anomaly Detection, Root-Cause Classification, and Spatial Data Reconstruction**.

Traditional anomaly detectors frequently fail in meteorological settings by triggering false alarms during genuine weather extremes (such as squalls, thunderstorms, and cyclonic drops) and missing subtle hardware degradation (such as calibration drift, frozen sensors, or psychrometric violations). **SkyGuard AI solves this by coupling Machine Learning with Thermodynamic Physics laws, Graph-based Spatial Consensus, and Explainable AI (SHAP & LIME).**

---

## 🌟 Key Technical Innovations

1. **6-Stage End-to-End Processing Pipeline**:
   - **Stage 1 (Sensor Ingestion)**: Ingests streaming AWS telemetry (Temperature, Humidity, Barometric Pressure, Dew Point, Rainfall, Wind, Solar Radiation, Battery Voltage, RSSI).
   - **Stage 2 (Edge Preprocessing)**: Robust automated cleaning, bounds rejection, and missing value interpolation via NumPy & Pandas.
   - **Stage 3 (Feature Engineering)**: Extracts diurnal cycles, psychrometric convergence offsets, and spatio-temporal distance weightings.
   - **Stage 4 (AI/ML Anomaly Detection)**: Isolation Forest ensemble coupled with neighbor consensus matrices to flag hardware outliers.
   - **Stage 5 (Explainable AI - XAI)**: Feature attribution with **SHAP & LIME** to explain *why* an observation was flagged.
   - **Stage 6 (Physics Imputation & Monitoring)**: Physics-guided spatial reconstruction ($-0.0065^\circ\text{C}/\text{m}$ lapse rate + IDW) surfaced via an interactive dashboard.

2. **Physics-Informed Neural / Thermodynamic Validation**:
   - **Magnus-Tetens Psychrometric Check**: Validates thermodynamic consistency between temperature, relative humidity, and dew point:
     $$e_s(T) = 6.1078 \times \exp\left(\frac{17.27 \times T}{T + 237.3}\right)$$
   - **Hydrostatic Barometric Pressure Equation**: Compares station barometric pressure against altitude elevation profiles:
     $$P(h) = P_0 \left(1 - \frac{L \cdot h}{T_0}\right)^{\frac{g \cdot M}{R_0 \cdot L}}$$

3. **Spatio-Temporal Graph Consensus (ST-GNN)**:
   - Evaluates multi-station spatial agreement using Haversine distance-weighted matrices ($450\,\text{km}$ radius).
   - Disagreements between isolated stations and surrounding healthy neighbors immediately separate **hardware sensor failures** from **regional weather fronts**.

4. **Physics-Guided Spatial Imputation (IDW + DEM)**:
   - When a sensor is compromised, replacement values are reconstructed in real-time combining Inverse Distance Weighting with Digital Elevation Model (DEM) adiabatic lapse rates.

---

## 🏗 System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    1. AWS SENSOR LAYER                      │
│        8 Automatic Weather Stations (Andhra Pradesh Grid)   │
│   Temp | Humidity | Pressure | Dew Point | Rain | Wind | Batt│
└──────────────────────────────┬──────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│             2. EDGE FILTERING & NOISE CLEANING              │
│      Kalman Filtering | Outlier Clipping | 75% Compression  │
└──────────────────────────────┬──────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│        3. SPATIO-TEMPORAL CONSENSUS (GRAPH NEIGHBORS)       │
│      Haversine Weighted Adjacency | Spatial Voting Engine   │
└──────────────────────────────┬──────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│           4. THERMODYNAMIC PHYSICS CONSISTENCY ENGINE       │
│   Magnus-Tetens Dewpoint Verification | Hydrostatic Profile │
└──────────────────────────────┬──────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│             5. AI/ML ANOMALY DETECTION & XAI                │
│    Isolation Forest | Root-Cause Categorization | SHAP/LIME │
└──────────────────────────────┬──────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│        6. SPATIAL DATA RECONSTRUCTION & CONTROL DASHBOARD   │
│   IDW Imputation | Interactive Leaflet GIS Map | Realtime UI│
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 Curated Benchmarking Datasets

The repository includes **6 realistic meteorological benchmark datasets** located in `sample_datasets/`, executable with 1-click in the web UI:

| Dataset | Scenario | Description |
|---|---|---|
| `dataset_1_baseline_normal.csv` | **Baseline Healthy Network** | Standard 24h diurnal cycle, 8 healthy stations, 100% physics consistency. |
| `dataset_2_cyclonic_storm.csv` | **Bay of Bengal Cyclone** | -22 hPa pressure drop, >60 km/h gale wind, heavy rain. Confirms genuine storm vs sensor fault. |
| `dataset_3_mountain_network.csv` | **Himalayan Mountain Grid** | Dynamic discovery of 6 high-altitude stations (`AWS-101` to `AWS-106`, 1457m - 3500m elevation). |
| `dataset_4_sensor_faults.csv` | **Multi-Sensor Faults** | Stuck temp (`AWS-003`), humidity drift (`AWS-005`), psychrometric violation (`AWS-008`), edge battery drop. |
| `dataset_5_heatwave_drought.csv` | **Severe Heatwave** | Extreme thermal surge (up to 46.5°C) and RH collapse (12%). Tests saturation vapor pressure. |
| `dataset_6_comm_outage_noise.csv` | **Telemetry Dropout & Noise** | Cellular packet loss (-105 dBm RSSI) and erratic signal spikes. Tests edge cleaning. |

---

## 📁 Repository Structure

```text
├── app.py                         # Flask REST API backend server & routing
├── requirements.txt               # Production Python dependencies
├── verify_atmosguard.py           # Automated test suite (12 unit & integration tests)
├── generate_sample_datasets.py    # Synthetic meteorological scenario generator
├── .gitignore                     # Git ignore rules for caches and local artifacts
├── services/                      # Modular backend engines
│   ├── anomaly_engine.py          # Central pipeline coordination engine
│   ├── physics_engine.py          # Magnus-Tetens & Hydrostatic thermodynamics
│   ├── spatial_consensus.py       # Spatio-temporal neighbor graph consensus
│   ├── root_cause.py              # Root-cause diagnostic classifier & XAI
│   ├── imputation.py              # Spatial IDW + lapse rate data reconstruction
│   └── edge_simulator.py          # Edge hardware telemetry & compression simulator
├── sample_datasets/               # 6 Curated demo scenario datasets (CSV)
│   ├── dataset_1_baseline_normal.csv
│   ├── dataset_2_cyclonic_storm.csv
│   ├── dataset_3_mountain_network.csv
│   ├── dataset_4_sensor_faults.csv
│   ├── dataset_5_heatwave_drought.csv
│   └── dataset_6_comm_outage_noise.csv
├── data/                          # Active telemetry data cache
├── static/                        # Frontend assets
│   ├── js/app.js                  # React 18 dashboard application
│   └── css/styles.css             # High-contrast UI styling
└── templates/
    └── index.html                 # Single-page application entry point
```

---

## 🚀 Quick Start Guide

### 1. Clone the Repository
```bash
git clone https://github.com/ddsmanasa064-bit/SkyGuard-AI.git
cd SkyGuard-AI
```

### 2. Set Up Virtual Environment & Dependencies
```bash
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Run Automated Tests
```bash
python verify_atmosguard.py
```
*Expected Output:*
```text
Ran 12 tests in 0.364s - OK
```

### 4. Launch the Web Application
```bash
python app.py
```
Open **[http://127.0.0.1:5000](http://127.0.0.1:5000)** in your web browser.

---

## 💻 Tech Stack & Skills Highlighted (For Recruiters)

- **Languages**: Python 3.10+, JavaScript (ES6+), HTML5, CSS3
- **Frameworks & Libraries**: Flask, React 18, Tailwind CSS, Leaflet.js
- **Machine Learning & AI**: Scikit-Learn (Isolation Forest), Explainable AI (SHAP, LIME)
- **Scientific Computing**: NumPy, Pandas, SciPy
- **Domain Specialization**: Physics-Informed ML, IoT Weather Station Networks, Spatio-Temporal Graph Consensus, Time-Series Anomaly Detection
- **Software Engineering**: Modular architecture, RESTful API design, automated test coverage (`unittest`), clean Git workflow

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
