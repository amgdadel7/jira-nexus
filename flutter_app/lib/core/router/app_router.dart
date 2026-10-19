import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/dashboard/presentation/dashboard_screen.dart';
import '../../features/projects/presentation/projects_screen.dart';
import '../../features/boards/presentation/board_screen.dart';
import '../../features/issues/presentation/issues_screen.dart';
import '../../features/sprints/presentation/sprints_screen.dart';
import '../../features/reports/presentation/reports_screen.dart';
import '../../features/users/presentation/team_screen.dart';
import '../../features/settings/presentation/settings_screen.dart';
import '../../shared/widgets/app_scaffold.dart';
import '../network/session.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final session = ref.watch(sessionProvider);
  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final loggingIn = state.matchedLocation == '/login';
      if (!session.isAuthenticated && !loggingIn) return '/login';
      if (session.isAuthenticated && loggingIn) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (c, s) => const LoginScreen()),
      ShellRoute(
        builder: (c, s, child) => AppScaffold(child: child),
        routes: [
          GoRoute(path: '/', builder: (c, s) => const DashboardScreen()),
          GoRoute(path: '/projects', builder: (c, s) => const ProjectsScreen()),
          GoRoute(path: '/boards', builder: (c, s) => const BoardScreen()),
          GoRoute(path: '/issues', builder: (c, s) => const IssuesScreen()),
          GoRoute(path: '/sprints', builder: (c, s) => const SprintsScreen()),
          GoRoute(path: '/reports', builder: (c, s) => const ReportsScreen()),
          GoRoute(path: '/team', builder: (c, s) => const TeamScreen()),
          GoRoute(path: '/settings', builder: (c, s) => const SettingsScreen()),
        ],
      ),
    ],
  );
});
