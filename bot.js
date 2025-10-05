const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

// Bot configuration
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

// User sessions
const userSessions = new Map();

// FREE AI models that work without credits
const AI_MODELS = {
  'free1': {
    id: 'microsoft/phi-3-mini-128k-instruct:free',
    name: '🆓 Phi-3 Mini',
    description: 'Microsoft free model'
  },
  'free2': {
    id: 'google/gemma-7b-it:free',
    name: '🆓 Gemma 7B',
    description: 'Google free model'
  },
  'free3': {
    id: 'meta-llama/llama-3-8b-instruct:free',
    name: '🆓 Llama 3 8B',
    description: 'Meta free model'
  },
  'gpt4': {
    id: 'openai/gpt-4o-mini',
    name: '💰 GPT-4o Mini',
    description: 'OpenAI (requires credits)'
  }
};

// Initialize user session
function initUserSession(userId) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, {
      currentModel: 'free1', // Start with free model
      conversationHistory: [],
      messageCount: 0
    });
  }
  return userSessions.get(userId);
}

// Create inline keyboard
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

// Send to AI with better error handling
async function sendToAI(modelId, message, conversationHistory = []) {
  try {
    console.log(`🤖 Using model: ${modelId}`);
    
    const messages = [
      ...conversationHistory.slice(-6),
      { role: 'user', content: message }
    ];

    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: modelId,
      messages: messages,
      max_tokens: 500,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'Multi-AI Telegram Bot',
        'HTTP-Referer': 'https://github.com/Vpswala123/oid_friend_bot'
      },
      timeout: 25000
    });

    console.log(`✅ API Response received`);
    return response.data.choices[0].message.content;
    
  } catch (error) {
    console.error('OpenRouter API Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      throw new Error('❌ API Key invalid. Please check your OpenRouter API key.');
    } else if (error.response?.status === 429) {
      throw new Error('⏳ Rate limit exceeded. Please try again in a moment.');
    } else if (error.response?.status === 402) {
      throw new Error('💳 Insufficient credits. Try a free model with /free1 command.');
    } else {
      throw new Error('🔧 AI service temporarily unavailable. Try a different model.');
    }
  }
}

// Bot commands
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  initUserSession(userId);
  
  const welcomeMessage = `🤖 *Multi-AI Bot*

Available models:
🆓 *Free Models:*
* Phi-3 Mini (Microsoft)
* Gemma 7B (Google)  
* Llama 3 8B (Meta)

💰 *Premium Models:*
* GPT-4o Mini (requires credits)

*Commands:*
/free1, /free2, /free3 - Free models
/gpt4 - GPT-4o Mini
/models - Model selector
/status - Current model
/clear - Clear chat
/help - All commands

*Current:* ${AI_MODELS['free1'].name}

Send any message to start! 🚀`;
  
  bot.sendMessage(chatId, welcomeMessage, { 
    parse_mode: 'Markdown',
    reply_markup: createModelKeyboard()
  }).catch(err => console.error('Send error:', err));
});

bot.onText(/\/models/, (msg) => {
  bot.sendMessage(msg.chat.id, '🤖 *Choose your AI model:*', {
    parse_mode: 'Markdown',
    reply_markup: createModelKeyboard()
  }).catch(err => console.error('Send error:', err));
});

// Model switches
bot.onText(/\/free1/, (msg) => switchModel(msg, 'free1'));
bot.onText(/\/free2/, (msg) => switchModel(msg, 'free2'));
bot.onText(/\/free3/, (msg) => switchModel(msg, 'free3'));
bot.onText(/\/gpt4/, (msg) => switchModel(msg, 'gpt4'));

function switchModel(msg, modelKey) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const session = initUserSession(userId);
  
  session.currentModel = modelKey;
  const model = AI_MODELS[modelKey];
  
  bot.sendMessage(chatId, `✅ Switched to *${model.name}*\n${model.description}`, {
    parse_mode: 'Markdown'
  }).catch(err => console.error('Send error:', err));
}

bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const session = initUserSession(userId);
  const model = AI_MODELS[session.currentModel];
  
  bot.sendMessage(chatId, `📊 *Status:*\n🤖 *Model:* ${model.name}\n💬 *Messages:* ${session.messageCount}`, { 
    parse_mode: 'Markdown' 
  }).catch(err => console.error('Send error:', err));
});

bot.onText(/\/clear/, (msg) => {
  const userId = msg.from.id;
  const session = initUserSession(userId);
  session.conversationHistory = [];
  session.messageCount = 0;
  
  bot.sendMessage(msg.chat.id, '🗑️ *Conversation cleared!*', {
    parse_mode: 'Markdown'
  }).catch(err => console.error('Send error:', err));
});

bot.onText(/\/help/, (msg) => {
  const helpMessage = `🤖 *Multi-AI Bot Commands:*

*Free Models:*
/free1 - Phi-3 Mini
/free2 - Gemma 7B  
/free3 - Llama 3 8B

*Premium Models:*
/gpt4 - GPT-4o Mini

*Other:*
/models - Model selector
/status - Current info
/clear - Clear chat
/start - Restart

*Usage:* Just send any text message!`;
  
  bot.sendMessage(msg.chat.id, helpMessage, { 
    parse_mode: 'Markdown' 
  }).catch(err => console.error('Send error:', err));
});

// Handle callback queries
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
      
      bot.editMessageText(`✅ *Switched to ${model.name}*\n\n${model.description}\n\nSend a message to start!`, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'Markdown'
      }).catch(err => console.error('Edit error:', err));
    }
  }
  
  bot.answerCallbackQuery(callbackQuery.id).catch(err => console.error('Callback error:', err));
});

// Handle messages
bot.on('message', async (msg) => {
  if (msg.text && msg.text.startsWith('/')) return;
  
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const session = initUserSession(userId);
  const model = AI_MODELS[session.currentModel];
  
  if (!msg.text) {
    bot.sendMessage(chatId, '❌ Please send text messages only.').catch(err => console.error('Send error:', err));
    return;
  }
  
  bot.sendChatAction(chatId, 'typing').catch(err => console.error('Action error:', err));
  
  try {
    const aiResponse = await sendToAI(model.id, msg.text, session.conversationHistory);
    
    session.conversationHistory.push(
      { role: 'user', content: msg.text },
      { role: 'assistant', content: aiResponse }
    );
    session.messageCount++;
    
    const responseMessage = `${model.name}\n\n${aiResponse}`;
    
    bot.sendMessage(chatId, responseMessage, {
      reply_to_message_id: msg.message_id
    }).catch(err => console.error('Send error:', err));
    
  } catch (error) {
    console.error('AI Error:', error.message);
    bot.sendMessage(chatId, `${error.message}\n\nTry /free1 for a free model or /help for assistance.`).catch(err => console.error('Send error:', err));
  }
});

// Error handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.code, error.message);
  if (error.code === 'ETELEGRAM' && error.message.includes('409')) {
    console.log('⚠️  Multiple instances detected. Stopping...');
    process.exit(1);
  }
});

console.log('🤖 Multi-AI Telegram Bot is running...');
console.log('🆓 Starting with free models...');
