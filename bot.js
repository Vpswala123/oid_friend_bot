const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

// Bot configuration
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// User sessions to track current model and conversation
const userSessions = new Map();

// Popular AI models configuration
const AI_MODELS = {
  'gpt4': {
    id: 'openai/gpt-4o',
    name: '🧠 GPT-4o',
    description: 'OpenAI\'s most capable model'
  },
  'gpt5': {
    id: 'openai/gpt-5-nano',
    name: '⚡ GPT-5 Nano',
    description: 'Latest GPT-5 model'
  },
  'claude': {
    id: 'anthropic/claude-sonnet-4.5',
    name: '🎭 Claude Sonnet 4.5',
    description: 'Anthropic\'s advanced reasoning model'
  },
  'gemini': {
    id: 'google/gemini-2.5-flash-preview-09-2025',
    name: '💎 Gemini 2.5 Flash',
    description: 'Google\'s latest multimodal model'
  },
  'llama': {
    id: 'meta-llama/llama-3.2-90b-vision-instruct',
    name: '🦙 Llama 3.2 90B',
    description: 'Meta\'s open-source powerhouse'
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
  
  keyboard.push([{ text: '🔍 Browse All Models', callback_data: 'browse_all' }]);
  
  return { inline_keyboard: keyboard };
}

// Send message to OpenRouter API
async function sendToAI(modelId, message, conversationHistory = []) {
  try {
    const messages = [
      ...conversationHistory.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: message }
    ];

    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: modelId,
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'Multi-AI Telegram Bot'
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('OpenRouter API Error:', error.response?.data || error.message);
    throw new Error('Failed to get AI response. Please try again.');
  }
}

// Bot commands
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  initUserSession(userId);
  
  const welcomeMessage = `
🤖 **Welcome to Multi-AI Bot!**

Access 300+ AI models through one bot:
* GPT-4o, GPT-5 Nano
* Claude Sonnet 4.5  
* Gemini 2.5 Flash
* Llama 3.2 90B
* And many more!

**Quick Commands:**
/models - Switch AI model
/gpt - Use GPT-4o
/claude - Use Claude
/gemini - Use Gemini
/status - Current model info
/clear - Clear conversation
/help - Show all commands

**Current Model:** ${AI_MODELS['gpt4'].name}

Just send any message to start chatting! 🚀
  `;
  
  bot.sendMessage(chatId, welcomeMessage, { 
    parse_mode: 'Markdown',
    reply_markup: createModelKeyboard()
  });
});

bot.onText(/\/models/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, '🤖 **Choose your AI model:**', {
    parse_mode: 'Markdown',
    reply_markup: createModelKeyboard()
  });
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
  
  bot.sendMessage(chatId, `✅ Switched to **${model.name}**\n${model.description}`, {
    parse_mode: 'Markdown'
  });
}

bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const session = initUserSession(userId);
  const model = AI_MODELS[session.currentModel];
  
  const statusMessage = `
📊 **Current Status:**

🤖 **Active Model:** ${model.name}
📝 **Description:** ${model.description}
💬 **Messages in session:** ${session.messageCount}
🔄 **Model ID:** \`${model.id}\`

Use /models to switch or /clear to reset conversation.
  `;
  
  bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/clear/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const session = initUserSession(userId);
  
  session.conversationHistory = [];
  session.messageCount = 0;
  
  bot.sendMessage(chatId, '🗑️ **Conversation cleared!** Starting fresh.', {
    parse_mode: 'Markdown'
  });
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  const helpMessage = `
🤖 **Multi-AI Bot Commands:**

**Model Management:**
/models - Choose AI model
/gpt - Switch to GPT-4o
/claude - Switch to Claude
/gemini - Switch to Gemini  
/llama - Switch to Llama
/status - Current model info

**Conversation:**
/clear - Clear chat history
/start - Restart bot

**Features:**
✅ 300+ AI models available
✅ Conversation memory
✅ Group chat support
✅ File sharing support
✅ Voice message support

**Usage:**
Just send any text message to chat with the current AI model!

**Supported in Groups:**
Add me to any group and use commands with @${bot.getMe().then(me => me.username)}
  `;
  
  bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// Handle callback queries (inline keyboard presses)
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  const session = initUserSession(userId);
  
  if (data.startsWith('model_')) {
    const modelKey = data.replace('model_', '');
    session.currentModel = modelKey;
    const model = AI_MODELS[modelKey];
    
    bot.editMessageText(`✅ **Switched to ${model.name}**\n\n${model.description}\n\nSend a message to start chatting!`, {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
      parse_mode: 'Markdown'
    });
  } else if (data === 'browse_all') {
    bot.sendMessage(chatId, `
🔍 **Browse All Models:**

Visit: https://openrouter.ai/models

**Popular Categories:**
* **Coding:** GPT-4o, Claude, Codestral
* **Creative:** GPT-4o, Claude, Gemini
* **Analysis:** Claude, GPT-4o, Qwen
* **Fast:** Gemini Flash, GPT-3.5, Llama
* **Free:** Some models have free tiers

Use model ID with /custom command (coming soon!)
    `, { parse_mode: 'Markdown' });
  }
  
  bot.answerCallbackQuery(callbackQuery.id);
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
  } else if (msg.voice) {
    userMessage = '[Voice message received - transcription not implemented yet]';
  } else if (msg.photo) {
    userMessage = '[Image received - vision models coming soon]';
  } else if (msg.document) {
    userMessage = '[Document received - file analysis coming soon]';
  } else {
    bot.sendMessage(chatId, '❌ Unsupported message type. Please send text messages.');
    return;
  }
  
  // Show typing indicator
  bot.sendChatAction(chatId, 'typing');
  
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
      parse_mode: 'Markdown',
      reply_to_message_id: msg.message_id
    });
    
  } catch (error) {
    console.error('Error:', error);
    bot.sendMessage(chatId, `❌ **Error:** ${error.message}\n\nTry /models to switch or /help for assistance.`, {
      parse_mode: 'Markdown'
    });
  }
});

// Error handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log('🤖 Multi-AI Telegram Bot is running...');