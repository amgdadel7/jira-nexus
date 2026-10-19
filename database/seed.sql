-- Demo Seed Data for Masar Jira Clone
INSERT INTO users (id, name, email, color, role, title, password_hash, active, created_at) VALUES
  ('u1', 'Ahmed Al-Haddad', 'ahmed@ahdfinancial.com', '#0052CC', 'admin', 'Head of Finance Engineering', '1d22e4cedf564977dd5cbd44557a6443:9eebbd412dddc9c2e92f7410169ff40a2662f9743e2e1421560eddcd1d675ba3', true, now() - interval '60 days'),
  ('u2', 'Sara Nasser', 'sara@ahdfinancial.com', '#6554C0', 'member', 'Senior Software Engineer', '1d22e4cedf564977dd5cbd44557a6443:9eebbd412dddc9c2e92f7410169ff40a2662f9743e2e1421560eddcd1d675ba3', true, now() - interval '60 days'),
  ('u3', 'Omar Saleh', 'omar@ahdfinancial.com', '#00875A', 'member', 'Financial Controller', '1d22e4cedf564977dd5cbd44557a6443:9eebbd412dddc9c2e92f7410169ff40a2662f9743e2e1421560eddcd1d675ba3', true, now() - interval '60 days'),
  ('u4', 'Layla Hassan', 'layla@ahdfinancial.com', '#FF5630', 'member', 'DevOps Engineer', '1d22e4cedf564977dd5cbd44557a6443:9eebbd412dddc9c2e92f7410169ff40a2662f9743e2e1421560eddcd1d675ba3', true, now() - interval '60 days'),
  ('u5', 'Yusuf Karim', 'yusuf@ahdfinancial.com', '#FF991F', 'member', 'Payments Engineer', '1d22e4cedf564977dd5cbd44557a6443:9eebbd412dddc9c2e92f7410169ff40a2662f9743e2e1421560eddcd1d675ba3', true, now() - interval '60 days'),
  ('u6', 'Mona Farouk', 'mona@ahdfinancial.com', '#00B8D9', 'member', 'Product Designer', '1d22e4cedf564977dd5cbd44557a6443:9eebbd412dddc9c2e92f7410169ff40a2662f9743e2e1421560eddcd1d675ba3', true, now() - interval '60 days'),
  ('u7', 'Khalid Mansour', 'khalid@ahdfinancial.com', '#8777D9', 'member', 'External Auditor', '1d22e4cedf564977dd5cbd44557a6443:9eebbd412dddc9c2e92f7410169ff40a2662f9743e2e1421560eddcd1d675ba3', true, now() - interval '60 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (key, name, type, description, lead_id, color, category, access, workflow_id, custom_permissions, board_swimlanes, next_num, created_at) VALUES
  ('KAN', 'AHD Financial', 'software', 'Finance engineering work for AHD Financial: client portal, payments and regulatory reporting.', 'u1', '#FFAB00', 'Engineering', 'open', 1, false, 'none', 16, now() - interval '90 days'),
  ('PAY', 'Payments Platform', 'software', 'Card processing, payouts and the new payment gateway.', 'u5', '#0C66E4', 'Engineering', 'open', 1, false, 'none', 11, now() - interval '45 days')
ON CONFLICT (key) DO NOTHING;

INSERT INTO sprints (id, project_key, name, goal, state, position, created_at) VALUES
  (1, 'KAN', 'KAN Sprint 1', 'Initial foundation', 'closed', 1, now() - interval '40 days'),
  (2, 'KAN', 'KAN Sprint 2', 'Core portal features', 'closed', 2, now() - interval '26 days'),
  (3, 'KAN', 'KAN Sprint 3', 'Payments integration', 'active', 3, now() - interval '12 days'),
  (4, 'KAN', 'KAN Sprint 4', 'Security & Audit', 'future', 4, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO issues (id, key, num, project_key, issue_type_id, summary, description, status_id, priority_id, assignee_id, reporter_id, sprint_id, rank, created_at, updated_at) VALUES
  (1, 'KAN-1', 1, 'KAN', 1, 'Client onboarding portal', 'Self-service portal where new clients can submit KYC documents.', 2, 2, 'u1', 'u1', 3, 1024, now() - interval '30 days', now()),
  (2, 'KAN-2', 2, 'KAN', 1, 'Q4 regulatory reporting', 'All work needed to file Q4 regulatory reports on time.', 1, 1, 'u3', 'u1', 3, 2048, now() - interval '25 days', now()),
  (3, 'KAN-3', 3, 'KAN', 2, 'KYC document upload component', 'Support PDF, JPG and PNG files up to 10 MB.', 2, 2, 'u2', 'u1', 3, 3072, now() - interval '20 days', now()),
  (4, 'KAN-4', 4, 'KAN', 3, 'Configure CI/CD deployment pipeline', 'Automated build and test runner on push to main.', 4, 3, 'u4', 'u1', 3, 4096, now() - interval '15 days', now())
ON CONFLICT (id) DO NOTHING;
