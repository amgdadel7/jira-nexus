import 'package:flutter/material.dart';

class SprintsScreen extends StatelessWidget {
  const SprintsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sprints')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          Card(
            child: ListTile(
              title: Text('NEX Sprint 14'),
              subtitle: Text('Ship tenant-aware search · 21/42 pts'),
            ),
          ),
          Card(
            child: ListTile(
              title: Text('MOB Sprint 9'),
              subtitle: Text('Offline board cache · 12/34 pts'),
            ),
          ),
        ],
      ),
    );
  }
}
