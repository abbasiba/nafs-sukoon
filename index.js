const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const Groq = require('groq-sdk');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'nafs-sukoon-secret-key-2024',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

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

// GROQ AI
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// AI Response - Yeh ab age/gender nahi puchega agar pehle se hai
async function getAIResponse(userMessage, username, userAge, userGender, userName) {
  // Agar API key nahi hai to simple response de
  if (!process.env.GROQ_API_KEY) {
    return getSimpleResponse(userMessage, userAge, userGender);
  }
  
  try {
    // Agar age aur gender pehle se hain to unhe use karein, nahi to puche
    let contextInfo = "";
    if (userAge && userGender) {
      contextInfo = `صارف کی معلومات: ${userAge} سالہ ${userGender === 'male' ? 'مرد' : 'خاتون'}`;
    } else {
      contextInfo = `صارف نے ابھی اپنی عمر اور جنس نہیں بتائی۔ براہ کرم پہلے یہ پوچھیں۔`;
    }
    
    const prompt = `آپ "نفس سکون" ہیں - ایک اسلامی نفسیاتی معاون۔

${contextInfo}

صارف کا سوال: "${userMessage}"

اپنے جواب میں یہ رکھیں:
1. پہلے ہمدردی کریں
2. موجودہ نفسیات سے مشورہ دیں
3. قرآن و حدیث کا حوالہ (اردو ترجمہ کے ساتھ)
4. مختصر تفسیر
5. آخر میں دعا یا وظیفہ

اگر صارف کی عمر اور جنس پہلے سے موجود ہے تو دوبارہ نہ پوچھیں۔
جواب اردو میں دیں۔`;

    const response = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "mixtral-8x7b-32768",
      temperature: 0.7,
      max_tokens: 800
    });
    
    return response.choices[0]?.message?.content || getSimpleResponse(userMessage, userAge, userGender);
  } catch (error) {
    console.error("GROQ Error:", error.message);
    return getSimpleResponse(userMessage, userAge, userGender);
  }
}

// Simple responses (agar API fail ho to)
function getSimpleResponse(userMessage, userAge, userGender) {
  const msg = userMessage.toLowerCase();
  
  // Agar age/gender pehle se hain to unhe dobara nahi puchega
  const hasInfo = (userAge && userGender);
  
  if (msg.includes('سلام') || msg.includes('السلام')) {
    if (hasInfo) {
      return `وعلیکم السلام! 🌙\n\nآپ ${userAge} سالہ ${userGender === 'male' ? 'مرد' : 'خاتون'} ہیں۔\n\nبتائیے، آپ کو کس قسم کی پریشانی ہے؟\n\n• اداسی / ڈپریشن\n• پریشانی / ٹینشن\n• نیند نہ آنا\n• غصہ / تناؤ`;
    } else {
      return `وعلیکم السلام! 🌙\n\nمیں نفس سکون ہوں۔ براہ کرم اپنی عمر اور جنس بتائیں۔\n\nمثال: "میں 30 سالہ مرد ہوں"`;
    }
  }
  else if (msg.includes('اداسی') || msg.includes('ڈپریشن')) {
    return `😔 میں آپ کا دکھ سمجھتا ہوں۔\n\n**📖 قرآن:** *وَاسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ* (البقرہ: 45)\n\n🤲 اللہ آپ کے غموں کو دور فرمائے۔`;
  }
  else if (msg.includes('پریشانی') || msg.includes('ٹینشن')) {
    return `😟 فکر نہ کریں۔\n\n**📖 قرآن:** *أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ* (الرعد: 28)\n\n🤲 اللہ آپ کو سکون عطا فرمائے۔`;
  }
  else if (msg.includes('نیند')) {
    return `😴 نیند نہ آنا عام مسئلہ ہے۔\n\n**📖 قرآن:** *وَجَعَلْنَا اللَّيْلَ لِبَاسًا* (النبأ: 10)\n\n🤲 اللہ آپ کو نیند عطا فرمائے۔`;
  }
  else if (msg.includes('غصہ')) {
    return `😤 غصہ نہ کریں۔\n\n**📖 حدیث:** "غصہ نہ کرو" (بخاری)\n\n🤲 اللہ آپ کو تحمل عطا فرمائے۔`;
  }
  else {
    if (hasInfo) {
      return `📝 "${userMessage}"\n\nمیں آپ کی مدد کرنا چاہتا ہوں۔ کیا آپ مزید تفصیل بتا سکتے ہیں؟\n\n🤲 اللہ آپ پر سکون نازل فرمائے۔`;
    } else {
      return `📝 "${userMessage}"\n\nبراہ کرم اپنی **عمر** اور **جنس** بتائیں۔\n\nمثال: "میں 25 سالہ خاتون ہوں"`;
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
    [username, hashedPassword, name, age || null, gender || null, createdAt],
    function(err) {
      if (err) {
        res.json({ success: false, error: 'یوزر نام پہلے سے موجود ہے' });
      } else {
        req.session.username = username;
        req.session.userName = name;
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
      req.session.userName = user.name;
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
  const username = req.session.username;
  const userAge = req.session.age;
  const userGender = req.session.gender;
  const userName = req.session.userName;
  
  const botResponse = await getAIResponse(userMessage, username, userAge, userGender, userName);
  
  db.run(`INSERT INTO conversations (username, user_message, bot_response, timestamp) VALUES (?, ?, ?, ?)`,
    [username, userMessage, botResponse, new Date().toISOString()]);
  
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
