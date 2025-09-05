const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const { ChromaClient } = require('chromadb');
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Initialize Chroma client and Ollama
const chroma = new ChromaClient();
let collection;
const ollama = { host: 'http://localhost:11434' };
const trainedUrls = new Set();

// Initialize collection
async function initCollection() {
  try {
    collection = await chroma.getOrCreateCollection({ name: "tmobile_docs" });
    console.log('Chroma collection initialized');
  } catch (error) {
    console.error('Error initializing collection:', error);
  }
}

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

// Generate embeddings (simplified - using text as embedding for demo)
function generateEmbedding(text) {
  return text.split(' ').slice(0, 100).map((word, i) => Math.sin(i + word.length));
}

// Chat endpoint with streaming
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Transfer-Encoding', 'chunked');
  
  try {
    let context = '';
    
    // Retrieve relevant context if collection exists
    if (collection && trainedUrls.size > 0) {
      try {
        const results = await collection.query({
          queryTexts: [message],
          nResults: 3
        });
        
        if (results.documents && results.documents[0]) {
          context = results.documents[0].join('\n\n');
        }
      } catch (error) {
        console.log('No relevant context found');
      }
    }
    
    const prompt = context 
      ? `Context: ${context}\n\nQuestion: ${message}\n\nAnswer based on the context above:`
      : message;
    
    // Stream response from Ollama
    const ollamaResponse = await axios.post('http://localhost:11434/api/chat', {
      model: 'llama3.2:latest',
      messages: [{ role: 'user', content: prompt }],
      stream: false
    });
    
    const aiResponse = ollamaResponse.data.message?.content || 'Sorry, I could not generate a response.';
    
    // Simulate streaming by sending chunks
    const words = aiResponse.split(' ');
    for (const word of words) {
      res.write(word + ' ');
      await new Promise(resolve => setTimeout(resolve, 50));
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
    const chunks = text.match(/.{1,1000}/g) || [text];
    
    if (!collection) {
      await initCollection();
    }
    
    const embeddings = chunks.map(chunk => generateEmbedding(chunk));
    const ids = chunks.map((_, i) => `${url}_${i}`);
    
    await collection.add({
      ids,
      embeddings,
      documents: chunks,
      metadatas: chunks.map(() => ({ url }))
    });
    
    trainedUrls.add(url);
    
    res.json({ success: true, message: 'URL trained successfully' });
  } catch (error) {
    console.error('Training error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get trained pages
app.get('/pages', (req, res) => {
  res.json(Array.from(trainedUrls));
});

// Clear memory
app.post('/clear', async (req, res) => {
  try {
    if (collection) {
      await chroma.deleteCollection({ name: "tmobile_docs" });
      await initCollection();
    }
    trainedUrls.clear();
    
    res.json({ success: true, message: 'Memory cleared successfully' });
  } catch (error) {
    console.error('Clear error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Initialize and start server
initCollection().then(() => {
  app.listen(PORT, () => {
    console.log(`T-Mobile AI Backend running on http://localhost:${PORT}`);
  });
});