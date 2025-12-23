import fetch from 'node-fetch';
import { systemPrompt } from './prompt.js';
import { KNOWLEDGE } from './knowledge.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function askGPT(userText) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt() + '\n\n' + KNOWLEDGE },
        { role: 'user', content: userText }
      ],
      temperature: 0.4
    })
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Я уточню и вернусь к вам 🌿';
}
