const https = require("https");
const apiKey = process.env.VITE_GEMINI_API_KEY || ""; // We can't access env in sandbox easily, let's just do a dummy request
const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=invalid_key";

https.get(url, (res) => {
  console.log("Status Code:", res.statusCode);
}).on('error', (e) => {
  console.error("Error:", e.message);
});
