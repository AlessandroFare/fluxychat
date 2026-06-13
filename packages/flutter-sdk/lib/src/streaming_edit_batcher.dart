import 'dart:async';

class StreamingEditBatcher {
  final void Function(List<Map<String, dynamic>> updates) apply;
  final int intervalMs;
  final int maxWaitMs;
  final Map<int, Map<String, dynamic>> _pending = {};
  Timer? _timer;
  int _firstQueuedAt = 0;

  StreamingEditBatcher(this.apply, {this.intervalMs = 80, this.maxWaitMs = 200});

  void push(Map<String, dynamic> update) {
    final id = update['id'] as int;
    _pending[id] = update;
    _schedule();
  }

  void flush() {
    _timer?.cancel();
    _timer = null;
    if (_pending.isEmpty) { _firstQueuedAt = 0; return; }
    final batch = _pending.values.toList();
    _pending.clear();
    _firstQueuedAt = 0;
    apply(batch);
  }

  void _schedule() {
    final now = DateTime.now().millisecondsSinceEpoch;
    if (_firstQueuedAt == 0) _firstQueuedAt = now;
    final elapsed = now - _firstQueuedAt;
    final delay = elapsed >= maxWaitMs ? 0 : intervalMs;
    _timer?.cancel();
    _timer = Timer(Duration(milliseconds: delay), flush);
  }

  void dispose() { _timer?.cancel(); }
}
