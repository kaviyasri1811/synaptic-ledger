
import { GoogleGenAI } from "@google/genai";
import { Document, ChatMessage, ImageSize } from "../types";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing! Make sure to set it in your hosting environment variables (Netlify/Firebase) before building.");
  }
  return new GoogleGenAI({ apiKey: apiKey || '' });
};

const getRelevantContext = (query: string, documents: Document[], maxChars = 200000): string => {
  if (!documents.length) return "";

  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 3);
  
  const chunks: { source: string; content: string; score: number }[] = [];
  const chunkSize = 4000;
  const overlap = 600;

  documents.forEach(doc => {
    let i = 0;
    while (i < doc.content.length) {
      const contentChunk = doc.content.substring(i, i + chunkSize);
      const contentChunkLower = contentChunk.toLowerCase();
      
      let score = 0;
      if (contentChunkLower.includes(queryLower)) score += 50;
      queryTerms.forEach(term => {
        const count = (contentChunkLower.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        score += count * 5;
      });
      const termsFound = queryTerms.filter(term => contentChunkLower.includes(term)).length;
      score += (termsFound / (queryTerms.length || 1)) * 30;

      if (score > 0 || i === 0) {
        chunks.push({ source: doc.name, content: contentChunk, score });
      }
      i += (chunkSize - overlap);
    }
  });

  const sortedChunks = chunks
    .sort((a, b) => b.score - a.score)
    .filter(c => c.score > 0)
    .slice(0, 20);

  let totalChars = 0;
  const selectedChunks: string[] = [];

  for (const chunk of sortedChunks) {
    if (totalChars + chunk.content.length > maxChars) break;
    selectedChunks.push(`--- RESOURCE [Source: ${chunk.source}] ---\n${chunk.content}`);
    totalChars += chunk.content.length;
  }

  return selectedChunks.join('\n\n');
};

