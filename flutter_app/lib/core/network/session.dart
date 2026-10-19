import 'package:flutter_riverpod/flutter_riverpod.dart';

class Session {
  const Session({this.token, this.userName});
  final String? token;
  final String? userName;
  bool get isAuthenticated => token != null;
}

class SessionNotifier extends StateNotifier<Session> {
  SessionNotifier() : super(const Session());

  void login(String token, String name) => state = Session(token: token, userName: name);
  void logout() => state = const Session();
}

final sessionProvider = StateNotifierProvider<SessionNotifier, Session>((ref) => SessionNotifier());
