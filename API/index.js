const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

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

function getBotResponse(userMessage, username, userAge, userGender) {
  const msg = userMessage.toLowerCase();
  
  if (msg.includes('سلام') || msg.includes('السلام') || msg.includes('hi')) {
    return `وعلیکم السلام ورحمتہ اللہ! 🌙\n\nمیں **نفس سکون** ہوں - اسلامی نفسیاتی معاون۔\n\nبراہ کرم اپنی **عمر**، **جنس**، اور **مسئلہ** بتائیں۔`;
  }
  else if (msg.includes('اداسی') || msg.includes('ڈپریشن') || msg.includes('غم')) {
    return `😔 میں آپ کا دکھ سمجھتا ہوں۔\n\n**🔬 نفسیاتی مشورہ:** روزانہ ورزش، نمونہ دار نیند، کسی سے بات کریں۔\n\n**📖 قرآن:** *وَاسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ* (البقرہ: 45)\n\n**🤲 وظیفہ:** روزانہ 11 بار *یا حفیظ* پڑھیں۔\n\nاللہ آپ کے غموں کو دور فرمائے۔ 🤲`;
  }
  else if (msg.includes('پریشانی') || msg.includes('ٹینشن') || msg.includes('فکر')) {
    return `😟 فکر اور پریشانی عام مسئلہ ہے۔\n\n**🔬 نفسیاتی مشورہ:** 4-7-9 سانس لینے کی تکنیک آزمائیں۔\n\n**📖 قرآن:** *أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ* (الرعد: 28)\n\n**🤲 وظیفہ:** 100 بار *یا سلام* پڑھیں۔`;
  }
  else {
    if (userAge && userGender) {
      return `📝 آپ نے پوچھا: "${userMessage}"\n\nآپ کی معلومات: ${userAge} سالہ ${userGender === 'male' ? 'مرد' : 'خاتون'}\n\nبراہ کرم مزید تفصیل بتائیں۔\n\n🤲 اللہ آپ کو سکون عطا فرمائے۔`;
    } else {
      return `📝 "${userMessage}"\n\nبراہ کرم اپنی **عمر**، **جنس**، اور **مسئلہ** بتائیں۔\n\nمثال: "میں 22 سالہ خاتون ہوں، مجھے پریشانی ہوتی ہے"`;
    }
  }
}

app.get('/', (req, res) => {
  if (req.session.username) {
    res.sendFile(path.join(__dirname, '../public/chat.html'));
  } else {
    res.sendFile(path.join(__dirname, '../public/login.html'));
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
        req.session.name = name;
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
      req.session.name = user.name;
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

app.post('/api/chat', (req, res) => {
  if (!req.session.username) {
    return res.json({ error: 'پہلے لاگ ان کریں' });
  }
  
  const userMessage = req.body.message;
  const username = req.session.username;
  const userAge = req.session.age;
  const userGender = req.session.gender;
  
  const botResponse = getBotResponse(userMessage, username, userAge, userGender);
  
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

module.exports = app;
