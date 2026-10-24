// Civic Resolve AI: Aggregate Synthetic Analytics API Routes
// Enforces PRD FR-12: Aggregate only, privacy-safe, clearly labelled synthetic data.

const express = require('express');
const router = express.Router();
const db = require('../db');

// Public or signed-in aggregate analytics endpoint
router.get('/summary', (req, res) => {
  // Aggregate report stats
  const totalReports = db.get('SELECT COUNT(*) as c FROM reports').c;
  const resolvedReports = db.get("SELECT COUNT(*) as c FROM reports WHERE status = 'Resolved'").c;
  const inProgressReports = db.get("SELECT COUNT(*) as c FROM reports WHERE status = 'In Progress'").c;
  const pendingReports = db.get("SELECT COUNT(*) as c FROM reports WHERE status IN ('Submitted', 'Under Review', 'Assigned')").c;
  const duplicateReports = db.get("SELECT COUNT(*) as c FROM reports WHERE status = 'Duplicate'").c;

  // Category distribution
  const categoryStats = db.all(`
    SELECT c.name, COUNT(r.id) as count
    FROM categories c
    LEFT JOIN reports r ON r.category_id = c.id
    GROUP BY c.id, c.name
    ORDER BY count DESC
  `);

  // Priority distribution
  const priorityStats = db.all(`
    SELECT priority_level, COUNT(*) as count
    FROM reports
    GROUP BY priority_level
  `);

  // Department workload distribution
  const departmentStats = db.all(`
    SELECT d.name, 
           COUNT(r.id) as total_assigned,
           COUNT(CASE WHEN r.status = 'Resolved' THEN 1 END) as resolved_count,
           COUNT(CASE WHEN r.status IN ('Assigned', 'In Progress', 'Blocked') THEN 1 END) as active_count
    FROM departments d
    LEFT JOIN reports r ON r.department_id = d.id
    GROUP BY d.id, d.name
    ORDER BY active_count DESC
  `);

  // Resolution Rate
  const resolutionRate = totalReports > 0 ? Math.round((resolvedReports / totalReports) * 100) : 72;

  // Synthetic monthly trend (aligned with Reference Screen 9)
  const monthlyTrend = [
    { month: 'Jan', reported: 150, resolved: 110 },
    { month: 'Feb', reported: 190, resolved: 140 },
    { month: 'Mar', reported: 230, resolved: 180 },
    { month: 'Apr', reported: 280, resolved: 210 },
    { month: 'May', reported: 320, resolved: 260 },
    { month: 'Jun', reported: 356, resolved: 290 }
  ];

  res.json({
    isSyntheticDemoData: true,
    disclaimer: 'Demonstration metrics based on synthetic demo data for prototype evaluation. Not an official municipal measurement.',
    kpis: {
      totalIssues: totalReports + 1236, // Scaled for demo presentation matching reference UI (1,248)
      pendingIssues: pendingReports + 350,
      inProgressIssues: inProgressReports + 636,
      resolvedIssues: resolvedReports + 886,
      resolutionRate: `${resolutionRate}%`,
      avgResolutionDays: 12,
      duplicatesLinked: duplicateReports + 42,
      improvementRate: '+15%'
    },
    categoryDistribution: categoryStats,
    priorityDistribution: priorityStats,
    departmentWorkload: departmentStats,
    monthlyTrend
  });
});

module.exports = router;
