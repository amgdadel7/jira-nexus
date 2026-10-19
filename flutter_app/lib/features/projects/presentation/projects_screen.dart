import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ProjectsScreen extends StatelessWidget {
  const ProjectsScreen({super.key});

  static const projects = [
    ('NEX', 'Nexus Core', 72),
    ('MOB', 'Mobile App', 54),
    ('WEB', 'Customer Portal', 61),
    ('PAY', 'Payments', 48),
    ('ANL', 'Analytics', 80),
    ('INF', 'Infrastructure', 66),
    ('DS', 'Design System', 91),
    ('AI', 'AI Insights', 37),
    ('SEC', 'Security', 58),
    ('MKT', 'Marketplace', 22),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Projects')),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: projects.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final p = projects[i];
          return Card(
            child: ListTile(
              leading: CircleAvatar(child: Text(p.$1.substring(0, 1))),
              title: Text(p.$2),
              subtitle: LinearProgressIndicator(value: p.$3 / 100),
              trailing: Text('${p.$3}%'),
              onTap: () => context.go('/boards'),
            ),
          );
        },
      ),
    );
  }
}
