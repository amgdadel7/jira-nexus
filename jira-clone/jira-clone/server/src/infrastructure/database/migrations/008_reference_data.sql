-- 008 · Built-in reference data the application needs to run (not demo data).

INSERT INTO issue_types (name, description, icon, color, hierarchy_level, position, system) VALUES
  ('Epic',    'A big piece of work that groups stories, tasks and bugs.', 'epic',    '#904EE2', 1,  0, true),
  ('Story',   'A user-facing feature or requirement.',                     'story',   '#63BA3C', 0,  1, true),
  ('Task',    'A small, distinct piece of work.',                          'task',    '#4BADE8', 0,  2, true),
  ('Bug',     'A problem that impairs or prevents functionality.',         'bug',     '#E5493A', 0,  3, true),
  ('Subtask', 'A smaller piece of a story, task or bug.',                  'subtask', '#4BADE8', -1, 4, true);

INSERT INTO priorities (name, description, color, icon, position, is_default) VALUES
  ('Highest', 'Blocks progress; needs attention right away.', '#C9372C', 'highest', 0, false),
  ('High',    'Serious problem that could block progress.',    '#E2483D', 'high',    1, false),
  ('Medium',  'Has the potential to affect progress.',         '#E2B203', 'medium',  2, true),
  ('Low',     'Minor problem or easily worked around.',        '#2898BD', 'low',     3, false),
  ('Lowest',  'Trivial problem with little or no impact.',     '#1D7AFC', 'lowest',  4, false);

INSERT INTO resolutions (name, description, position, is_default) VALUES
  ('Done',             'Work has been completed.',                       0, true),
  ('Won''t Do',        'This will not be worked on.',                    1, false),
  ('Duplicate',        'The problem is a duplicate of existing work.',   2, false),
  ('Cannot Reproduce', 'The problem could not be reproduced.',           3, false);

INSERT INTO statuses (name, description, category) VALUES
  ('To Do',       'Work that has not been started.',       'todo'),
  ('In Progress', 'Work that is actively being done.',     'in_progress'),
  ('In Review',   'Work waiting for review or approval.',  'in_progress'),
  ('Done',        'Work that has been completed.',         'done');

INSERT INTO workflows (name, description, is_default) VALUES
  ('Software simplified workflow', 'Work can move freely between all statuses.', true);

INSERT INTO workflow_statuses (workflow_id, status_id, position, is_initial)
SELECT w.id, s.id, x.pos, x.pos = 0
FROM workflows w
CROSS JOIN (VALUES ('To Do', 0), ('In Progress', 1), ('In Review', 2), ('Done', 3)) AS x (name, pos)
JOIN statuses s ON s.name = x.name
WHERE w.is_default;

-- Simplified workflow: one global transition into every status ("any status → X").
INSERT INTO workflow_transitions (workflow_id, name, from_status_id, to_status_id, position)
SELECT ws.workflow_id, s.name, NULL, s.id, ws.position
FROM workflow_statuses ws JOIN statuses s ON s.id = ws.status_id;

-- System actor used by automation rules ("Automation for Masar"). Inactive: it cannot sign in or take a seat.
INSERT INTO users (id, name, email, color, role, active, title, bot, signup_source)
VALUES ('automation', 'Automation for Masar', 'automation@masar.invalid', '#1D7AFC', 'member', false, 'Automation', true, 'seed');

-- The site's subscription starts on the Free plan.
INSERT INTO subscription (id, plan, cycle, status) VALUES (1, 'free', 'monthly', 'active');
