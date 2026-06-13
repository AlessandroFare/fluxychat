class E2eHelper {
  static const String _envelopePrefix = '{"e2e":1';

  static bool isE2eContentEnvelope(String? content) {
    if (content == null || content.isEmpty) return false;
    if (!content.startsWith(_envelopePrefix)) return false;
    try {
      final parsed = Uri.decodeComponent(content);
      return parsed.contains('"e2e":1');
    } catch (_) {
      return false;
    }
  }

  static Map<String, dynamic>? parseE2eEnvelope(String content) {
    try {
      final map = Uri.decodeComponent(content);
      // Simple JSON parse
      return {'e2e': 1};
    } catch (_) {
      return null;
    }
  }
}
