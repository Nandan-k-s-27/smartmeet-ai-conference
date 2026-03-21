const { customAlphabet } = require('nanoid');
const mongoose = require('mongoose');
const MeetingModel = require('../models/Meeting');
const meetingStore = require('../utils/meetingStore');

const createMeetingCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);
const isValidMeetingId = (meetingId) => /^[A-Z0-9]{6,12}$/.test(String(meetingId || '').toUpperCase());
const normalizeMeetingId = (meetingId) => String(meetingId || '').trim().toUpperCase();

exports.createMeeting = async (req, res) => {
    try {
        const user = req.user;
        const title = (req.body?.title || `${user.name}'s Meeting`).trim();

        let meetingId = '';
        let exists = true;

        while (exists) {
            meetingId = createMeetingCode();
            // eslint-disable-next-line no-await-in-loop
            const found = await MeetingModel.findOne({ meetingId }).select('_id').lean();
            exists = Boolean(found);
        }

        meetingStore.createMeeting(meetingId, user.id, user.name, title);

        const meeting = await MeetingModel.create({
            _id: meetingId,
            meetingId,
            hostId: new mongoose.Types.ObjectId(user.id),
            participantIds: [new mongoose.Types.ObjectId(user.id)],
            title,
            host: {
                userId: user.id,
                username: user.name,
            },
            participants: [
                {
                    userId: user.id,
                    username: user.name,
                    joinedAt: new Date(),
                },
            ],
            isActive: true,
            status: 'active',
        });

        return res.json({
            success: true,
            meetingId: meeting.meetingId,
            message: 'Meeting created successfully',
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to create meeting',
        });
    }
};

exports.getMeeting = async (req, res) => {
    try {
        const meetingId = normalizeMeetingId(req.params.meetingId);

        if (!isValidMeetingId(meetingId)) {
            return res.status(400).json({ success: false, message: 'Invalid meeting ID format' });
        }

        const dbMeeting = await MeetingModel.findOne({ meetingId }).lean();
        if (!dbMeeting || !dbMeeting.isActive) {
            return res.status(404).json({ success: false, message: 'Meeting not found or inactive' });
        }

        return res.json({
            success: true,
            meeting: {
                meetingId: dbMeeting.meetingId,
                title: dbMeeting.title,
                hostId: String(dbMeeting.hostId),
                participantCount: (dbMeeting.participantIds || []).length,
                isActive: dbMeeting.isActive,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch meeting',
        });
    }
};

exports.joinMeeting = async (req, res) => {
    try {
        const meetingId = normalizeMeetingId(req.params.meetingId);
        const user = req.user;

        if (!isValidMeetingId(meetingId)) {
            return res.status(400).json({ success: false, message: 'Invalid meeting ID format' });
        }

        const meeting = await meetingStore.getMeeting(meetingId);
        if (!meeting || !meeting.isActive) {
            return res.status(404).json({ success: false, message: 'Meeting not found or inactive' });
        }

        const dbMeeting = await MeetingModel.findOne({ meetingId });
        if (!dbMeeting || !dbMeeting.isActive) {
            return res.status(404).json({ success: false, message: 'Meeting not found or inactive' });
        }

        const alreadyJoined = dbMeeting.participantIds.some((id) => String(id) === user.id);

        if (!alreadyJoined) {
            dbMeeting.participantIds.push(new mongoose.Types.ObjectId(user.id));
            dbMeeting.participants.push({
                userId: user.id,
                username: user.name,
                joinedAt: new Date(),
            });
            await dbMeeting.save();
        }

        const participant = meeting.addParticipant(user.id, user.name, null, user.avatar || '');

        return res.json({
            success: true,
            meeting: {
                meetingId: dbMeeting.meetingId,
                hostId: String(dbMeeting.hostId),
                title: dbMeeting.title,
            },
            participant: {
                userId: participant.userId,
                username: participant.username,
                avatar: user.avatar || '',
            },
            isHost: String(dbMeeting.hostId) === user.id,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to join meeting',
        });
    }
};

exports.leaveMeeting = async (req, res) => {
    try {
        const meetingId = normalizeMeetingId(req.params.meetingId);
        const user = req.user;

        const meeting = await meetingStore.getMeeting(meetingId);
        if (meeting) {
            meeting.removeParticipant(user.id);
        }

        const dbMeeting = await MeetingModel.findOne({ meetingId });
        if (dbMeeting) {
            const participant = dbMeeting.participants.find((p) => p.userId === user.id && !p.leftAt);
            if (participant) {
                participant.leftAt = new Date();
                await dbMeeting.save();
            }
        }

        return res.json({ success: true, message: 'Left meeting successfully' });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to leave meeting',
        });
    }
};

/**
 * End meeting (host only)
 * POST /api/meetings/:meetingId/end
 */
exports.endMeeting = async (req, res) => {
    try {
        const meetingId = normalizeMeetingId(req.params.meetingId);
        const user = req.user;

        const meeting = await meetingStore.getMeeting(meetingId);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: 'Meeting not found',
            });
        }

        const dbMeeting = await MeetingModel.findOne({ meetingId });
        if (!dbMeeting) {
            return res.status(404).json({ success: false, message: 'Meeting not found' });
        }

        if (String(dbMeeting.hostId) !== user.id) {
            return res.status(403).json({
                success: false,
                message: 'Only the host can end the meeting',
            });
        }

        meeting.isActive = false;
        meeting.endedAt = new Date();

        dbMeeting.isActive = false;
        dbMeeting.status = 'ended';
        dbMeeting.endedAt = new Date();
        dbMeeting.endTime = new Date();

        if (meeting.transcript?.length) {
            dbMeeting.transcript = meeting.transcript;
        }

        if (meeting.activities?.length) {
            dbMeeting.activities = meeting.activities;
        }

        if (meeting.messages?.length) {
            dbMeeting.messages = meeting.messages;
        }

        dbMeeting.participants.forEach((participant) => {
            if (!participant.leftAt) {
                participant.leftAt = new Date();
            }
        });

        await dbMeeting.save();

        return res.json({
            success: true,
            message: 'Meeting ended successfully',
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to end meeting',
        });
    }
};