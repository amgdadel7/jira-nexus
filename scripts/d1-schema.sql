-- Generated D1 Schema & Initial Data from jira.db
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS "projects";
CREATE TABLE projects (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'software',
  description TEXT NOT NULL DEFAULT '',
  lead_id TEXT,
  next_num INTEGER NOT NULL DEFAULT 1
, color TEXT NOT NULL DEFAULT '#FFAB00', category TEXT NOT NULL DEFAULT '', created_at TEXT, access TEXT NOT NULL DEFAULT 'open', permissions TEXT, board_config TEXT NOT NULL DEFAULT '{}');

INSERT INTO "projects" ("key", "name", "type", "description", "lead_id", "next_num", "color", "category", "created_at", "access", "permissions", "board_config") VALUES ('KAN', 'AHD Financial', 'software', 'Finance engineering work for AHD Financial: client portal, payments and regulatory reporting.', 'u1', 32, '#FFAB00', 'Engineering', '2026-07-20T07:36:25.919Z', 'limited', NULL, '{"wip":{"In Progress":6,"In Review":3},"swimlanes":"none"}');
INSERT INTO "projects" ("key", "name", "type", "description", "lead_id", "next_num", "color", "category", "created_at", "access", "permissions", "board_config") VALUES ('PAY', 'Payments Platform', 'software', 'Card processing, payouts and the new payment gateway.', 'u5', 11, '#0C66E4', 'Engineering', '2026-09-08T09:00:00.000Z', 'open', NULL, '{}');
INSERT INTO "projects" ("key", "name", "type", "description", "lead_id", "next_num", "color", "category", "created_at", "access", "permissions", "board_config") VALUES ('FIN', 'Finance Close', 'business', 'Month-end close, reconciliations and audit requests.', 'u3', 7, '#22A06B', 'Finance', '2026-09-18T09:00:00.000Z', 'private', NULL, '{}');

DROP TABLE IF EXISTS "users";
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color TEXT NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  active INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL DEFAULT '',
  created_at TEXT
, email_verified INTEGER NOT NULL DEFAULT 1, signup_source TEXT NOT NULL DEFAULT 'invite', prefs TEXT NOT NULL DEFAULT '{}', avatar TEXT, bot INTEGER NOT NULL DEFAULT 0);

INSERT INTO "users" ("id", "name", "email", "color", "password_hash", "role", "active", "title", "created_at", "email_verified", "signup_source", "prefs", "avatar", "bot") VALUES ('u1', 'Ahmed Al-Haddad', 'ahmed@ahdfinancial.com', '#0052CC', '669a9e71c478946c3c8c9bae67fe81ba:ee4a42e2056670b793abe5cce06214db30469ed52b2e86e1b2b2eba5f6cd1011', 'admin', 1, 'Head of Finance Engineering', '2026-08-19T07:36:25.919Z', 1, 'seed', '{}', NULL, 0);
INSERT INTO "users" ("id", "name", "email", "color", "password_hash", "role", "active", "title", "created_at", "email_verified", "signup_source", "prefs", "avatar", "bot") VALUES ('u2', 'Sara Nasser', 'sara@ahdfinancial.com', '#6554C0', '669a9e71c478946c3c8c9bae67fe81ba:ee4a42e2056670b793abe5cce06214db30469ed52b2e86e1b2b2eba5f6cd1011', 'member', 1, 'Senior Software Engineer', '2026-08-19T07:36:25.919Z', 1, 'seed', '{}', NULL, 0);
INSERT INTO "users" ("id", "name", "email", "color", "password_hash", "role", "active", "title", "created_at", "email_verified", "signup_source", "prefs", "avatar", "bot") VALUES ('u3', 'Omar Saleh', 'omar@ahdfinancial.com', '#00875A', '669a9e71c478946c3c8c9bae67fe81ba:ee4a42e2056670b793abe5cce06214db30469ed52b2e86e1b2b2eba5f6cd1011', 'member', 1, 'Financial Controller', '2026-08-19T07:36:25.919Z', 1, 'seed', '{}', NULL, 0);
INSERT INTO "users" ("id", "name", "email", "color", "password_hash", "role", "active", "title", "created_at", "email_verified", "signup_source", "prefs", "avatar", "bot") VALUES ('u4', 'Layla Hassan', 'layla@ahdfinancial.com', '#FF5630', '669a9e71c478946c3c8c9bae67fe81ba:ee4a42e2056670b793abe5cce06214db30469ed52b2e86e1b2b2eba5f6cd1011', 'member', 1, 'DevOps Engineer', '2026-08-19T07:36:25.919Z', 1, 'seed', '{}', NULL, 0);
INSERT INTO "users" ("id", "name", "email", "color", "password_hash", "role", "active", "title", "created_at", "email_verified", "signup_source", "prefs", "avatar", "bot") VALUES ('u5', 'Yusuf Karim', 'yusuf@ahdfinancial.com', '#FF991F', '669a9e71c478946c3c8c9bae67fe81ba:ee4a42e2056670b793abe5cce06214db30469ed52b2e86e1b2b2eba5f6cd1011', 'member', 1, 'Payments Engineer', '2026-08-19T07:36:25.919Z', 1, 'seed', '{}', NULL, 0);
INSERT INTO "users" ("id", "name", "email", "color", "password_hash", "role", "active", "title", "created_at", "email_verified", "signup_source", "prefs", "avatar", "bot") VALUES ('u6', 'Mona Farouk', 'mona@ahdfinancial.com', '#00B8D9', '669a9e71c478946c3c8c9bae67fe81ba:ee4a42e2056670b793abe5cce06214db30469ed52b2e86e1b2b2eba5f6cd1011', 'member', 1, 'Product Designer', '2026-08-19T07:36:25.919Z', 1, 'seed', '{}', NULL, 0);
INSERT INTO "users" ("id", "name", "email", "color", "password_hash", "role", "active", "title", "created_at", "email_verified", "signup_source", "prefs", "avatar", "bot") VALUES ('u7', 'Khalid Mansour', 'khalid@ahdfinancial.com', '#8777D9', '669a9e71c478946c3c8c9bae67fe81ba:ee4a42e2056670b793abe5cce06214db30469ed52b2e86e1b2b2eba5f6cd1011', 'member', 1, 'External Auditor', '2026-08-19T07:36:25.919Z', 1, 'seed', '{}', NULL, 0);
INSERT INTO "users" ("id", "name", "email", "color", "password_hash", "role", "active", "title", "created_at", "email_verified", "signup_source", "prefs", "avatar", "bot") VALUES ('automation', 'Automation for Masar', 'automation@masar.invalid', '#1D7AFC', NULL, 'member', 0, 'Automation', '2026-10-18T07:36:25.943Z', 1, 'seed', '{}', NULL, 1);

DROP TABLE IF EXISTS "sessions";
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
, user_agent TEXT NOT NULL DEFAULT '', last_seen_at TEXT, remember INTEGER NOT NULL DEFAULT 1);

INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('a01a44daac2f9c09b3786955ae695d8b54e4f97f61cdaefb6c7f6114021ba911', 'u2', '2026-10-18T06:56:50.267Z', '2026-11-01T06:56:50.267Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T06:56:50.267Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('968a7fc4426d2342e0f4c3a90f269ef83c785c50efe3c7f30eec81e92b24d0e3', 'u1', '2026-10-18T06:56:50.672Z', '2026-11-01T06:56:50.672Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T06:56:50.672Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('dbb45954466fecd59fbd039d80986b89177be24451cdf3076f1471b08dc8da6f', 'u2', '2026-10-18T06:57:02.905Z', '2026-11-01T06:57:02.905Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T06:57:02.905Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('dd090a249d779876b1346577db840d4a24124fca5b03cec265ee0b6419b814cd', 'u1', '2026-10-18T06:57:03.312Z', '2026-11-01T06:57:03.312Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T06:57:03.312Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('2a8e5f5bbbd073daf5bd33999b2af8dd65b93aaf966cb17890ee9b20f3880417', 'u1', '2026-10-18T06:57:06.458Z', '2026-11-01T06:57:06.458Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T06:57:06.458Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('a6142eb660af0ab55ba1a4fda79117cb80e815f9b2a6ce1a9676dcde6d722983', 'u3', '2026-10-18T06:57:11.204Z', '2026-11-01T06:57:11.204Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T06:57:11.204Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('0ff96e3642a744b594bbe41035fba274677f223d0620aaea9e31524102f7e05c', 'u1', '2026-10-18T06:57:27.910Z', '2026-11-01T06:57:27.910Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T06:57:27.910Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('87b57cb13fe317db14757886679fd6cdeb2d97805d9c211d3f3076a88f0144a2', 'u7', '2026-10-18T06:57:47.876Z', '2026-11-01T06:57:47.876Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T06:57:47.876Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('ad53c1d6a8ae37a6d2cd7e2fb74050fd23afea947ca9a65f5544d6b92b424354', 'u2', '2026-10-18T06:57:52.070Z', '2026-11-01T06:57:52.070Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T06:57:52.070Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('1ff693cd0fb946e1595f3f581884a7c89261af9b91b91d6be14b02d7c114a809', 'u1', '2026-10-18T06:57:58.503Z', '2026-11-01T06:57:58.503Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T06:57:58.503Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('f88f9c0324de03e5b3f182435b0a20e0ac01aedb175ad60299f4111d76815b72', 'u2', '2026-10-18T06:58:15.275Z', '2026-11-01T06:58:15.275Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T06:58:15.275Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('b46b451d4003526682e0127f539a4dbbb4f374e37f5c1d37b3de9f343785673f', 'u1', '2026-10-18T06:58:24.782Z', '2026-11-01T06:58:24.782Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T06:58:24.782Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('6965cce081a358cfc62c11364027f6109b34c24cd6b035e738347c7a35cec81f', 'u1', '2026-10-18T06:58:34.865Z', '2026-11-01T06:58:34.865Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T06:58:34.865Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('5efa50ecbfed71c3dea9ee77f594c619a65ed43b2b0aea92a0b577f435c9d4dc', 'u1', '2026-10-18T06:58:44.989Z', '2026-11-01T06:58:44.989Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T06:58:44.989Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('7f0d36ef097b8a2e3587285fcc1c7b655455864d927e600469f2fa96097e390c', 'u1', '2026-10-18T06:58:55.071Z', '2026-11-01T06:58:55.071Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T06:58:55.071Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('86edc374e99e9e40cc3d47a4b816058c2933a9b49229f0c7b73ee95718567af4', 'u1', '2026-10-18T06:59:03.355Z', '2026-11-01T06:59:03.355Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T06:59:03.355Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('e6aaf971ab8086c30509d03a61976fc3e320f1f212221747c645f455462818db', 'u2', '2026-10-18T06:59:20.282Z', '2026-11-01T06:59:20.282Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T06:59:20.282Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('09bc5a7259c5d93b687dab60058bb3dcdc7bd1c00fee997970cad8069eb8741d', 'u1', '2026-10-18T06:59:29.667Z', '2026-11-01T06:59:29.667Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T06:59:29.667Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('7bf324fc5d4ae12691adbd55d95a3ea8d7208c102e4f7a5a55919ec4f2237de4', 'u1', '2026-10-18T06:59:39.734Z', '2026-11-01T06:59:39.734Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T06:59:39.734Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('c9d87636b6eab986beea7839724b49d209ade7ccf1d837c80df3e026a9095af7', 'u1', '2026-10-18T06:59:49.801Z', '2026-11-01T06:59:49.801Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T06:59:49.801Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('a551cf36d81ca26c0c103d15da32764937170167cc6ce14a0df97536c771a759', 'u1', '2026-10-18T06:59:59.902Z', '2026-11-01T06:59:59.902Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T06:59:59.902Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('64dd9ddd7a0607a6aff86486896633a07f57d565d587a4f7e2500587ab794a2e', 'u1', '2026-10-18T07:28:03.720Z', '2026-11-01T07:28:03.720Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:28:03.720Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('3a07621664942b65a1a1241f79d728b36b4e20db4d1d775799bbf579c1d41fc8', 'u1', '2026-10-18T07:29:50.588Z', '2026-11-01T07:29:50.588Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:29:50.588Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('93c9e0420d251221cf326d6fe68b0dbd4ffd422b33cf60e62ce0849814ee48a4', 'u7', '2026-10-18T07:30:22.387Z', '2026-11-01T07:30:22.387Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:30:22.387Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('07cfa13c4d9258c9d68ac910ddd4840bf7190d79f12a8cf7cb180df79cdadf5f', 'u1', '2026-10-18T07:30:33.415Z', '2026-11-01T07:30:33.415Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:30:33.415Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('d6b9b7cdb69c0c8f34faf8148527197b5ca5ae5e1d82e9ae2a22eaef2a6a4aa8', 'u7', '2026-10-18T07:31:05.564Z', '2026-11-01T07:31:05.564Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:31:05.564Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('01a03d3145da633d3d1079b118611ef32496ce42a82b594dbb7353d0691a258c', 'u2', '2026-10-18T07:31:14.645Z', '2026-11-01T07:31:14.645Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:31:14.645Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('fafa1fd81d7598caffd369d52a882ae80b0e81add04aee19ab0bfacc0017fa1b', 'u1', '2026-10-18T07:31:15.129Z', '2026-11-01T07:31:15.129Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:31:15.129Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('23921d237ac9469307d8df9998c6818534ddf3e36eb42d208ddd55f9e4e98f64', 'u1', '2026-10-18T07:31:18.538Z', '2026-11-01T07:31:18.538Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:31:18.538Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('8ecbb55a093416fc4e0d7331e943962c48ad19673a849805f2e1b47ff7ca7473', 'u3', '2026-10-18T07:31:24.539Z', '2026-11-01T07:31:24.539Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:31:24.539Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('ec205abad9b6da61239cb2833c3470d63b62c7013ebe3efae9f34ec3dfc17f54', 'u1', '2026-10-18T07:31:26.833Z', '2026-11-01T07:31:26.833Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:31:26.833Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('f13eebf9da9cc3bc5a7d54420abb0216a8abb8210e09c9ad4f5e195c361da1aa', 'u7', '2026-10-18T07:31:47.539Z', '2026-11-01T07:31:47.539Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:31:47.539Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('ddb4fc708ac5b50a283bc3b758b87be4e2e528722a2b8f923d0bfed35c41ba7d', 'u2', '2026-10-18T07:31:51.966Z', '2026-11-01T07:31:51.966Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:31:51.966Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('c011f5727ebd080e5c876997be313575d8881ca26ff66a848a7c585fd1abfaa9', 'u1', '2026-10-18T07:31:58.697Z', '2026-11-01T07:31:58.697Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:31:58.697Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('2aa146919f3dedef10b844aec4e0ba1f6497d2024c33f32abac8ca5ec1a3f87e', 'u2', '2026-10-18T07:32:16.090Z', '2026-11-01T07:32:16.090Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:32:16.090Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('8654d71fa51de4ace0c9ce13fa2850f8744636b1f00c58fb0ac7c6070656f743', 'u1', '2026-10-18T07:32:25.856Z', '2026-11-01T07:32:25.856Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:32:25.856Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('42d15c1bab1aa010b52853425f85e2c2143e46129ec1d0097571d8e58a2a93eb', 'u1', '2026-10-18T07:32:36.043Z', '2026-11-01T07:32:36.043Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:32:36.043Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('a3e858fb74a0a1899a42a8af68abd2b147d0cf9ea35f8bd187cb4cb5491d525a', 'u1', '2026-10-18T07:32:46.205Z', '2026-11-01T07:32:46.205Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:32:46.205Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('6c53d2960523a9c1e9dba8fc5ab131fd90042f7f8bb69cf24129cd049eb4e68f', 'u1', '2026-10-18T07:32:56.327Z', '2026-11-01T07:32:56.327Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:32:56.327Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('a1364870aead63e53ac0d0a6b2170d57fcc47287e07ee52b3b297a7a038f197a', 'u1', '2026-10-18T07:33:04.855Z', '2026-11-01T07:33:04.855Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:33:04.855Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('3d1ffc0d00a0f69ee12528f3d90e6cc33e43857cf1e78901fa7fe52b0f5e7523', 'u2', '2026-10-18T07:33:22.197Z', '2026-11-01T07:33:22.197Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:33:22.197Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('2a3a2f2ef63210217cc926b93261687ae243374f8ef45095ab913ddc4f785ec7', 'u1', '2026-10-18T07:33:36.968Z', '2026-11-01T07:33:36.968Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:33:36.968Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('a2ab3fb3c9a756309347c01d4da8fbfd164d00ec531cb2a8a91ee35e847e9b37', 'u7', '2026-10-18T07:33:57.485Z', '2026-11-01T07:33:57.485Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:33:57.485Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('27b8059aaeed9058a80157267e2774783a987b01391cdc8db04cc022ae11cdeb', 'u2', '2026-10-18T07:34:01.910Z', '2026-11-01T07:34:01.910Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:34:01.910Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('6dd1c64c807fc7da734c162a58de669ca3f016bceeb68f5e6fb1aa8b1486ac01', 'u1', '2026-10-18T07:34:08.585Z', '2026-11-01T07:34:08.585Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:34:08.585Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('208f8ea532207463ae95161ae9d3654222cdb98db8152cac96418cdde14e1565', 'u1', '2026-10-18T07:34:18.702Z', '2026-11-01T07:34:18.702Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:34:18.702Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('c6acce8543b44ba8cadcd26cfb67917139ccce81d9622edaaf45ba92b4d01586', 'u1', '2026-10-18T07:34:28.756Z', '2026-11-01T07:34:28.756Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:34:28.756Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('9e4021638b90074596196c659df02b69c57289fd6202b3a214f14bc3a7fa7964', 'u1', '2026-10-18T07:34:38.802Z', '2026-11-01T07:34:38.802Z', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36', '2026-10-18T07:34:38.802Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u1.1793530841940.1.6e9b066f03de667c4bb5f9ceadc6c537.f391d918cfac3730f496b25f73365662703821c35ac6e167f150e83e742bae82', 'u1', '2026-10-18T11:00:41.950Z', '2026-11-01T11:00:41.940Z', '', '2026-10-18T11:00:41.950Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u1.1793530855628.1.ee0eba6a351eca657304095c7f03964e.65d56be68c11a1b0269ccb2a457b2e4efa4b9cd0ccdd6e1b47747627bdf29bc4', 'u1', '2026-10-18T11:00:55.628Z', '2026-11-01T11:00:55.628Z', 'node', '2026-10-18T11:00:55.628Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u1.1793704107947.1.b77d36d0c0dc4eab7509c5f540ac45a8.106e4525e745df32f92ebde35ea17860f66e29da7d37a7585cfc35ec0d7c3287', 'u1', '2026-10-20T11:08:27.947Z', '2026-11-03T11:08:27.947Z', 'node', '2026-10-20T11:08:27.947Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u2.1793704107950.1.4864ad2fd765a4e05083ae41a28eb870.ceead60532a87839803f1f8478384c8768d53a6fac6e559cc98e8d29a84dafeb', 'u2', '2026-10-20T11:08:27.950Z', '2026-11-03T11:08:27.950Z', '', '2026-10-20T11:08:27.950Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u3.1793704108033.1.2b740820ab2a40152e554a6275c2537b.0606418965423463da70390ded2034e2b31c97a390a896e89e3cbe4136cea253', 'u3', '2026-10-20T11:08:28.033Z', '2026-11-03T11:08:28.033Z', 'node', '2026-10-20T11:08:28.033Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u1.1793704108164.1.d0c8b06c350de810c49bbbfdf5ef7eb5.1e8a76a92568bdcef9dfde5c0cd14d75356745daac70d6d767978d82816b0467', 'u1', '2026-10-20T11:08:28.164Z', '2026-11-03T11:08:28.164Z', 'node', '2026-10-20T11:08:28.164Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u1.1793704777804.1.596ecb0af21cd4c23f8414a365514940.dd071acd0e07aa8a15299b5b37c9803e609fb4714d38a58686fd6cea0f7a0974', 'u1', '2026-10-20T11:19:37.804Z', '2026-11-03T11:19:37.804Z', 'node', '2026-10-20T11:19:37.804Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u2.1793704777807.1.280d916e5ab44b0064322c99f8a5b504.354c1798e4e650273537073554cb2a15a14d7bc072c25a370fcf7071f296c6b4', 'u2', '2026-10-20T11:19:37.807Z', '2026-11-03T11:19:37.807Z', '', '2026-10-20T11:19:37.807Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u3.1793704777902.1.045acfa57c988de740c204590dc8609c.5ea37295976180b1844972ccb5bec9b82b76873a8cd1c3f9064dbb3f450c6e3a', 'u3', '2026-10-20T11:19:37.902Z', '2026-11-03T11:19:37.902Z', 'node', '2026-10-20T11:19:37.902Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u1.1793704778052.1.e1c0ca5f9167b6f89a9daebea746e580.962c34791f598118b5154a4573d282adadc114e094a0128fdb52dc771c814e05', 'u1', '2026-10-20T11:19:38.052Z', '2026-11-03T11:19:38.052Z', 'node', '2026-10-20T11:19:38.052Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u1.1793704886509.1.827d0eb19310e1562c516a0716a34e5c.d09369bc29e880a3950e548c4ce1861dc4adee4a1a40c3aa869de16dddf8ff14', 'u1', '2026-10-20T11:21:26.509Z', '2026-11-03T11:21:26.509Z', 'node', '2026-10-20T11:21:26.509Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u2.1793704886513.1.bfbc2dcf8c1762a8c9031996a2e7f63e.3ebac816ea84ea072d2977317f15a18d10f814052a6cc670dafa5ad751dd9046', 'u2', '2026-10-20T11:21:26.513Z', '2026-11-03T11:21:26.513Z', '', '2026-10-20T11:21:26.513Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u3.1793704886598.1.5f56db109925b50ed6f405ecf994a25c.a30b036820f6763404a4dcedf7d4cc9e675c045d861876ed948185111eb282a8', 'u3', '2026-10-20T11:21:26.598Z', '2026-11-03T11:21:26.598Z', 'node', '2026-10-20T11:21:26.598Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u1.1793704886733.1.3013a5fd27a89262132b02e96a8aacd8.ce78565dc8d2bafa264fdefea246554427961eeeac1c1af2c63e71d7c8a4be40', 'u1', '2026-10-20T11:21:26.733Z', '2026-11-03T11:21:26.733Z', 'node', '2026-10-20T11:21:26.733Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u1.1793705622716.1.e094a61a45a3fb7125baacac935718fb.0243545f00f9c6f394ff292c7ac2f1be48bedde9ae832cf91cc1f0b2dd5d4c05', 'u1', '2026-10-20T11:33:42.716Z', '2026-11-03T11:33:42.716Z', 'node', '2026-10-20T11:33:42.716Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u2.1793705622720.1.820d447b712cb6b9f0079271e8ce43f1.26d4d7cb5334a01c32765c82db8353fae37d4f31943ebfb8711ad2ae552f4a04', 'u2', '2026-10-20T11:33:42.720Z', '2026-11-03T11:33:42.720Z', '', '2026-10-20T11:33:42.720Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u3.1793705622808.1.fdbc39a01866044f6e683e8b5de53dee.188f5dcee90721470ecf64757d2b42acfaf6e7609120296b7aab0dd2b5769b59', 'u3', '2026-10-20T11:33:42.808Z', '2026-11-03T11:33:42.808Z', 'node', '2026-10-20T11:33:42.808Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u1.1793705622951.1.0952b7b6170c9d36e5c1c5f2c60dd6f8.5dfe5f371ce9eb6873e58f3a686afba23a7997fa2cf531a99d361634d0887319', 'u1', '2026-10-20T11:33:42.951Z', '2026-11-03T11:33:42.951Z', 'node', '2026-10-20T11:33:42.951Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u1.1793709833976.1.f4b35cc722e70bafaace3f88e4edb063.97056389d7f0f5bc1724546fa46b57b7c59f4696613f9526a12d85b4e1f9ad98', 'u1', '2026-10-20T12:43:53.976Z', '2026-11-03T12:43:53.976Z', 'node', '2026-10-20T12:43:53.976Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u2.1793709833982.1.43fcf9a2bcdc29b1ecc60a2f6453c4bd.141dd4035f3ecbdf90e99c30308c7738e4f8116abf01e3e316fdf42591a263cc', 'u2', '2026-10-20T12:43:53.982Z', '2026-11-03T12:43:53.982Z', '', '2026-10-20T12:43:53.982Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u3.1793709834139.1.3c4a0c5ecd84f799bd5d5659540059cb.59b7fb18de0ef6ca305dccd754c4725c1179d8ba6ce3dcfd6e42d4b786a1dafc', 'u3', '2026-10-20T12:43:54.139Z', '2026-11-03T12:43:54.139Z', 'node', '2026-10-20T12:43:54.139Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u1.1793709834389.1.0135e116e8af9f2ba7ae35330b753fb0.4fb67437a557a57a49361607a65c9615214fdc52e74c8ec5913804fbe9220894', 'u1', '2026-10-20T12:43:54.389Z', '2026-11-03T12:43:54.389Z', 'node', '2026-10-20T12:43:54.389Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u1.1793710099435.1.766c14620489b5abe0dab1a643cee2b9.b6691d4ac29e66b4c9a2ef3d3e2fba0e0640e3c4b4c4f97afc2e430db56c1624', 'u1', '2026-10-20T12:48:19.435Z', '2026-11-03T12:48:19.435Z', 'node', '2026-10-20T12:48:19.435Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u2.1793710099441.1.d5c0e0aa6e006e576599ea4dffed05a7.7d77bf53920eb05f14220edfe6a307af1f0841e3f49125b8f9e760e9aed79b41', 'u2', '2026-10-20T12:48:19.441Z', '2026-11-03T12:48:19.441Z', '', '2026-10-20T12:48:19.441Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u3.1793710099590.1.b4af8d623b6f71cbfaaff1f047502e9d.5d7bc2095c57b2d0460bf9171670668f93404d06d353b807e409562272c8ac8c', 'u3', '2026-10-20T12:48:19.590Z', '2026-11-03T12:48:19.590Z', 'node', '2026-10-20T12:48:19.590Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u1.1793710099850.1.d6d6424bad09da227d945c437cbb0903.29518fd9e6b11471d009f12921fb204fbcfde8634d124bdad6091bdcdf69f938', 'u1', '2026-10-20T12:48:19.850Z', '2026-11-03T12:48:19.850Z', 'node', '2026-10-20T12:48:19.850Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u1.1793710338398.1.394f7a1af17aaa58103f014cc6dae04e.a54e4ebc54f51af71d360cce2831daf6e66b8cae80791f24b449fa2fad48b691', 'u1', '2026-10-20T12:52:18.398Z', '2026-11-03T12:52:18.398Z', 'node', '2026-10-20T12:52:18.398Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u2.1793710338404.1.0747efb8ad551cb8a0dd4b75ccaabc17.dac418c16c055406a551b90671244c3faa8783859c833e01b554a6683096bc03', 'u2', '2026-10-20T12:52:18.404Z', '2026-11-03T12:52:18.404Z', '', '2026-10-20T12:52:18.404Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u3.1793710338598.1.b6c229f5a24d51be8ace3e7afb48a920.0c699d5edbf7bfc8d94ccc2637240fd0330111f1a958fbddb6e39ddb561115ac', 'u3', '2026-10-20T12:52:18.598Z', '2026-11-03T12:52:18.598Z', 'node', '2026-10-20T12:52:18.598Z', 1);
INSERT INTO "sessions" ("token", "user_id", "created_at", "expires_at", "user_agent", "last_seen_at", "remember") VALUES ('s_u1.1793710338882.1.039ca79fd89f585a429b28bae67dd1ba.44672e20e5ed6d5341be17b00d55071f2a2be785515cb9deb1c70ee61236dee5', 'u1', '2026-10-20T12:52:18.882Z', '2026-11-03T12:52:18.882Z', 'node', '2026-10-20T12:52:18.882Z', 1);

DROP TABLE IF EXISTS "issues";
CREATE TABLE issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  num INTEGER NOT NULL,
  project_key TEXT NOT NULL REFERENCES projects(key),
  type TEXT NOT NULL DEFAULT 'Task',
  summary TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'To Do',
  priority TEXT NOT NULL DEFAULT 'Medium',
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  parent_id INTEGER REFERENCES issues(id) ON DELETE SET NULL,
  labels TEXT NOT NULL DEFAULT '[]',
  due_date TEXT,
  start_date TEXT,
  story_points REAL,
  sprint TEXT,
  rank REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT
, fix_version TEXT, components TEXT NOT NULL DEFAULT '[]', team_id INTEGER, original_estimate INTEGER, remaining_estimate INTEGER, time_spent INTEGER NOT NULL DEFAULT 0);

INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (1, 'KAN-1', 1, 'KAN', 'Epic', 'Client onboarding portal', 'Self-service portal where new clients can submit KYC documents, sign agreements and fund their accounts.', 'In Progress', 'High', 'u1', 'u1', NULL, '["portal"]', '2026-11-27', '2026-09-06', NULL, NULL, 1024, '2026-09-04T09:00:00.000Z', '2026-10-04T09:00:00.000Z', NULL, NULL, '["Client Portal"]', 1, NULL, NULL, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (2, 'KAN-2', 2, 'KAN', 'Epic', 'Q4 regulatory reporting', 'All work needed to file Q4 regulatory reports on time.', 'To Do', 'Highest', 'u3', 'u1', NULL, '["compliance"]', '2026-12-17', '2026-09-07', NULL, NULL, 2048, '2026-09-05T08:00:00.000Z', '2026-10-04T06:00:00.000Z', NULL, NULL, '["Reporting"]', 3, NULL, NULL, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (3, 'KAN-3', 3, 'KAN', 'Epic', 'Payments platform migration', 'Move payment processing from the legacy gateway to the new provider.', 'In Progress', 'Medium', 'u2', 'u1', NULL, '["payments","infra"]', '2027-01-01', '2026-09-08', NULL, NULL, 3072, '2026-09-06T07:00:00.000Z', '2026-10-04T03:00:00.000Z', NULL, NULL, '["Payments"]', 2, NULL, NULL, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (4, 'KAN-4', 4, 'KAN', 'Story', 'As a client, I can upload KYC documents', 'Support PDF, JPG and PNG files up to 10 MB. Show upload progress and validation errors.', 'In Progress', 'High', 'u2', 'u1', 1, '["portal","kyc"]', '2026-10-24', '2026-10-16', 5, 'KAN Sprint 4', 4096, '2026-09-10T06:00:00.000Z', '2026-10-06T00:00:00.000Z', NULL, '1.3.0', '["Client Portal"]', 1, 72000, 68400, 3600);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (5, 'KAN-5', 5, 'KAN', 'Story', 'As a client, I can e-sign the account agreement', 'Integrate with the e-signature provider. Store signed PDFs in the document vault.', 'To Do', 'Medium', 'u4', 'u1', 1, '["portal"]', '2026-11-01', '2026-10-20', 8, 'KAN Sprint 5', 5120, '2026-09-11T05:00:00.000Z', '2026-10-06T08:00:00.000Z', NULL, '1.4.0', '["Client Portal"]', 1, 115200, 115200, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (6, 'KAN-6', 6, 'KAN', 'Task', 'Design onboarding wizard screens', 'Wireframes and high-fidelity mockups for the 5-step onboarding wizard.', 'Done', 'Medium', 'u6', 'u2', 1, '["design","portal"]', '2026-10-13', '2026-10-08', 8, 'KAN Sprint 1', 6144, '2026-09-12T04:00:00.000Z', '2026-10-06T05:00:00.000Z', '2026-10-06T05:00:00.000Z', '1.2.0', '["Client Portal"]', 1, 115200, 0, 30600);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (7, 'KAN-7', 7, 'KAN', 'Bug', 'Upload fails for files larger than 5 MB', 'Steps to reproduce:
1. Open onboarding wizard
2. Upload a 6 MB PDF

Expected: upload succeeds
Actual: 413 Request Entity Too Large', 'In Review', 'Highest', 'u2', 'u4', 1, '["portal","kyc"]', '2026-10-19', '2026-10-16', 2, 'KAN Sprint 4', 7168, '2026-10-09T03:00:00.000Z', '2026-10-15T02:00:00.000Z', NULL, '1.3.0', '["Client Portal"]', 1, 28800, 9000, 19800);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (8, 'KAN-8', 8, 'KAN', 'Task', 'Reconcile Q3 vendor payments', 'Match all Q3 vendor invoices against bank statements and flag discrepancies.', 'Done', 'High', 'u3', 'u3', NULL, '["finance"]', '2026-10-08', '2026-10-03', 5, 'KAN Sprint 2', 8192, '2026-09-15T09:00:00.000Z', '2026-10-06T23:00:00.000Z', '2026-10-06T23:00:00.000Z', '1.2.0', '["Payments"]', 2, 72000, 0, 23400);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (9, 'KAN-9', 9, 'KAN', 'Task', 'Prepare capital adequacy report draft', 'First draft for internal review before submission.', 'In Progress', 'Highest', 'u3', 'u1', 2, '["compliance","reporting"]', '2026-10-27', '2026-10-19', 5, 'KAN Sprint 4', 9216, '2026-09-18T08:00:00.000Z', '2026-10-08T07:00:00.000Z', NULL, '1.3.0', '["Reporting"]', 3, 72000, 52200, 19800);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (10, 'KAN-10', 10, 'KAN', 'Task', 'Collect trial balance from all branches', '', 'To Do', 'High', 'u5', 'u3', 2, '["reporting"]', '2026-10-30', '2026-10-25', 3, 'KAN Sprint 4', 10240, '2026-09-19T07:00:00.000Z', '2026-10-09T04:00:00.000Z', NULL, '1.3.0', '["Reporting"]', 3, 43200, 43200, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (11, 'KAN-11', 11, 'KAN', 'Story', 'Automate AML transaction report export', 'Generate the monthly AML report automatically from the transaction warehouse.', 'To Do', 'Medium', 'u1', 'u3', 2, '["compliance","automation"]', '2026-11-12', '2026-10-31', 8, 'KAN Sprint 5', 11264, '2026-09-20T06:00:00.000Z', '2026-10-09T01:00:00.000Z', NULL, '1.4.0', '["Payments","Reporting"]', 3, 115200, 115200, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (12, 'KAN-12', 12, 'KAN', 'Task', 'Set up sandbox account with new payment provider', '', 'Done', 'Medium', 'u2', 'u2', 3, '["payments"]', '2026-10-03', '2026-09-30', 8, 'KAN Sprint 3', 12288, '2026-09-21T05:00:00.000Z', '2026-10-09T09:00:00.000Z', '2026-10-09T09:00:00.000Z', '1.2.0', '["Payments","Infrastructure"]', 2, 115200, 0, 23400);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (13, 'KAN-13', 13, 'KAN', 'Story', 'Route card payments through new gateway', 'Feature-flagged rollout: 5% → 25% → 100%.', 'In Progress', 'High', 'u5', 'u2', 3, '["payments"]', '2026-11-05', '2026-10-16', 13, 'KAN Sprint 4', 13312, '2026-09-22T04:00:00.000Z', '2026-10-10T06:00:00.000Z', NULL, '1.3.0', '["Payments"]', 2, 187200, 167400, 19800);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (14, 'KAN-14', 14, 'KAN', 'Bug', 'Duplicate refund issued on retry', 'When the gateway times out, our retry logic issues the refund twice. Needs idempotency keys.', 'To Do', 'Highest', 'u5', 'u6', 3, '["payments","incident"]', '2026-10-20', '2026-10-15', 3, 'KAN Sprint 4', 14336, '2026-10-12T03:00:00.000Z', '2026-10-16T03:00:00.000Z', NULL, '1.3.0', '["Payments"]', 2, 43200, 43200, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (15, 'KAN-15', 15, 'KAN', 'Task', 'Write runbook for payment gateway failover', '', 'To Do', 'Low', NULL, 'u2', 3, '["payments","docs"]', '2026-11-17', '2026-11-14', 2, NULL, 15360, '2026-09-24T09:00:00.000Z', '2026-10-10T00:00:00.000Z', NULL, NULL, '["Payments","Infrastructure"]', 2, 28800, 28800, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (16, 'KAN-16', 16, 'KAN', 'Task', 'Renew SSL certificates for client portal', '', 'Done', 'High', 'u4', 'u4', NULL, '["infra"]', '2026-10-16', '2026-10-13', 13, 'KAN Sprint 1', 16384, '2026-09-26T08:00:00.000Z', '2026-10-11T08:00:00.000Z', '2026-10-11T08:00:00.000Z', '1.2.0', '["Client Portal"]', 1, 187200, 0, 23400);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (17, 'KAN-17', 17, 'KAN', 'Task', 'Enable SSO for internal accounting tools', 'Use the company identity provider (SAML) for all accounting apps.', 'In Review', 'Medium', 'u4', 'u1', NULL, '["security","infra"]', '2026-10-22', '2026-10-14', 5, 'KAN Sprint 4', 17408, '2026-09-27T07:00:00.000Z', '2026-10-11T05:00:00.000Z', NULL, '1.3.0', '["Client Portal"]', 1, 72000, 52200, 19800);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (18, 'KAN-18', 18, 'KAN', 'Bug', 'Dashboard totals rounding incorrectly', 'Totals are off by 0.01 because values are rounded before summing.', 'In Progress', 'Medium', 'u6', 'u3', NULL, '["reporting"]', '2026-10-21', '2026-10-18', 2, 'KAN Sprint 4', 18432, '2026-09-29T06:00:00.000Z', '2026-10-12T02:00:00.000Z', NULL, '1.3.0', '["Reporting"]', 3, 28800, 18000, 10800);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (19, 'KAN-19', 19, 'KAN', 'Task', 'Quarterly access review', 'Review who has access to finance systems and revoke stale accounts.', 'To Do', 'Medium', 'u1', 'u1', NULL, '["security","compliance"]', '2026-10-31', '2026-10-28', 2, 'KAN Sprint 5', 19456, '2026-09-30T05:00:00.000Z', '2026-10-11T23:00:00.000Z', NULL, '1.4.0', '[]', NULL, 28800, 28800, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (20, 'KAN-20', 20, 'KAN', 'Story', 'Export statements as CSV', '', 'To Do', 'Low', 'u6', 'u4', 1, '["portal"]', '2026-11-22', '2026-11-17', 3, NULL, 20480, '2026-10-02T04:00:00.000Z', '2026-10-13T07:00:00.000Z', NULL, NULL, '[]', NULL, 43200, 43200, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (21, 'KAN-21', 21, 'KAN', 'Task', 'Update chart of accounts mapping', '', 'Done', 'Low', 'u3', 'u5', NULL, '["finance"]', '2026-10-11', '2026-10-08', 5, 'KAN Sprint 2', 21504, '2026-10-03T03:00:00.000Z', '2026-10-13T04:00:00.000Z', '2026-10-13T04:00:00.000Z', '1.2.0', '[]', NULL, 72000, 0, 34200);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (22, 'KAN-22', 22, 'KAN', 'Bug', 'Wrong currency symbol shown for SAR accounts', '', 'Done', 'Low', 'u6', 'u4', NULL, '["portal","i18n"]', '2026-10-15', '2026-10-12', 8, 'KAN Sprint 3', 22528, '2026-10-04T09:00:00.000Z', '2026-10-14T01:00:00.000Z', '2026-10-14T01:00:00.000Z', '1.2.0', '[]', NULL, 115200, 0, 30600);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (23, 'KAN-23', 23, 'KAN', 'Task', 'Vendor due diligence for new KYC provider', '', 'In Progress', 'Medium', 'u1', 'u3', 1, '["compliance","vendor"]', '2026-10-26', '2026-10-21', 3, 'KAN Sprint 4', 23552, '2026-10-06T08:00:00.000Z', '2026-10-14T09:00:00.000Z', NULL, '1.3.0', '["Client Portal"]', 1, 43200, 23400, 19800);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (24, 'KAN-24', 24, 'KAN', 'Task', 'Archive FY2024 ledgers', '', 'To Do', 'Lowest', NULL, 'u3', NULL, '["finance"]', NULL, NULL, 1, NULL, 24576, '2026-10-07T07:00:00.000Z', '2026-10-15T06:00:00.000Z', NULL, NULL, '[]', NULL, 14400, 14400, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (25, 'KAN-25', 25, 'KAN', 'Story', 'Email notifications for pending approvals', 'Notify approvers when an onboarding application is waiting for them for more than 24 hours.', 'To Do', 'Medium', 'u4', 'u2', 1, '["portal","notifications"]', '2026-11-08', '2026-10-31', 5, 'KAN Sprint 5', 25600, '2026-10-10T06:00:00.000Z', '2026-10-16T03:00:00.000Z', NULL, '1.4.0', '[]', NULL, 72000, 72000, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (26, 'KAN-26', 26, 'KAN', 'Task', 'Load-test new gateway at 2x peak volume', '', 'To Do', 'High', 'u5', 'u2', 3, '["payments","performance"]', '2026-11-03', '2026-10-29', 3, 'KAN Sprint 4', 26624, '2026-10-13T05:00:00.000Z', '2026-10-17T00:00:00.000Z', NULL, '1.3.0', '["Payments","Infrastructure"]', 2, 43200, 43200, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (27, 'KAN-27', 27, 'KAN', 'Bug', 'Session expires during long KYC form', 'Users lose their progress if they take longer than 15 minutes.', 'To Do', 'High', NULL, 'u6', 1, '["portal","kyc"]', '2026-10-25', '2026-10-22', 2, 'KAN Sprint 4', 27648, '2026-10-15T04:00:00.000Z', '2026-10-17T08:00:00.000Z', NULL, '1.3.0', '["Client Portal"]', 1, 28800, 28800, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (28, 'KAN-28', 28, 'KAN', 'Task', 'Board meeting financial pack — October', '', 'In Progress', 'High', 'u3', 'u1', NULL, '["reporting"]', '2026-10-23', '2026-10-18', 3, 'KAN Sprint 4', 28672, '2026-10-16T03:00:00.000Z', '2026-10-18T05:00:00.000Z', NULL, '1.3.0', '["Reporting"]', 3, 43200, 39600, 3600);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (29, 'KAN-29', 29, 'KAN', 'Subtask', 'Add server-side file size validation', '', 'To Do', 'High', 'u2', 'u2', 7, '["kyc"]', '2026-10-19', '2026-10-16', 1, 'KAN Sprint 4', 29696, '2026-10-17T09:00:00.000Z', '2026-10-18T02:00:00.000Z', NULL, '1.3.0', '["Infrastructure"]', 1, 14400, 14400, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (30, 'KAN-30', 30, 'KAN', 'Subtask', 'Increase proxy body size limit', '', 'Done', 'High', 'u4', 'u2', 7, '["infra"]', '2026-10-18', '2026-10-15', 5, 'KAN Sprint 1', 30720, '2026-10-17T08:00:00.000Z', '2026-10-17T23:00:00.000Z', '2026-10-17T23:00:00.000Z', '1.3.0', '[]', NULL, 72000, 0, 30600);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (31, 'PAY-1', 1, 'PAY', 'Epic', 'New payment gateway', '', 'In Progress', 'High', 'u5', 'u1', NULL, '[]', '2026-11-17', NULL, NULL, NULL, 32768, '2026-09-10T09:00:00.000Z', '2026-09-29T09:00:00.000Z', NULL, NULL, '["Gateway"]', 2, NULL, NULL, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (32, 'PAY-2', 2, 'PAY', 'Story', 'Tokenise cards with the new gateway vault', '', 'Done', 'High', 'u5', 'u1', NULL, '[]', NULL, NULL, 5, 'PAY Sprint 1', 33792, '2026-10-02T09:00:00.000Z', '2026-10-10T09:00:00.000Z', '2026-10-10T09:00:00.000Z', '2026.10', '["Gateway"]', 2, 72000, 72000, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (33, 'PAY-3', 3, 'PAY', 'Story', '3-D Secure 2 challenge flow', '', 'Done', 'High', 'u2', 'u1', NULL, '[]', NULL, NULL, 3, 'PAY Sprint 1', 34816, '2026-10-03T09:00:00.000Z', '2026-10-11T09:00:00.000Z', '2026-10-11T09:00:00.000Z', '2026.10', '[]', 2, 43200, 43200, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (34, 'PAY-4', 4, 'PAY', 'Task', 'Map gateway decline codes to customer messages', '', 'In Progress', 'Medium', 'u6', 'u1', NULL, '[]', '2026-10-24', NULL, 3, 'PAY Sprint 2', 35840, '2026-10-08T09:00:00.000Z', '2026-10-13T09:00:00.000Z', NULL, '2026.10', '["Gateway"]', 2, 43200, 43200, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (35, 'PAY-5', 5, 'PAY', 'Story', 'Payout reconciliation report', '', 'In Progress', 'High', 'u3', 'u1', NULL, '[]', '2026-10-27', NULL, 5, 'PAY Sprint 2', 36864, '2026-10-09T09:00:00.000Z', '2026-10-14T09:00:00.000Z', NULL, '2026.10', '["Payouts"]', 2, 72000, 72000, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (36, 'PAY-6', 6, 'PAY', 'Bug', 'Webhook signature check fails on retries', '', 'In Review', 'Highest', 'u5', 'u1', NULL, '[]', '2026-10-20', NULL, 2, 'PAY Sprint 2', 37888, '2026-10-14T09:00:00.000Z', '2026-10-16T09:00:00.000Z', NULL, '2026.10', '["Gateway"]', 2, 28800, 28800, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (37, 'PAY-7', 7, 'PAY', 'Task', 'Load test 3x peak checkout traffic', '', 'To Do', 'High', 'u4', 'u1', NULL, '[]', '2026-10-28', NULL, 5, 'PAY Sprint 2', 38912, '2026-10-15T09:00:00.000Z', '2026-10-17T09:00:00.000Z', NULL, '2026.10', '["Gateway"]', 2, 72000, 72000, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (38, 'PAY-8', 8, 'PAY', 'Task', 'Cut-over runbook and rollback plan', '', 'To Do', 'Medium', 'u4', 'u1', NULL, '[]', '2026-10-29', NULL, 3, 'PAY Sprint 2', 39936, '2026-10-16T09:00:00.000Z', '2026-10-17T09:00:00.000Z', NULL, '2026.10', '["Gateway"]', 2, 43200, 43200, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (39, 'PAY-9', 9, 'PAY', 'Story', 'Apple Pay and Google Pay wallets', '', 'To Do', 'Medium', NULL, 'u1', NULL, '[]', NULL, NULL, 8, 'PAY Sprint 3', 40960, '2026-10-16T09:00:00.000Z', '2026-10-17T09:00:00.000Z', NULL, NULL, '["Gateway"]', 2, 115200, 115200, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (40, 'PAY-10', 10, 'PAY', 'Story', 'Partial refunds from the back office', '', 'To Do', 'Low', NULL, 'u1', NULL, '[]', NULL, NULL, 5, NULL, 41984, '2026-10-17T09:00:00.000Z', '2026-10-18T09:00:00.000Z', NULL, NULL, '["Payouts"]', 2, 72000, 72000, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (41, 'FIN-1', 1, 'FIN', 'Task', 'October bank reconciliations', '', 'In Progress', 'High', 'u3', 'u1', NULL, '[]', '2026-10-23', NULL, NULL, NULL, 43008, '2026-10-12T09:00:00.000Z', '2026-10-15T09:00:00.000Z', NULL, NULL, '[]', 3, NULL, NULL, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (42, 'FIN-2', 2, 'FIN', 'Task', 'Accruals review with department heads', '', 'To Do', 'Medium', 'u3', 'u1', NULL, '[]', '2026-10-27', NULL, NULL, NULL, 44032, '2026-10-14T09:00:00.000Z', '2026-10-16T09:00:00.000Z', NULL, NULL, '[]', 3, NULL, NULL, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (43, 'FIN-3', 3, 'FIN', 'Task', 'Prepare auditor PBC list', '', 'To Do', 'High', 'u1', 'u1', NULL, '[]', '2026-11-01', NULL, NULL, NULL, 45056, '2026-10-15T09:00:00.000Z', '2026-10-17T09:00:00.000Z', NULL, NULL, '[]', 3, NULL, NULL, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (44, 'FIN-4', 4, 'FIN', 'Task', 'September close sign-off', '', 'Done', 'Highest', 'u1', 'u1', NULL, '[]', '2026-10-06', NULL, NULL, NULL, 46080, '2026-09-28T09:00:00.000Z', '2026-10-08T09:00:00.000Z', '2026-10-08T09:00:00.000Z', NULL, '[]', 3, NULL, NULL, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (45, 'FIN-5', 5, 'FIN', 'Bug', 'FX revaluation posts to the wrong ledger', '', 'In Review', 'High', 'u2', 'u1', NULL, '[]', '2026-10-21', NULL, NULL, NULL, 47104, '2026-10-13T09:00:00.000Z', '2026-10-16T09:00:00.000Z', NULL, NULL, '[]', 3, NULL, NULL, 0);
INSERT INTO "issues" ("id", "key", "num", "project_key", "type", "summary", "description", "status", "priority", "assignee_id", "reporter_id", "parent_id", "labels", "due_date", "start_date", "story_points", "sprint", "rank", "created_at", "updated_at", "resolved_at", "fix_version", "components", "team_id", "original_estimate", "remaining_estimate", "time_spent") VALUES (46, 'FIN-6', 6, 'FIN', 'Task', 'Update chart of accounts for new entity', '', 'To Do', 'Low', NULL, 'u1', NULL, '[]', NULL, NULL, NULL, NULL, 48128, '2026-10-16T09:00:00.000Z', '2026-10-17T09:00:00.000Z', NULL, NULL, '[]', 3, NULL, NULL, 0);

DROP TABLE IF EXISTS "comments";
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO "comments" ("id", "issue_id", "author_id", "body", "created_at", "updated_at") VALUES (1, 4, 'u4', 'Can we also accept HEIC files from iPhones?', '2026-09-18T07:00:00.000Z', '2026-09-18T07:00:00.000Z');
INSERT INTO "comments" ("id", "issue_id", "author_id", "body", "created_at", "updated_at") VALUES (2, 4, 'u2', 'Good idea — I will add conversion on the backend.', '2026-09-19T07:00:00.000Z', '2026-09-19T07:00:00.000Z');
INSERT INTO "comments" ("id", "issue_id", "author_id", "body", "created_at", "updated_at") VALUES (3, 7, 'u2', 'Root cause is the nginx client_max_body_size. Fix is in review.', '2026-10-16T07:00:00.000Z', '2026-10-16T07:00:00.000Z');
INSERT INTO "comments" ("id", "issue_id", "author_id", "body", "created_at", "updated_at") VALUES (4, 7, 'u4', 'Confirmed on staging, 8 MB file uploads fine now 👍', '2026-10-17T07:00:00.000Z', '2026-10-17T07:00:00.000Z');
INSERT INTO "comments" ("id", "issue_id", "author_id", "body", "created_at", "updated_at") VALUES (5, 9, 'u1', 'Please share the draft with the CFO by Thursday.', '2026-10-14T07:00:00.000Z', '2026-10-14T07:00:00.000Z');
INSERT INTO "comments" ("id", "issue_id", "author_id", "body", "created_at", "updated_at") VALUES (6, 13, 'u5', 'Flag is at 5% in production. Error rate looks normal.', '2026-10-15T07:00:00.000Z', '2026-10-15T07:00:00.000Z');
INSERT INTO "comments" ("id", "issue_id", "author_id", "body", "created_at", "updated_at") VALUES (7, 14, 'u6', 'Customer support reported 3 more cases this morning.', '2026-10-17T07:00:00.000Z', '2026-10-17T07:00:00.000Z');
INSERT INTO "comments" ("id", "issue_id", "author_id", "body", "created_at", "updated_at") VALUES (8, 14, 'u5', 'Working on idempotency keys now.', '2026-10-18T07:00:00.000Z', '2026-10-18T07:00:00.000Z');
INSERT INTO "comments" ("id", "issue_id", "author_id", "body", "created_at", "updated_at") VALUES (9, 17, 'u1', 'IdP metadata has been uploaded.', '2026-10-13T07:00:00.000Z', '2026-10-13T07:00:00.000Z');
INSERT INTO "comments" ("id", "issue_id", "author_id", "body", "created_at", "updated_at") VALUES (10, 18, 'u3', 'Finance team noticed this on the monthly report.', '2026-10-08T07:00:00.000Z', '2026-10-08T07:00:00.000Z');
INSERT INTO "comments" ("id", "issue_id", "author_id", "body", "created_at", "updated_at") VALUES (11, 27, 'u1', 'Let us raise the timeout to 60 minutes and add autosave.', '2026-10-17T07:00:00.000Z', '2026-10-17T07:00:00.000Z');

DROP TABLE IF EXISTS "history";
CREATE TABLE history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  field TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  created_at TEXT NOT NULL
);

INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (1, 1, 'u1', 'created', NULL, NULL, '2026-09-04T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (2, 1, 'u1', 'status', 'To Do', 'In Progress', '2026-09-26T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (3, 2, 'u1', 'created', NULL, NULL, '2026-09-05T08:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (4, 3, 'u1', 'created', NULL, NULL, '2026-09-06T07:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (5, 3, 'u2', 'status', 'To Do', 'In Progress', '2026-09-27T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (6, 4, 'u1', 'created', NULL, NULL, '2026-09-10T06:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (7, 4, 'u2', 'status', 'To Do', 'In Progress', '2026-09-29T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (8, 5, 'u1', 'created', NULL, NULL, '2026-09-11T05:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (9, 6, 'u2', 'created', NULL, NULL, '2026-09-12T04:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (10, 6, 'u6', 'status', 'To Do', 'In Progress', '2026-09-30T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (11, 6, 'u6', 'status', 'In Progress', 'Done', '2026-10-06T05:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (12, 7, 'u4', 'created', NULL, NULL, '2026-10-09T03:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (13, 7, 'u2', 'status', 'To Do', 'In Review', '2026-10-14T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (14, 8, 'u3', 'created', NULL, NULL, '2026-09-15T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (15, 8, 'u3', 'status', 'To Do', 'In Progress', '2026-10-02T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (16, 8, 'u3', 'status', 'In Progress', 'Done', '2026-10-06T23:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (17, 9, 'u1', 'created', NULL, NULL, '2026-09-18T08:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (18, 9, 'u3', 'status', 'To Do', 'In Progress', '2026-10-03T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (19, 10, 'u3', 'created', NULL, NULL, '2026-09-19T07:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (20, 11, 'u3', 'created', NULL, NULL, '2026-09-20T06:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (21, 12, 'u2', 'created', NULL, NULL, '2026-09-21T05:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (22, 12, 'u2', 'status', 'To Do', 'In Progress', '2026-10-05T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (23, 12, 'u2', 'status', 'In Progress', 'Done', '2026-10-09T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (24, 13, 'u2', 'created', NULL, NULL, '2026-09-22T04:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (25, 13, 'u5', 'status', 'To Do', 'In Progress', '2026-10-05T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (26, 14, 'u6', 'created', NULL, NULL, '2026-10-12T03:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (27, 15, 'u2', 'created', NULL, NULL, '2026-09-24T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (28, 16, 'u4', 'created', NULL, NULL, '2026-09-26T08:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (29, 16, 'u4', 'status', 'To Do', 'In Progress', '2026-10-07T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (30, 16, 'u4', 'status', 'In Progress', 'Done', '2026-10-11T08:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (31, 17, 'u1', 'created', NULL, NULL, '2026-09-27T07:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (32, 17, 'u4', 'status', 'To Do', 'In Review', '2026-10-08T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (33, 18, 'u3', 'created', NULL, NULL, '2026-09-29T06:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (34, 18, 'u6', 'status', 'To Do', 'In Progress', '2026-10-09T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (35, 19, 'u1', 'created', NULL, NULL, '2026-09-30T05:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (36, 20, 'u4', 'created', NULL, NULL, '2026-10-02T04:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (37, 21, 'u5', 'created', NULL, NULL, '2026-10-03T03:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (38, 21, 'u3', 'status', 'To Do', 'In Progress', '2026-10-11T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (39, 21, 'u3', 'status', 'In Progress', 'Done', '2026-10-13T04:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (40, 22, 'u4', 'created', NULL, NULL, '2026-10-04T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (41, 22, 'u6', 'status', 'To Do', 'In Progress', '2026-10-11T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (42, 22, 'u6', 'status', 'In Progress', 'Done', '2026-10-14T01:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (43, 23, 'u3', 'created', NULL, NULL, '2026-10-06T08:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (44, 23, 'u1', 'status', 'To Do', 'In Progress', '2026-10-12T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (45, 24, 'u3', 'created', NULL, NULL, '2026-10-07T07:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (46, 25, 'u2', 'created', NULL, NULL, '2026-10-10T06:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (47, 26, 'u2', 'created', NULL, NULL, '2026-10-13T05:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (48, 27, 'u6', 'created', NULL, NULL, '2026-10-15T04:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (49, 28, 'u1', 'created', NULL, NULL, '2026-10-16T03:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (50, 28, 'u3', 'status', 'To Do', 'In Progress', '2026-10-17T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (51, 29, 'u2', 'created', NULL, NULL, '2026-10-17T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (52, 30, 'u2', 'created', NULL, NULL, '2026-10-17T08:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (53, 30, 'u4', 'status', 'To Do', 'In Progress', '2026-10-18T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (54, 30, 'u4', 'status', 'In Progress', 'Done', '2026-10-17T23:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (55, 7, 'u1', 'sprint', 'KAN Sprint 2', 'KAN Sprint 3', '2026-09-28T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (56, 7, 'u1', 'sprint', 'KAN Sprint 3', 'KAN Sprint 4', '2026-10-11T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (57, 18, 'u1', 'sprint', 'KAN Sprint 3', 'KAN Sprint 4', '2026-10-11T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (58, 31, 'u1', 'created', NULL, NULL, '2026-09-10T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (59, 31, 'u5', 'status', 'To Do', 'In Progress', '2026-09-22T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (60, 32, 'u1', 'created', NULL, NULL, '2026-10-02T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (61, 32, 'u5', 'status', 'To Do', 'In Progress', '2026-10-07T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (62, 32, 'u5', 'status', 'In Progress', 'Done', '2026-10-10T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (63, 33, 'u1', 'created', NULL, NULL, '2026-10-03T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (64, 33, 'u2', 'status', 'To Do', 'In Progress', '2026-10-08T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (65, 33, 'u2', 'status', 'In Progress', 'Done', '2026-10-11T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (66, 34, 'u1', 'created', NULL, NULL, '2026-10-08T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (67, 34, 'u6', 'status', 'To Do', 'In Progress', '2026-10-11T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (68, 35, 'u1', 'created', NULL, NULL, '2026-10-09T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (69, 35, 'u3', 'status', 'To Do', 'In Progress', '2026-10-12T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (70, 36, 'u1', 'created', NULL, NULL, '2026-10-14T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (71, 36, 'u5', 'status', 'To Do', 'In Review', '2026-10-16T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (72, 37, 'u1', 'created', NULL, NULL, '2026-10-15T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (73, 38, 'u1', 'created', NULL, NULL, '2026-10-16T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (74, 39, 'u1', 'created', NULL, NULL, '2026-10-16T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (75, 40, 'u1', 'created', NULL, NULL, '2026-10-17T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (76, 41, 'u1', 'created', NULL, NULL, '2026-10-12T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (77, 41, 'u3', 'status', 'To Do', 'In Progress', '2026-10-14T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (78, 42, 'u1', 'created', NULL, NULL, '2026-10-14T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (79, 43, 'u1', 'created', NULL, NULL, '2026-10-15T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (80, 44, 'u1', 'created', NULL, NULL, '2026-09-28T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (81, 44, 'u1', 'status', 'To Do', 'In Progress', '2026-10-04T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (82, 44, 'u1', 'status', 'In Progress', 'Done', '2026-10-08T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (83, 45, 'u1', 'created', NULL, NULL, '2026-10-13T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (84, 45, 'u2', 'status', 'To Do', 'In Review', '2026-10-15T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (85, 46, 'u1', 'created', NULL, NULL, '2026-10-16T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (87, 4, 'u1', 'original estimate', NULL, '2d 4h', '2026-09-10T06:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (88, 5, 'u1', 'original estimate', NULL, '4d', '2026-09-11T05:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (89, 6, 'u2', 'original estimate', NULL, '4d', '2026-09-12T04:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (90, 7, 'u4', 'original estimate', NULL, '1d', '2026-10-09T03:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (91, 8, 'u3', 'original estimate', NULL, '2d 4h', '2026-09-15T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (92, 9, 'u1', 'original estimate', NULL, '2d 4h', '2026-09-18T08:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (93, 10, 'u3', 'original estimate', NULL, '1d 4h', '2026-09-19T07:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (94, 11, 'u3', 'original estimate', NULL, '4d', '2026-09-20T06:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (95, 12, 'u2', 'original estimate', NULL, '4d', '2026-09-21T05:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (96, 13, 'u2', 'original estimate', NULL, '1w 1d 4h', '2026-09-22T04:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (97, 14, 'u6', 'original estimate', NULL, '1d 4h', '2026-10-12T03:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (98, 15, 'u2', 'original estimate', NULL, '1d', '2026-09-24T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (99, 16, 'u4', 'original estimate', NULL, '1w 1d 4h', '2026-09-26T08:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (100, 17, 'u1', 'original estimate', NULL, '2d 4h', '2026-09-27T07:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (101, 18, 'u3', 'original estimate', NULL, '1d', '2026-09-29T06:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (102, 19, 'u1', 'original estimate', NULL, '1d', '2026-09-30T05:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (103, 20, 'u4', 'original estimate', NULL, '1d 4h', '2026-10-02T04:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (104, 21, 'u5', 'original estimate', NULL, '2d 4h', '2026-10-03T03:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (105, 22, 'u4', 'original estimate', NULL, '4d', '2026-10-04T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (106, 23, 'u3', 'original estimate', NULL, '1d 4h', '2026-10-06T08:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (107, 24, 'u3', 'original estimate', NULL, '4h', '2026-10-07T07:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (108, 25, 'u2', 'original estimate', NULL, '2d 4h', '2026-10-10T06:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (109, 26, 'u2', 'original estimate', NULL, '1d 4h', '2026-10-13T05:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (110, 27, 'u6', 'original estimate', NULL, '1d', '2026-10-15T04:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (111, 28, 'u1', 'original estimate', NULL, '1d 4h', '2026-10-16T03:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (112, 29, 'u2', 'original estimate', NULL, '4h', '2026-10-17T09:00:00.000Z');
INSERT INTO "history" ("id", "issue_id", "author_id", "field", "from_value", "to_value", "created_at") VALUES (113, 30, 'u2', 'original estimate', NULL, '2d 4h', '2026-10-17T08:00:00.000Z');

DROP TABLE IF EXISTS "watchers";
CREATE TABLE watchers (
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (issue_id, user_id)
);

INSERT INTO "watchers" ("issue_id", "user_id") VALUES (1, 'u1');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (2, 'u1');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (3, 'u1');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (4, 'u1');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (5, 'u1');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (6, 'u2');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (7, 'u4');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (8, 'u3');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (9, 'u1');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (10, 'u3');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (11, 'u3');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (12, 'u2');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (13, 'u2');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (14, 'u6');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (15, 'u2');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (16, 'u4');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (17, 'u1');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (18, 'u3');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (19, 'u1');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (20, 'u4');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (21, 'u5');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (22, 'u4');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (23, 'u3');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (24, 'u3');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (25, 'u2');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (26, 'u2');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (27, 'u6');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (28, 'u1');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (29, 'u2');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (30, 'u2');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (2, 'u3');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (3, 'u2');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (4, 'u2');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (5, 'u4');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (6, 'u6');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (7, 'u2');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (9, 'u3');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (10, 'u5');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (11, 'u1');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (13, 'u5');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (14, 'u5');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (17, 'u4');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (18, 'u6');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (20, 'u6');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (21, 'u3');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (22, 'u6');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (23, 'u1');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (25, 'u4');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (26, 'u5');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (28, 'u3');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (30, 'u4');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (4, 'u4');
INSERT INTO "watchers" ("issue_id", "user_id") VALUES (27, 'u1');

DROP TABLE IF EXISTS "issue_links";
CREATE TABLE issue_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  UNIQUE (source_id, target_id, type)
);

INSERT INTO "issue_links" ("id", "source_id", "target_id", "type", "created_by", "created_at") VALUES (1, 14, 26, 'blocks', 'u5', '2026-10-13T09:00:00.000Z');
INSERT INTO "issue_links" ("id", "source_id", "target_id", "type", "created_by", "created_at") VALUES (2, 7, 4, 'blocks', 'u2', '2026-10-13T09:00:00.000Z');
INSERT INTO "issue_links" ("id", "source_id", "target_id", "type", "created_by", "created_at") VALUES (3, 27, 25, 'relates', 'u6', '2026-10-13T09:00:00.000Z');
INSERT INTO "issue_links" ("id", "source_id", "target_id", "type", "created_by", "created_at") VALUES (4, 10, 11, 'blocks', 'u3', '2026-10-13T09:00:00.000Z');
INSERT INTO "issue_links" ("id", "source_id", "target_id", "type", "created_by", "created_at") VALUES (5, 18, 8, 'relates', 'u3', '2026-10-13T09:00:00.000Z');
INSERT INTO "issue_links" ("id", "source_id", "target_id", "type", "created_by", "created_at") VALUES (6, 22, 4, 'duplicates', 'u6', '2026-10-13T09:00:00.000Z');
INSERT INTO "issue_links" ("id", "source_id", "target_id", "type", "created_by", "created_at") VALUES (7, 12, 19, 'relates', 'u1', '2026-10-13T09:00:00.000Z');

DROP TABLE IF EXISTS "attachments";
CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  stored_name TEXT NOT NULL,
  uploader_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

DROP TABLE IF EXISTS "notifications";
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  issue_id INTEGER REFERENCES issues(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

INSERT INTO "notifications" ("id", "user_id", "actor_id", "issue_id", "type", "message", "read", "created_at") VALUES (1, 'u1', 'u5', 14, 'comment', 'commented on KAN-14: “Working on idempotency keys now.”', 0, '2026-10-18T07:00:00.000Z');
INSERT INTO "notifications" ("id", "user_id", "actor_id", "issue_id", "type", "message", "read", "created_at") VALUES (2, 'u1', 'u4', 17, 'status', 'changed KAN-17 to In Review', 0, '2026-10-17T09:00:00.000Z');
INSERT INTO "notifications" ("id", "user_id", "actor_id", "issue_id", "type", "message", "read", "created_at") VALUES (3, 'u1', 'u3', 27, 'assigned', 'mentioned you on KAN-27', 1, '2026-10-16T09:00:00.000Z');
INSERT INTO "notifications" ("id", "user_id", "actor_id", "issue_id", "type", "message", "read", "created_at") VALUES (4, 'u1', 'u2', 7, 'comment', 'commented on KAN-7: “Root cause is the nginx client_max_body_size.”', 1, '2026-10-16T05:00:00.000Z');

DROP TABLE IF EXISTS "filters";
CREATE TABLE filters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  jql TEXT NOT NULL,
  owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  starred INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO "filters" ("id", "name", "description", "jql", "owner_id", "starred", "created_at", "updated_at") VALUES (1, 'My open work', 'Everything assigned to me that is not done', 'project = KAN AND assignee = currentUser() AND status != Done ORDER BY priority DESC', 'u1', 1, '2026-10-13T09:00:00.000Z', '2026-10-13T09:00:00.000Z');
INSERT INTO "filters" ("id", "name", "description", "jql", "owner_id", "starred", "created_at", "updated_at") VALUES (2, 'Payments incidents', 'Bugs and incidents for the payments platform', 'project = KAN AND labels in (payments, incident) AND type = Bug ORDER BY created DESC', 'u1', 1, '2026-10-13T09:00:00.000Z', '2026-10-13T09:00:00.000Z');
INSERT INTO "filters" ("id", "name", "description", "jql", "owner_id", "starred", "created_at", "updated_at") VALUES (3, 'Overdue', 'Work items past their due date', 'project = KAN AND duedate < now() AND status != Done ORDER BY duedate ASC', 'u1', 0, '2026-10-13T09:00:00.000Z', '2026-10-13T09:00:00.000Z');
INSERT INTO "filters" ("id", "name", "description", "jql", "owner_id", "starred", "created_at", "updated_at") VALUES (4, 'Unassigned backlog', '', 'project = KAN AND assignee IS EMPTY ORDER BY cf[10019] ASC', 'u2', 0, '2026-10-13T09:00:00.000Z', '2026-10-13T09:00:00.000Z');

DROP TABLE IF EXISTS "goals";
CREATE TABLE goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO "goals" ("id", "name", "description", "status", "owner_id", "target_date", "created_at", "updated_at") VALUES (1, 'Launch self-service client onboarding', 'Cut new-client onboarding time from 5 days to under 1 day by moving KYC and agreements online.', 'on_track', 'u1', '2026-12-02', '2026-09-08T09:00:00.000Z', '2026-10-15T09:00:00.000Z');
INSERT INTO "goals" ("id", "name", "description", "status", "owner_id", "target_date", "created_at", "updated_at") VALUES (2, 'File Q4 regulatory reports on time', 'Zero late or amended submissions to the regulator in Q4.', 'at_risk', 'u3', '2026-12-17', '2026-09-08T09:00:00.000Z', '2026-10-17T09:00:00.000Z');
INSERT INTO "goals" ("id", "name", "description", "status", "owner_id", "target_date", "created_at", "updated_at") VALUES (3, 'Migrate 100% of card volume to the new gateway', 'Retire the legacy payment gateway before the contract renewal.', 'off_track', 'u2', '2027-01-01', '2026-09-10T09:00:00.000Z', '2026-10-16T09:00:00.000Z');
INSERT INTO "goals" ("id", "name", "description", "status", "owner_id", "target_date", "created_at", "updated_at") VALUES (4, 'Pass the annual security audit', 'No high findings in the external audit.', 'pending', 'u4', '2027-02-15', '2026-10-08T09:00:00.000Z', '2026-10-08T09:00:00.000Z');

DROP TABLE IF EXISTS "goal_issues";
CREATE TABLE goal_issues (
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  PRIMARY KEY (goal_id, issue_id)
);

INSERT INTO "goal_issues" ("goal_id", "issue_id") VALUES (1, 1);
INSERT INTO "goal_issues" ("goal_id", "issue_id") VALUES (2, 2);
INSERT INTO "goal_issues" ("goal_id", "issue_id") VALUES (3, 3);
INSERT INTO "goal_issues" ("goal_id", "issue_id") VALUES (4, 17);
INSERT INTO "goal_issues" ("goal_id", "issue_id") VALUES (4, 19);
INSERT INTO "goal_issues" ("goal_id", "issue_id") VALUES (4, 16);

DROP TABLE IF EXISTS "forms";
CREATE TABLE forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  issue_type TEXT NOT NULL DEFAULT 'Task',
  fields TEXT NOT NULL DEFAULT '[]',
  default_labels TEXT NOT NULL DEFAULT '[]',
  default_assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1,
  submissions INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
, project_key TEXT NOT NULL DEFAULT 'KAN');

INSERT INTO "forms" ("id", "name", "description", "issue_type", "fields", "default_labels", "default_assignee_id", "active", "submissions", "created_by", "created_at", "updated_at", "project_key") VALUES (1, 'Report a bug', 'Found something broken in the client portal or internal tools? Tell us here.', 'Bug', '["summary","description","priority","dueDate"]', '["form","triage"]', 'u2', 1, 4, 'u1', '2026-09-18T09:00:00.000Z', '2026-09-18T09:00:00.000Z', 'KAN');
INSERT INTO "forms" ("id", "name", "description", "issue_type", "fields", "default_labels", "default_assignee_id", "active", "submissions", "created_by", "created_at", "updated_at", "project_key") VALUES (2, 'Finance data request', 'Request a report, export or reconciliation from the finance team.', 'Task', '["summary","description","dueDate","labels"]', '["form","finance"]', 'u3', 1, 2, 'u3', '2026-09-28T09:00:00.000Z', '2026-09-28T09:00:00.000Z', 'KAN');
INSERT INTO "forms" ("id", "name", "description", "issue_type", "fields", "default_labels", "default_assignee_id", "active", "submissions", "created_by", "created_at", "updated_at", "project_key") VALUES (3, 'Access request', 'Ask for access to a finance system.', 'Task', '["summary","description","priority"]', '["form","security"]', 'u4', 0, 0, 'u4', '2026-10-10T09:00:00.000Z', '2026-10-10T09:00:00.000Z', 'KAN');
INSERT INTO "forms" ("id", "name", "description", "issue_type", "fields", "default_labels", "default_assignee_id", "active", "submissions", "created_by", "created_at", "updated_at", "project_key") VALUES (4, 'Expense report query', 'Questions about an expense claim or reimbursement.', 'Task', '["summary","description","dueDate"]', '["form","expenses"]', 'u3', 1, 1, 'u3', '2026-10-03T09:00:00.000Z', '2026-10-03T09:00:00.000Z', 'FIN');

DROP TABLE IF EXISTS "dev_items";
CREATE TABLE dev_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER REFERENCES issues(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,           -- branch | commit | pr
  repo TEXT NOT NULL,
  name TEXT NOT NULL,           -- branch name, commit message or PR title
  ref TEXT,                     -- commit sha, PR number
  status TEXT,                  -- open | merged | declined (PR), active (branch)
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

INSERT INTO "dev_items" ("id", "issue_id", "kind", "repo", "name", "ref", "status", "author_id", "created_at") VALUES (1, 7, 'branch', 'client-portal', 'KAN-7-upload-fails-for-large-files', NULL, 'active', 'u2', '2026-10-15T06:00:00.000Z');
INSERT INTO "dev_items" ("id", "issue_id", "kind", "repo", "name", "ref", "status", "author_id", "created_at") VALUES (2, 7, 'commit', 'client-portal', 'KAN-7 Increase nginx client_max_body_size to 12m', 'a3f9c21', NULL, 'u4', '2026-10-16T06:00:00.000Z');
INSERT INTO "dev_items" ("id", "issue_id", "kind", "repo", "name", "ref", "status", "author_id", "created_at") VALUES (3, 7, 'commit', 'client-portal', 'KAN-7 Validate file size on the server', '7be01d4', NULL, 'u2', '2026-10-16T06:00:00.000Z');
INSERT INTO "dev_items" ("id", "issue_id", "kind", "repo", "name", "ref", "status", "author_id", "created_at") VALUES (4, 7, 'pr', 'client-portal', 'KAN-7: Fix uploads larger than 5 MB', '142', 'open', 'u2', '2026-10-16T06:00:00.000Z');
INSERT INTO "dev_items" ("id", "issue_id", "kind", "repo", "name", "ref", "status", "author_id", "created_at") VALUES (5, 4, 'branch', 'client-portal', 'KAN-4-kyc-document-upload', NULL, 'active', 'u2', '2026-09-28T06:00:00.000Z');
INSERT INTO "dev_items" ("id", "issue_id", "kind", "repo", "name", "ref", "status", "author_id", "created_at") VALUES (6, 4, 'pr', 'client-portal', 'KAN-4: KYC document upload step', '131', 'merged', 'u2', '2026-10-06T06:00:00.000Z');
INSERT INTO "dev_items" ("id", "issue_id", "kind", "repo", "name", "ref", "status", "author_id", "created_at") VALUES (7, 13, 'branch', 'payments-service', 'KAN-13-route-card-payments', NULL, 'active', 'u5', '2026-10-03T06:00:00.000Z');
INSERT INTO "dev_items" ("id", "issue_id", "kind", "repo", "name", "ref", "status", "author_id", "created_at") VALUES (8, 13, 'commit', 'payments-service', 'KAN-13 Add feature flag for new gateway routing', 'c81d0aa', NULL, 'u5', '2026-10-09T06:00:00.000Z');
INSERT INTO "dev_items" ("id", "issue_id", "kind", "repo", "name", "ref", "status", "author_id", "created_at") VALUES (9, 13, 'pr', 'payments-service', 'KAN-13: Route 5% of card traffic to new gateway', '88', 'merged', 'u5', '2026-10-12T06:00:00.000Z');
INSERT INTO "dev_items" ("id", "issue_id", "kind", "repo", "name", "ref", "status", "author_id", "created_at") VALUES (10, 14, 'branch', 'payments-service', 'KAN-14-idempotent-refunds', NULL, 'active', 'u5', '2026-10-17T06:00:00.000Z');
INSERT INTO "dev_items" ("id", "issue_id", "kind", "repo", "name", "ref", "status", "author_id", "created_at") VALUES (11, 14, 'commit', 'payments-service', 'KAN-14 Add idempotency keys to refund requests', 'f00ba12', NULL, 'u5', '2026-10-18T06:00:00.000Z');
INSERT INTO "dev_items" ("id", "issue_id", "kind", "repo", "name", "ref", "status", "author_id", "created_at") VALUES (12, 17, 'pr', 'infra', 'KAN-17: SAML SSO for accounting apps', '57', 'open', 'u4', '2026-10-14T06:00:00.000Z');
INSERT INTO "dev_items" ("id", "issue_id", "kind", "repo", "name", "ref", "status", "author_id", "created_at") VALUES (13, 16, 'pr', 'infra', 'KAN-16: Renew portal certificates', '55', 'merged', 'u4', '2026-10-12T06:00:00.000Z');
INSERT INTO "dev_items" ("id", "issue_id", "kind", "repo", "name", "ref", "status", "author_id", "created_at") VALUES (14, 18, 'pr', 'reporting', 'KAN-18: Sum before rounding on dashboard totals', '23', 'declined', 'u6', '2026-10-13T06:00:00.000Z');

DROP TABLE IF EXISTS "password_resets";
CREATE TABLE password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

DROP TABLE IF EXISTS "sprints";
CREATE TABLE sprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_key TEXT NOT NULL DEFAULT 'KAN',
  name TEXT NOT NULL UNIQUE,
  goal TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'future',   -- future | active | closed
  start_date TEXT,
  end_date TEXT,
  completed_at TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
, committed_points REAL, committed_count INTEGER, completed_points REAL, completed_count INTEGER);

INSERT INTO "sprints" ("id", "project_key", "name", "goal", "state", "start_date", "end_date", "completed_at", "position", "created_at", "committed_points", "committed_count", "completed_points", "completed_count") VALUES (1, 'KAN', 'KAN Sprint 1', 'Stabilise KYC uploads before the August audit', 'closed', '2026-08-31', '2026-09-14', '2026-09-14T09:00:00.000Z', 0, '2026-08-29T09:00:00.000Z', 26, 3, 26, 3);
INSERT INTO "sprints" ("id", "project_key", "name", "goal", "state", "start_date", "end_date", "completed_at", "position", "created_at", "committed_points", "committed_count", "completed_points", "completed_count") VALUES (2, 'KAN', 'KAN Sprint 2', 'Payments reconciliation and certificate renewals', 'closed', '2026-09-14', '2026-09-28', '2026-09-28T09:00:00.000Z', 1, '2026-09-12T09:00:00.000Z', 12, 3, 10, 2);
INSERT INTO "sprints" ("id", "project_key", "name", "goal", "state", "start_date", "end_date", "completed_at", "position", "created_at", "committed_points", "committed_count", "completed_points", "completed_count") VALUES (3, 'KAN', 'KAN Sprint 3', 'Ship the KYC upload fixes and close out September reporting', 'closed', '2026-09-28', '2026-10-11', '2026-10-11T09:00:00.000Z', 2, '2026-09-26T09:00:00.000Z', 20, 4, 16, 2);
INSERT INTO "sprints" ("id", "project_key", "name", "goal", "state", "start_date", "end_date", "completed_at", "position", "created_at", "committed_points", "committed_count", "completed_points", "completed_count") VALUES (4, 'KAN', 'KAN Sprint 4', 'Launch the onboarding portal beta and start the gateway migration', 'active', '2026-10-12', '2026-10-26', NULL, 3, '2026-10-10T09:00:00.000Z', 50, 13, NULL, NULL);
INSERT INTO "sprints" ("id", "project_key", "name", "goal", "state", "start_date", "end_date", "completed_at", "position", "created_at", "committed_points", "committed_count", "completed_points", "completed_count") VALUES (5, 'KAN', 'KAN Sprint 5', '', 'future', NULL, NULL, NULL, 4, '2026-10-16T09:00:00.000Z', NULL, NULL, NULL, NULL);
INSERT INTO "sprints" ("id", "project_key", "name", "goal", "state", "start_date", "end_date", "completed_at", "position", "created_at", "committed_points", "committed_count", "completed_points", "completed_count") VALUES (6, 'PAY', 'PAY Sprint 1', 'Gateway sandbox integration', 'closed', '2026-10-01', '2026-10-15', '2026-10-15T09:00:00.000Z', 10, '2026-09-30T09:00:00.000Z', 13, 3, 8, 2);
INSERT INTO "sprints" ("id", "project_key", "name", "goal", "state", "start_date", "end_date", "completed_at", "position", "created_at", "committed_points", "committed_count", "completed_points", "completed_count") VALUES (7, 'PAY', 'PAY Sprint 2', 'Go live with card payments on the new gateway', 'active', '2026-10-15', '2026-10-29', NULL, 11, '2026-10-14T09:00:00.000Z', 21, 5, NULL, NULL);
INSERT INTO "sprints" ("id", "project_key", "name", "goal", "state", "start_date", "end_date", "completed_at", "position", "created_at", "committed_points", "committed_count", "completed_points", "completed_count") VALUES (8, 'PAY', 'PAY Sprint 3', '', 'future', NULL, NULL, NULL, 12, '2026-10-17T09:00:00.000Z', NULL, NULL, NULL, NULL);

DROP TABLE IF EXISTS "versions";
CREATE TABLE versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_key TEXT NOT NULL REFERENCES projects(key) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unreleased',   -- unreleased | released | archived
  start_date TEXT,
  release_date TEXT,
  released_at TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (project_key, name)
);

INSERT INTO "versions" ("id", "project_key", "name", "description", "status", "start_date", "release_date", "released_at", "position", "created_at") VALUES (1, 'KAN', '1.1.0', 'Portal hardening and audit fixes', 'archived', '2026-08-19', '2026-09-08', '2026-09-08T09:00:00.000Z', 0, '2026-08-09T09:00:00.000Z');
INSERT INTO "versions" ("id", "project_key", "name", "description", "status", "start_date", "release_date", "released_at", "position", "created_at") VALUES (2, 'KAN', '1.2.0', 'KYC uploads, certificates and September reporting', 'released', '2026-09-08', '2026-10-11', '2026-10-11T09:00:00.000Z', 1, '2026-09-03T09:00:00.000Z');
INSERT INTO "versions" ("id", "project_key", "name", "description", "status", "start_date", "release_date", "released_at", "position", "created_at") VALUES (3, 'KAN', '1.3.0', 'Client onboarding portal beta', 'unreleased', '2026-10-11', '2026-10-26', NULL, 2, '2026-10-08T09:00:00.000Z');
INSERT INTO "versions" ("id", "project_key", "name", "description", "status", "start_date", "release_date", "released_at", "position", "created_at") VALUES (4, 'KAN', '1.4.0', 'Payments gateway migration', 'unreleased', '2026-10-26', '2026-11-23', NULL, 3, '2026-10-15T09:00:00.000Z');
INSERT INTO "versions" ("id", "project_key", "name", "description", "status", "start_date", "release_date", "released_at", "position", "created_at") VALUES (5, 'PAY', '2026.10', 'October gateway launch', 'unreleased', '2026-10-08', '2026-10-30', NULL, 0, '2026-10-06T09:00:00.000Z');

DROP TABLE IF EXISTS "api_tokens";
CREATE TABLE api_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  expires_at TEXT
);

DROP TABLE IF EXISTS "project_stars";
CREATE TABLE project_stars (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_key TEXT NOT NULL REFERENCES projects(key) ON DELETE CASCADE,
  PRIMARY KEY (user_id, project_key)
);

INSERT INTO "project_stars" ("user_id", "project_key") VALUES ('u1', 'KAN');
INSERT INTO "project_stars" ("user_id", "project_key") VALUES ('u2', 'KAN');
INSERT INTO "project_stars" ("user_id", "project_key") VALUES ('u3', 'KAN');
INSERT INTO "project_stars" ("user_id", "project_key") VALUES ('u4', 'KAN');
INSERT INTO "project_stars" ("user_id", "project_key") VALUES ('u5', 'KAN');
INSERT INTO "project_stars" ("user_id", "project_key") VALUES ('u6', 'KAN');
INSERT INTO "project_stars" ("user_id", "project_key") VALUES ('u5', 'PAY');
INSERT INTO "project_stars" ("user_id", "project_key") VALUES ('u3', 'FIN');

DROP TABLE IF EXISTS "project_members";
CREATE TABLE project_members (
  project_key TEXT NOT NULL REFERENCES projects(key) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin','member','viewer')),
  added_by TEXT,
  added_at TEXT NOT NULL,
  PRIMARY KEY (project_key, user_id)
);

INSERT INTO "project_members" ("project_key", "user_id", "role", "added_by", "added_at") VALUES ('KAN', 'u2', 'admin', 'u1', '2026-07-30T09:00:00.000Z');
INSERT INTO "project_members" ("project_key", "user_id", "role", "added_by", "added_at") VALUES ('KAN', 'u3', 'member', 'u1', '2026-07-30T09:00:00.000Z');
INSERT INTO "project_members" ("project_key", "user_id", "role", "added_by", "added_at") VALUES ('KAN', 'u4', 'member', 'u1', '2026-07-30T09:00:00.000Z');
INSERT INTO "project_members" ("project_key", "user_id", "role", "added_by", "added_at") VALUES ('KAN', 'u5', 'member', 'u1', '2026-07-30T09:00:00.000Z');
INSERT INTO "project_members" ("project_key", "user_id", "role", "added_by", "added_at") VALUES ('KAN', 'u6', 'member', 'u1', '2026-07-30T09:00:00.000Z');
INSERT INTO "project_members" ("project_key", "user_id", "role", "added_by", "added_at") VALUES ('PAY', 'u2', 'member', 'u5', '2026-09-08T09:00:00.000Z');
INSERT INTO "project_members" ("project_key", "user_id", "role", "added_by", "added_at") VALUES ('PAY', 'u4', 'member', 'u5', '2026-09-08T09:00:00.000Z');
INSERT INTO "project_members" ("project_key", "user_id", "role", "added_by", "added_at") VALUES ('PAY', 'u6', 'viewer', 'u5', '2026-09-08T09:00:00.000Z');
INSERT INTO "project_members" ("project_key", "user_id", "role", "added_by", "added_at") VALUES ('FIN', 'u1', 'admin', 'u3', '2026-09-18T09:00:00.000Z');
INSERT INTO "project_members" ("project_key", "user_id", "role", "added_by", "added_at") VALUES ('FIN', 'u6', 'member', 'u3', '2026-09-18T09:00:00.000Z');
INSERT INTO "project_members" ("project_key", "user_id", "role", "added_by", "added_at") VALUES ('FIN', 'u7', 'viewer', 'u3', '2026-10-08T09:00:00.000Z');

DROP TABLE IF EXISTS "site_settings";
CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO "site_settings" ("key", "value") VALUES ('site', '{"signup":"open","allowedDomains":["ahdfinancial.com"]}');

DROP TABLE IF EXISTS "audit_log";
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT,
  action TEXT NOT NULL,
  project_key TEXT,
  target TEXT,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

INSERT INTO "audit_log" ("id", "actor_id", "action", "project_key", "target", "details", "created_at") VALUES (1, 'u1', 'project.created', 'KAN', 'KAN', '{"name":"AHD Financial","type":"software"}', '2026-07-20T09:00:00.000Z');
INSERT INTO "audit_log" ("id", "actor_id", "action", "project_key", "target", "details", "created_at") VALUES (2, 'u5', 'project.created', 'PAY', 'PAY', '{"name":"Payments Platform","type":"software"}', '2026-09-03T09:00:00.000Z');
INSERT INTO "audit_log" ("id", "actor_id", "action", "project_key", "target", "details", "created_at") VALUES (3, 'u3', 'project.created', 'FIN', 'FIN', '{"name":"Finance Close","type":"business"}', '2026-09-13T09:00:00.000Z');
INSERT INTO "audit_log" ("id", "actor_id", "action", "project_key", "target", "details", "created_at") VALUES (4, 'u3', 'project.access_changed', 'FIN', 'FIN', '{"access":{"from":"open","to":"private"}}', '2026-09-14T09:00:00.000Z');
INSERT INTO "audit_log" ("id", "actor_id", "action", "project_key", "target", "details", "created_at") VALUES (5, 'u1', 'project.access_changed', 'KAN', 'KAN', '{"access":{"from":"open","to":"limited"}}', '2026-09-28T09:00:00.000Z');
INSERT INTO "audit_log" ("id", "actor_id", "action", "project_key", "target", "details", "created_at") VALUES (6, 'u1', 'member.role_changed', 'KAN', 'Sara Nasser', '{"userId":"u2","from":"member","to":"admin"}', '2026-09-29T09:00:00.000Z');
INSERT INTO "audit_log" ("id", "actor_id", "action", "project_key", "target", "details", "created_at") VALUES (7, 'u5', 'member.role_changed', 'PAY', 'Mona Farouk', '{"userId":"u6","from":null,"to":"viewer"}', '2026-10-03T09:00:00.000Z');
INSERT INTO "audit_log" ("id", "actor_id", "action", "project_key", "target", "details", "created_at") VALUES (8, 'u3', 'member.added', 'FIN', 'Khalid Mansour', '{"userId":"u7","role":"viewer"}', '2026-10-08T09:00:00.000Z');
INSERT INTO "audit_log" ("id", "actor_id", "action", "project_key", "target", "details", "created_at") VALUES (9, 'u1', 'user.invited', NULL, 'Khalid Mansour', '{"userId":"u7","email":"khalid@ahdfinancial.com","role":"member"}', '2026-10-08T09:00:00.000Z');
INSERT INTO "audit_log" ("id", "actor_id", "action", "project_key", "target", "details", "created_at") VALUES (10, 'u2', 'issue.deleted', 'KAN', 'KAN-31', '{"summary":"Spike: evaluate PDF rendering libraries"}', '2026-10-15T09:00:00.000Z');
INSERT INTO "audit_log" ("id", "actor_id", "action", "project_key", "target", "details", "created_at") VALUES (11, 'u1', 'billing.plan_changed', NULL, 'Premium', '{"from":"standard","to":"premium","cycle":"monthly"}', '2026-10-08T09:00:00.000Z');

DROP TABLE IF EXISTS "components";
CREATE TABLE components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_key TEXT NOT NULL REFERENCES projects(key) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  lead_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  default_assignee TEXT NOT NULL DEFAULT 'unassigned',
  created_at TEXT NOT NULL,
  UNIQUE (project_key, name)
);

INSERT INTO "components" ("id", "project_key", "name", "description", "lead_id", "default_assignee", "created_at") VALUES (1, 'KAN', 'Client Portal', 'Customer-facing onboarding and self-service portal.', 'u2', 'component_lead', '2026-08-09T09:00:00.000Z');
INSERT INTO "components" ("id", "project_key", "name", "description", "lead_id", "default_assignee", "created_at") VALUES (2, 'KAN', 'Payments', 'Card processing, refunds and the new gateway.', 'u5', 'component_lead', '2026-08-09T09:00:00.000Z');
INSERT INTO "components" ("id", "project_key", "name", "description", "lead_id", "default_assignee", "created_at") VALUES (3, 'KAN', 'Reporting', 'Regulatory and management reporting.', 'u3', 'component_lead', '2026-08-09T09:00:00.000Z');
INSERT INTO "components" ("id", "project_key", "name", "description", "lead_id", "default_assignee", "created_at") VALUES (4, 'KAN', 'Infrastructure', 'Environments, CI/CD and observability.', 'u4', 'unassigned', '2026-08-19T09:00:00.000Z');
INSERT INTO "components" ("id", "project_key", "name", "description", "lead_id", "default_assignee", "created_at") VALUES (5, 'PAY', 'Gateway', 'Integration with the new payment gateway.', 'u5', 'component_lead', '2026-09-08T09:00:00.000Z');
INSERT INTO "components" ("id", "project_key", "name", "description", "lead_id", "default_assignee", "created_at") VALUES (6, 'PAY', 'Payouts', 'Merchant payouts and reconciliation.', 'u3', 'project_lead', '2026-09-08T09:00:00.000Z');

DROP TABLE IF EXISTS "trash";
CREATE TABLE trash (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_key TEXT NOT NULL,
  issue_key TEXT NOT NULL,
  summary TEXT NOT NULL,
  type TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  files TEXT NOT NULL DEFAULT '[]',
  deleted_by TEXT,
  deleted_at TEXT NOT NULL
);

INSERT INTO "trash" ("id", "project_key", "issue_key", "summary", "type", "snapshot", "files", "deleted_by", "deleted_at") VALUES (1, 'KAN', 'KAN-31', 'Spike: evaluate PDF rendering libraries', 'Task', '{"issues":[{"id":47,"key":"KAN-31","num":31,"project_key":"KAN","type":"Task","summary":"Spike: evaluate PDF rendering libraries","description":"Superseded by the e-sign vendor decision.","status":"To Do","priority":"Medium","assignee_id":"u6","reporter_id":"u2","parent_id":null,"labels":"[\"spike\"]","due_date":null,"start_date":null,"story_points":null,"sprint":null,"rank":49152,"created_at":"2026-10-18T07:36:25.940Z","updated_at":"2026-10-18T07:36:25.940Z","resolved_at":null,"fix_version":null,"components":"[]","team_id":null,"original_estimate":null,"remaining_estimate":null,"time_spent":0}],"orphaned":[],"comments":[],"history":[{"id":86,"issue_id":47,"author_id":"u2","field":"created","from_value":null,"to_value":null,"created_at":"2026-10-18T07:36:25.940Z"}],"watchers":[{"issue_id":47,"user_id":"u2"},{"issue_id":47,"user_id":"u6"}],"attachments":[],"goal_issues":[],"dev_items":[],"worklogs":[],"votes":[],"issue_links":[]}', '[]', 'u2', '2026-10-15T09:00:00.000Z');

DROP TABLE IF EXISTS "teams";
CREATE TABLE teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#0C66E4',
  created_by TEXT,
  created_at TEXT NOT NULL
);

INSERT INTO "teams" ("id", "name", "description", "color", "created_by", "created_at") VALUES (1, 'Platform', 'Portal, infrastructure and developer experience.', '#0C66E4', 'u1', '2026-08-04T09:00:00.000Z');
INSERT INTO "teams" ("id", "name", "description", "color", "created_by", "created_at") VALUES (2, 'Payments Squad', 'Gateway migration, refunds and payouts.', '#E2483D', 'u5', '2026-09-03T09:00:00.000Z');
INSERT INTO "teams" ("id", "name", "description", "color", "created_by", "created_at") VALUES (3, 'Finance Ops', 'Month-end close, reconciliations and reporting.', '#22A06B', 'u3', '2026-09-13T09:00:00.000Z');

DROP TABLE IF EXISTS "team_members";
CREATE TABLE team_members (
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id)
);

INSERT INTO "team_members" ("team_id", "user_id") VALUES (1, 'u1');
INSERT INTO "team_members" ("team_id", "user_id") VALUES (1, 'u2');
INSERT INTO "team_members" ("team_id", "user_id") VALUES (1, 'u4');
INSERT INTO "team_members" ("team_id", "user_id") VALUES (1, 'u6');
INSERT INTO "team_members" ("team_id", "user_id") VALUES (2, 'u5');
INSERT INTO "team_members" ("team_id", "user_id") VALUES (2, 'u2');
INSERT INTO "team_members" ("team_id", "user_id") VALUES (3, 'u3');
INSERT INTO "team_members" ("team_id", "user_id") VALUES (3, 'u1');

DROP TABLE IF EXISTS "email_verifications";
CREATE TABLE email_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL COLLATE NOCASE,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  signup_token TEXT UNIQUE,
  used_at TEXT
);

DROP TABLE IF EXISTS "user_identities";
CREATE TABLE user_identities (
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TEXT NOT NULL,
  last_login_at TEXT,
  PRIMARY KEY (provider, subject)
);

INSERT INTO "user_identities" ("provider", "subject", "user_id", "email", "created_at", "last_login_at") VALUES ('google', 'demo_google_u1', 'u1', 'ahmed@ahdfinancial.com', '2026-10-18T11:00:55.625Z', '2026-10-18T11:00:55.625Z');

DROP TABLE IF EXISTS "oauth_states";
CREATE TABLE oauth_states (
  state TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'login',
  popup INTEGER NOT NULL DEFAULT 0,
  remember INTEGER NOT NULL DEFAULT 1,
  nonce TEXT,
  created_at TEXT NOT NULL
);

DROP TABLE IF EXISTS "subscription";
CREATE TABLE subscription (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  plan TEXT NOT NULL DEFAULT 'free',
  cycle TEXT NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'active',
  trial_ends_at TEXT,
  trial_used INTEGER NOT NULL DEFAULT 0,
  current_period_start TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  billing_email TEXT,
  company TEXT,
  updated_at TEXT
);

INSERT INTO "subscription" ("id", "plan", "cycle", "status", "trial_ends_at", "trial_used", "current_period_start", "current_period_end", "cancel_at_period_end", "billing_email", "company", "updated_at") VALUES (1, 'premium', 'monthly', 'active', NULL, 1, '2026-10-08T09:00:00.000Z', '2026-11-08T09:00:00.000Z', 0, 'billing@ahdfinancial.com', 'AHD Financial', '2026-10-08T09:00:00.000Z');

DROP TABLE IF EXISTS "payment_methods";
CREATE TABLE payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL,
  last4 TEXT NOT NULL,
  exp_month INTEGER NOT NULL,
  exp_year INTEGER NOT NULL,
  holder TEXT NOT NULL DEFAULT '',
  is_default INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

INSERT INTO "payment_methods" ("id", "brand", "last4", "exp_month", "exp_year", "holder", "is_default", "created_at") VALUES (1, 'Visa', '4242', 8, 2029, 'Ahmed Al-Haddad', 1, '2026-08-08T09:00:00.000Z');

DROP TABLE IF EXISTS "invoices";
CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  plan TEXT NOT NULL,
  cycle TEXT NOT NULL,
  seats INTEGER NOT NULL,
  lines TEXT NOT NULL DEFAULT '[]',
  subtotal_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  card TEXT
);

INSERT INTO "invoices" ("id", "number", "created_at", "period_start", "period_end", "plan", "cycle", "seats", "lines", "subtotal_cents", "total_cents", "status", "card") VALUES (1, 'MSR-2026-00001', '2026-08-08T09:00:00.000Z', '2026-08-08T09:00:00.000Z', '2026-09-08T09:00:00.000Z', 'standard', 'monthly', 7, '[{"description":"Standard plan (monthly) – 7 users × $7.53","amount":5271}]', 5271, 5271, 'paid', 'Visa •••• 4242');
INSERT INTO "invoices" ("id", "number", "created_at", "period_start", "period_end", "plan", "cycle", "seats", "lines", "subtotal_cents", "total_cents", "status", "card") VALUES (2, 'MSR-2026-00002', '2026-09-08T09:00:00.000Z', '2026-09-08T09:00:00.000Z', '2026-10-08T09:00:00.000Z', 'standard', 'monthly', 7, '[{"description":"Standard plan (monthly) – 7 users × $7.53","amount":5271}]', 5271, 5271, 'paid', 'Visa •••• 4242');
INSERT INTO "invoices" ("id", "number", "created_at", "period_start", "period_end", "plan", "cycle", "seats", "lines", "subtotal_cents", "total_cents", "status", "card") VALUES (3, 'MSR-2026-00003', '2026-10-08T09:00:00.000Z', '2026-10-08T09:00:00.000Z', '2026-11-08T09:00:00.000Z', 'premium', 'monthly', 7, '[{"description":"Premium plan (monthly) – 7 users × $13.53","amount":9471}]', 9471, 9471, 'paid', 'Visa •••• 4242');

DROP TABLE IF EXISTS "worklogs";
CREATE TABLE worklogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  started_at TEXT NOT NULL,
  time_spent INTEGER NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (1, 4, 'u2', '2026-10-17T06:00:00.000Z', 3600, 'Implementation', '2026-10-17T06:00:00.000Z', '2026-10-17T06:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (2, 6, 'u6', '2026-10-13T08:00:00.000Z', 10800, 'Pairing session', '2026-10-13T08:00:00.000Z', '2026-10-13T08:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (3, 6, 'u6', '2026-10-10T09:00:00.000Z', 16200, 'Investigated root cause', '2026-10-10T09:00:00.000Z', '2026-10-10T09:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (4, 6, 'u6', '2026-10-07T10:00:00.000Z', 3600, 'Wrote tests', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (5, 7, 'u2', '2026-10-11T09:00:00.000Z', 14400, 'Investigated root cause', '2026-10-11T09:00:00.000Z', '2026-10-11T09:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (6, 7, 'u2', '2026-10-08T10:00:00.000Z', 5400, 'Wrote tests', '2026-10-08T10:00:00.000Z', '2026-10-08T10:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (7, 8, 'u3', '2026-10-09T10:00:00.000Z', 3600, 'Wrote tests', '2026-10-09T10:00:00.000Z', '2026-10-09T10:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (8, 8, 'u3', '2026-10-06T11:00:00.000Z', 9000, 'Updated documentation', '2026-10-06T11:00:00.000Z', '2026-10-06T11:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (9, 8, 'u3', '2026-10-15T12:00:00.000Z', 10800, 'Deployed to staging', '2026-10-15T12:00:00.000Z', '2026-10-15T12:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (10, 9, 'u3', '2026-10-07T11:00:00.000Z', 7200, 'Updated documentation', '2026-10-07T11:00:00.000Z', '2026-10-07T11:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (11, 9, 'u3', '2026-10-16T12:00:00.000Z', 12600, 'Deployed to staging', '2026-10-16T12:00:00.000Z', '2026-10-16T12:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (12, 12, 'u2', '2026-10-13T07:00:00.000Z', 3600, 'Implementation', '2026-10-13T07:00:00.000Z', '2026-10-13T07:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (13, 12, 'u2', '2026-10-10T08:00:00.000Z', 9000, 'Code review fixes', '2026-10-10T08:00:00.000Z', '2026-10-10T08:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (14, 12, 'u2', '2026-10-07T09:00:00.000Z', 10800, 'Pairing session', '2026-10-07T09:00:00.000Z', '2026-10-07T09:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (15, 13, 'u5', '2026-10-11T08:00:00.000Z', 7200, 'Code review fixes', '2026-10-11T08:00:00.000Z', '2026-10-11T08:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (16, 13, 'u5', '2026-10-08T09:00:00.000Z', 12600, 'Pairing session', '2026-10-08T09:00:00.000Z', '2026-10-08T09:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (17, 16, 'u4', '2026-10-17T11:00:00.000Z', 3600, 'Wrote tests', '2026-10-17T11:00:00.000Z', '2026-10-17T11:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (18, 16, 'u4', '2026-10-14T12:00:00.000Z', 9000, 'Updated documentation', '2026-10-14T12:00:00.000Z', '2026-10-14T12:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (19, 16, 'u4', '2026-10-11T06:00:00.000Z', 10800, 'Deployed to staging', '2026-10-11T06:00:00.000Z', '2026-10-11T06:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (20, 17, 'u4', '2026-10-15T12:00:00.000Z', 7200, 'Updated documentation', '2026-10-15T12:00:00.000Z', '2026-10-15T12:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (21, 17, 'u4', '2026-10-12T06:00:00.000Z', 12600, 'Deployed to staging', '2026-10-12T06:00:00.000Z', '2026-10-12T06:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (22, 18, 'u6', '2026-10-13T06:00:00.000Z', 10800, 'Deployed to staging', '2026-10-13T06:00:00.000Z', '2026-10-13T06:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (23, 21, 'u3', '2026-10-07T09:00:00.000Z', 7200, 'Code review fixes', '2026-10-07T09:00:00.000Z', '2026-10-07T09:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (24, 21, 'u3', '2026-10-16T10:00:00.000Z', 12600, 'Pairing session', '2026-10-16T10:00:00.000Z', '2026-10-16T10:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (25, 21, 'u3', '2026-10-13T11:00:00.000Z', 14400, 'Investigated root cause', '2026-10-13T11:00:00.000Z', '2026-10-13T11:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (26, 22, 'u6', '2026-10-17T10:00:00.000Z', 10800, 'Pairing session', '2026-10-17T10:00:00.000Z', '2026-10-17T10:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (27, 22, 'u6', '2026-10-14T11:00:00.000Z', 16200, 'Investigated root cause', '2026-10-14T11:00:00.000Z', '2026-10-14T11:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (28, 22, 'u6', '2026-10-11T12:00:00.000Z', 3600, 'Wrote tests', '2026-10-11T12:00:00.000Z', '2026-10-11T12:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (29, 23, 'u1', '2026-10-15T11:00:00.000Z', 14400, 'Investigated root cause', '2026-10-15T11:00:00.000Z', '2026-10-15T11:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (30, 23, 'u1', '2026-10-12T12:00:00.000Z', 5400, 'Wrote tests', '2026-10-12T12:00:00.000Z', '2026-10-12T12:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (31, 28, 'u3', '2026-10-17T09:00:00.000Z', 3600, 'Implementation', '2026-10-17T09:00:00.000Z', '2026-10-17T09:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (32, 30, 'u4', '2026-10-13T11:00:00.000Z', 10800, 'Pairing session', '2026-10-13T11:00:00.000Z', '2026-10-13T11:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (33, 30, 'u4', '2026-10-10T12:00:00.000Z', 16200, 'Investigated root cause', '2026-10-10T12:00:00.000Z', '2026-10-10T12:00:00.000Z');
INSERT INTO "worklogs" ("id", "issue_id", "author_id", "started_at", "time_spent", "comment", "created_at", "updated_at") VALUES (34, 30, 'u4', '2026-10-07T06:00:00.000Z', 3600, 'Wrote tests', '2026-10-07T06:00:00.000Z', '2026-10-07T06:00:00.000Z');

DROP TABLE IF EXISTS "votes";
CREATE TABLE votes (
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (issue_id, user_id)
);

INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (4, 'u2', '2026-10-16T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (5, 'u2', '2026-10-15T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (5, 'u3', '2026-10-14T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (7, 'u2', '2026-10-14T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (7, 'u3', '2026-10-13T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (9, 'u2', '2026-10-13T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (9, 'u3', '2026-10-12T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (9, 'u4', '2026-10-11T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (9, 'u5', '2026-10-10T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (10, 'u2', '2026-10-12T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (11, 'u2', '2026-10-16T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (13, 'u3', '2026-10-14T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (13, 'u4', '2026-10-13T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (14, 'u2', '2026-10-14T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (14, 'u3', '2026-10-13T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (14, 'u4', '2026-10-12T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (14, 'u5', '2026-10-11T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (17, 'u2', '2026-10-12T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (17, 'u3', '2026-10-11T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (18, 'u2', '2026-10-16T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (18, 'u4', '2026-10-14T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (19, 'u2', '2026-10-15T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (19, 'u3', '2026-10-14T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (19, 'u4', '2026-10-13T09:00:00.000Z');
INSERT INTO "votes" ("issue_id", "user_id", "created_at") VALUES (19, 'u5', '2026-10-12T09:00:00.000Z');

DROP TABLE IF EXISTS "automation_rules";
CREATE TABLE automation_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_key TEXT NOT NULL REFERENCES projects(key) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  trigger TEXT NOT NULL,
  condition TEXT NOT NULL DEFAULT '',
  actions TEXT NOT NULL DEFAULT '[]',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO "automation_rules" ("id", "project_key", "name", "description", "enabled", "trigger", "condition", "actions", "created_by", "created_at", "updated_at") VALUES (1, 'KAN', 'Assign new bugs using balanced workload', 'Spreads incoming bugs across the team.', 1, '{"type":"issue_created"}', 'type = Bug AND assignee IS EMPTY', '[{"type":"assign","to":"balanced"},{"type":"comment","body":"Assigned to {{issue.assignee.displayName}} automatically (balanced workload)."}]', 'u2', '2026-09-28T09:00:00.000Z', '2026-09-28T09:00:00.000Z');
INSERT INTO "automation_rules" ("id", "project_key", "name", "description", "enabled", "trigger", "condition", "actions", "created_by", "created_at", "updated_at") VALUES (2, 'KAN', 'Label urgent work when priority becomes Highest', '', 1, '{"type":"field_changed","field":"priority"}', 'priority = Highest', '[{"type":"add_label","label":"urgent"},{"type":"add_watcher","userId":"u2"}]', 'u2', '2026-09-28T09:00:00.000Z', '2026-09-28T09:00:00.000Z');
INSERT INTO "automation_rules" ("id", "project_key", "name", "description", "enabled", "trigger", "condition", "actions", "created_by", "created_at", "updated_at") VALUES (3, 'KAN', 'When work moves to In Review, comment for the reporter', '', 0, '{"type":"issue_transitioned","to":"In Review"}', '', '[{"type":"comment","body":"{{issue.key}} is ready for review, {{issue.reporter.displayName}}."}]', 'u1', '2026-09-28T09:00:00.000Z', '2026-09-28T09:00:00.000Z');

DROP TABLE IF EXISTS "automation_runs";
CREATE TABLE automation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  issue_key TEXT,
  status TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  actions TEXT NOT NULL DEFAULT '[]',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

INSERT INTO "automation_runs" ("id", "rule_id", "issue_key", "status", "message", "actions", "duration_ms", "created_at") VALUES (1, 1, 'KAN-27', 'success', 'Assign work item: Assigned to Layla Hassan · Comment on work item: Comment added', '[{"type":"assign","ok":true,"detail":"Assigned to Layla Hassan"},{"type":"comment","ok":true,"detail":"Comment added"}]', 41, '2026-10-12T09:00:00.000Z');
INSERT INTO "automation_runs" ("id", "rule_id", "issue_key", "status", "message", "actions", "duration_ms", "created_at") VALUES (2, 1, 'KAN-29', 'no_actions', 'The work item didn’t match the rule’s condition.', '[]', 6, '2026-10-14T09:00:00.000Z');
INSERT INTO "automation_runs" ("id", "rule_id", "issue_key", "status", "message", "actions", "duration_ms", "created_at") VALUES (3, 2, 'KAN-12', 'success', 'Add label: Added label urgent · Add watcher: Added Sara Nasser as a watcher', '[{"type":"add_label","ok":true,"detail":"Added label urgent"},{"type":"add_watcher","ok":true,"detail":"Added Sara Nasser as a watcher"}]', 23, '2026-10-16T09:00:00.000Z');
INSERT INTO "automation_runs" ("id", "rule_id", "issue_key", "status", "message", "actions", "duration_ms", "created_at") VALUES (4, 3, 'KAN-8', 'success', 'Comment on work item: Comment added', '[{"type":"comment","ok":true,"detail":"Comment added"}]', 18, '2026-10-09T09:00:00.000Z');

DROP TABLE IF EXISTS "webhooks";
CREATE TABLE webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL DEFAULT '',
  events TEXT NOT NULL DEFAULT '[]',
  jql TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO "webhooks" ("id", "name", "url", "secret", "events", "jql", "enabled", "created_by", "created_at", "updated_at") VALUES (1, 'Finance data warehouse sync', 'https://hooks.example.com/masar/issues', 'change-me', '["jira:issue_created","jira:issue_updated","jira:issue_deleted"]', 'project = KAN', 0, 'u1', '2026-10-03T09:00:00.000Z', '2026-10-03T09:00:00.000Z');

DROP TABLE IF EXISTS "webhook_deliveries";
CREATE TABLE webhook_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  uuid TEXT NOT NULL,
  event TEXT NOT NULL,
  payload TEXT NOT NULL,
  status_code INTEGER,
  ok INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  response TEXT,
  attempt INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

INSERT OR REPLACE INTO "users" ("id", "name", "email", "color", "password_hash", "role", "active", "title", "created_at", "email_verified", "signup_source")
VALUES ('u0', 'Amjad Alhakimi', 'amgdadel7@gmail.com', '#0C66E4', 'ce203c9ef437af984c53c6eca858a82f:86f7d8176d402b2c56e61eba42e101159dfcb1165f3c820be6b5fe9e01c43947', 'admin', 1, 'Site Administrator', '2026-10-20T16:32:58.369Z', 1, 'system');
INSERT OR IGNORE INTO "project_members" ("project_key", "user_id", "role", "added_by", "added_at")
VALUES ('KAN', 'u0', 'admin', 'u0', '2026-10-20T16:32:58.369Z');

PRAGMA foreign_keys = ON;
