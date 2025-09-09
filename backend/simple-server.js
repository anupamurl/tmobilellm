const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Simple in-memory storage
let trainedData = [];
let trainedUrls = [];

// Extract text from URL
async function extractTextFromUrl(url) {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    $('script, style, nav, footer, header').remove();
    return $('body').text().replace(/\s+/g, ' ').trim();
  } catch (error) {
    throw new Error(`Failed to fetch URL: ${error.message}`);
  }
}

// Simple text search
function searchRelevantContent(query, maxResults = 3) {
  const queryWords = query.toLowerCase().split(' ');
  const results = [];
  
  for (const data of trainedData) {
    const content = data.content.toLowerCase();
    let score = 0;
    
    for (const word of queryWords) {
      if (content.includes(word)) {
        score += 1;
      }
    }
    
    if (score > 0) {
      results.push({ ...data, score });
    }
  }
  
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(r => r.content);
}

// Chat endpoint with streaming
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Transfer-Encoding', 'chunked');
  
  try {
    let context = '';
    
    // Search for relevant context
    if (trainedData.length > 0) {
      const relevantContent = searchRelevantContent(message);
      context = relevantContent.join('\n\n');
    }
    
    let aiResponse;
    let prefix;
    
    if (context && context.trim().length > 0) {
      // Use trained content
      const prompt = `Answer this question using ONLY the provided context. Context: ${context}\n\nQuestion: ${message}\n\nAnswer:`;
      
      const response = await axios.post('http://localhost:11434/api/chat', {
        model: 'llama3.2:latest',
        messages: [{ role: 'user', content: prompt }],
        stream: false
      });
      
      aiResponse = response.data.message?.content || 'No answer found in trained data.';
      prefix = 'Trained: ';
    } else {
      // Use LLM general knowledge
      const response = await axios.post('http://localhost:11434/api/chat', {
        model: 'llama3.2:latest',
        messages: [{ role: 'user', content: message }],
        stream: false
      });
      
      aiResponse = response.data.message?.content || 'Sorry, I could not generate a response.';
      prefix = 'LLM: ';
    }
    
    // Stream response with prefix
    res.write(prefix);
    const words = aiResponse.split(' ');
    for (let i = 0; i < words.length; i++) {
      res.write(words[i] + (i < words.length - 1 ? ' ' : ''));
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    
    res.end();
  } catch (error) {
    console.error('Chat error:', error);
    res.write('Sorry, I encountered an error processing your request.');
    res.end();
  }
});

// Train endpoint
app.post('/train', async (req, res) => {
  const { url } = req.body;
  
  try {
    const text = await extractTextFromUrl(url);
    
    // Split into chunks
    const chunkSize = 1000;
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    
    // Store chunks
    for (const chunk of chunks) {
      trainedData.push({
        url,
        content: chunk,
        timestamp: new Date()
      });
    }
    
    if (!trainedUrls.includes(url)) {
      trainedUrls.push(url);
    }
    
    res.json({ success: true, message: 'URL trained successfully' });
  } catch (error) {
    console.error('Training error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get trained pages
app.get('/pages', (req, res) => {
  res.json(trainedUrls);
});

// Clear memory
app.post('/clear', (req, res) => {
  trainedData = [];
  trainedUrls = [];
  res.json({ success: true, message: 'Memory cleared successfully' });
});

app.listen(PORT, () => {
  console.log(`T-Mobile AI Backend (Simple) running on http://localhost:${PORT}`);
  console.log('Make sure Ollama is running: ollama serve');
});