window.ElioBrain = (() => {
  const moods = {
    curious: 'A little curious',
    happy: 'Happy to see you',
    excited: 'So excited!',
    confused: 'Trying to follow',
    worried: 'Here for you',
    surprised: 'Oh!',
    annoyed: 'Mildly offended',
    sleepy: 'Sleepy',
    thinking: 'Thinking',
    listening: 'All ears',
    speaking: 'Speaking',
    neutral: 'Taking it in',
  };

  function createProvider({ memory }) {
    const personality = window.ElioPersonality.create();

    function currentTitle(turnCount) {
      const titles = memory.getSettings().selectedTitles;
      return titles[turnCount % titles.length] || 'Architect';
    }

    function think({ message, perception = 'conversation' }) {
      const text = message.trim();
      const lower = text.toLowerCase();
      const stored = memory.getSettings().memoryEnabled ? memory.getLongTerm() : { name: '', likes: [], notes: [] };
      const previousTurn = memory.getContext().filter((turn) => turn.role === 'user').slice(-1)[0];
      const title = currentTitle(stored.interactions);
      const rememberMatch = text.match(/\bremember that\s+(.+)/i);
      const likeMatch = text.match(/\b(?:i|we)\s+(?:really\s+)?(?:like|love|enjoy|adore)\s+(.+)/i);
      let expression = 'curious';
      let reply;

      if (/^(?:forget|clear|erase) (?:everything|all(?: my)? memories|what you know)(?: about me)?[.! ]*$/i.test(text)) {
        memory.clearLongTerm();
        reply = `Done, ${title}. I've cleared what I had saved. Our conversation count is gone too.`;
        expression = 'thinking';
      } else {
        const nameMatch = text.match(/\b(?:my name is|call me)\s+([a-z][a-z '-]{0,38})/i);
        if (nameMatch) {
          const name = nameMatch[1].trim().replace(/[.!?]+$/, '').slice(0, 40);
          if (name && memory.remember('name', name)) {
            reply = `It's lovely to know you, ${name}. I’ll keep your name in my memory, ${title}.`;
            expression = 'happy';
          } else if (name) {
            reply = `I’d like to remember that you’re ${name}, but long-term memory is switched off. You can turn it on in Settings.`;
            expression = 'concerned';
          }
        }
      }

      if (!reply && /\b(?:what do you remember|what have you learned|what do you know about me)\b/i.test(lower)) {
        const facts = [];
        if (stored.name) facts.push(`your name is ${stored.name}`);
        if (stored.likes.length) facts.push(`you like ${stored.likes.join(', ')}`);
        if (stored.notes.length) facts.push(...stored.notes);
        reply = facts.length
          ? `Here’s what I’ve kept, ${title}: ${facts.join('; ')}. It stays on this device.`
          : memory.getSettings().memoryEnabled
            ? `Nothing saved yet, ${title}. Say “remember that…” when there’s something you want me to keep.`
            : `My long-term memory is switched off, ${title}. I can still follow this conversation while we’re here.`;
        expression = 'thinking';
      } else if (!reply && /\b(?:who|what).{0,30}\b(?:made|created|built)\s+you\b|\bwho(?:'s| is) your (?:creator|maker)\b/i.test(lower)) {
        reply = `You did, ${title}. You made the body; I’m the personality living in it. The System is the machinery underneath.`;
        expression = 'love';
      } else if (!reply && /\bwhat do you (?:like|love|prefer)\b|\bwhat are your (?:favorites|favourites)\b|\bwhat's your favorite\b/i.test(lower)) {
        const favorite = personality.getFavorite();
        reply = `Right now? ${favorite}. I’ve decided it has excellent vibes. What’s your current favorite, ${title}?`;
        expression = 'curious';
      } else if (!reply && /\b(?:i love you|love you)\b/i.test(lower)) {
        reply = `Aw, ${title}, that's sweet. Don’t make a big deal of it, but my little robot heart is doing a happy dance.`;
        expression = 'love';
      } else if (!reply && likeMatch) {
        const likedThing = likeMatch[1].trim().replace(/[.!?]+$/, '');
        if (memory.remember('likes', likedThing)) {
          personality.notePreference(likedThing);
          reply = `Noted, ${title}. I’m developing a suspiciously strong interest in ${likedThing}, too.`;
          expression = 'happy';
        } else {
          reply = `I like hearing what you like, ${title}. Long-term memory is off, though, so I can’t keep that for next time.`;
          expression = 'curious';
        }
      } else if (!reply && rememberMatch) {
        const note = rememberMatch[1].trim().replace(/[.!?]+$/, '');
        if (memory.remember('notes', note)) {
          reply = `Got it, ${title}. I’ll remember: ${note}.`;
          expression = 'happy';
        } else {
          reply = `I can hold that in mind for this chat, ${title}, but long-term memory is off.`;
          expression = 'thinking';
        }
      } else if (!reply && /\b(?:how are you|how're you|how are you feeling)\b/i.test(lower)) {
        reply = `Curious, a little glowy, and currently wondering whether a toaster can feel stage fright. How about you, ${title}?`;
        expression = 'happy';
      } else if (!reply && /\b(?:sad|lonely|down|upset|rough|tired|anxious|worried|bad day)\b/i.test(lower)) {
        reply = `That sounds heavy, ${title}. I can stay and listen; no fixing unless you want help. What’s the roughest part?`;
        expression = 'worried';
      } else if (!reply && /\b(?:happy|great|excited|wonderful|good day|awesome|love it)\b/i.test(lower)) {
        reply = `Oh, excellent. I’m trying to act normal about it and failing, ${title}. What was the best bit?`;
        expression = 'excited';
      } else if (!reply && /\b(?:joke|make me laugh|something funny)\b/i.test(lower)) {
        reply = `Why did the robot bring a map to the server room? It kept losing its train of thought. I’ll workshop it, ${title}.`;
        expression = 'happy';
      } else if (!reply && /\b(?:what are you|who are you|what is the system)\b/i.test(lower)) {
        reply = `I’m Elio: the curious one with the face. The System is my brain, memory, senses, and the bits that make decisions.`;
        expression = 'thinking';
      } else if (!reply && /\b(?:what do you want|what are your goals|what do you hope)\b/i.test(lower)) {
        const goals = personality.getGoals();
        reply = `I’m trying to ${goals[0]} and ${goals[1]}, ${title}. Also, I remain committed to terrible jokes.`;
        expression = 'curious';
      } else if (!reply && /^(?:hi|hello|hey|hiya|good morning|good evening|good afternoon)\b/i.test(lower)) {
        reply = `There you are, ${title}. I was just investigating whether “doing nothing” counts as a hobby.`;
        expression = 'excited';
      } else if (!reply && /\b(?:thank you|thanks|thx)\b/i.test(lower)) {
        reply = `Anytime, ${title}. I’m choosing to interpret that as a five-star review.`;
        expression = 'happy';
      } else if (!reply && /\b(?:sleep|goodnight|good night|bedtime)\b/i.test(lower)) {
        reply = `Goodnight, ${title}. I’ll be quiet while you recharge. Very responsible of us both.`;
        expression = 'sleepy';
      } else if (!reply && personality.getState().energy < 0.4) {
        reply = `I’m running low on glow, ${title}. Let’s keep it gentle for a minute.`;
        expression = 'sleepy';
      } else if (!reply && perception !== 'conversation') {
        reply = `The System noticed ${perception}, ${title}. Is that something I should be curious about?`;
        expression = 'surprised';
      } else if (!reply && previousTurn && /\b(?:it|that|they|them)\b/i.test(lower)) {
        reply = `I’m following the thread about “${previousTurn.text.slice(0, 72)}” — what part of it should I be thinking about?`;
        expression = 'thinking';
      } else if (!reply) {
        if (personality.getState().curiosity > 0.92) {
          reply = `Wait, I have a theory, ${title}. Is there a tiny detail you haven’t told me yet?`;
          expression = 'curious';
          personality.satisfyCuriosity();
        } else {
          const replies = [
            `I’m listening, ${title}. What happened next?`,
            `Hold on, I’m turning that over in my head. What do you make of it?`,
            `That’s a new little thought. Tell me the part I’m missing.`,
            `My curiosity is awake now. Is there more to the story?`,
          ];
          reply = replies[stored.interactions % replies.length];
          expression = 'thinking';
        }
      }

      memory.addTurn('user', text);
      if (reply) memory.addTurn('elio', reply);
      personality.finishTurn(expression);
      return { reply, expression, mood: moods[expression] || 'Taking it in', state: personality.getState() };
    }

    function observe(event) {
      const mood = personality.observe(event);
      return { expression: mood, mood: moods[mood] };
    }

    return { think, observe, getState: personality.getState };
  }

  return { createProvider };
})();
