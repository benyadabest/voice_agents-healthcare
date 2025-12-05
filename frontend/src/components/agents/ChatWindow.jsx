import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api';

const ChatWindow = ({ agentType, initialMessage, title }) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: initialMessage }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatState, setChatState] = useState({ current_step: "greeting", messages: [], context: {} });
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await api.post('/agent/chat', {
        message: input,
        agent_type: agentType,
        state: chatState
      });
      
      const aiMessage = { role: 'assistant', content: response.data.response };
      setMessages(prev => [...prev, aiMessage]);
      setChatState(response.data.updated_state);

    } catch (error) {
      console.error("Chat Error", error);
      setMessages(prev => [...prev, { role: 'system', content: "Error connecting to agent. Please ensure backend is running." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl h-full flex flex-col border border-base-300 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-base-200 border-b border-base-300 flex justify-between items-center">
        <div>
            <h2 className="font-bold text-lg text-base-content">{title}</h2>
            <p className="text-xs text-base-content/60 uppercase tracking-wider font-semibold">Live Logic Verification</p>
        </div>
        <div className="badge badge-success badge-sm gap-2">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
            ONLINE
        </div>
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6 bg-base-100">
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat ${msg.role === 'user' ? 'chat-end' : 'chat-start'} animate-in fade-in duration-300 slide-in-from-bottom-2`}>
            <div className="chat-header text-xs opacity-50 mb-1">
                {msg.role === 'user' ? 'You' : 'AI Agent'}
            </div>
            <div className="chat-image avatar placeholder">
              <div className={`w-10 rounded-full ring ring-offset-2 ring-offset-base-100 ${msg.role === 'user' ? 'bg-neutral text-neutral-content ring-neutral' : 'bg-primary text-primary-content ring-primary'}`}>
                <span className="text-sm font-bold">{msg.role === 'user' ? 'ME' : 'AI'}</span>
              </div>
            </div>
            <div className={`chat-bubble shadow-sm ${msg.role === 'user' ? 'chat-bubble-neutral' : 'chat-bubble-primary'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        
        {loading && (
            <div className="chat chat-start animate-pulse">
                <div className="chat-image avatar placeholder">
                    <div className="w-10 rounded-full bg-primary text-primary-content ring ring-primary ring-offset-2 ring-offset-base-100 opacity-50">
                        <span className="text-sm font-bold">AI</span>
                    </div>
                </div>
                <div className="chat-bubble chat-bubble-primary opacity-75">
                    <span className="loading loading-dots loading-md"></span>
                </div>
                <div className="chat-footer opacity-50 text-xs mt-1">Thinking...</div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-base-200 border-t border-base-300">
        <div className="join w-full shadow-sm">
          <input 
            type="text" 
            className="input input-bordered join-item flex-1 focus:outline-none focus:border-primary" 
            placeholder="Type your response here..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
            autoFocus
          />
          <button className="btn btn-primary join-item px-8" onClick={handleSend} disabled={loading}>
            {loading ? <span className="loading loading-spinner loading-sm"></span> : 
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                </svg>
            }
          </button>
        </div>
        <div className="text-center mt-2">
            <span className="text-xs text-base-content/40">Press Enter to send</span>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
