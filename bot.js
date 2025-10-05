const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

// Bot configuration with better error handling
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
  polling: {
    interval: 1000,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// User sessions to track current model and conversation
const userSessions = new Map();

// Popular AI models configuration
const AI_MODELS = {
  'gpt4': {
    id: 'openai/gpt-4o',
    name: '🧠 GPT-4o',
    description: 'OpenAI most capable model'
  },
  'claude': {
    id: 'anthropic/claude-sonnet-4.5',
    name: '🎭 Claude Sonnet 4.5',
    description: 'Anthropic advanced reasoning model'
  },
  'gemini': {
    id: 'google/gemini-2.5-flash-preview-09-2025',
    name: '💎 Gemini 2.5 Flash',
    description: 'Google latest multimodal model'
  },
  'llama': {
    id: 'meta-llama/llama-3.2-90b-vision-instruct',
    name: '🦙 Llama 3.2 90B',
    description: 'Meta open-source powerhouse'
  }
};

// Initialize user session
function initUserSession(userId) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, {
      currentModel: 'gpt4',
      conversationHistory: [],
      messageCount: 0
    });
  }
  return userSessions.get(userId);
}

// Create inline keyboard for model selection
function createModelKeyboard() {
  const keyboard = [];
  const models = Object.entries(AI_MODELS);
  
  for (let i = 0; i < models.length; i += 2) {
    const row = [];
    row.push({ text: models[i][1].name, callback_data: `model_${models[i][0]}` });
    if (models[i + 1]) {
      row.push({ text: models[i + 1][1].name, callback_data: `model_${models[i + 1][0]}` });
    }
    keyboard.push(row);
  }
  
  return { inline_keyboard: keyboard };
}

// Send message to OpenRouter API
async function sendToAI(modelId, message, conversationHistory = []) {
  try {
    const messages = [
      ...conversationHistory.slice(-8), // Keep last 8 messages for context
      { role: 'user', content: message }
    ];

    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: modelId,
      messages: messages,
      max_tokens: 800,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'Multi-AI Telegram Bot'
      },
      timeout: 30000
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('OpenRouter API Error:', error.response?.data || error.message);
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again in a moment.');
    }
    throw new Error('AI service temporarily unavailable. Please try again.');
  }
}

// Bot commands
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  initUserSession(userId);
  
  const welcomeMessage = `🤖 *Multi-AI Bot*

Access multiple AI models:
* 🧠 GPT-4o
* 🎭 Claude Sonnet 4.5  
* 💎 Gemini 2.5 Flash
* 🦙 Llama 3.2 90B

*Commands:*
/models - Switch AI model
/gpt - Use GPT-4o
/claude - Use Claude
/gemini - Use Gemini
/status - Current model
/clear - Clear chat
/help - All commands

*Current:* ${AI_MODELS['gpt4'].name}

Send any message to start chatting! 🚀`;
  
  bot.sendMessage(chatId, welcomeMessage, { 
    parse_mode: 'Markdown',
    reply_markup: createModelKeyboard()
  }).catch(err => console.error('Send message error:', err));
});

bot.onText(/\/models/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, '🤖 *Choose your AI model:*', {
    parse_mode: 'Markdown',
    reply_markup: createModelKeyboard()
  }).catch(err => console.error('Send message error:', err));
});

// Quick model switches
bot.onText(/\/gpt/, (msg) => switchModel(msg, 'gpt4'));
bot.onText(/\/claude/, (msg) => switchModel(msg, 'claude'));
bot.onText(/\/gemini/, (msg) => switchModel(msg, 'gemini'));
bot.onText(/\/llama/, (msg) => switchModel(msg, 'llama'));

function switchModel(msg, modelKey) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const session = initUserSession(userId);
  
  session.currentModel = modelKey;
  const model = AI_MODELS[modelKey];
  
  bot.sendMessage(chatId, `✅ Switched to *${model.name}*\n${model.description}`, {
    parse_mode: 'Markdown'
  }).catch(err => console.error('Send message error:', err));
}

bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const session = initUserSession(userId);
  const model = AI_MODELS[session.currentModel];
  
  const statusMessage = `📊 *Current Status:*

🤖 *Model:* ${model.name}
📝 *Description:* ${model.description}
💬 *Messages:* ${session.messageCount}

Use /models to switch or /clear to reset.`;
  
  bot.sendMessage(chatId, statusMessage, { 
    parse_mode: 'Markdown' 
  }).catch(err => console.error('Send message error:', err));
});

bot.onText(/\/clear/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const session = initUserSession(userId);
  
  session.conversationHistory = [];
  session.messageCount = 0;
  
  bot.sendMessage(chatId, '🗑️ *Conversation cleared!* Starting fresh.', {
    parse_mode: 'Markdown'
  }).catch(err => console.error('Send message error:', err));
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  const helpMessage = `🤖 *Multi-AI Bot Commands:*

*Model Management:*
/models - Choose AI model
/gpt - Switch to GPT-4o
/claude - Switch to Claude
/gemini - Switch to Gemini  
/llama - Switch to Llama
/status - Current model info

*Conversation:*
/clear - Clear chat history
/start - Restart bot

*Features:*
✅ Multiple AI models
✅ Conversation memory
✅ Group chat support

*Usage:*
Just send any text message to chat!`;
  
  bot.sendMessage(chatId, helpMessage, { 
    parse_mode: 'Markdown' 
  }).catch(err => console.error('Send message error:', err));
});

// Handle callback queries (inline keyboard presses)
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  const session = initUserSession(userId);
  
  if (data.startsWith('model_')) {
    const modelKey = data.replace('model_', '');
    if (AI_MODELS[modelKey]) {
      session.currentModel = modelKey;
      const model = AI_MODELS[modelKey];
      
      bot.editMessageText(`✅ *Switched to ${model.name}*\n\n${model.description}\n\nSend a message to start chatting!`, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'Markdown'
      }).catch(err => console.error('Edit message error:', err));
    }
  }
  
  bot.answerCallbackQuery(callbackQuery.id).catch(err => console.error('Answer callback error:', err));
});

// Handle regular messages (AI chat)
bot.on('message', async (msg) => {
  // Skip if it's a command
  if (msg.text && msg.text.startsWith('/')) return;
  
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const session = initUserSession(userId);
  const model = AI_MODELS[session.currentModel];
  
  // Handle different message types
  let userMessage = '';
  
  if (msg.text) {
    userMessage = msg.text;
  } else {
    bot.sendMessage(chatId, '❌ Please send text messages only.').catch(err => console.error('Send message error:', err));
    return;
  }
  
  // Show typing indicator
  bot.sendChatAction(chatId, 'typing').catch(err => console.error('Send action error:', err));
  
  try {
    // Get AI response
    const aiResponse = await sendToAI(model.id, userMessage, session.conversationHistory);
    
    // Update conversation history
    session.conversationHistory.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: aiResponse }
    );
    session.messageCount++;
    
    // Send response with model indicator
    const responseMessage = `${model.name}\n\n${aiResponse}`;
    
    bot.sendMessage(chatId, responseMessage, {
      reply_to_message_id: msg.message_id
    }).catch(err => console.error('Send message error:', err));
    
  } catch (error) {
    console.error('AI Error:', error);
    bot.sendMessage(chatId, `❌ ${error.message}\n\nTry /models to switch or /help for assistance.`).catch(err => console.error('Send message error:', err));
  }
});

// Enhanced error handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.code, error.message);
  
  if (error.code === 'ETELEGRAM' && error.message.includes('409')) {
    console.log('⚠️  Multiple bot instances detected. Stopping this instance...');
    process.exit(1);
  }
});

bot.on('error', (error) => {
  console.error('Bot error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down bot...');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down bot...');
  bot.stopPolling();
  process.exit(0);
});

console.log('🤖 Multi-AI Telegram Bot is running...');
console.log('🔍 Checking for conflicts...');
