const geminiService = require('../services/geminiService');
const meetingStore = require('../utils/meetingStore');

const ALLOWED_SUMMARY_TYPES = new Set(['detailed', 'adaptive', 'all']);
const ALLOWED_SUMMARY_LEVELS = new Set(['beginner', 'intermediate', 'advanced']);
const MAX_CHAT_MESSAGE_LENGTH = 5000;
const MAX_CHAT_HISTORY_ITEMS = 100;
const MAX_MISSED_MESSAGES = 300;
const MAX_MISSED_TRANSCRIPTS = 300;

const ensureTrimmedString = (value) => String(value || '').trim();

/**
 * Generate meeting summary
 * POST /api/summary/generate
 */
exports.generateSummary = async (req, res) => {
    try {
        const { meetingId, summaryType = 'detailed', level = 'intermediate', additionalData } = req.body;
        const normalizedMeetingId = ensureTrimmedString(meetingId);
        const normalizedSummaryType = ensureTrimmedString(summaryType).toLowerCase() || 'detailed';
        const normalizedLevel = ensureTrimmedString(level).toLowerCase() || 'intermediate';

        if (!normalizedMeetingId) {
            return res.status(400).json({
                success: false,
                message: 'Meeting ID is required'
            });
        }

        if (!ALLOWED_SUMMARY_TYPES.has(normalizedSummaryType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid summaryType. Allowed values: detailed, adaptive, all'
            });
        }

        if (!ALLOWED_SUMMARY_LEVELS.has(normalizedLevel)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid level. Allowed values: beginner, intermediate, advanced'
            });
        }

        // Check if Gemini is available
        if (!geminiService.isAvailable()) {
            return res.status(503).json({
                success: false,
                message: 'Summary service is not available. Please configure GEMINI_API_KEY.'
            });
        }

        // Get meeting data from store
        const meeting = await meetingStore.getMeeting(normalizedMeetingId);
        
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: 'Meeting not found'
            });
        }

        // Get all meeting data including transcript and activities
        const allMeetingData = meeting.getAllMeetingData();
        
        // Prepare meeting data for summary with all available data
        const meetingData = {
            meetingId: allMeetingData.meetingId,
            title: allMeetingData.title || 'Untitled Meeting',
            host: allMeetingData.host || 'Unknown Host',
            participants: allMeetingData.participants || [],
            messages: allMeetingData.chatMessages || [],
            transcript: allMeetingData.transcript || [],
            activities: allMeetingData.activities || [],
            startTime: allMeetingData.startTime,
            endTime: additionalData?.endTime || new Date(),
            duration: calculateDuration(allMeetingData.startTime, additionalData?.endTime || new Date()),
            // Include any additional data provided
            ...additionalData
        };

        console.log(`📝 Generating ${normalizedSummaryType} (level: ${normalizedLevel}) summary for meeting: ${normalizedMeetingId}`);
        console.log(`   📊 Data: ${meetingData.messages.length} chat msgs, ${meetingData.transcript.length} transcript entries, ${meetingData.activities.length} activities`);

        // Generate summary based on type
        let result;
        if (normalizedSummaryType === 'adaptive') {
            // New adaptive summary based on difficulty level
            result = await geminiService.generateAdaptiveSummary(meetingData, normalizedLevel);
        } else if (normalizedSummaryType === 'all') {
            result = await geminiService.generateAllSummaries(meetingData);
        } else {
            result = await geminiService.generateSummary(meetingData, normalizedSummaryType);
        }

        console.log(`✅ Summary generated successfully for meeting: ${normalizedMeetingId}`);

        res.json(result);
    } catch (error) {
        console.error('❌ Error generating summary:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate summary'
        });
    }
};

/**
 * Chat with AI about meeting
 * POST /api/summary/chat
 */
exports.chatWithAI = async (req, res) => {
    try {
        const { meetingId, message, chatHistory = [] } = req.body;
        const normalizedMeetingId = ensureTrimmedString(meetingId);
        const normalizedMessage = ensureTrimmedString(message);

        if (!normalizedMeetingId) {
            return res.status(400).json({
                success: false,
                message: 'Meeting ID is required'
            });
        }

        if (!normalizedMessage) {
            return res.status(400).json({
                success: false,
                message: 'Message is required'
            });
        }

        if (normalizedMessage.length > MAX_CHAT_MESSAGE_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `Message is too long. Maximum length is ${MAX_CHAT_MESSAGE_LENGTH} characters.`
            });
        }

        if (!Array.isArray(chatHistory)) {
            return res.status(400).json({
                success: false,
                message: 'chatHistory must be an array'
            });
        }

        if (chatHistory.length > MAX_CHAT_HISTORY_ITEMS) {
            return res.status(400).json({
                success: false,
                message: `chatHistory is too large. Maximum entries: ${MAX_CHAT_HISTORY_ITEMS}.`
            });
        }

        // Check if Gemini is available
        if (!geminiService.isAvailable()) {
            return res.status(503).json({
                success: false,
                message: 'AI service is not available. Please configure GEMINI_API_KEY.'
            });
        }

        // Get meeting data from store
        const meeting = await meetingStore.getMeeting(normalizedMeetingId);
        
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: 'Meeting not found'
            });
        }

        // Get all meeting data
        const allMeetingData = meeting.getAllMeetingData();
        
        const meetingData = {
            meetingId: allMeetingData.meetingId,
            title: allMeetingData.title || 'Untitled Meeting',
            host: allMeetingData.host || 'Unknown Host',
            participants: allMeetingData.participants || [],
            messages: allMeetingData.chatMessages || [],
            transcript: allMeetingData.transcript || [],
            activities: allMeetingData.activities || [],
            duration: calculateDuration(allMeetingData.startTime, new Date())
        };

        console.log(`💬 AI Chat for meeting: ${normalizedMeetingId} - "${normalizedMessage.substring(0, 50)}..."`);

        const result = await geminiService.chatAboutMeeting(meetingData, normalizedMessage, chatHistory);

        console.log(`✅ AI responded for meeting: ${normalizedMeetingId}`);

        res.json(result);
    } catch (error) {
        console.error('❌ Error in AI chat:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get AI response'
        });
    }
};

