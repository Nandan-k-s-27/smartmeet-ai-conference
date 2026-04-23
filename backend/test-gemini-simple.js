require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const modelCandidates = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
    
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

    // Test 1: Constructor with string, then object fallback
    console.log('\nTest 1: Client initialization');
    let genAI = null;
    let constructorUsed = null;
    try {
        genAI = new GoogleGenerativeAI(apiKey);
        constructorUsed = 'string';
    } catch (error) {
        try {
            genAI = new GoogleGenerativeAI({ apiKey });
            constructorUsed = 'object';
        } catch (fallbackError) {
            console.error('❌ Test 1 FAILED:', fallbackError.message);
            return;
        }
    }
    console.log(`✅ Test 1 PASSED (constructor: ${constructorUsed})`);

    // Test 2: Try multiple model names for maximum compatibility
    console.log('\nTest 2: Model + prompt test');
    let success = false;
    for (const modelName of modelCandidates) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            console.log(`Trying model: ${modelName}`);
            const result = await model.generateContent('Hello, are you working?');
            console.log('Response received:', result.response.text());
            console.log(`✅ Test 2 PASSED with model: ${modelName}`);
            success = true;
            break;
        } catch (error) {
            console.error(`❌ Model ${modelName} failed: ${error.message}`);
        }
    }

    if (!success) {
        console.error('❌ Test 2 FAILED: No compatible model responded successfully.');
    }
}

testGemini();
