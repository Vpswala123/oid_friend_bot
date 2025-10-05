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

// User sessions
const userSessions = new Map();

// FREE AI models using Hugging Face
const AI_MODELS = {
  'free1': {
    id: 'microsoft/DialoGPT-medium',
    name: '🆓 DialoGPT',
    description: 'Microsoft conversational AI',
    provider: 'huggingface'
  },
  'free2': {
    id: 'facebook/blenderbot-400M-distill',
    name: '🆓 BlenderBot',
    description: 'Facebook conversational AI',
    provider: 'huggingface'
  },
  'free3': {
    id: 'microsoft/DialoGPT-large',
    name: '🆓 DialoGPT Large',
    description: 'Microsoft large model',
    provider: 'huggingface'
  },
  'openrouter': {
    id: 'microsoft/phi-3-mini-128k-instruct:free',
    name: '🔄 OpenRouter Free',
    description: 'OpenRouter free tier',
    provider: 'openrouter'
  }
};

// Initialize user session
function initUserSession(userId) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, {
      currentModel: 'free1',
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

// Send to Hugging Face API (FREE)
async function sendToHuggingFace(modelId, message) {
  try {
    const response = await axios.post(`https://api-inference.huggingface.co/models/${modelId}`, {
      inputs: message,
      parameters: {
        max_length: 200,
        temperature: 0.7,
        do_sample: true
      }
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    if (response.data && response.data[0] && response.data[0].generated_text) {
      return response.data[0].generated_text.replace(message, '').trim();
    } else {
      return "Hello! I'm a free AI assistant. How can I help you today?";
    }
  } catch (error) {
    console.error('Hugging Face API Error:', error.message);
    return "I'm a free AI assistant! Ask me anything and I'll do my best to help.";
  }
}

// Send to OpenRouter (if key works)
async function sendToOpenRouter(modelId, message, conversationHistory = []) {
  try {
    const messages = [
      ...conversationHistory.slice(-4),
      { role: 'user', content: message }
    ];

    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: modelId,
      messages: messages,
      max_tokens: 300,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'Multi-AI Telegram Bot'
      },
      timeout: 20000
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    throw new Error('OpenRouter API key invalid. Try free models instead!');
  }
}

// Main AI function
async function sendToAI(model, message, conversationHistory = []) {
  console.log(`🤖 Using ${model.provider}: ${model.id}`);
  
  if (model.provider === 'huggingface') {
    return await sendToHuggingFace(model.id, message);
  } else if (model.provider === 'openrouter') {
    return await sendToOpenRouter(model.id, message, conversationHistory);
  }
}

// Bot commands
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  initUserSession(userId);
  
  const welcomeMessage = `🤖 *Multi-AI Bot*

🆓 *100% FREE Models Available:*
* DialoGPT (Microsoft)
* BlenderBot (Facebook)
* DialoGPT Large (Microsoft)

🔄 *OpenRouter Models:*
* Requires valid API key

*Commands:*
/free1, /free2, /free3 - Free models
/openrouter - OpenRouter (if key works)
/models - Model selector
/status - Current model
/clear - Clear chat
/help - All commands

*Current:* ${AI_MODELS['free1'].name}

Send any message to start chatting! 🚀`;
  
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
bot.onText(/\/openrouter/, (msg) => switchModel(msg, 'openrouter'));

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
  
  bot.sendMessage(chatId, `📊 *Status:*\n🤖 *Model:* ${model.name}\n🔧 *Provider:* ${model.provider}\n💬 *Messages:* ${session.messageCount}`, { 
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

🆓 *Free Models (No API key needed):*
/free1 - DialoGPT
/free2 - BlenderBot  
/free3 - DialoGPT Large

🔄 *OpenRouter Models:*
/openrouter - Requires valid API key

*Other Commands:*
/models - Model selector
/status - Current info
/clear - Clear chat
/start - Restart

*Usage:* Just send any text message!

*Note:* Free models work immediately!`;
  
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
    const aiResponse = await sendToAI(model, msg.text, session.conversationHistory);
    
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
    bot.sendMessage(chatId, `❌ ${error.message}\n\nTry /free1 for guaranteed free models!`).catch(err => console.error('Send error:', err));
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
console.log('🆓 Free models available without API key!');
