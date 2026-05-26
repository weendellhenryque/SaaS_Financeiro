import { google } from 'googleapis';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from './env.js';

// Drive API - usa Application Default Credentials (arquivo da service account)
const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/drive'],
});

export const driveClient = google.drive({ version: 'v3', auth });
export const visionClient = new ImageAnnotatorClient();
export const geminiClient = new GoogleGenerativeAI(env.GEMINI_API_KEY);

export const geminiModel = geminiClient.getGenerativeModel({
  model: env.GEMINI_MODEL,
  generationConfig: { temperature: 0.1 }, // determinístico para RAG
});

export const embeddingModel = geminiClient.getGenerativeModel({
  model: env.EMBEDDING_MODEL,
});
