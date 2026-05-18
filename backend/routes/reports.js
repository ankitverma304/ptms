const express = require('express');
const r    = express.Router();
const ctrl = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');
r.use(authenticate);

r.get('/user-performance',              authorize('project_manager'), ctrl.userPerformance);
r.get('/bug-analytics',                 authorize('team_lead'),       ctrl.bugAnalytics);
r.get('/time-tracking',                 authorize('project_manager'), ctrl.timeTracking);
r.get('/leaderboard',                                                  ctrl.leaderboard);
r.get('/project-progress/:project_id',                                 ctrl.projectProgress);
r.get('/user/:userId/timeline',                                        ctrl.userTimeline);

module.exports = r;