/**
 * Check if summary service is available
 * GET /api/summary/status
 */
exports.checkStatus = (req, res) => {
    const isAvailable = geminiService.isAvailable();
    res.json({
        success: true,
        available: isAvailable,
        message: isAvailable 
            ? 'Summary service is available' 
            : 'Summary service requires GEMINI_API_KEY configuration'
    });
};

/**
 * Get meeting data for summary (without generating)
 * GET /api/summary/meeting-data/:meetingId
 */
exports.getMeetingData = async (req, res) => {
    try {
        const { meetingId } = req.params;

        const meeting = await meetingStore.getMeeting(meetingId);
        
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: 'Meeting not found'
            });
        }

        const messages = meeting.getChatHistory() || [];
        
        res.json({
            success: true,
            data: {
                meetingId: meeting.meetingId,
                title: meeting.title,
                host: meeting.hostUsername,
                participants: meeting.participants?.map(p => ({
                    username: p.username,
                    joinedAt: p.joinedAt
                })) || [],
                messageCount: messages.filter(m => m.type === 'text' || !m.type).length,
                pollCount: messages.filter(m => m.type === 'poll').length,
                fileCount: messages.filter(m => m.type === 'file').length,
                startTime: meeting.createdAt,
                isActive: meeting.isActive
            }
        });
    } catch (error) {
        console.error('❌ Error getting meeting data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get meeting data'
        });
    }
};

/**
 * Calculate duration between two dates
 */
function calculateDuration(start, end) {
    if (!start || !end) return 'Unknown';
    
    const startTime = new Date(start);
    const endTime = new Date(end);
    const diffMs = endTime - startTime;
    
    if (diffMs < 0) return 'Unknown';
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes} minutes`;
}

/**
 * Summarize missed messages when user was away
 * POST /api/summary/missed-messages
 */
exports.summarizeMissedMessages = async (req, res) => {
    try {
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                success: false,
                message: 'Messages array is required'
            });
        }

        if (messages.length > MAX_MISSED_MESSAGES) {
            return res.status(400).json({
                success: false,
                message: `Too many messages to summarize at once. Maximum: ${MAX_MISSED_MESSAGES}`
            });
        }

        if (messages.length === 0) {
            return res.json({
                success: true,
                summary: 'No messages were missed during your absence.'
            });
        }

        // Check if Gemini is available
        if (!geminiService.isAvailable()) {
            return res.status(503).json({
                success: false,
                message: 'Summary service is not available. Please configure GEMINI_API_KEY.'
            });
        }

        console.log(`📝 Summarizing ${messages.length} missed messages`);

        const summary = await geminiService.summarizeMissedMessages(messages);

        console.log(`✅ Missed messages summary generated successfully`);

        res.json({
            success: true,
            summary,
            messageCount: messages.length
        });
    } catch (error) {
        console.error('❌ Error summarizing missed messages:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to summarize missed messages'
        });
    }
};

/**
 * Summarize missed speech when user was away
 * POST /api/summary/missed-speech
 */
exports.summarizeMissedSpeech = async (req, res) => {
    try {
        const { transcripts } = req.body;

        if (!transcripts || !Array.isArray(transcripts)) {
            return res.status(400).json({
                success: false,
                message: 'Transcripts array is required'
            });
        }

        if (transcripts.length > MAX_MISSED_TRANSCRIPTS) {
            return res.status(400).json({
                success: false,
                message: `Too many transcript entries to summarize at once. Maximum: ${MAX_MISSED_TRANSCRIPTS}`
            });
        }

        if (transcripts.length === 0) {
            return res.json({
                success: true,
                summary: 'No speech was missed during your absence.'
            });
        }

        // Check if Gemini is available
        if (!geminiService.isAvailable()) {
            return res.status(503).json({
                success: false,
                message: 'Summary service is not available. Please configure GEMINI_API_KEY.'
            });
        }

        console.log(`🎤 Summarizing ${transcripts.length} missed speech segments`);

        const summary = await geminiService.summarizeMissedSpeech(transcripts);

        console.log(`✅ Missed speech summary generated successfully`);

        res.json({
            success: true,
            summary,
            transcriptCount: transcripts.length
        });
    } catch (error) {
        console.error('❌ Error summarizing missed speech:', error);
        
        // Provide more helpful error messages based on error type
        let statusCode = 500;
        let message = error.message || 'Failed to summarize missed speech';
        
        if (error.message?.includes('RATE_LIMIT')) {
            statusCode = 429; // Too Many Requests
            message = 'AI service is temporarily busy (quota exceeded). Please wait a moment and try again.';
        } else if (error.message?.includes('AI_UNAVAILABLE')) {
            statusCode = 503; // Service Unavailable
            message = 'AI service is temporarily unavailable. Please try again later.';
        }
        
        res.status(statusCode).json({
            success: false,
            message: message
        });
    }
};

module.exports = exports;
