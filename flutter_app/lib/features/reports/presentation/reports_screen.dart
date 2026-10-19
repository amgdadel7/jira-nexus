import 'package:flutter/material.dart';

class ReportsScreen extends StatelessWidget {
  const ReportsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reports')),
      body: const Padding(
        padding: EdgeInsets.all(16),
        child: Text('Burndown, velocity, cycle time, and team workload are available on the web dashboard and via GET /api/reports.'),
      ),
    );
  }
}
