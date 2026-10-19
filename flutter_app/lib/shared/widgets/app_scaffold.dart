import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class AppScaffold extends StatelessWidget {
  const AppScaffold({super.key, required this.child});
  final Widget child;

  static const _destinations = [
    (icon: Icons.space_dashboard_outlined, label: 'Home', path: '/'),
    (icon: Icons.folder_outlined, label: 'Projects', path: '/projects'),
    (icon: Icons.view_kanban_outlined, label: 'Board', path: '/boards'),
    (icon: Icons.bolt_outlined, label: 'Sprints', path: '/sprints'),
    (icon: Icons.insights_outlined, label: 'Reports', path: '/reports'),
  ];

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.path;
    final width = MediaQuery.sizeOf(context).width;
    final index = _destinations.indexWhere((d) => d.path == location).clamp(0, _destinations.length - 1);

    if (width >= 900) {
      return Scaffold(
        body: Row(
          children: [
            NavigationRail(
              selectedIndex: index,
              onDestinationSelected: (i) => context.go(_destinations[i].path),
              labelType: NavigationRailLabelType.all,
              destinations: [
                for (final d in _destinations)
                  NavigationRailDestination(icon: Icon(d.icon), label: Text(d.label)),
              ],
            ),
            const VerticalDivider(width: 1),
            Expanded(child: child),
          ],
        ),
      );
    }

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) => context.go(_destinations[i].path),
        destinations: [
          for (final d in _destinations) NavigationDestination(icon: Icon(d.icon), label: d.label),
        ],
      ),
    );
  }
}
