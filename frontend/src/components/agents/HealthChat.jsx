import { useState, useRef, useEffect } from 'react';
import { startChatConversation, sendChatMessage } from '../../api';

/**
 * HealthChat - ChatGPT-style Health Agent Interface
 */

// Icons
const BotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8"/>
    <rect width="16" height="12" x="4" y="8" rx="2"/>
    <path d="M2 14h2"/>
    <path d="M20 14h2"/>
    <path d="M15 13v2"/>
    <path d="M9 13v2"/>
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="5"/>
    <path d="M20 21a8 8 0 0 0-16 0"/>
  </svg>
);

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>
);

const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
    <path d="M21 3v5h-5"/>
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
    <path d="M8 16H3v5"/>
  </svg>
);

const ELEVEN_WIDGET_SRC = 'https://unpkg.com/@elevenlabs/convai-widget-embed@beta';

const ElevenLabsVoiceWidget = ({ patientId }) => {
  useEffect(() => {
    if (!patientId) return;

    const existingScript = document.querySelector(`script[src="${ELEVEN_WIDGET_SRC}"]`);
    if (existingScript) return;

    const script = document.createElement('script');
    script.src = ELEVEN_WIDGET_SRC;
    script.async = true;
    script.type = 'text/javascript';
    document.body.appendChild(script);
  }, [patientId]);

  if (!patientId) return null;

  // Dynamic variables must be passed as JSON string
  const dynamicVariables = JSON.stringify({ patient_id: patientId });

  return (
    <div className="mb-4">
      <elevenlabs-convai
        agent-id="agent_6801ke4yb0g6f1xvsvennnb2es5a"
        dynamic-variables={dynamicVariables}
      />
    </div>
  );
};

const ChevronIcon = ({ isOpen }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="14" 
    height="14" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2"
    style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
  >
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
  </svg>
);

const ToolIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
);

// Typing indicator animation
const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-1">
    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}/>
    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}/>
  </div>
);

