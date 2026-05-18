// routes/comments.js
const express = require('express');
const r = express.Router();
const ctrl = require('../controllers/commentController');
const { authenticate } = require('../middleware/auth');
r.use(authenticate);
r.patch('/:id',  ctrl.update);
r.delete('/:id', ctrl.remove);
module.exports = r;
