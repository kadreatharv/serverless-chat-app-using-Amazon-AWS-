const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Generates a response from Gemini 1.5 Flash.
 * Falls back to a mock message if the API key is not set.
 * 
 * @param {string} prompt The user prompt to respond to
 * @returns {Promise<string>} The AI response
 */
async function generateAIResponse(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('[GEMINI SERVICE] GEMINI_API_KEY is not set. Using mock fallback.');
    return `🤖 **[Mock AI]** You asked: "${prompt}"\n\nTo enable real Gemini AI, please add \`GEMINI_API_KEY\` to your \`.env\` file in the \`aws-backend\` directory.`;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const result = await model.generateContent(
      `You are Nexus AI, a helpful and concise coding assistant in a team chat room. 
Keep your responses professional, informative, and formatted in clean Markdown.

User: ${prompt}`
    );

    const responseText = result.response.text();
    if (!responseText) {
      throw new Error('Received empty response from Gemini API');
    }
    
    return responseText.trim();
  } catch (err) {
    console.error('[GEMINI SERVICE] Error generating content:', err);
    return `🤖 **[AI Error]** Sorry, I ran into an issue while processing your request. (${err.message || err})`;
  }
}

module.exports = {
  generateAIResponse
};
