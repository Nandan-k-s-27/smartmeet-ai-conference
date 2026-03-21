const { v4: uuidv4 } = require('uuid');
const MeetingModel = require('../models/Meeting');
const meetingStore = require('../utils/meetingStore');

const getAuthParticipant = (req) => {
    const userId = String(req.user?._id || '');
    const username = req.user?.name || req.user?.email || 'User';
    return { userId, username };
};

exports.createMeeting = async (req, res) => {
    try {
        const { title } = req.body;
        const { userId: host, username: hostUsername } = getAuthParticipant(req);

        // Auto-generate meeting ID
        const meetingId = uuidv4().substring(0, 8).toUpperCase();

        // Create in-memory meeting
        meetingStore.createMeeting(meetingId, host, hostUsername, title || `${hostUsername}'s Meeting`);

        // Prepare MongoDB document
        const dbMeetingData = {
            meetingId,
            title: title || `${hostUsername}'s Meeting`,
            host: {
                userId: host,
                username: hostUsername
            },
            participants: [{
                userId: host,
                username: hostUsername,
                joinedAt: new Date()
            }],
            isActive: true
        };

        // Save to MongoDB
        const dbMeeting = new MeetingModel(dbMeetingData);
        await dbMeeting.save();

        console.log('✅ Meeting created:', meetingId);

        res.json({
            success: true,
            meetingId,
            message: 'Meeting created successfully'
        });
    } catch (error) {
        console.error('❌ Error creating meeting:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create meeting'
        });
    }
};

exports.getMeeting = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const meeting = await meetingStore.getMeeting(meetingId);

        if (!meeting || !meeting.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Meeting not found'
            });
        }

        res.json({
            success: true,
            meeting: {
                meetingId: meeting.meetingId,
                host: meeting.host,
                hostUsername: meeting.hostUsername,
                title: meeting.title,
                participantCount: meeting.participants.length
            }
        });
    } catch (error) {
        console.error('❌ Error fetching meeting:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch meeting'
        });
    }
};

exports.joinMeeting = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { userId, username } = getAuthParticipant(req);

        const meeting = await meetingStore.getMeeting(meetingId);
        if (!meeting || !meeting.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Meeting not found'
            });
        }

        // Add to in-memory (socketId null for now, will be updated when socket connects)
        const participant = meeting.addParticipant(userId, username, null);

        // Update MongoDB
        const dbMeeting = await MeetingModel.findOne({ meetingId });
        if (dbMeeting) {
            const existingParticipant = dbMeeting.participants.find(p => p.userId === userId);
            if (!existingParticipant) {
                dbMeeting.participants.push({
                    userId,
                    username,
                    joinedAt: new Date()
                });
                await dbMeeting.save();
            } else if (existingParticipant.leftAt) {
                existingParticipant.leftAt = undefined;
                await dbMeeting.save();
            }
        }

        console.log('✅ User joined via API:', username, 'to meeting:', meetingId);

        res.json({
            success: true,
            meeting: {
                meetingId: meeting.meetingId,
                host: meeting.host,
                hostUsername: meeting.hostUsername,
                title: meeting.title
            },
            participant: {
                userId: participant.userId,
                username: participant.username
            }
        });
    } catch (error) {
        console.error('❌ Error joining meeting:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to join meeting'
        });
    }
};

exports.leaveMeeting = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { userId } = getAuthParticipant(req);

        const meeting = await meetingStore.getMeeting(meetingId);
        if (meeting) {
            meeting.removeParticipant(userId);
            console.log('✅ User left via API:', userId, 'from meeting:', meetingId);
        }

        // Update MongoDB - mark participant as left
        const dbMeeting = await MeetingModel.findOne({ meetingId });
        if (dbMeeting) {
            const participant = dbMeeting.participants.find(p => p.userId === userId && !p.leftAt);
            if (participant) {
                participant.leftAt = new Date();
                await dbMeeting.save();
            }
        }

        res.json({ success: true, message: 'Left meeting successfully' });
    } catch (error) {
        console.error('❌ Error leaving meeting:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to leave meeting'
        });
    }
};

/**
 * End meeting (host only)
 * POST /api/meetings/:meetingId/end
 */
exports.endMeeting = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { userId } = getAuthParticipant(req);

        const meeting = await meetingStore.getMeeting(meetingId);
        
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: 'Meeting not found'
            });
        }

        // Verify the user is the host
        if (meeting.host !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Only the host can end the meeting'
            });
        }

        // Mark meeting as ended in memory
        meeting.isActive = false;
        meeting.endedAt = new Date();

        // Update MongoDB with all meeting data including transcript and activities
        const dbMeeting = await MeetingModel.findOne({ meetingId });
        if (dbMeeting) {
            dbMeeting.isActive = false;
            dbMeeting.status = 'ended';
            dbMeeting.endedAt = new Date();
            dbMeeting.endTime = new Date();
            
            // Save transcript (speech-to-text conversations)
            if (meeting.transcript && meeting.transcript.length > 0) {
                dbMeeting.transcript = meeting.transcript;
                console.log(`📝 Saving ${meeting.transcript.length} transcript entries to database`);
            }
            
            // Save activities (join/leave, hand raise, screen share, etc.)
            if (meeting.activities && meeting.activities.length > 0) {
                dbMeeting.activities = meeting.activities;
                console.log(`📊 Saving ${meeting.activities.length} activity entries to database`);
            }
            
            // Save chat messages (if not already saved)
            if (meeting.messages && meeting.messages.length > 0) {
                dbMeeting.messages = meeting.messages;
                console.log(`💬 Saving ${meeting.messages.length} chat messages to database`);
            }
            
            // Mark all participants as left
            dbMeeting.participants.forEach(p => {
                if (!p.leftAt) {
                    p.leftAt = new Date();
                }
            });
            
            await dbMeeting.save();
            console.log(`✅ Meeting data saved to database. Will auto-delete after 24 hours.`);
        }

        console.log('✅ Meeting ended by host:', meetingId);

        res.json({
            success: true,
            message: 'Meeting ended successfully'
        });
    } catch (error) {
        console.error('❌ Error ending meeting:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to end meeting'
        });
    }
};