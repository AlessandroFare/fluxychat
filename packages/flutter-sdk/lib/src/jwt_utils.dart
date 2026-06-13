import 'dart:convert';

class DecodedFluxyJwt {
  final int? exp;
  final String? sub;
  final String? tid;
  DecodedFluxyJwt({this.exp, this.sub, this.tid});
}

DecodedFluxyJwt decodeFluxyJwtPayload(String token) {
  try {
    final parts = token.split('.');
    if (parts.length < 2) return DecodedFluxyJwt();
    var normalized = parts[1].replaceAll('-', '+').replaceAll('_', '/');
    while (normalized.length % 4 != 0) normalized += '=';
    final json = utf8.decode(base64Decode(normalized));
    final map = jsonDecode(json) as Map<String, dynamic>;
    return DecodedFluxyJwt(
      exp: map['exp'] as int?,
      sub: map['sub'] as String?,
      tid: map['tid'] as String?,
    );
  } catch (_) {
    return DecodedFluxyJwt();
  }
}

int jwtRefreshDelayMs(int expSeconds, {int bufferMs = 300000}) {
  final ms = expSeconds * 1000 - DateTime.now().millisecondsSinceEpoch - bufferMs;
  return ms > 0 ? ms : 0;
}
