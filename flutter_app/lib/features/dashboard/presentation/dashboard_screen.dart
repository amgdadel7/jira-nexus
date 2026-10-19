import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final kpis = [
      ('Projects', '10', Icons.folder_outlined),
      ('Sprints', '5', Icons.bolt_outlined),
      ('Open', '84', Icons.assignment_outlined),
      ('Done', '16', Icons.task_alt),
    ];
    return CustomScrollView(
      slivers: [
        const SliverAppBar(title: Text('Dashboard'), pinned: true),
        SliverPadding(
          padding: const EdgeInsets.all(16),
          sliver: SliverToBoxAdapter(
            child: Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                for (final k in kpis)
                  SizedBox(
                    width: 160,
                    child: Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(k.$3, size: 18),
                            const SizedBox(height: 8),
                            Text(k.$2, style: Theme.of(context).textTheme.headlineSmall),
                            Text(k.$1),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: SizedBox(
            height: 220,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: LineChart(
                LineChartData(
                  titlesData: const FlTitlesData(show: false),
                  borderData: FlBorderData(show: false),
                  lineBarsData: [
                    LineChartBarData(
                      isCurved: true,
                      spots: const [
                        FlSpot(0, 42),
                        FlSpot(1, 36),
                        FlSpot(2, 30),
                        FlSpot(3, 24),
                        FlSpot(4, 21),
                      ],
                      color: const Color(0xFF0C66E4),
                      dotData: const FlDotData(show: false),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
