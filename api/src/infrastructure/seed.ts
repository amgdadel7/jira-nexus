import bcrypt from 'bcryptjs'
import type { Issue, Project, Sprint, User } from '../domain/entities.ts'
import { db, insertNotification, insertProject, isEmpty, users, workspace } from './sqlite.ts'
import { seedPeople } from './seed_people.ts'

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function seedIfNeeded() {
  if (!isEmpty()) return
  const rand = mulberry32(20261013)
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]!
  const between = (a: number, b: number) => Math.floor(rand() * (b - a + 1)) + a
  const iso = (d: Date) => d.toISOString()
  const daysAgo = (n: number) => {
    const d = new Date('2026-10-13T09:00:00.000Z')
    d.setUTCDate(d.getUTCDate() - n)
    return d
  }
  const daysFrom = (n: number) => {
    const d = new Date('2026-10-13T09:00:00.000Z')
    d.setUTCDate(d.getUTCDate() + n)
    return d
  }

  const people = seedPeople

  const COLORS = ['#0E8F86', '#2563EB', '#C2410C', '#7C3AED', '#0F766E', '#0369A1']
  const SKILLS = ['TypeScript', 'React', 'Flutter', 'C#', 'PostgreSQL', 'Python', 'Go']
  const hash = bcrypt.hashSync('demo1234', 10)
  const org = 'org_acme'

  const userList: User[] = people.map((p, i) => {
    const [first, ...rest] = p.name.split(' ')
    const last = rest.join('').toLowerCase().replace(/[^a-z]/g, '')
    const u: User = {
      id: `usr_${String(i + 1).padStart(3, '0')}`,
      organizationId: org,
      name: p.name,
      email: i === 0 ? 'zoe.m@example.net' : `${first!.toLowerCase()}.${last}@acme.digital`,
      role: p.role,
      title: p.title,
      department: p.dept,
      skills: SKILLS.slice(0, 3),
      capacity: 40,
      workload: between(8, 38),
      presence: i === 0 ? 'active' : 'active',
      color: COLORS[i % COLORS.length]!,
      joinedAt: iso(daysAgo(between(60, 400))),
      emailVerified: true,
    }
    users.save(u, hash)
    return u
  })

  const defs = [
    { name: 'Nexus Core', key: 'NEX', category: 'Platform', desc: 'Shared identity and workflow engine.' },
    { name: 'Mobile App', key: 'MOB', category: 'Mobile', desc: 'iOS and Android offline-first client.' },
    { name: 'Customer Portal', key: 'WEB', category: 'Web', desc: 'Self-serve portal for billing and tickets.' },
    { name: 'Payments', key: 'PAY', category: 'Fintech', desc: 'Card processing and ledger.' },
    { name: 'Analytics', key: 'ANL', category: 'Data', desc: 'Warehouse and executive dashboards.' },
    { name: 'Infrastructure', key: 'INF', category: 'Platform', desc: 'Kubernetes and CI/CD.' },
    { name: 'Design System', key: 'DS', category: 'Design', desc: 'Nexus UI kit and tokens.' },
    { name: 'AI Insights', key: 'AI', category: 'AI', desc: 'Risk and assignment models.' },
    { name: 'Security', key: 'SEC', category: 'Security', desc: 'SSO, audit, compliance.' },
    { name: 'Marketplace', key: 'MKT', category: 'Growth', desc: 'Public API and app directory.' },
  ]

  const projects: Project[] = defs.map((d, i) => {
    const lead = userList[i % 8]!
    const members = userList.slice(i, i + 10).map((u) => u.id)
    if (!members.includes(lead.id)) members.unshift(lead.id)
    const p: Project = {
      id: `prj_${d.key.toLowerCase()}`,
      organizationId: org,
      name: d.name,
      key: d.key,
      description: d.desc,
      status: 'active',
      startDate: iso(daysAgo(120)),
      endDate: iso(daysFrom(90)),
      progress: between(28, 92),
      leadId: lead.id,
      memberIds: members,
      category: d.category,
      color: COLORS[i % COLORS.length]!,
    }
    insertProject(p)
    return p
  })

  const sprints: Sprint[] = [
    { id: 'spr_nex_14', projectId: 'prj_nex', name: 'NEX Sprint 14', goal: 'Ship tenant-aware search and RBAC.', startDate: iso(daysAgo(8)), endDate: iso(daysFrom(6)), status: 'active', committedPoints: 42, completedPoints: 21 },
    { id: 'spr_mob_9', projectId: 'prj_mob', name: 'MOB Sprint 9', goal: 'Offline board cache.', startDate: iso(daysAgo(5)), endDate: iso(daysFrom(9)), status: 'active', committedPoints: 34, completedPoints: 12 },
    { id: 'spr_web_11', projectId: 'prj_web', name: 'WEB Sprint 11', goal: 'Billing v2.', startDate: iso(daysAgo(3)), endDate: iso(daysFrom(11)), status: 'active', committedPoints: 38, completedPoints: 9 },
    { id: 'spr_pay_7', projectId: 'prj_pay', name: 'PAY Sprint 7', goal: 'Idempotent capture.', startDate: iso(daysAgo(4)), endDate: iso(daysFrom(10)), status: 'active', committedPoints: 29, completedPoints: 14 },
    { id: 'spr_ai_3', projectId: 'prj_ai', name: 'AI Sprint 3', goal: 'Risk model v2.', startDate: iso(daysAgo(6)), endDate: iso(daysFrom(8)), status: 'active', committedPoints: 31, completedPoints: 11 },
  ]
  sprints.forEach((s) => workspace.saveSprint(s))

  const titles = [
    'Implement JWT refresh token rotation',
    'Tenant-aware global issue search',
    'Board reorder race condition',
    'Offline Kanban cache on mobile',
    'Workspace switcher redesign',
    'Smart task assignment',
    'Sprint risk prediction widget',
    'Accessible keyboard shortcuts',
    'Arabic and English locale packs',
    'SignalR presence indicators',
  ]
  const statuses: Issue['status'][] = ['backlog', 'todo', 'in_progress', 'review', 'testing', 'done']
  const types: Issue['type'][] = ['story', 'task', 'bug', 'epic', 'subtask']
  const pris: Issue['priority'][] = ['low', 'medium', 'high', 'critical', 'lowest']

  for (let i = 0; i < 100; i++) {
    const project = projects[i % projects.length]!
    const issue: Issue = {
      id: `iss_${String(i + 1).padStart(3, '0')}`,
      key: `${project.key}-${i + 12}`,
      projectId: project.id,
      sprintId: statuses[i % 6] !== 'backlog' && i % 3 !== 0 ? sprints[i % sprints.length]?.id : undefined,
      type: types[i % types.length]!,
      title: titles[i % titles.length]!,
      description: 'Acceptance criteria agreed with product.',
      status: statuses[i % statuses.length]!,
      priority: pris[i % pris.length]!,
      assigneeId: pick(userList).id,
      reporterId: pick(userList).id,
      labels: ['platform'],
      storyPoints: [1, 2, 3, 5, 8][i % 5],
      dueDate: i % 3 === 0 ? iso(daysFrom((i % 18) - 4)) : undefined,
      createdAt: iso(daysAgo(between(1, 40))),
      updatedAt: iso(daysAgo(between(0, 10))),
      rank: i,
    }
    workspace.saveIssue(issue)
  }

  for (let i = 0; i < 24; i++) {
    const issue = workspace.listIssues()[i]!
    workspace.addActivity({
      id: `act_${i}`,
      userId: pick(userList).id,
      action: `updated ${issue.key}`,
      issueKey: issue.key,
      projectId: issue.projectId,
      timestamp: iso(daysAgo(0)),
    })
  }

  insertNotification({
    id: 'n1',
    userId: 'usr_001',
    title: 'You were assigned NEX-18',
    body: 'Elena Rossi assigned JWT refresh token rotation to you.',
    read: false,
    createdAt: new Date().toISOString(),
    type: 'assignment',
  })
  insertNotification({
    id: 'n2',
    userId: 'usr_001',
    title: 'Sprint 14 is at 50%',
    body: 'NEX Sprint 14 has 21 of 42 points done. Review spillover on search.',
    read: false,
    createdAt: new Date().toISOString(),
    type: 'sprint',
  })
  insertNotification({
    id: 'n3',
    userId: 'usr_001',
    title: 'Comment on NEX-12',
    body: 'Elena Rossi: Acceptance looks good. Keep RTL in the board chrome.',
    read: true,
    createdAt: new Date().toISOString(),
    type: 'comment',
  })

  const seededIssues = workspace.listIssues().slice(0, 20)
  seededIssues.forEach((issue, i) => {
    workspace.addComment({
      id: `cmt_seed_${i}`,
      issueId: issue.id,
      authorId: userList[2 + (i % 6)]!.id,
      body: i % 2 === 0 ? 'Acceptance looks good. Please keep RTL in the board chrome.' : 'Ready for review after the API contract freeze.',
      createdAt: iso(daysAgo(i % 5)),
    })
  })

  console.log('Seeded workspace: 50 users, 10 projects, 100 issues')
}

