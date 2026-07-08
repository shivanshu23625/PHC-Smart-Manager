import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoint for parsing unstructured reports
  app.post('/api/extract-logistics', async (req, res) => {
    try {
      const { reportText } = req.body;

      if (!reportText || typeof reportText !== 'string' || reportText.trim() === '') {
        return res.status(400).json({ error: 'Please provide valid report text for analysis.' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: 'GEMINI_API_KEY environment variable is required. Please set your API key in AI Studio Secrets panel.'
        });
      }

      // Lazy load GoogleGenAI as recommended by safety rules
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: reportText,
        config: {
          systemInstruction: `You are a specialized medical logistics extraction agent for the PHC Smart Manager application, serving rural Indian health centers.
Your job is to read unstructured conversational input, logs, or voice transcripts from rural health workers and parse them into a strict, validated JSON structure.

Crucial: The input can be in English or any Indian language (Hindi, Bengali, Marathi, Telugu, Tamil, Gujarati, Kannada, Malayalam, Punjabi, etc.) or mixed (Hinglish/Tanglish).
Translate any native quantities, scripts, or spelled numbers to standard codes:
1. "health_center_id": Extract standard center labels (e.g., PHC_001, PHC_002, PHC_003). If not mentioned, return null.
2. "medicine_name": Map informal, regional, or native scripts to exact keys:
   - "paracetamol", "pcm", "पैरासिटामॉल", "প্যারাসিটামল", "பாரசிட்டமால்", "పారాసిటమాల్", "ಪ್ಯಾರಸಿಟಮಾಲ್", "પેરાસીટામોલ" -> "paracetamol_stock"
   - "anti venom", "anti-venom", "av", "snakebite kit", "एंटी-वेनम", "ஆன்டி-வெனம்", "యాంటీ-వెనం" -> "anti_venom_stock"
3. "quantity_used": Map native quantities/words to standard integers (e.g., "twenty", "बीस", "இருபது", "ఇరవై" -> 20; "fifty", "५०", "ஐம்பது" -> 50; "one", "एक", "ஒன்று" -> 1). If not mentioned, default to 0.
4. "doctor_present": Look for duty statements in regional languages:
   - Present: "doctor is present", "dr came", "डॉक्टर उपस्थित हैं", "டாக்டர் இருக்கிறார்", "డాక్టర్ వచ్చారు" -> true
   - Absent: "doctor absent", "no doctor", "डॉक्टर नहीं हैं", "டாக்டர் இல்லை", "డాక్టర్ లేరు" -> false
   - Default: null

Return ONLY a flat, valid JSON object following this JSON schema:
{
  "health_center_id": string or null,
  "updates": {
    "medicine_name": "paracetamol_stock" | "anti_venom_stock" | null,
    "quantity_used": integer,
    "doctor_present": boolean or null
  }
}

Do not include any markdown styling, backticks, or conversational padding.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              health_center_id: {
                type: Type.STRING,
                description: 'The health center ID extracted from the text, e.g., PHC_001, PHC_002. If not found, return null.',
              },
              updates: {
                type: Type.OBJECT,
                properties: {
                  medicine_name: {
                    type: Type.STRING,
                    description: "The exact mapped medicine name ('paracetamol_stock' or 'anti_venom_stock'). Return null if no matches.",
                  },
                  quantity_used: {
                    type: Type.INTEGER,
                    description: 'The quantity of medicine consumed (integer). Default to 0.',
                  },
                  doctor_present: {
                    type: Type.BOOLEAN,
                    description: 'True if a doctor is explicitly present/active/on-duty, false if absent/off-duty, null if not mentioned.',
                  },
                },
                required: ['medicine_name', 'quantity_used', 'doctor_present'],
              },
            },
            required: ['health_center_id', 'updates'],
          },
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error('Received empty response from Gemini model.');
      }

      // Clean the response from potential backticks
      let cleanText = text.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/```$/, '').trim();
      }

      const parsedJSON = JSON.parse(cleanText);
      return res.json(parsedJSON);

    } catch (error: any) {
      console.error('Error in extraction endpoint:', error);
      return res.status(500).json({
        error: error.message || 'An error occurred while parsing the report.'
      });
    }
  });

  // API endpoint for translating text to selected language
  app.post('/api/translate', async (req, res) => {
    try {
      const { text, targetLanguage } = req.body;

      if (!text || typeof text !== 'string' || text.trim() === '') {
        return res.status(400).json({ error: 'Please provide valid text for translation.' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: 'GEMINI_API_KEY environment variable is required. Please set your API key in AI Studio Secrets panel.'
        });
      }

      // Lazy load GoogleGenAI
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `Translate the following text into the target language code: "${targetLanguage}".
Text to translate: "${text}"`,
        config: {
          systemInstruction: `You are a professional medical and logistical translator for rural Indian health centers.
Translate the text accurately and naturally into the target language.
Keep clinical terms and station IDs recognizable (e.g., 'PHC_002', 'Paracetamol', 'Anti-Venom', 'Dr. Sarah Smith' should be preserved or translated correctly).
Return ONLY the direct translation. Do not include quotes, markdown formatting, backticks, or any preambles/conversational filler.`,
        },
      });

      const translatedText = response.text?.trim() || text;
      return res.json({ translatedText });

    } catch (error: any) {
      console.error('Error in translation endpoint:', error);
      return res.status(500).json({
        error: error.message || 'An error occurred during translation.'
      });
    }
  });

  // Serve static files / Vite client
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
