const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/ticketController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/',            ctrl.list);
router.post('/',           ctrl.create);
router.get('/:id',         ctrl.getOne);
router.patch('/:id',       ctrl.update);
router.patch('/:id/status', ctrl.changeStatus);
router.delete('/:id',      authorize('project_manager'), ctrl.remove);
router.post('/:id/time-log', ctrl.logTime);

// Comments sub-route
const commentCtrl = require('../controllers/commentController');
router.get('/:ticketId/comments',      commentCtrl.list);
router.post('/:ticketId/comments',     commentCtrl.create);

module.exports = router;
