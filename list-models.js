const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/GEMINI_API_KEY=(.*)/);
const key = match ? match[1].trim() : '';

async function run() {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await res.json();
    if (data.error) {
      console.error("API Error:", data.error.message);
    } else {
      console.log("Available models:");
      data.models.forEach(m => console.log(m.name, "-", m.supportedGenerationMethods));
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}

run();
