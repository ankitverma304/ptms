const express  = require('express');
const router   = express.Router();
const rateLimit = require('express-rate-limit');
const { body, param, query } = require('express-validator');

const { authenticate, authorize, authorizeMin, requireProjectMember } = require('../middleware/auth');

const authC    = require('../controllers/authController');
const projC    = require('../controllers/projectController');
const tickC    = require('../controllers/ticketController');
const timeC    = require('../controllers/timeLogController');
const commC    = require('../controllers/commentController');
const reptC    = require('../controllers/reportController');
const userC    = require('../controllers/userController');

// ── Rate limiters ─────────────────────────────────────────────
const loginLimiter = rateLimit({ windowMs: 60_000, max: 5, message: { success: false, message: 'Too many login attempts' } });

// ── Validation helper ─────────────────────────────────────────
const validate = require('../middleware/validate');  // see validate.js

// ═══════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════
router.post('/auth/register', [
  body('name').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
], validate, authC.register);

router.post('/auth/login',    loginLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], validate, authC.login);

router.post('/auth/refresh',  authC.refresh);
router.post('/auth/logout',   authC.logout);
router.get ('/auth/me',       authenticate, authC.me);

// ═══════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════
router.get   ('/users',                   authenticate, authorizeMin('team_lead'), userC.list);
router.get   ('/users/:id',               authenticate, userC.get);
router.put   ('/users/:id',               authenticate, userC.update);
router.post  ('/users/change-password',   authenticate, userC.changePassword);
router.get   ('/users/me/notifications',  authenticate, userC.notifications);
router.post  ('/users/me/notifications/read', authenticate, userC.markRead);

// ═══════════════════════════════════════════════════════════════
// PROJECTS
// ═══════════════════════════════════════════════════════════════
router.get   ('/projects',            authenticate, projC.list);
router.get   ('/projects/:id',        authenticate, requireProjectMember, projC.get);
router.post  ('/projects',            authenticate, authorizeMin('project_manager'), [
  body('name').trim().notEmpty().isLength({ max: 200 }),
], validate, projC.create);
router.put   ('/projects/:id',        authenticate, authorizeMin('project_manager'), projC.update);
router.delete('/projects/:id',        authenticate, authorize('super_admin','admin'), projC.remove);
router.get   ('/projects/:id/dashboard', authenticate, requireProjectMember, projC.dashboard);
router.post  ('/projects/:id/members',   authenticate, authorizeMin('project_manager'), projC.addMember);
router.delete('/projects/:id/members/:userId', authenticate, authorizeMin('project_manager'), projC.removeMember);

// ═══════════════════════════════════════════════════════════════
// TICKETS
// ═══════════════════════════════════════════════════════════════
router.get   ('/projects/:projectId/tickets', authenticate, requireProjectMember, tickC.list);

router.post  ('/tickets',             authenticate, [
  body('project_id').isInt(),
  body('title').trim().notEmpty().isLength({ max: 300 }),
], validate, tickC.create);

router.get   ('/tickets/:id',         authenticate, tickC.get);
router.put   ('/tickets/:id',         authenticate, tickC.update);
router.delete('/tickets/:id',         authenticate, authorizeMin('project_manager'), tickC.remove);

// Bug logging (QA, TL, PM, Admin, Super Admin)
router.post  ('/tickets/:id/log-bug', authenticate, authorize('qa','team_lead','project_manager','admin','super_admin'), [
  body('fix_minutes').isInt({ min: 1 }),
], validate, tickC.logBug);

// Manual point adjustment (Admin only)
router.post  ('/tickets/:id/adjust-points', authenticate, authorize('super_admin','admin'), [
  body('user_id').isInt(),
  body('delta').isInt(),
], validate, tickC.adjustPoints);

// ═══════════════════════════════════════════════════════════════
// TIME LOGS
// ═══════════════════════════════════════════════════════════════
router.post  ('/time-logs',              authenticate, [
  body('ticket_id').isInt(),
  body('hours').isFloat({ min: 0.01 }),
], validate, timeC.logTime);

router.get   ('/tickets/:ticketId/time-logs', authenticate, timeC.listForTicket);
router.get   ('/users/:userId/timeline', authenticate, timeC.userTimeline);
router.put   ('/time-logs/:id',          authenticate, timeC.update);
router.delete('/time-logs/:id',          authenticate, timeC.remove);

// ═══════════════════════════════════════════════════════════════
// COMMENTS
// ═══════════════════════════════════════════════════════════════
router.get   ('/tickets/:ticketId/comments', authenticate, commC.list);
router.post  ('/tickets/:ticketId/comments', authenticate, [
  body('body').trim().notEmpty(),
], validate, commC.create);
router.put   ('/comments/:id',          authenticate, commC.update);
router.delete('/comments/:id',          authenticate, commC.remove);

// ═══════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════
router.get('/reports/user-performance', authenticate, authorizeMin('team_lead'), reptC.userPerformance);
router.get('/reports/bug-analytics',    authenticate, authorizeMin('team_lead'), reptC.bugAnalytics);
router.get('/reports/project-progress', authenticate, reptC.projectProgress);
router.get('/reports/time-tracking',    authenticate, authorizeMin('team_lead'), reptC.timeTracking);
router.get('/reports/leaderboard',      authenticate, reptC.leaderboard);
router.get('/reports/overdue',          authenticate, authorizeMin('team_lead'), reptC.overdue);

module.exports = router;
