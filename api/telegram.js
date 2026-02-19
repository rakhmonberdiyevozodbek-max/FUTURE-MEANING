import TelegramBot from 'node-telegram-bot-api';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, score, total, percentage, results, timestamp } = req.body;

    // Validate required fields
    if (!name || !email || score === undefined || !total) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get credentials from environment variables (set in Vercel)
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    // Create a detailed message for Telegram
    const message = createTelegramMessage(name, email, score, total, percentage, results, timestamp);

    // Send to Telegram
    const bot = new TelegramBot(TELEGRAM_TOKEN);
    await bot.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: 'HTML' });

    // Also send a summary as a separate message
    const summary = `📊 <b>Quick Summary</b>\n${name} scored ${score}/${total} (${percentage}%)`;
    await bot.sendMessage(TELEGRAM_CHAT_ID, summary, { parse_mode: 'HTML' });

    res.status(200).json({ success: true, message: 'Report sent to Telegram' });
  } catch (error) {
    console.error('Telegram API Error:', error);
    res.status(500).json({ error: 'Failed to send message to Telegram' });
  }
}

function createTelegramMessage(name, email, score, total, percentage, results, timestamp) {
  const date = new Date(timestamp).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'medium'
  });

  // Create results breakdown
  const resultsBreakdown = results.map((r, i) => {
    const icon = r.isCorrect ? '✅' : '❌';
    return `${icon} Q${i + 1}: ${r.questionText.substring(0, 50)}...\n   Your answer: "${r.selected}" | Correct: "${r.correct}"\n`;
  }).join('\n');

  // Calculate statistics by tense type
  const tenseStats = results.reduce((acc, r) => {
    const type = r.type;
    if (!acc[type]) {
      acc[type] = { correct: 0, total: 0 };
    }
    acc[type].total++;
    if (r.isCorrect) acc[type].correct++;
    return acc;
  }, {});

  const tenseBreakdown = Object.entries(tenseStats)
    .map(([type, stats]) => {
      const typeNames = {
        PC: 'Present Continuous',
        GT: 'Going To',
        WL: 'Will',
        PS: 'Present Simple'
      };
      return `${typeNames[type] || type}: ${stats.correct}/${stats.total} (${Math.round(stats.correct/stats.total*100)}%)`;
    })
    .join('\n');

  return `
📝 <b>NEW TEST SUBMISSION</b>

👤 <b>Student Information:</b>
• Name: ${name}
• Email: ${email}
• Date: ${date}

📊 <b>Results:</b>
• Score: ${score}/${total}
• Percentage: ${percentage}%
• Status: ${getPerformanceMessage(percentage)}

📈 <b>Performance by Tense:</b>
${tenseBreakdown}

📋 <b>Detailed Breakdown:</b>
${resultsBreakdown}

🏆 <b>Overall Assessment:</b>
${getDetailedFeedback(percentage)}
`;
}

function getPerformanceMessage(percentage) {
  if (percentage >= 90) return '🌟 Excellent!';
  if (percentage >= 75) return '👍 Good job!';
  if (percentage >= 60) return '📚 Fair attempt';
  return '💪 Needs practice';
}

function getDetailedFeedback(percentage) {
  if (percentage >= 90) {
    return 'Outstanding! You have mastered all future tenses. Ready for advanced topics!';
  } else if (percentage >= 75) {
    return 'Very good! You understand most concepts well. Focus on the questions you missed.';
  } else if (percentage >= 60) {
    return 'Good effort! Review the explanations for incorrect answers and try again.';
  } else {
    return 'Keep practicing! Study each tense carefully and take the test again.';
  }
}