// Simple markdown-like renderer
const FormattedText = ({ text }) => {
  // Split by code blocks first
  const parts = text.split(/(```[\s\S]*?```)/g);
  
  return (
    <div className="prose prose-sm max-w-none">
      {parts.map((part, i) => {
        // Code block
        if (part.startsWith('```') && part.endsWith('```')) {
          const code = part.slice(3, -3).replace(/^\w+\n/, ''); // Remove language hint
          return (
            <pre key={i} className="bg-gray-900 text-gray-100 rounded-lg p-4 my-3 overflow-x-auto text-sm font-mono">
              <code>{code}</code>
            </pre>
          );
        }
        
        // Regular text - process inline formatting
        const lines = part.split('\n');
        return (
          <div key={i}>
            {lines.map((line, j) => {
              // Empty line = paragraph break
              if (!line.trim()) {
                return <div key={j} className="h-3"/>;
              }
              
              // H1: # Header
              if (line.match(/^#\s+/)) {
                const content = line.replace(/^#\s+/, '');
                return (
                  <h1 key={j} className="text-2xl font-bold text-gray-900 mt-4 mb-2">
                    {processInlineFormatting(content)}
                  </h1>
                );
              }
              
              // H2: ## Header
              if (line.match(/^##\s+/)) {
                const content = line.replace(/^##\s+/, '');
                return (
                  <h2 key={j} className="text-xl font-semibold text-gray-900 mt-4 mb-2">
                    {processInlineFormatting(content)}
                  </h2>
                );
              }
              
              // H3: ### Header
              if (line.match(/^###\s+/)) {
                const content = line.replace(/^###\s+/, '');
                return (
                  <h3 key={j} className="text-lg font-semibold text-gray-800 mt-3 mb-1">
                    {processInlineFormatting(content)}
                  </h3>
                );
              }
              
              // H4: #### Header
              if (line.match(/^####\s+/)) {
                const content = line.replace(/^####\s+/, '');
                return (
                  <h4 key={j} className="text-base font-semibold text-gray-800 mt-2 mb-1">
                    {processInlineFormatting(content)}
                  </h4>
                );
              }
              
              // Bullet points
              if (line.match(/^[\s]*[-•*]\s/)) {
                const content = line.replace(/^[\s]*[-•*]\s/, '');
                return (
                  <div key={j} className="flex gap-2 my-1">
                    <span className="text-gray-400 select-none">•</span>
                    <span>{processInlineFormatting(content)}</span>
                  </div>
                );
              }
              
              // Numbered list
              if (line.match(/^[\s]*\d+\.\s/)) {
                const match = line.match(/^[\s]*(\d+)\.\s(.*)/);
                if (match) {
                  return (
                    <div key={j} className="flex gap-2 my-1">
                      <span className="text-gray-400 select-none min-w-[1.5rem]">{match[1]}.</span>
                      <span>{processInlineFormatting(match[2])}</span>
                    </div>
                  );
                }
              }
              
              // Regular line
              return <p key={j} className="my-1">{processInlineFormatting(line)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
};

// Process bold, italic, inline code
const processInlineFormatting = (text) => {
  if (!text) return text;
  
  // Split by inline code, bold, and italic patterns
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
};

// Trace step component
const TraceStep = ({ step }) => {
  const config = {
    thought: { icon: '💭', label: 'Thinking', bg: 'bg-blue-50 border-blue-100' },
    action: { icon: step.tool_name === 'web_search' ? '🔍' : '🔧', label: step.tool_name || 'Tool', bg: 'bg-amber-50 border-amber-100' },
    observation: { icon: '📋', label: 'Result', bg: 'bg-green-50 border-green-100' }
  }[step.step_type] || { icon: '📝', label: step.step_type, bg: 'bg-gray-50 border-gray-100' };

  return (
    <div className={`${config.bg} border rounded-lg p-3 text-xs mb-2`}>
      <div className="flex items-center gap-1.5 text-gray-600 mb-1.5 font-medium">
        <span>{config.icon}</span>
        <span className="uppercase tracking-wide">{config.label}</span>
      </div>
      <div className="text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">
        {step.content.length > 400 ? step.content.substring(0, 400) + '...' : step.content}
      </div>
    </div>
  );
};

// Message component - ChatGPT style
const Message = ({ message, showTrace, onToggleTrace }) => {
  const isUser = message.role === 'user';
  
  return (
    <div className="py-6 bg-white">
      <div className="max-w-3xl mx-auto px-4 flex gap-4">
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {isUser ? <UserIcon /> : <BotIcon />}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-900 mb-1">
            {isUser ? 'You' : 'Health Assistant'}
          </div>
          
          <div className="text-gray-700 leading-relaxed">
            <FormattedText text={message.content} />
          </div>
          
          {/* Tool calls badges */}
          {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {message.toolCalls.map((call, i) => (
                <span 
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-600 font-medium"
                >
                  {call.tool === 'web_search' ? <SearchIcon /> : <ToolIcon />}
                  {call.tool}
                </span>
              ))}
            </div>
          )}
          
          {/* Trace toggle */}
          {!isUser && message.trace && message.trace.length > 0 && (
            <div className="mt-3">
              <button 
                onClick={onToggleTrace}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors font-medium"
              >
                <ChevronIcon isOpen={showTrace} />
                <span>{showTrace ? 'Hide' : 'View'} reasoning ({message.trace.length} steps)</span>
              </button>
              
              {showTrace && (
                <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                  {message.trace.map((step, i) => (
                    <TraceStep key={i} step={step} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function HealthChat({ patientId }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [conversationState, setConversationState] = useState(null);
  const [error, setError] = useState(null);
  const [expandedTraces, setExpandedTraces] = useState({});
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const initializingRef = useRef(false);
  const lastPatientIdRef = useRef(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);
  
  useEffect(() => {
    if (patientId && patientId !== lastPatientIdRef.current && !initializingRef.current) {
      lastPatientIdRef.current = patientId;
      startConversation();
    }
  }, [patientId]);
  
  const startConversation = async () => {
    if (initializingRef.current) return;
    initializingRef.current = true;
    
    setIsStarting(true);
    setError(null);
    setMessages([]);
    setConversationState(null);
    
    try {
      const response = await startChatConversation(patientId);
      setConversationState(response.state);
      setMessages([{
        id: Date.now(),
        role: 'assistant',
        content: response.text,
        trace: [],
        toolCalls: []
      }]);
    } catch (err) {
      console.error('Error starting conversation:', err);
      setError(err.response?.data?.detail || 'Failed to start conversation');
    } finally {
      setIsStarting(false);
      initializingRef.current = false;
    }
  };
  
  const handleNewConversation = () => {
    initializingRef.current = false;
    startConversation();
  };
  
  const sendMessage = async () => {
    if (!inputText.trim() || isLoading || !conversationState) return;
    
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputText.trim()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await sendChatMessage(userMessage.content, conversationState);
      
      setConversationState(response.state);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.text,
        trace: response.trace || [],
        toolCalls: response.tool_calls || []
      }]);
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err.response?.data?.detail || 'Failed to send message');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  const toggleTrace = (messageId) => {
    setExpandedTraces(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };
  
  if (!patientId) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BotIcon />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Health Assistant</h2>
          <p className="text-gray-500">Select a patient profile to start a conversation.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full bg-white">
      <ElevenLabsVoiceWidget patientId={patientId} />

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {isStarting ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-600">
                <BotIcon />
              </div>
              <TypingIndicator />
              <p className="mt-3 text-sm text-gray-500">Starting conversation...</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {messages.map((message) => (
              <Message
                key={message.id}
                message={message}
                showTrace={expandedTraces[message.id]}
                onToggleTrace={() => toggleTrace(message.id)}
              />
            ))}
            
            {isLoading && (
              <div className="py-6 bg-white">
                <div className="max-w-3xl mx-auto px-4 flex gap-4">
                  <div className="w-8 h-8 rounded-sm bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                    <BotIcon />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-900 mb-2">Health Assistant</div>
                    <TypingIndicator />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-3">
          <div className="max-w-3xl mx-auto text-sm text-red-700 flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}
      
      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white p-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-2 bg-white border border-gray-200 rounded-xl p-2 focus-within:border-gray-400 transition-colors">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Health Assistant..."
              disabled={isLoading || isStarting || !conversationState}
              rows={1}
              className="flex-1 bg-transparent resize-none border-0 outline-none px-2 py-2 text-gray-900 placeholder:text-gray-400 disabled:cursor-not-allowed text-sm leading-6"
              style={{ minHeight: '24px', maxHeight: '200px' }}
            />
            <div className="flex items-center gap-1 pr-1">
              <button
                onClick={handleNewConversation}
                disabled={isStarting}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                title="New conversation"
              >
                <RefreshIcon />
              </button>
              <button
                onClick={sendMessage}
                disabled={!inputText.trim() || isLoading || isStarting || !conversationState}
                className="p-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <SendIcon />
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400 text-center">
            Health Assistant can make mistakes. Always consult your care team for medical decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
