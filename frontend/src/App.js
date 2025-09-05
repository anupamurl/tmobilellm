import React, { useState, useEffect, useRef } from 'react';

const API_BASE = 'http://localhost:5000';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showTrainModal, setShowTrainModal] = useState(false);
  const [showPagesModal, setShowPagesModal] = useState(false);
  const [trainUrl, setTrainUrl] = useState('');
  const [trainedPages, setTrainedPages] = useState([]);
  const [notification, setNotification] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(''), 3000);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { type: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiMessage = { type: 'ai', content: '' };
      
      setMessages(prev => [...prev, aiMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        aiMessage.content += chunk;
        setMessages(prev => prev.map((msg, i) => 
          i === prev.length - 1 ? { ...aiMessage } : msg
        ));
      }
    } catch (error) {
      setMessages(prev => [...prev, { type: 'ai', content: 'Sorry, I encountered an error.' }]);
    }
    
    setIsTyping(false);
  };

  const handleTrainUrl = async () => {
    if (!trainUrl.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trainUrl })
      });
      
      const result = await response.json();
      showNotification(result.success ? 'URL trained successfully!' : result.message);
      setTrainUrl('');
      setShowTrainModal(false);
    } catch (error) {
      showNotification('Failed to train URL');
    }
  };

  const loadTrainedPages = async () => {
    try {
      const response = await fetch(`${API_BASE}/pages`);
      const pages = await response.json();
      setTrainedPages(pages);
      setShowPagesModal(true);
    } catch (error) {
      showNotification('Failed to load trained pages');
    }
  };

  const clearMemory = async () => {
    try {
      const response = await fetch(`${API_BASE}/clear`, { method: 'POST' });
      const result = await response.json();
      showNotification(result.success ? 'Memory cleared!' : result.message);
      setTrainedPages([]);
    } catch (error) {
      showNotification('Failed to clear memory');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="bg-tmobile-magenta text-white p-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <span className="text-tmobile-magenta font-bold text-sm">T</span>
          </div>
          <h1 className="text-xl font-semibold">AI Assistant</h1>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowTrainModal(true)}
            className="bg-white text-tmobile-magenta px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Train URL
          </button>
          <button
            onClick={loadTrainedPages}
            className="bg-white text-tmobile-magenta px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Trained Pages
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
              message.type === 'user' 
                ? 'bg-tmobile-magenta text-white' 
                : 'bg-tmobile-gray text-tmobile-black'
            }`}>
              {message.content}
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-tmobile-gray px-4 py-2 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-tmobile-magenta"
          />
          <button
            onClick={sendMessage}
            className="bg-tmobile-magenta text-white px-6 py-2 rounded-lg hover:bg-pink-600 transition-colors"
          >
            Send
          </button>
        </div>
      </div>

      {/* Train URL Modal */}
      {showTrainModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md animate-fade-in">
            <h2 className="text-xl font-semibold mb-4">Train URL</h2>
            <input
              type="url"
              value={trainUrl}
              onChange={(e) => setTrainUrl(e.target.value)}
              placeholder="Enter URL to train..."
              className="w-full px-4 py-2 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-tmobile-magenta"
            />
            <div className="flex space-x-2">
              <button
                onClick={handleTrainUrl}
                className="bg-tmobile-magenta text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition-colors"
              >
                Submit
              </button>
              <button
                onClick={() => setShowTrainModal(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trained Pages Modal */}
      {showPagesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md animate-fade-in">
            <h2 className="text-xl font-semibold mb-4">Trained Pages</h2>
            <div className="max-h-60 overflow-y-auto mb-4">
              {trainedPages.length === 0 ? (
                <p className="text-gray-500">No pages trained yet</p>
              ) : (
                trainedPages.map((url, index) => (
                  <div key={index} className="p-2 border-b text-sm break-all">
                    {url}
                  </div>
                ))
              )}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={clearMemory}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
              >
                Clear Memory
              </button>
              <button
                onClick={() => setShowPagesModal(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div className="fixed top-4 right-4 bg-tmobile-magenta text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {notification}
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

export default App;