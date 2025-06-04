import os
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from typing import List, Tuple, Optional
import logging

logger = logging.getLogger(__name__)

# Define the path where models will be stored
MODEL_CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "models", "rerank_models")
os.makedirs(MODEL_CACHE_DIR, exist_ok=True)

class PrincipalRerankService:
    def __init__(self, model_name: str = "BAAI/bge-reranker-v2-m3"):
        self.model_name = model_name
        self.tokenizer = None
        self.model = None
        self._load_model()

    def _load_model(self):
        """Loads the reranker model and tokenizer, ensuring CPU usage."""
        try:
            logger.info(f"Loading reranker model '{self.model_name}' from Hugging Face cache directory: {MODEL_CACHE_DIR}")
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name, cache_dir=MODEL_CACHE_DIR)
            self.model = AutoModelForSequenceClassification.from_pretrained(self.model_name, cache_dir=MODEL_CACHE_DIR)
            
            # Ensure the model runs on CPU
            self.device = torch.device("cpu")
            self.model.to(self.device)
            self.model.eval() # Set model to evaluation mode
            logger.info(f"Reranker model '{self.model_name}' loaded successfully on CPU.")
        except Exception as e:
            logger.error(f"Failed to load reranker model '{self.model_name}': {e}")
            self.tokenizer = None
            self.model = None

    def rerank(self, query: str, documents: List[str], top_n: Optional[int] = None) -> List[Tuple[str, float]]:
        """
        Reranks a list of documents based on their relevance to a given query.

        Args:
            query: The query text.
            documents: A list of document texts to be reranked.

        Returns:
            A list of tuples (document_text, relevance_score), sorted by relevance score in descending order.
        """
        if not self.model or not self.tokenizer:
            logger.error("Reranker model not loaded. Cannot perform reranking.")
            return [(doc, 0.0) for doc in documents] # Return original order with zero scores

        if not documents:
            return []

        # Prepare inputs for the reranker model
        features = self.tokenizer([query] * len(documents), documents, padding=True, truncation=True, return_tensors='pt').to(self.device)

        with torch.no_grad():
            scores = self.model(**features).logits.squeeze().tolist()

        if not isinstance(scores, list): # Handle case where there's only one document
            scores = [scores]

        # Pair documents with their scores and sort
        reranked_results = sorted(zip(documents, scores), key=lambda x: x[1], reverse=True)
        
        if top_n is not None and top_n > 0:
            reranked_results = reranked_results[:top_n]

        logger.info(f"Reranked {len(documents)} documents for query: '{query[:50]}...' (Returning top {len(reranked_results)})")
        return reranked_results

class AuxiliaryRerankService:
    def __init__(self, model_name: str = "intfloat/multilingual-e5-small"): # Corrected model name
        self.model_name = model_name
        self.tokenizer = None
        self.model = None
        self._load_model()

    def _load_model(self):
        """Loads the reranker model and tokenizer, ensuring CPU usage."""
        try:
            logger.info(f"Loading reranker model '{self.model_name}' from Hugging Face cache directory: {MODEL_CACHE_DIR}")
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name, cache_dir=MODEL_CACHE_DIR)
            self.model = AutoModelForSequenceClassification.from_pretrained(self.model_name, cache_dir=MODEL_CACHE_DIR)
            
            # Ensure the model runs on CPU
            self.device = torch.device("cpu")
            self.model.to(self.device)
            self.model.eval() # Set model to evaluation mode
            logger.info(f"Reranker model '{self.model_name}' loaded successfully on CPU.")
        except Exception as e:
            logger.error(f"Failed to load reranker model '{self.model_name}': {e}")
            self.tokenizer = None
            self.model = None

    def rerank(self, query: str, documents: List[str], top_n: Optional[int] = None) -> List[Tuple[str, float]]:
        """
        Reranks a list of documents based on their relevance to a given query.

        Args:
            query: The query text.
            documents: A list of document texts to be reranked.

        Returns:
            A list of tuples (document_text, relevance_score), sorted by relevance score in descending order.
        """
        if not self.model or not self.tokenizer:
            logger.error("Reranker model not loaded. Cannot perform reranking.")
            return [(doc, 0.0) for doc in documents] # Return original order with zero scores

        if not documents:
            return []

        # Prepare inputs for the reranker model
        features = self.tokenizer([query] * len(documents), documents, padding=True, truncation=True, return_tensors='pt').to(self.device)

        with torch.no_grad():
            scores = self.model(**features).logits.squeeze().tolist()

        if not isinstance(scores, list): # Handle case where there's only one document
            scores = [scores]

        # Pair documents with their scores and sort
        reranked_results = sorted(zip(documents, scores), key=lambda x: x[1], reverse=True)
        
        if top_n is not None and top_n > 0:
            reranked_results = reranked_results[:top_n]

        logger.info(f"Reranked {len(documents)} documents for query: '{query[:50]}...' (Returning top {len(reranked_results)})")
        return reranked_results

# Global instances of the RerankServices
_principal_rerank_service_instance: PrincipalRerankService = None
_auxiliary_rerank_service_instance: AuxiliaryRerankService = None

def get_principal_rerank_service() -> PrincipalRerankService:
    """Returns the global PrincipalRerankService instance, initializing it if necessary."""
    global _principal_rerank_service_instance
    if _principal_rerank_service_instance is None:
        _principal_rerank_service_instance = PrincipalRerankService()
    return _principal_rerank_service_instance

def get_auxiliary_rerank_service() -> AuxiliaryRerankService:
    """Returns the global AuxiliaryRerankService instance, initializing it if necessary."""
    global _auxiliary_rerank_service_instance
    if _auxiliary_rerank_service_instance is None:
        _auxiliary_rerank_service_instance = AuxiliaryRerankService()
    return _auxiliary_rerank_service_instance