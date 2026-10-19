import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final themeModeProvider = StateProvider<ThemeMode>((ref) => ThemeMode.system);

class AppTheme {
  static ThemeData get light => _base(Brightness.light, const Color(0xFF0C66E4), const Color(0xFFF7F8F9));
  static ThemeData get dark => _base(Brightness.dark, const Color(0xFF579DFF), const Color(0xFF161A1D));

  static ThemeData _base(Brightness brightness, Color primary, Color scaffold) {
    final scheme = ColorScheme.fromSeed(seedColor: primary, brightness: brightness);
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme.copyWith(primary: primary),
      scaffoldBackgroundColor: scaffold,
      fontFamily: 'Inter',
      appBarTheme: AppBarTheme(
        backgroundColor: brightness == Brightness.dark ? const Color(0xFF1D2125) : Colors.white,
        foregroundColor: scheme.onSurface,
        elevation: 0,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: scheme.outlineVariant),
        ),
      ),
    );
  }
}
