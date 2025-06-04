"""
Comprehensive monitoring service for chat flow improvements.
Tracks reliability, performance, and quality metrics.
"""

import logging
import time
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from collections import defaultdict, deque

logger = logging.getLogger(__name__)

@dataclass
class FlowStepMetrics:
    """Metrics for individual flow steps."""
    step_name: str
    success_count: int = 0
    failure_count: int = 0
    total_duration: float = 0.0
    avg_duration: float = 0.0
    max_duration: float = 0.0
    min_duration: float = float('inf')
    error_types: Dict[str, int] = None
    
    def __post_init__(self):
        if self.error_types is None:
            self.error_types = defaultdict(int)
    
    @property
    def success_rate(self) -> float:
        total = self.success_count + self.failure_count
        return (self.success_count / total * 100) if total > 0 else 0.0
    
    def record_success(self, duration: float):
        self.success_count += 1
        self._update_duration(duration)
    
    def record_failure(self, duration: float, error_type: str):
        self.failure_count += 1
        self.error_types[error_type] += 1
        self._update_duration(duration)
    
    def _update_duration(self, duration: float):
        self.total_duration += duration
        total_calls = self.success_count + self.failure_count
        self.avg_duration = self.total_duration / total_calls if total_calls > 0 else 0.0
        self.max_duration = max(self.max_duration, duration)
        self.min_duration = min(self.min_duration, duration)

class ChatFlowMonitor:
    """Comprehensive monitoring for chat flow improvements."""
    
    def __init__(self, max_recent_errors: int = 100):
        self.flow_metrics: Dict[str, FlowStepMetrics] = {}
        self.recent_errors: deque = deque(maxlen=max_recent_errors)
        self.start_time = datetime.utcnow()
        
        # Initialize metrics for all flow steps
        flow_steps = [
            "query_transformation",
            "embedding",
            "rag",
            "panel_rendering",
            "generation",
            "full_analysis",
            "dynamic_memory_processing"
        ]
        
        for step in flow_steps:
            self.flow_metrics[step] = FlowStepMetrics(step_name=step)
    
    def record_step_start(self, step_name: str) -> float:
        """Record the start of a flow step. Returns start timestamp."""
        return time.time()
    
    def record_step_success(self, step_name: str, start_time: float, metadata: Dict[str, Any] = None):
        """Record successful completion of a flow step."""
        duration = time.time() - start_time
        
        if step_name not in self.flow_metrics:
            self.flow_metrics[step_name] = FlowStepMetrics(step_name=step_name)
        
        self.flow_metrics[step_name].record_success(duration)
        
        logger.info(f"Flow step '{step_name}' completed successfully in {duration:.3f}s")
        
        # Log additional metadata if provided
        if metadata:
            logger.debug(f"Step '{step_name}' metadata: {metadata}")
    
    def record_step_failure(self, step_name: str, start_time: float, error: Exception, metadata: Dict[str, Any] = None):
        """Record failure of a flow step."""
        duration = time.time() - start_time
        error_type = type(error).__name__
        
        if step_name not in self.flow_metrics:
            self.flow_metrics[step_name] = FlowStepMetrics(step_name=step_name)
        
        self.flow_metrics[step_name].record_failure(duration, error_type)
        
        # Store recent error for analysis
        error_record = {
            'timestamp': datetime.utcnow().isoformat(),
            'step_name': step_name,
            'error_type': error_type,
            'error_message': str(error),
            'duration': duration,
            'metadata': metadata or {}
        }
        self.recent_errors.append(error_record)
        
        logger.error(f"Flow step '{step_name}' failed after {duration:.3f}s: {error}")
    
    def get_health_report(self) -> Dict[str, Any]:
        """Generate comprehensive health report."""
        uptime = datetime.utcnow() - self.start_time
        
        # Calculate overall statistics
        total_success = sum(m.success_count for m in self.flow_metrics.values())
        total_failure = sum(m.failure_count for m in self.flow_metrics.values()) 
        overall_success_rate = (total_success / (total_success + total_failure) * 100) if (total_success + total_failure) > 0 else 0.0
        
        # Find critical failures (success rate < 90%)
        critical_steps = []
        for step_name, metrics in self.flow_metrics.items():
            if metrics.success_rate < 90.0 and (metrics.success_count + metrics.failure_count) > 5:
                critical_steps.append({
                    'step': step_name,
                    'success_rate': metrics.success_rate,
                    'failure_count': metrics.failure_count
                })
        
        # Recent error analysis
        recent_error_summary = defaultdict(int)
        for error in list(self.recent_errors)[-20:]:  # Last 20 errors
            recent_error_summary[f"{error['step_name']}: {error['error_type']}"] += 1
        
        return {
            'system_health': {
                'uptime_hours': uptime.total_seconds() / 3600,
                'overall_success_rate': overall_success_rate,
                'total_successful_calls': total_success,
                'total_failed_calls': total_failure,
                'critical_steps': critical_steps
            },
            'step_metrics': {
                step_name: asdict(metrics) for step_name, metrics in self.flow_metrics.items()
            },
            'recent_errors': recent_error_summary,
            'performance_targets': {
                'query_transformation_success_rate': 95.0,
                'planning_success_rate': 98.0, 
                'full_analysis_success_rate': 95.0,
                'response_time_target_seconds': 5.0
            }
        }
    
    def check_performance_targets(self) -> Dict[str, bool]:
        """Check if performance targets are being met."""
        targets = {
            'query_transformation_success_rate': 95.0,
            'planning_success_rate': 98.0,
            'full_analysis_success_rate': 95.0
        }
        
        results = {}
        for step, target_rate in targets.items():
            step_key = step.replace('_success_rate', '')
            if step_key in self.flow_metrics:
                actual_rate = self.flow_metrics[step_key].success_rate
                results[step] = actual_rate >= target_rate
            else:
                results[step] = False
        
        return results
    
    def export_metrics(self, filepath: str):
        """Export metrics to JSON file for analysis."""
        health_report = self.get_health_report()
        
        with open(filepath, 'w') as f:
            json.dump(health_report, f, indent=2, default=str)
        
        logger.info(f"Metrics exported to {filepath}")

# Global monitor instance
chat_flow_monitor = ChatFlowMonitor()

def get_monitor() -> ChatFlowMonitor:
    """Get the global chat flow monitor instance."""
    return chat_flow_monitor
