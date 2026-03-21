const express = require('express');
const meetingController = require('../controllers/meetingController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);

router.post('/create', meetingController.createMeeting);
router.get('/:meetingId', meetingController.getMeeting);
router.post('/:meetingId/join', meetingController.joinMeeting);
router.post('/:meetingId/leave', meetingController.leaveMeeting);
router.post('/:meetingId/end', meetingController.endMeeting);

module.exports = router;
