const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const Groq = require('groq-sdk');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
  secret: 'nafs-sukoon-secret-key-2024',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Database
const db = new sqlite3.Database('/tmp/nafs_sukoon.db');

db.run(`CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  password TEXT,
  name TEXT,
  age INTEGER,
  gender TEXT,
  created_at TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  user_message TEXT,
  bot_response TEXT,
  timestamp TEXT
)`);

// GROQ AI (Environment Variable se)
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// AI Response function
async function getAIResponse(userMessage, username, userAge, userGender) {
  if (!process.env.GROQ_API_KEY) {
    return getSimpleResponse(userMessage, username, userAge, userGender);
  }
  
  try {
    const prompt = `آپ ایک اسلامی نفسیاتی معاون ہیں "نفس سکون"۔
    
صارف کی معلومات:
- عمر: ${userAge || 'نہیں بتائی'}
- جنس: ${userGender === 'male' ? 'مرد' : userGender === 'female' ? 'خاتون' : 'نہیں بتائی'}

صارف کا مسئلہ: "${userMessage}"

آپ کا جواب اردو میں دیں۔ یہ ضروری ہے:
1. پہلے ہمدردی کریں
2. نفسیاتی مشورہ (CBT, DBT, etc.)
3. قرآن و حدیث کا حوالہ (اردو ترجمہ کے ساتھ)
4. مختصر تفسیر
5. کوئی وظیفہ یا دعا
6. نرم اور غیر فیصلہ کن انداز میں`;

    const response = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "mixtral-8x7b-32768",
      temperature: 0.7,
      max_tokens: 1000
    });
    
    return response.choices[0]?.message?.content || getSimpleResponse(userMessage, username, userAge, userGender);
  } catch (error) {
    console.error("GROQ Error:", error.message);
    return getSimpleResponse(userMessage, username, userAge, userGender);
  }
}

// Fallback responses
function getSimpleResponse(userMessage, username, userAge, userGender) {
  const msg = userMessage.toLowerCase();
  
  if (msg.includes('سلام') || msg.includes('السلام')) {
    return `وعلیکم السلام ورحمتہ اللہ! 🌙\n\nمیں **نفس سکون** ہوں۔ براہ کرم اپنی عمر، جنس اور مسئلہ بتائیں۔`;
  }
  else if (msg.includes('نیند')) {
    return `😴 نیند نہ آنا عام مسئلہ ہے۔\n\n**🔬 نفسیاتی مشورہ:** سونے سے پہلے موبائل نہ دیکھیں، گرم دودھ پیئیں۔\n\n**📖 قرآن:** *وَجَعَلْنَا اللَّيْلَ لِبَاسًا* (النبأ: 10)\n\n🤲 "اللهم باسمك أموت وأحيا"`;
  }
  else if (msg.includes('اداسی') || msg.includes('ڈپریشن')) {
    return `😔 میں آپ کا دکھ سمجھتا ہوں۔\n\n**📖 قرآن:** *وَاسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ* (البقرہ: 45)\n\n🤲 اللہ آپ کے غموں کو دور فرمائے۔`;
  }
  else if (msg.includes('پریشانی') || msg.includes('ٹینشن')) {
    return `😟 فکر نہ کریں۔\n\n**📖 قرآن:** *أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ* (الرعد: 28)\n\n🤲 اللہ آپ کو سکون عطا فرمائے۔`;
  }
  else if (msg.includes('غصہ')) {
    return `😤 غصہ نہ کریں۔\n\n**📖 حدیث:** رسول اللہ ﷺ نے فرمایا: "غصہ نہ کرو" (بخاری)\n\n🤲 اللہ آپ کو تحمل عطا فرمائے۔`;
  }
  else {
    if (userAge && userGender) {
      return `📝 "${userMessage}"\n\nآپ: ${userAge} سالہ ${userGender === 'male' ? 'مرد' : 'خاتون'}\n\nبراہ کرم مزید تفصیل بتائیں۔`;
    } else {
      return `📝 "${userMessage}"\n\nبراہ کرم اپنی عمر، جنس اور مسئلہ بتائیں۔\n\nمثال: "میں 25 سالہ خاتون ہوں، مجھے پریشانی ہے"`;
    }
  }
}

// Routes
app.get('/', (req, res) => {
  if (req.session.username) {
    res.sendFile(path.join(__dirname, 'public/chat.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public/login.html'));
  }
});

app.post('/api/register', (req, res) => {
  const { username, password, name, age, gender } = req.body;
  
  if (!username || !password || !name) {
    return res.json({ success: false, error: 'سب فیلڈز بھریں' });
  }
  
  const hashedPassword = bcrypt.hashSync(password, 10);
  const createdAt = new Date().toISOString();
  
  db.run(`INSERT INTO users (username, password, name, age, gender, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [username, hashedPassword, name, age, gender, createdAt],
    function(err) {
      if (err) {
        res.json({ success: false, error: 'یوزر نام پہلے سے موجود ہے' });
      } else {
        req.session.username = username;
        req.session.age = age;
        req.session.gender = gender;
        res.json({ success: true });
      }
    });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (err || !user) {
      return res.json({ success: false, error: 'نام یا پاس ورڈ غلط ہے' });
    }
    
    if (bcrypt.compareSync(password, user.password)) {
      req.session.username = user.username;
      req.session.age = user.age;
      req.session.gender = user.gender;
      res.json({ success: true });
    } else {
      res.json({ success: false, error: 'نام یا پاس ورڈ غلط ہے' });
    }
  });
});

app.get('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.post('/api/chat', async (req, res) => {
  if (!req.session.username) {
    return res.json({ error: 'پہلے لاگ ان کریں' });
  }
  
  const userMessage = req.body.message;
  const botResponse = await getAIResponse(
    userMessage, 
    req.session.username, 
    req.session.age, 
    req.session.gender
  );
  
  db.run(`INSERT INTO conversations (username, user_message, bot_response, timestamp) VALUES (?, ?, ?, ?)`,
    [req.session.username, userMessage, botResponse, new Date().toISOString()]);
  
  res.json({ response: botResponse });
});

app.get('/api/history', (req, res) => {
  if (!req.session.username) {
    return res.json({ error: 'پہلے لاگ ان کریں' });
  }
  
  db.all(`SELECT user_message, bot_response, timestamp FROM conversations WHERE username = ? ORDER BY id DESC LIMIT 50`,
    [req.session.username], (err, rows) => {
      res.json(rows || []);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
