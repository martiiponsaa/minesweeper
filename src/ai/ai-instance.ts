import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  promptDir: './prompts',
  plugins: [
    googleAI({
      apiKey: "AIzaSyCxX3a5JvGLVnLo2kW5rPS_muAVYtzTTzM",
      // apiKey: 
    }),
  ],
  model: 'googleai/gemini-2.0-flash',
});