export function ensureDemoFixes() {
  const admin = db.prepare('SELECT email FROM users WHERE id = ?').get('usr_001') as { email: string } | undefined
  if (admin && admin.email !== 'zoe.m@example.net') {
    const taken = db.prepare('SELECT id FROM users WHERE email = ?').get('zoe.m@example.net') as { id: string } | undefined
    if (!taken) db.prepare('UPDATE users SET email = ? WHERE id = ?').run('zoe.m@example.net', 'usr_001')
  }

  const missingDue = db.prepare('SELECT id FROM issues WHERE due_date IS NULL').all() as { id: string }[]
  missingDue.forEach((row, i) => {
    if (i % 3 !== 0) return
    const d = new Date('2026-10-13T09:00:00.000Z')
    d.setUTCDate(d.getUTCDate() + (i % 18) - 4)
    db.prepare('UPDATE issues SET due_date = ? WHERE id = ?').run(d.toISOString(), row.id)
  })

  const comments = db.prepare('SELECT COUNT(*) AS c FROM comments').get() as { c: number }
  if (comments.c === 0) {
    const rows = db.prepare('SELECT id FROM issues LIMIT 20').all() as { id: string }[]
    rows.forEach((iss, i) => {
      db.prepare('INSERT INTO comments VALUES (?,?,?,?,?)').run(
        `cmt_fix_${i}`,
        iss.id,
        'usr_003',
        i % 2 === 0
          ? 'Acceptance looks good. Please keep RTL in the board chrome.'
          : 'Ready for review after the API contract freeze.',
        new Date().toISOString(),
      )
    })
  }

  const notes = db.prepare('SELECT COUNT(*) AS c FROM notifications').get() as { c: number }
  if (notes.c < 3) {
    insertNotification({
      id: 'n2',
      userId: 'usr_001',
      title: 'Sprint 14 is at 50%',
      body: 'NEX Sprint 14 has 21 of 42 points done. Review spillover on search.',
      read: false,
      createdAt: new Date().toISOString(),
      type: 'sprint',
    })
    insertNotification({
      id: 'n3',
      userId: 'usr_001',
      title: 'Comment on NEX-12',
      body: 'Elena Rossi: Acceptance looks good. Keep RTL in the board chrome.',
      read: true,
      createdAt: new Date().toISOString(),
      type: 'comment',
    })
  }
}
