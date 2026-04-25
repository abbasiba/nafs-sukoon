import sys
print("Python version:", sys.version)
import sqlite3
import hashlib
from datetime import datetime
import os

app = Flask(__name__, template_folder='../templates')
app.secret_key = "nafs_sukoon_2024_secret_key"

# Database file path for Vercel (/tmp is writable)
DB_PATH = '/tmp/nafs_sukoon.db'

def get_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # Users table
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (username TEXT PRIMARY KEY, 
                  password TEXT, 
                  name TEXT, 
                  age INTEGER, 
                  gender TEXT, 
                  created_at TEXT)''')
    # Conversations table
    c.execute('''CREATE TABLE IF NOT EXISTS conversations
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  username TEXT, 
                  user_message TEXT, 
                  bot_response TEXT, 
                  timestamp TEXT)''')
    conn.commit()
    return conn

def get_bot_response(user_message, username):
    msg = user_message.lower()
    
    # Get user info if exists
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT age, gender FROM users WHERE username=?", (username,))
    user_info = c.fetchone()
    conn.close()
    
    if "سلام" in msg or "السلام" in msg:
        return "وعلیکم السلام ورحمتہ اللہ! 🌙\n\nمیں **نفس سکون** ہوں - اسلامی نفسیاتی معاون۔\n\nبراہ کرم اپنی **عمر**، **جنس** (مرد/خاتون)، اور **مسئلہ** بتائیں۔"
    
    elif "اداسی" in msg or "ڈپریشن" in msg:
        return """😔 میں آپ کا دکھ سمجھتا ہوں۔

**🔬 نفسیاتی مشورہ:** روزانہ ورزش، نمونہ دار نیند، کسی سے بات کریں۔

**📖 قرآن:** *وَاسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ* (البقرہ: 45)

**🤲 وظیفہ:** روزانہ 11 بار *یا حفیظ* پڑھیں۔"""
    
    elif "پریشانی" in msg or "ٹینشن" in msg:
        return """😟 فکر اور پریشانی عام مسئلہ ہے۔

**🔬 نفسیاتی مشورہ:** 4-7-8 سانس لینے کی تکنیک آزمائیں۔

**📖 قرآن:** *أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ* (الرعد: 28)

**🤲 وظیفہ:** 100 بار *یا سلام* پڑھیں۔"""
    
    else:
        if user_info and user_info[0]:
            return f"""📝 آپ نے پوچھا: "{user_message}"

آپ کی معلومات: {user_info[0]} سالہ {'مرد' if user_info[1]=='male' else 'خاتون'}

براہ کرم مزید تفصیل بتائیں تاکہ بہتر مدد کر سکوں۔

🤲 اللہ آپ کو سکون عطا فرمائے۔"""
        else:
            return f"""📝 "{user_message}"

براہ کرم اپنی **عمر**، **جنس**، اور **مسئلہ** بتائیں۔

مثال: "میں 22 سالہ خاتون ہوں، مجھے پریشانی ہوتی ہے" """

@app.route('/')
def index():
    if 'username' in session:
        return render_template('chat.html')
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.json
        username = data.get('username')
        password = hashlib.sha256(data.get('password').encode()).hexdigest()
        
        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE username=? AND password=?", (username, password))
        user = c.fetchone()
        conn.close()
        
        if user:
            session['username'] = username
            return jsonify({"success": True})
        return jsonify({"success": False, "error": "نام یا پاس ورڈ غلط ہے"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.json
        username = data.get('username')
        password = hashlib.sha256(data.get('password').encode()).hexdigest()
        name = data.get('name')
        age = data.get('age')
        gender = data.get('gender')
        
        if not username or not password or not name:
            return jsonify({"success": False, "error": "سب فیلڈز بھریں"})
        
        conn = get_db()
        c = conn.cursor()
        c.execute("INSERT INTO users (username, password, name, age, gender, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                  (username, password, name, age, gender, datetime.now().isoformat()))
        conn.commit()
        conn.close()
        session['username'] = username
        return jsonify({"success": True})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "error": "یوزر نام پہلے سے موجود ہے"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/logout')
def logout():
    session.pop('username', None)
    return jsonify({"success": True})

@app.route('/chat', methods=['POST'])
def chat():
    if 'username' not in session:
        return jsonify({"error": "پہلے لاگ ان کریں"}), 401
    
    user_message = request.json.get('message')
    username = session['username']
    
    bot_response = get_bot_response(user_message, username)
    
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO conversations (username, user_message, bot_response, timestamp) VALUES (?, ?, ?, ?)",
              (username, user_message, bot_response, datetime.now().isoformat()))
    conn.commit()
    conn.close()
    
    return jsonify({"response": bot_response})

@app.route('/history')
def get_history():
    if 'username' not in session:
        return jsonify({"error": "پہلے لاگ ان کریں"}), 401
    
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT user_message, bot_response, timestamp FROM conversations WHERE username=? ORDER BY id DESC LIMIT 50", (session['username'],))
    history = [{"user": row[0], "bot": row[1], "time": row[2]} for row in c.fetchall()]
    conn.close()
    return jsonify(history)

# For local testing
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
