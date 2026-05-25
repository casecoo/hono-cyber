import { includes } from "zod"

export interface TextStats {
    upper: number
    lower: number
    digits: number
    special: number
    whitespace: number
    totalLength: number
    includesNameOrSurname: boolean
    hasBirthYear: boolean
    shannonEntropy: number
    sequentialPatterns: number
    keyboardPatterns: number
    localEntropyScore: number
}

export interface AiReport {
    report: string[]
    hybridScore: number
    source: 'gemini' | 'local'
}
