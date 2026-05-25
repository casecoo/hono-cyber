# Ai Powered Secure Password Scoring API

This project provides a robust, privacy-first API for password security analysis using a dual-layered scoring. It combines mathematical profiling via local computations on Cloudflare Workers with semantic interpretation powered by the Google Gemini API.

## Core Features
*   **Privacy-by-Design:** The most important feature. Raw passwords are *never* transmitted to external AI servers.
*   **Dual-layer Hybrid Score:** Analyzed by local algorithms for mathematical strength and by Gemini API for human-predictability or dictionary patterns.
*   **Actionable Feedback:** Returns 0-100 numerical score and targeted security tips in Turkish.
*   **Edge Performance:** Runs completely on the edge using Cloudflare Workers (Hono framework).

## System Architecture & Flow

The system analyzes a password using a 3-step pipeline:

1.  **Local Mathematical Profiling:** When a password request arrives, it calculates character distributions (upper, lower, digits, etc.), Shannon Entropy (randomness), and scans for sequential (e.g., "123") or keyboard (e.g., "qwe") patterns. A local score is calculated.
2.  **Anonymous AI Processing:** An "Anonymous Technical Meta-data Profile" is generated from the local calculations. The original raw password is discarded. This anonymous profile is sent securely to the Gemini API.
3.  **Hybrid Output:** Gemini evaluates the metrics (looking for semantic weakness despite formal complexity) and returns a semanticScore. The system averages the two scores into a combined hybridScore (0-100) and returns the JSON payload to the user.

## Requirements & Setup

*   [Node.js](https://nodejs.org/) & [Bun](https://bun.sh/) (or NPM)
*   A Google [Gemini API Key](https://aistudio.google.com/app/apikey)
*   Wrangler CLI for Cloudflare Workers

### 1. Installation

`ash
git clone <repository-url>
cd <project-folder>
bun install
`

### 2. Environment Variables

Create .dev.vars and .env files in your root directory based on the .env.example.

`env
GEN_API_KEY="your-gemini-api-key-here"
X_API_KEY="your-secure-internal-api-key"
`

### 3. Local Development

Run the Cloudflare dev server locally:

`ash
bun run dev
`

The API will typically start at http://localhost:8787/.

---

## API Usage

### Cyber Endpoint (/api/cyber)

This endpoint accepts the password data and user information.

**Method:** POST
**URL:** http://localhost:8787/api/cyber
**Headers:**
*   Content-Type: application/json
*   x-api-key: your-secure-internal-api-key *(If auth middleware is enabled)*

**Request Body Example:**

`json
{
  "password": "Password123!",
  "personalInfo": {
    "name": "Jane",
    "surname": "Doe",
    "birthDate": "1990-12-05"
  }
}
`

**Response Example:**

```json
{
  "status": "success",
  "hybridScore": 65,
  "processedResult": [
    "You have a strong number combination, but using capital letters at the beginning of the word is a common mistake.",
    "Including your birth year is a major security vulnerability. Please change it."
  ]
}
```

---

## Front-end Integration Guide

Integrating this API into your Front-end (React, Vue, Vanilla JS, etc.) is straightforward.

### Example: React etch Call

`javascript
import React, { useState } from 'react';

const PasswordChecker = () => {
    const [password, setPassword] = useState('');
    const [score, setScore] = useState(null);
    const [feedback, setFeedback] = useState([]);

    const checkPassword = async () => {
        try {
            const response = await fetch('http://localhost:8787/api/cyber', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // 'x-api-key': 'your-secure-internal-api-key' // if auth is active
                },
                body: JSON.stringify({
                    password: password,
                    personalInfo: {
                        name: "Test",
                        surname: "User",
                        birthDate: "2000-01-01"
                    }
                })
            });

            const data = await response.json();
            
            if (data.status === 'success') {
                setScore(data.hybridScore); // 0-100 value
                setFeedback(data.processedResult); // Array of string tips
            }
        } catch (error) {
            console.error("Error connecting to Password Security API:", error);
        }
    };

    return (
        <div>
            <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Enter password"
            />
            <button onClick={checkPassword}>Analyze Strength</button>

            {score !== null && (
                <div>
                    <h3>Security Score: {score}/100</h3>
                    <ul>
                        {feedback.map((tip, index) => <li key={index}>{tip}</li>)}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default PasswordChecker;
`

---

## Security & "Privacy-by-Design" Notice

The fundamental design of this project is built on **Privacy-by-Design**.
When working with AI APIs (like Gemini, OpenAI, etc.), sending raw passwords poses a severe data privacy risk.

In this architecture:
1.  **NO RAW DATA TRANSMISSION:** The Gemini model *never* receives the string Password123!. It receives a sanitized JSON object detailing lengths, specific pattern counts, and logical entropy calculations.
2.  **EDGE PROCESSING:** All the critical math and data hashing is kept on the Cloudflare Worker Edge environment. Once the function ends, memory is cleared.
3.  **ANONYMOUS EVALUATION:** The AI is forced to become a "rule engine", processing structural meta-data rather than the actual linguistic content, making database leaks irrelevant to this app architecture.
