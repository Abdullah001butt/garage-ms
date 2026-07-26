import { GoogleGenAI } from "@google/genai";

export async function generateWeeklyInsights(dataSummary: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: `You are a business analyst writing a short weekly summary for the owner of a small car repair garage in the UAE (Al Bahir Garage). Given the data below, write a plain-English analysis of 3-5 sentences: what drove revenue, which jobs or areas were most profitable, and one concrete, actionable suggestion. Be direct and specific with numbers. Do not use markdown formatting, headers, or bullet points - just a short flowing paragraph.

Data for this week vs last week:
${dataSummary}`,
  });

  const text = response.text;
  if (!text) {
    throw new Error("No response generated. Please try again.");
  }
  return text.trim();
}
