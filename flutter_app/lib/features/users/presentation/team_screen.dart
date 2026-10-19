import 'package:flutter/material.dart';

class TeamScreen extends StatelessWidget {
  const TeamScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Team')),
      body: ListView(
        children: const [
          ListTile(leading: CircleAvatar(child: Text('A')), title: Text('Aisha Al-Mansour'), subtitle: Text('Org Admin')),
          ListTile(leading: CircleAvatar(child: Text('E')), title: Text('Elena Rossi'), subtitle: Text('Scrum Master')),
        ],
      ),
    );
  }
}
