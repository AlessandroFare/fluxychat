class MessageTemplate {
  final String id;
  final String name;
  final String body;
  final List<String> vars;
  final String? createdByUserId;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const MessageTemplate({required this.id, required this.name, required this.body, this.vars = const [], this.createdByUserId, this.createdAt, this.updatedAt});

  factory MessageTemplate.fromJson(Map<String, dynamic> json) {
    return MessageTemplate(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      body: json['body'] ?? '',
      vars: json['vars'] != null ? List<String>.from(json['vars']) : [],
      createdByUserId: json['createdByUserId'],
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt']) : null,
      updatedAt: json['updatedAt'] != null ? DateTime.tryParse(json['updatedAt']) : null,
    );
  }
}

String renderMessageTemplate(MessageTemplate template, Map<String, dynamic> vars) {
  var out = template.body;
  for (final entry in vars.entries) {
    out = out.replaceAll(RegExp('\\{\\{\\s*${entry.key}\\s*\\}\\}'), entry.value?.toString() ?? '');
  }
  return out;
}

List<String> extractTemplateVarNames(String body) {
  final matches = RegExp(r'\{\{\s*(\w+)\s*\}\}').allMatches(body);
  return matches.map((m) => m.group(1)!).toSet().toList();
}
