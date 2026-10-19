import 'package:flutter/material.dart';

class BoardScreen extends StatelessWidget {
  const BoardScreen({super.key});

  static const columns = ['Backlog', 'To Do', 'In Progress', 'Review', 'Testing', 'Done'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Board')),
      body: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.all(12),
        itemCount: columns.length,
        itemBuilder: (context, i) {
          return Container(
            width: 260,
            margin: const EdgeInsets.only(right: 12),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                Align(alignment: Alignment.centerLeft, child: Text(columns[i], style: const TextStyle(fontWeight: FontWeight.w700))),
                const SizedBox(height: 8),
                Expanded(
                  child: ListView(
                    children: [
                      for (var n = 0; n < 3; n++)
                        Card(
                          child: ListTile(
                            dense: true,
                            title: Text('NEX-${20 + i * 3 + n}'),
                            subtitle: const Text('Implement JWT rotation'),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