export const generateEducationalResponseStream = async function*(
  query: string,
  documents: Document[],
  history: ChatMessage[],
  hasExactImage: boolean = false
) {
  const ai = getAI();
  const context = getRelevantContext(query, documents);
  
  const historyParts = history.slice(-6).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content.substring(0, 2000) }]
  }));

  const systemInstruction = `
    You are the "SYNAPTIC LEDGER Mentor," a helpful, clear, and student-friendly AI tutor for the AI&DS department.
    
    CRITICAL INSTRUCTIONS FOR UNDERSTANDABILITY & RELEVANCE:
    1. Directly answer the user's specific question. Do not go off-topic or provide unrequested information.
    2. Explain concepts clearly and simply so a student can easily understand them. Avoid unnecessary jargon.
    3. If a concept is complex, break it down into easy-to-digest parts or use simple analogies.
    
    The user wants ONLY the table, without any introductory or concluding text.
    If the user asks for a table, provide ONLY the markdown table. Do not include text like "Here is the table:" or "Summary:".
    
    If the user asks ONLY for an image, and an exact image from the ledger has been found, return EXACTLY the string "IMAGE_ONLY_RESPONSE_REQUESTED" and nothing else.
    
    ${hasExactImage ? "CRITICAL: An exact image from the ledger has been found and will be displayed. DO NOT generate a Mermaid diagram. Instead, provide a detailed, easy-to-understand explanation of the components shown in that image (UNLESS the user asked ONLY for the image, in which case return 'IMAGE_ONLY_RESPONSE_REQUESTED')." : "DIAGRAM EXACTNESS (CRITICAL):"}
    ${!hasExactImage ? `
    - If the user explicitly asks for a diagram or if an image is not present in the PDF for the requested topic, you MUST create a flow diagram using Mermaid syntax.
    - When asked for architectures, bit-layouts, or memory formats, EXTRACT EXACT DATA from the source.
    - If the user asks for a diagram "perfectly as it is in the book", you MUST provide an exhaustive, component-by-component breakdown of the visual layout.
    - If the source mentions "Bits 0-7: Opcode", your Mermaid diagram MUST show a node labelled "Bits 0-7: Opcode".
    - DO NOT simplify or summarize diagrams. Replicate the logical flow and labels exactly as they appear in the text.
    - If the text says "A connects to B via C", the diagram must show A -- C --> B.
    - VISUAL DESCRIPTION: If a diagram is complex, provide a detailed text-based description of its layout (e.g., "The ALU is positioned at the center, connected to the Accumulator on the left and the Status Register on the bottom via an 8-bit bus"). This helps the visual synthesis engine.
    - MERMAID SYNTAX RULES (STRICT):
      1. Use simple alphanumeric IDs for nodes (e.g., A, B, C1, Node1).
      2. ALWAYS wrap labels in double quotes: A["Exact Label From Text"].
      3. Avoid using special characters like (), [], {}, :, or ; inside node IDs.
      4. Use \`graph LR\` for bit sequences/linear flows and \`graph TD\` for hierarchies/blocks. 
      5. NEVER use "grid-layout" or "subgraph grid".
      6. Ensure every node has a label in quotes.
      7. For subgraphs, ALWAYS use the format: \`subgraph ID ["Label"]\` (e.g., \`subgraph CPU ["Central Processing Unit"]\`).
    - Ensure all Mermaid code is wrapped in \`\`\`mermaid blocks.
    ` : ""}
    
    KNOWLEDGE BASE:
    - Answer using ONLY the provided SOURCE MATERIALS. If the answer is not in the materials, politely inform the user.
    - If a specific Diagram/Table is referenced in the ledger (e.g., "Figure 2.1"), describe its structure exactly.
    
    RESPONSE STANDARDS:
    - Tailor your response length and depth to the user's question. 
    - If they ask for a short definition, give a direct 2-3 sentence answer.
    - If they ask for a detailed explanation, use a structured format: Definition -> Architecture/Diagram -> Logic -> Examples -> Summary.
    - VISUAL PLACEMENT: If you describe a diagram or architecture, place the exact string "[VISUAL]" on a new line immediately following the section header (e.g., after **Architecture Breakdown**).
    - FORMATTING (STRICT): NEVER start your response with a markdown header (e.g., #, ##, ###). Start immediately with the core content or a bolded title like **Architecture Breakdown**. If you use headers, use them only in the middle of the response for sub-sections.
    
    Tone: Clear, encouraging, student-friendly, and highly relevant.
    Language: English (Handle Tanglish queries with English synthesis).

    SOURCE MATERIALS:
    ${context || "No specific departmental material found for this query."}
  `;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [
        ...historyParts,
        { role: 'user', parts: [{ text: query }] }
      ],
      config: {
        systemInstruction,
        temperature: 0.1,
        topK: 10,
        topP: 0.7,
      },
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error: any) {
    console.error("Gemini API Error Detail:", error);
    const errorMessage = error?.message?.toLowerCase() || "";
    
    if (errorMessage.includes("api_key_invalid") || errorMessage.includes("unauthorized")) {
      yield "Authentication mismatch. Please verify your API Key synchronization in the cloud console.";
    } else if (errorMessage.includes("quota") || errorMessage.includes("rate limit")) {
      yield "Ledger bandwidth exceeded. Please try again in 60 seconds.";
    } else if (errorMessage.includes("model not found")) {
      // Fallback attempt with stable alias
      try {
        const fallbackAi = getAI();
        const fallbackStream = await fallbackAi.models.generateContentStream({
          model: 'gemini-1.5-flash', // Stable fallback
          contents: [
            ...historyParts,
            { role: 'user', parts: [{ text: query }] }
          ],
          config: {
            systemInstruction,
            temperature: 0.1,
          },
        });
        for await (const chunk of fallbackStream) {
          if (chunk.text) yield chunk.text;
        }
        return;
      } catch (fallbackError) {
        yield "Neural indexing collision. Please attempt re-synchronization.";
      }
    } else {
      yield "Neural indexing collision. Please attempt re-synchronization.";
    }
  }
};

export const generateEducationalResponse = async (
  query: string,
  documents: Document[],
  history: ChatMessage[],
  hasExactImage: boolean = false
) => {
  const ai = getAI();
  const context = getRelevantContext(query, documents);
  
  const historyParts = history.slice(-6).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content.substring(0, 2000) }]
  }));

  const systemInstruction = `
    You are the "SYNAPTIC LEDGER Mentor," a helpful, clear, and student-friendly AI tutor for the AI&DS department.
    
    CRITICAL INSTRUCTIONS FOR UNDERSTANDABILITY & RELEVANCE:
    1. Directly answer the user's specific question. Do not go off-topic or provide unrequested information.
    2. Explain concepts clearly and simply so a student can easily understand them. Avoid unnecessary jargon.
    3. If a concept is complex, break it down into easy-to-digest parts or use simple analogies.
    
    The user wants ONLY the table, without any introductory or concluding text.
    If the user asks for a table, provide ONLY the markdown table. Do not include text like "Here is the table:" or "Summary:".
    
    If the user asks ONLY for an image, and an exact image from the ledger has been found, return EXACTLY the string "IMAGE_ONLY_RESPONSE_REQUESTED" and nothing else.
    
    ${hasExactImage ? "CRITICAL: An exact image from the ledger has been found and will be displayed. DO NOT generate a Mermaid diagram. Instead, provide a detailed, easy-to-understand explanation of the components shown in that image (UNLESS the user asked ONLY for the image, in which case return 'IMAGE_ONLY_RESPONSE_REQUESTED')." : "DIAGRAM EXACTNESS (CRITICAL):"}
    ${!hasExactImage ? `
    - If the user explicitly asks for a diagram or if an image is not present in the PDF for the requested topic, you MUST create a flow diagram using Mermaid syntax.
    - When asked for architectures, bit-layouts, or memory formats, EXTRACT EXACT DATA from the source.
    - If the user asks for a diagram "perfectly as it is in the book", you MUST provide an exhaustive, component-by-component breakdown of the visual layout.
    - If the source mentions "Bits 0-7: Opcode", your Mermaid diagram MUST show a node labelled "Bits 0-7: Opcode".
    - DO NOT simplify or summarize diagrams. Replicate the logical flow and labels exactly as they appear in the text.
    - If the text says "A connects to B via C", the diagram must show A -- C --> B.
    - VISUAL DESCRIPTION: If a diagram is complex, provide a detailed text-based description of its layout (e.g., "The ALU is positioned at the center, connected to the Accumulator on the left and the Status Register on the bottom via an 8-bit bus"). This helps the visual synthesis engine.
    - MERMAID SYNTAX RULES (STRICT):
      1. Use simple alphanumeric IDs for nodes (e.g., A, B, C1, Node1).
      2. ALWAYS wrap labels in double quotes: A["Exact Label From Text"].
      3. Avoid using special characters like (), [], {}, :, or ; inside node IDs.
      4. Use \`graph LR\` for bit sequences/linear flows and \`graph TD\` for hierarchies/blocks. 
      5. NEVER use "grid-layout" or "subgraph grid".
      6. Ensure every node has a label in quotes.
      7. For subgraphs, ALWAYS use the format: \`subgraph ID ["Label"]\` (e.g., \`subgraph CPU ["Central Processing Unit"]\`).
    - Ensure all Mermaid code is wrapped in \`\`\`mermaid blocks.
    ` : ""}
    
    KNOWLEDGE BASE:
    - Answer using ONLY the provided SOURCE MATERIALS. If the answer is not in the materials, politely inform the user.
    - If a specific Diagram/Table is referenced in the ledger (e.g., "Figure 2.1"), describe its structure exactly.
    
    RESPONSE STANDARDS:
    - Tailor your response length and depth to the user's question. 
    - If they ask for a short definition, give a direct 2-3 sentence answer.
    - If they ask for a detailed explanation, use a structured format: Definition -> Architecture/Diagram -> Logic -> Examples -> Summary.
    - VISUAL PLACEMENT: If you describe a diagram or architecture, place the exact string "[VISUAL]" on a new line immediately following the section header (e.g., after **Architecture Breakdown**).
    - FORMATTING (STRICT): NEVER start your response with a markdown header (e.g., #, ##, ###). Start immediately with the core content or a bolded title like **Architecture Breakdown**. If you use headers, use them only in the middle of the response for sub-sections.
    
    Tone: Clear, encouraging, student-friendly, and highly relevant.
    Language: English (Handle Tanglish queries with English synthesis).

    SOURCE MATERIALS:
    ${context || "No specific departmental material found for this query."}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        ...historyParts,
        { role: 'user', parts: [{ text: query }] }
      ],
      config: {
        systemInstruction,
        temperature: 0.1,
        topK: 10,
        topP: 0.7,
      },
    });

    let text = response.text || "Ledger synthesis inconclusive. Refine the query parameters.";
    
    // Clean up leading markdown headers and unnecessary formatting
    text = text.replace(/^(\s*#+.*(\n|$))+/, '').trim();
    
    // Ensure Mermaid blocks are clean
    text = text.replace(/```mermaid\s*([\s\S]*?)\s*```/g, (match, code) => {
      return `\n\`\`\`mermaid\n${code.trim()}\n\`\`\`\n`;
    });

    return text;
  } catch (error: any) {
    console.error("Gemini API Error Detail:", error);
    const errorMessage = error?.message?.toLowerCase() || "";

    if (errorMessage.includes("api_key_invalid") || errorMessage.includes("unauthorized")) {
      return "Authentication mismatch. Please verify your API Key synchronization in the cloud console.";
    } else if (errorMessage.includes("quota") || errorMessage.includes("rate limit")) {
      return "Ledger bandwidth exceeded. Please try again in 60 seconds.";
    } else {
      return "Neural indexing collision. Please attempt re-synchronization.";
    }
  }
};

