import 'package:flutter/material.dart';

class IssuesScreen extends StatelessWidget {
  const IssuesScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Issues')),
      floatingActionButton: FloatingActionButton(onPressed: () {}, child: const Icon(Icons.add)),
      body: ListView.builder(
        itemCount: 20,
        itemBuilder: (c, i) => ListTile(
          leading: Icon(i.isEven ? Icons.bookmark : Icons.bug_report, color: i.isEven ? Colors.green : Colors.red),
          title: Text('NEX-${12 + i}  Tenant-aware search'),
          subtitle: Text(i.isEven ? 'In Progress' : 'To Do'),
        ),
      ),
    );
  }
}
