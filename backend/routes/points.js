// ── points.js ────────────────────────────────────────────────
const express = require('express');
const rPts = express.Router();
const pCtrl = require('../controllers/pointController');
const { authenticate, authorize } = require('../middleware/auth');
rPts.use(authenticate);
rPts.get('/log',            authorize('admin'), pCtrl.getLog);
rPts.get('/user/:userId',                       pCtrl.getUserPoints);
rPts.post('/adjust',        authorize('admin'), pCtrl.adjust);
module.exports = rPts;