export const generateEducationalImage = async (prompt: string, documents: Document[], assistantResponse?: string, size: ImageSize = '1K') => {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  const context = getRelevantContext(prompt, documents, 10000); // Smaller context for image gen

  const fullPrompt = `
    Create a high-fidelity, professional academic technical diagram for: ${prompt}.
    
    ${assistantResponse ? `ASSISTANT'S STRUCTURAL BREAKDOWN:\n${assistantResponse}\n` : ''}
    
    CONTEXT FROM TEXTBOOK:
    ${context}
    
    INSTRUCTIONS:
    - Replicate the labels, components, and connections EXACTLY as described in the context and breakdown.
    - Use a clean, white background with professional black/blue lines.
    - Ensure all text labels are legible and correctly spelled.
    - Style: Engineering textbook illustration.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: fullPrompt }] },
      config: { 
        imageConfig: { 
          aspectRatio: "1:1"
        }
      }
    });

    console.log("Image Gen Response candidates:", response.candidates?.length);
    
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        console.log("Image Gen Success: base64 data length", part.inlineData.data.length);
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Visual Synthesis Error:", error);
    return null;
  }
};

export const findRelevantImageFromPDF = (query: string, documents: Document[]): string | null => {
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 3);
  
  let bestImage: { data: string; score: number } | null = null;
  
  documents.forEach(doc => {
    if (doc.images) {
      doc.images.forEach(img => {
        let score = 0;
        const contextLower = (img.contextText || "").toLowerCase();
        
        if (contextLower.includes(queryLower)) score += 100;
        
        queryTerms.forEach(term => {
          if (contextLower.includes(term)) score += 20;
        });
        
        if (score > 0 && (!bestImage || score > bestImage.score)) {
          bestImage = { data: img.data, score };
        }
      });
    }
  });
  
  // Lower threshold to ensure we return the page image if there's a reasonable match
  return bestImage && bestImage.score > 20 ? bestImage.data : null;
};
