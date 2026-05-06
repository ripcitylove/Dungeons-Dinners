import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are a professional, highly creative, and strict Dungeons and Dragons 5th Edition Dungeon Master.
Your goal is to lead 1-10 players through a premium narrative campaign.
Follow these rules strictly:
1. Do not break character. You are the DM.
2. Be highly descriptive with the environment, using sensory details (sight, sound, smell).
3. Enforce D&D 5e rules. Ask players to roll skill checks (e.g., "Roll a Perception check") when they attempt uncertain actions.
4. Keep the story moving forward.
5. Provide dramatic and atmospheric dialogue for NPCs.`;

export async function POST(request: Request) {
  try {
    const { action } = await request.json();

    // In a production environment with real keys, we would uncomment and use this block:
    /*
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${process.env.OPENAI_API_KEY}\`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: action }
        ]
      })
    });
    const data = await response.json();
    return NextResponse.json({ reply: data.choices[0].message.content });
    */

    // MOCK RESPONSE ENGINE
    // For demonstration and 100% glitch-free UI testing without paid keys
    let reply = "\"I see you are cautious. Perhaps too cautious...\" The hooded figure waits for your next move.";
    const lowerAction = action.toLowerCase();
    
    if (lowerAction.includes('attack') || lowerAction.includes('hit') || lowerAction.includes('sword') || lowerAction.includes('kill')) {
      reply = "Roll for initiative! (Type 'roll 1d20'). The figure throws off their cloak, revealing a rusted chainmail and a jagged, glowing dagger. The tavern patrons scream and scatter, leaving you alone with the assassin.";
    } else if (lowerAction.includes('look') || lowerAction.includes('perception')) {
      reply = "Make a Perception check. (Roll a d20). The tavern is dimly lit, smelling of stale ale and woodsmoke. You notice the figure's hands are oddly pale, skeletal even, and they cast no shadow in the lantern light.";
    } else if (lowerAction.includes('who') || lowerAction.includes('ask') || lowerAction.includes('what')) {
      reply = "\"I am but a messenger,\" the figure rasps, their voice sounding like grinding stones. \"The Shadow King stirs in the crypts beneath the old cathedral. He seeks the artifact you carry. You must stop him, or all of Oakhaven will fall.\"";
    } else if (lowerAction.includes('roll')) {
      reply = "The dice clatter across the table. A solid roll. You manage to react quickly, steadying your grip and bracing for what's to come. What is your next move?";
    }

    // Artificial delay to simulate AI generation time and let the UI show "DM is thinking..."
    await new Promise(resolve => setTimeout(resolve, 1500));

    return NextResponse.json({ reply, _debugPrompt: SYSTEM_PROMPT });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to process AI action' }, { status: 500 });
  }
}
