import { AppContext } from "../types/env";
import { Context } from "hono";
import { AiReport, TextStats } from "../types/report";

// Ambient declarations for runtime globals (keep minimal to avoid changing project TS config)
declare const process: { env: { [key: string]: string | undefined } } | undefined
type RequestInfo = string
type RequestInit = { method?: string; headers?: Record<string, string>; body?: string }
type Response = { ok: boolean; status: number; text(): Promise<string>; json(): Promise<any> }
declare function fetch(input: RequestInfo, init?: RequestInit): Promise<Response>




// Types for the stats object returned by processText

/**
 * Send the stats to Gemini (Google Generative Language) API as a prompt and return a textual report.
 * Environment variables used (optional):
 * - GEN_API_KEY: API key for Google Generative Language API
 * - GEN_MODEL: model name (e.g. "models/text-bison-001"). Defaults to "models/text-bison-001" if not set.
 * If the API key is not provided or the request fails, the function returns a local summary report.
 */

export class AIService {

    private c: Context<AppContext>;

    constructor(c: Context<AppContext>) {
        this.c = c;
    }

private calculateShannonEntropy(text: string): number {
    const freq: Record<string, number> = {};
    for (const char of text) {
        freq[char] = (freq[char] || 0) + 1;
    }
    const len = text.length;
    let entropy = 0;
    for (const char in freq) {
        const p = freq[char] / len;
        entropy -= p * Math.log2(p);
    }
    return entropy * len;
}

private findSequentialPatterns(text: string): number {
    let patterns = 0;
    const lower = text.toLowerCase();
    for (let i = 0; i < lower.length - 2; i++) {
        const c1 = lower.charCodeAt(i);
        const c2 = lower.charCodeAt(i + 1);
        const c3 = lower.charCodeAt(i + 2);
        
        if (c1 === c2 && c2 === c3) patterns++; 
        else if (c2 === c1 + 1 && c3 === c2 + 1) patterns++; 
        else if (c2 === c1 - 1 && c3 === c2 - 1) patterns++; 
    }
    return patterns;
}

private findKeyboardPatterns(text: string): number {
    const layouts = [
        "qwertyuiop", "asdfghjkl", "zxcvbnm",
        "1234567890", "qazwsxedcrfvtgbyhnujmikolp"
    ];
    let patterns = 0;
    const lower = text.toLowerCase();
    for (const layout of layouts) {
        for (let i = 0; i < lower.length - 2; i++) {
            const chunk = lower.substring(i, i + 3);
            if (layout.includes(chunk) || layout.split('').reverse().join('').includes(chunk)) {
                patterns++;
            }
        }
    }
    return patterns;
}

private calculateLocalScore(stats: any): number {
    let score = (stats.shannonEntropy / 100) * 100;
    if (score > 100) score = 100;
    
    score -= stats.sequentialPatterns * 10;
    score -= stats.keyboardPatterns * 15;
    if (stats.includesNameOrSurname) score -= 20;
    if (stats.hasBirthYear) score -= 15;
    
    let types = 0;
    if (stats.upper > 0) types++;
    if (stats.lower > 0) types++;
    if (stats.digits > 0) types++;
    if (stats.special > 0) types++;
    
    if (types === 1) score -= 30; 
    else if (types === 2) score -= 15;
    
    return Math.max(0, Math.min(100, Math.round(score)));
}

private cleanAndSplit(text: string): string[] {
    // Kaçış karakterlerini temizle, boşlukları normalize et ve cümleleri ayır
    return text
        .replace(/[\n\r\t]/g, ' ') // Kaçış karakterlerini space'e çevir
        .replace(/\s+/g, ' ') // Birden fazla boşluğu tek boşluğa çevir
        .trim() // Başında sondaki boşlukları sil
        .split('.') // Cümleleri ayır
        .map(s => s.trim()) // Her cümleyi trim et
        .filter(s => s.length > 0); // Boş cümleleri filtrele
}

private processText(text: string, personalInfo: any): TextStats {
    // Count characters in the input string.
    // Assumption: "special characters" = characters that are not letters (any Unicode letter),
    // not digits, and not whitespace. Whitespace is counted separately below but not included in 'special'.
    let uppercase = 0
    let lowercase = 0
    let digits = 0
    let special = 0
    let whitespace = 0

    for (const ch of text) {
        if (/\p{Lu}/u.test(ch)) {
            uppercase++
        } else if (/\p{Ll}/u.test(ch)) {
            lowercase++
        } else if (/\p{Nd}/u.test(ch)) {
            digits++
        } else if (/\s/.test(ch)) {
            whitespace++
        } else {
            special++
        }
    }
    
    let nameOrsurname = (text.toLowerCase().includes(personalInfo.name?.toLowerCase()) || text.toLowerCase().includes(personalInfo.surname?.toLowerCase()))
    let birthDateInfo = personalInfo.birthDate ? personalInfo.birthDate.split('-') : ''
    let hasBirthYear = false;
    if (birthDateInfo) {
        hasBirthYear = text.includes(birthDateInfo[0]) || text.includes(birthDateInfo[2]) // YYYY might be start or end
    }
    
    let shannonEntropy = this.calculateShannonEntropy(text);
    let sequentialPatterns = this.findSequentialPatterns(text);
    let keyboardPatterns = this.findKeyboardPatterns(text);

    let baseStats = {
        upper: uppercase,
        lower: lowercase,
        digits: digits,
        special: special,
        whitespace: whitespace,
        totalLength: text.length,
        includesNameOrSurname: nameOrsurname,
        hasBirthYear: hasBirthYear,
        shannonEntropy: shannonEntropy,
        sequentialPatterns: sequentialPatterns,
        keyboardPatterns: keyboardPatterns,
        localEntropyScore: 0 // Will be computed next
    };
    
    baseStats.localEntropyScore = this.calculateLocalScore(baseStats);

    return baseStats;
}


private getSystemPrompt(): string {
    return [
        'You are a password security expert analyzing an Anonymous Technical Meta-data Profile.',
        'You will receive character statistics, Shannon entropy, and pattern analyses of a user password. THE RAW PASSWORD IS NOT PROVIDED to preserve "Privacy-by-Design".',
        'Please interpret this technical profile from these perspectives: cultural, linguistic, semantic coherence, dictionary attacks, and human behavior predictability.',
        'Evaluate whether the pattern indicates compliance with formal rules but is semantically weak (e.g. follows "WordNumber!" pattern).',
        'Provide your response exactly in this JSON format:',
        '{',
        '  "semanticScore": <an integer between 0 and 100 evaluating the semantic strength based on the provided stats and patterns>,',
        '  "suggestions": ["suggestion 1", "suggestion 2", ...] (Provide up to 3 concise, actionable, and polite suggestions in Turkish)',
        '}',
        'Do NOT wrap the JSON in Markdown block. Output raw JSON only. Warn the user if their personal information is included.'
    ].join('\n');
}

private buildUserMessage(stats: TextStats): string {
    const systemPrompt = this.getSystemPrompt();
    const statistics = [
        '{',
        `  "Uppercase letters": ${stats.upper},`,
        `  "Lowercase letters": ${stats.lower},`,
        `  "Digits": ${stats.digits},`,
        `  "Special characters": ${stats.special},`,
        `  "Whitespace characters": ${stats.whitespace},`,
        `  "Total length": ${stats.totalLength},`,
        `  "Shannon Entropy (bits)": ${stats.shannonEntropy.toFixed(2)},`,
        `  "Sequential Patterns Count": ${stats.sequentialPatterns},`,
        `  "Keyboard Layout Patterns Count": ${stats.keyboardPatterns},`,
        `  "Includes Name/Surname": ${stats.includesNameOrSurname},`,
        `  "Includes Birth Year": ${stats.hasBirthYear}`,
        '}'
    ].join('\n');
    
    return `${systemPrompt}\n\nTechnical Profile:\n${statistics}`;
}
 
async callGenAi(text: string, personalInfo: any): Promise<AiReport> {
    // 1. Anahtar ve Model Ayarları
    const GEMINI_API_KEY= this.c.env.GEN_API_KEY;
    // Eğer env.GEN_MODEL ayarlanmışsa onu kullan, yoksa 'gemini-2.5-flash' modelini kullan
    const model = 'gemini-2.5-flash'; 

    // Metni işle
    const stats = this.processText(text, personalInfo);

    // API anahtarı yoksa yerel rapora dön
    if (!GEMINI_API_KEY) {
        const localReport = "API anahtarı bulunamadı. Yerel karakter analizi raporu: Metin uzunluğu: " + stats.totalLength;
        return { report: this.cleanAndSplit(localReport), hybridScore: stats.localEntropyScore, source: 'local' };
    }

    // 2. Prompt Oluşturma
    

    // 3. API Uç Noktasını Oluşturma
    // Modeli ve API anahtarını doğrudan URL'ye ekliyoruz
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
    try {
        // Gemini API expects system instructions and user content separately
        
        // Ensure no raw passwords by logging or checking stats only.
        const userMessage = this.buildUserMessage(stats);

        const body = {
            contents: [{
                parts: [{ text: userMessage }]
            }],
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'x-goog-api-key': GEMINI_API_KEY
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const errorText = await res.text();
            //console.error('Gemini API Hata Yanıtı:', res.status, errorText);
            const fallback = `(Hata: Gemini API isteği başarısız oldu. Durum: ${res.status}. Detay: ${errorText.substring(0, 100)}...)`;
            return { report: this.cleanAndSplit(fallback), hybridScore: stats.localEntropyScore, source: 'local' };
        }

        const data = await res.json();
        
        // 4. Yanıtı Ayrıştırma
        let generated = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generated) {
            // Yanıt gövdesi gelse bile içerik boş olabilir (örneğin güvenlik engeli)
            const fallback = `(Gemini'den yanıt alınamadı. Yanıt yapısı: ${JSON.stringify(data, null, 2).substring(0, 300)}...)`;
            return { report: this.cleanAndSplit(fallback), hybridScore: stats.localEntropyScore, source: 'local' };
        }

        let semanticScore = 50;
        let suggestions: string[] = [];
        try {
            generated = generated.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(generated);
            semanticScore = typeof parsed.semanticScore === 'number' ? parsed.semanticScore : 50;
            if (Array.isArray(parsed.suggestions)) {
                suggestions = parsed.suggestions;
            } else {
                suggestions = this.cleanAndSplit(generated);
            }
        } catch (e) {
            suggestions = this.cleanAndSplit(generated);
        }

        const hybridScore = Math.floor((stats.localEntropyScore + semanticScore) / 2);

        return { report: suggestions, hybridScore, source: 'gemini' };
    } catch (err: any) {
        //console.error('Gemini API İstek Hatası:', err);
        const fallback = `(Genel Hata: Gemini API isteği sırasında bir hata oluştu: ${err?.message ?? String(err)})`;
        return { report: this.cleanAndSplit(fallback), hybridScore: stats.localEntropyScore, source: 'local' };
    }
}


}