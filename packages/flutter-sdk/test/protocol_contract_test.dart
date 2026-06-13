import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:fluxychat_sdk/src/protocol_events.dart';

void main() {
  group('Flutter SDK protocol parity', () {
    late Map<String, dynamic> manifest;

    setUp(() {
      final manifestFile = File(
        '${Directory.current.path}/../protocol/protocol-events.json',
      );
      manifest = jsonDecode(manifestFile.readAsStringSync()) as Map<String, dynamic>;
    });

    test('matches protocol-events.json outbound registry', () {
      final outbound = (manifest['outbound'] as List<dynamic>).cast<String>();
      expect(fluxyOutboundEventTypes.toSet(), outbound.toSet());
      expect(outbound, contains('message'));
      expect(outbound, contains('edit'));
    });

    test('matches protocol-events.json inbound registry', () {
      final inbound = (manifest['inbound'] as List<dynamic>).cast<String>();
      expect(fluxyInboundEventTypes.toSet(), inbound.toSet());
    });

    test('recognizes inbound message events', () {
      expect(isFluxyInboundEvent({'type': 'message', 'id': 1}), isTrue);
      expect(isFluxyInboundEvent({'type': 'not_a_real_event'}), isFalse);
    });

    test('recognizes outbound client events', () {
      expect(isFluxyOutboundEvent({'type': 'ping'}), isTrue);
      expect(isFluxyOutboundEvent({'type': 'subscribe'}), isFalse);
    });
  });
}
