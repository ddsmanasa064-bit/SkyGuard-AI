"""
Spatio-Temporal Graph Neural Network (ST-GNN) Model Interface.
Placeholder module for production ST-GNN model weights & PyTorch Geometric / DGL inference pipeline.
"""
class STGNNModelInterface:
    def __init__(self, model_path=None):
        self.is_loaded = False
        self.model_path = model_path

    def load_weights(self):
        """Loads trained PyTorch ST-GNN weights."""
        self.is_loaded = True
        return True

    def predict_spatio_temporal_embeddings(self, node_features, adj_matrix):
        """
        Inference interface for ST-GNN spatio-temporal graph message passing.
        node_features: tensor [N_stations, T_steps, Feature_dim]
        adj_matrix: spatial graph adjacency matrix [N_stations, N_stations]
        """
        return {"spatial_embeddings": None, "confidence": 0.95}
