require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    
    console.log('--- Gemini API Test ---');
    console.log(`API Key present: ${!!apiKey}`);
    if (apiKey) {
        console.log(`API Key length: ${apiKey.length}`);
        console.log(`API Key start: ${apiKey.substring(0, 5)}...`);
        console.log(`API Key end: ...${apiKey.substring(apiKey.length - 5)}`);
    } else {
        console.error('ERROR: GEMINI_API_KEY is missing in .env file');
        return;
    }

    // Test 1: Constructor with string
    console.log('\nTest 1: Constructor with string');
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        console.log('Model initialized. Sending prompt...');
        const result = await model.generateContent('Hello, are you working?');
        console.log('Response received:', result.response.text());
        console.log('✅ Test 1 PASSED');
    } catch (error) {
        console.error('❌ Test 1 FAILED:', error.message);
        if (error.message.includes('API key not valid')) {
            console.error('   -> This confirms Google rejected the key.');
        }
    }

    // Test 2: Constructor with object
    console.log('\nTest 2: Constructor with object');
    try {
        const genAI = new GoogleGenerativeAI({ apiKey: apiKey });
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }); // Try fallback model
        console.log('Model initialized. Sending prompt...');
        const result = await model.generateContent('Hello, are you working?');
        console.log('Response received:', result.response.text());
        console.log('✅ Test 2 PASSED');
    } catch (error) {
        console.error('❌ Test 2 FAILED:', error.message);
    }
}

testGemini();
