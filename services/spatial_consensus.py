import math
import numpy as np

class SpatioTemporalGraphEngine:
    """
    Spatio-Temporal Graph Neural Network (ST-GNN) Spatial Consensus Engine.
    Models AWS stations as graph nodes connected by geographic proximity edges.
    Calculates cross-station spatial consensus to distinguish Genuine Weather Events
    from isolated Sensor Faults.
    """
    def __init__(self, neighbor_radius_km=450.0):
        self.neighbor_radius_km = neighbor_radius_km

    @staticmethod
    def haversine_distance_km(lat1, lon1, lat2, lon2):
        """Calculates Haversine geographic distance in kilometers."""
        R = 6371.0  # Earth radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * (math.sin(dlon / 2) ** 2))
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    def build_adjacency_graph(self, stations_list):
        """
        Builds spatial graph adjacency matrix and neighbor graph from station metadata list.
        stations_list: list of dicts with 'id', 'latitude', 'longitude', 'elevation'
        """
        nodes = {}
        edges = []

        for st in stations_list:
            nodes[st['id']] = st

        st_ids = list(nodes.keys())
        n_nodes = len(st_ids)
        adj_matrix = np.zeros((n_nodes, n_nodes))

        for i in range(n_nodes):
            id_i = st_ids[i]
            st_i = nodes[id_i]
            for j in range(i + 1, n_nodes):
                id_j = st_ids[j]
                st_j = nodes[id_j]

                dist_km = self.haversine_distance_km(st_i['latitude'], st_i['longitude'], st_j['latitude'], st_j['longitude'])
                if dist_km <= self.neighbor_radius_km:
                    weight = math.exp(-dist_km / 100.0)
                    adj_matrix[i, j] = weight
                    adj_matrix[j, i] = weight
                    edges.append({
                        'source': id_i,
                        'target': id_j,
                        'distance_km': round(dist_km, 1),
                        'weight': round(weight, 3)
                    })

        return {
            'nodes': nodes,
            'edges': edges,
            'adjacency_matrix': adj_matrix
        }

    def compute_spatial_consensus(self, target_obs, all_latest_obs, stations_list):
        """
        Computes spatial consensus score for target_obs against neighboring stations.
        Returns dict with:
        - consensus_score (0-100%)
        - weather_event_likelihood (%)
        - sensor_fault_likelihood (%)
        - agreeing_neighbors_count
        - total_neighbors_count
        - neighbor_details (list)
        """
        target_id = target_obs.get('station_id')
        target_temp = target_obs.get('temperature')
        target_pres = target_obs.get('pressure')
        target_hum = target_obs.get('humidity')

        graph = self.build_adjacency_graph(stations_list)
        target_st = graph['nodes'].get(target_id)

        if not target_st or target_temp is None or target_temp == 'NULL':
            return {
                'consensus_score': 50.0,
                'weather_event_likelihood': 10.0,
                'sensor_fault_likelihood': 90.0,
                'agreeing_neighbors_count': 0,
                'total_neighbors_count': 0,
                'neighbor_details': []
            }

        target_temp = float(target_temp)
        target_pres = float(target_pres) if target_pres is not None and target_pres != 'NULL' else 1012.0
        target_hum = float(target_hum) if target_hum is not None and target_hum != 'NULL' else 65.0

        neighbor_details = []
        agreements = 0

        for st_id, st in graph['nodes'].items():
            if st_id == target_id:
                continue

            dist_km = self.haversine_distance_km(target_st['latitude'], target_st['longitude'], st['latitude'], st['longitude'])
            if dist_km <= self.neighbor_radius_km:
                n_obs = all_latest_obs.get(st_id, {})
                n_temp = n_obs.get('temperature')
                n_pres = n_obs.get('pressure')

                if n_temp is not None and n_temp != 'NULL':
                    try:
                        n_temp = float(n_temp)
                        n_pres = float(n_pres) if n_pres is not None and n_pres != 'NULL' else 1012.0

                        # Adjust temperature for elevation difference (lapse rate: -0.0065 C/m)
                        elev_diff = target_st['elevation'] - st['elevation']
                        expected_n_temp = target_temp - (0.0065 * elev_diff)

                        temp_diff = abs(n_temp - expected_n_temp)
                        pres_diff = abs(n_pres - target_pres)

                        # Neighbor agrees if temperature is within 3.5C and pressure trend aligns
                        is_agree = temp_diff <= 3.5 and pres_diff <= 5.0
                        if is_agree:
                            agreements += 1

                        neighbor_details.append({
                            'station_id': st_id,
                            'distance_km': round(dist_km, 1),
                            'observed_temp': n_temp,
                            'expected_temp': round(expected_n_temp, 1),
                            'temp_diff': round(temp_diff, 1),
                            'agrees': is_agree
                        })
                    except (ValueError, TypeError):
                        pass

        total_neighbors = len(neighbor_details)
        if total_neighbors > 0:
            consensus_pct = round((agreements / total_neighbors) * 100.0, 1)
        else:
            consensus_pct = 90.0  # Default baseline if isolated

        # Weather event vs sensor fault likelihood
        weather_event_likelihood = consensus_pct
        sensor_fault_likelihood = round(100.0 - consensus_pct, 1)

        return {
            'consensus_score': consensus_pct,
            'weather_event_likelihood': weather_event_likelihood,
            'sensor_fault_likelihood': sensor_fault_likelihood,
            'agreeing_neighbors_count': agreements,
            'total_neighbors_count': total_neighbors,
            'neighbor_details': neighbor_details
        }
