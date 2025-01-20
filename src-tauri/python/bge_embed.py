import torch
from sentence_transformers import SentenceTransformer

class BGEEmbedder:
    def __init__(self, model_name="BAAI/bge-m3"):
        try:
            print(f"Initializing BGE model: {model_name}")
            self.model = SentenceTransformer(model_name)
            print("Model initialized successfully")
        except Exception as e:
            print(f"Error initializing model: {str(e)}")
            raise

    def embed_text(self, text: str) -> list[float]:
        """Generate embeddings for a single text string."""
        try:
            # Convert to string if not already
            if not isinstance(text, str):
                text = str(text)
            
            # Generate embedding
            embedding = self.model.encode([text])[0]
            
            # Convert to Python list of floats
            return embedding.tolist()
        except Exception as e:
            print(f"Error generating embedding: {str(e)}")
            raise

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a batch of texts."""
        try:
            # Convert all inputs to strings
            texts = [str(t) for t in texts]
            
            # Generate embeddings
            embeddings = self.model.encode(texts)
            
            # Convert to Python list of lists
            return [emb.tolist() for emb in embeddings]
        except Exception as e:
            print(f"Error generating batch embeddings: {str(e)}")
            raise

# Create a global instance
_model = None

def get_model():
    global _model
    if _model is None:
        _model = BGEEmbedder()
    return _model

def embed_text(text: str) -> list[float]:
    """Convenience function for single text embedding."""
    return get_model().embed_text(text)

def embed_text_batch(texts: list[str]) -> list[list[float]]:
    """Convenience function for batch text embedding."""
    return get_model().embed_batch(texts)