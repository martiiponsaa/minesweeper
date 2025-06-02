import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/ai-instance'; // Import your Genkit AI instance

export async function POST(req: NextRequest) {
    try {
    const { message } = await req.json();

    if (!message) {
        return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Use your Genkit AI instance to generate content
    const result = await ai.generate({
        prompt: message,
        // You can add configuration here, e.g., temperature, maxTokens
    });

    const aiResponse = result.text; // Get the generated text

    return NextResponse.json({ response: aiResponse });

    } catch (error) {
    console.error('Error in chat API route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}