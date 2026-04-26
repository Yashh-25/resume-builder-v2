require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Serve frontend
app.use(express.static(path.join(__dirname, "../public")));

// ✅ Gemini Setup
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

// 🔐 Allowed Users
const allowedUsers = [
    "yash_001",
    "yash_002",
    "vedant_001",
    "pranjali_001",
    "sakshi_001"
];

// 🔹 Default route
app.get("/", (req, res) => {
    res.redirect("/login.html");
});

// 🔹 Login API
app.post("/login", (req, res) => {
    let { username } = req.body;

    if (!username) {
        return res.json({ success: false, message: "Username is required" });
    }

    username = username.toLowerCase().trim();

    if (allowedUsers.includes(username)) {
        return res.json({ success: true, message: "Login successful" });
    } else {
        return res.json({ success: false, message: "Invalid username" });
    }
});

// 🔥 KEYWORD EXTRACTION API
app.post("/extract-keywords", async (req, res) => {
    try {
        const { jd } = req.body;

        if (!jd) {
            return res.json({ keywords: [] });
        }

        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: `
Extract ONLY important technical keywords from the job description.

STRICT RULES:
- Return ONLY a valid JSON array
- No explanation
- No extra text

Example:
["Java","Spring Boot","AWS"]

JD:
${jd}
            `
        });

        const raw = response.text;

        // 🔥 SAFE JSON EXTRACTION
        let keywords;

        try {
            const match = raw.match(/\[.*\]/s);
            keywords = match ? JSON.parse(match[0]) : [];
        } catch {
            keywords = [];
        }

        res.json({ keywords });

    } catch (err) {
        console.log("Gemini Error:", err);

        // 🔁 fallback
        try {
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: `Extract keywords as JSON array:\n${req.body.jd}`
            });

            const raw = response.text;

            let keywords;
            try {
                const match = raw.match(/\[.*\]/s);
                keywords = match ? JSON.parse(match[0]) : [];
            } catch {
                keywords = [];
            }

            res.json({ keywords });

        } catch (e) {
            console.log("Fallback Error:", e);
            res.json({ keywords: [] });
        }
    }
});

app.post("/generate-resume", async (req, res) => {
    try {
        const { timeline, keywords, userComment } = req.body;

        const keywordText = keywords
            .map(k => `${k.keyword} (${k.weight})`)
            .join(", ");

        const prompt = `
Create a PROFESSIONAL resume.

INPUT:

Timeline:
${timeline}

Keywords with importance:
${keywordText}

User Special Instructions:
${userComment || "None"}

STRICT RULES:

1. Structure:
- Professional Summary (8 points)
And in professional summary start 15 points with words I'm giving now:
1. Professional
2. Extensive experience
3. Strong expertise
4. Hands on experience
5. Proficient in
6. Experience
7. Strong expertise
8. Hands on experience


2. Each point:
- 5–15 words
- Realistic
- Strong action verbs

3. Logic:
- Latest role = advanced
- Older roles = basic
- Match tech with timeline years

4. Keywords:
- Use naturally based on weight

5. Output:
- Clean text
- No markdown
- No symbols like **

Generate now.
`;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview", // ✅ WORKING MODEL
            contents: prompt
        });

        const resume = response.text;

        res.json({ resume });

    } catch (err) {
        console.log("Resume Error:", err);
        res.json({ resume: "Error generating resume" });
    }
});
// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});