import statsd
import time
from typing import Optional

class AnalysisMonitor:
    def __init__(self, host='localhost', port=8125):
        self.client = statsd.StatsClient(host, port)
        self.current_timer = None
        
    def start_timer(self):
        """Start timing an analysis operation"""
        self.current_timer = time.perf_counter()
        
    def track_analysis(self, chat_id: str, success: bool):
        """Track analysis completion and performance"""
        if not self.current_timer:
            return
            
        duration = time.perf_counter() - self.current_timer
        self.client.timing('analysis.duration', duration * 1000)
        self.client.incr('analysis.count')
        
        if not success:
            self.client.incr('analysis.errors')
            
        if duration > 10.0:  # 10 seconds threshold
            self.client.incr('analysis.slow')
            
    def send_alert_to_admin(self, message: str):
        """Send alert to admin (stub implementation)"""
        self.client.incr('analysis.alerts')
        # In production, this would integrate with PagerDuty/Email/etc.
        print(f"ADMIN ALERT: {message}")

# Global instance for easy access
monitor = AnalysisMonitor()
