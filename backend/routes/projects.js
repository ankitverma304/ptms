const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/projectController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/',                        ctrl.list);
router.post('/',    authorize('project_manager'), ctrl.create);
router.get('/:id',                     ctrl.getOne);
router.patch('/:id', authorize('project_manager'), ctrl.update);
router.delete('/:id', authorize('admin'),           ctrl.remove);

router.post('/:id/members',   authorize('project_manager'), ctrl.addMember);
router.delete('/:id/members/:userId', authorize('project_manager'), ctrl.removeMember);

module.exports = router;
