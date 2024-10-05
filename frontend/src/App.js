import React, { useState } from 'react';
import './App.css';

function App() {
  const [username, setUsername] = useState('');
  const [theme, setTheme] = useState('light');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');

  const handleCreate = (e) => {
    e.preventDefault();
    const trimmedName = username.trim();
    if (trimmedName) {
      setUsername(trimmedName);
    }
  };

  const handleSendMessage = () => {
    const trimmedMessage = inputMessage.trim();
    if (trimmedMessage) {
      setMessages([...messages, { sender: username, text: trimmedMessage }]);
      setInputMessage('');
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };
  

  return (
    <div className="App" data-theme={theme}>
      <header className="App-header">
        <button className="theme-toggle" onClick={toggleTheme}>
          Switch to {theme === 'light' ? 'Dark' : 'Light'} Theme
        </button>
      </header>

      {!username ? (
        <div className="creation-container">
          <h1 className="title">Ciphered</h1>
          <p className="description">
            Please enter a display name to start your anonymous chat session.
          </p>
          <form onSubmit={handleCreate} className="creation-form">
            <label htmlFor="username" className="field-title">
              What will your display name be?
            </label>
            <input
              type="text"
              id="username"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field"
            />
            <button type="submit" className="create-button">
              Create
            </button>
          </form>
        </div>
      ) : (
        <div className="chat-interface">
          <aside className="sidebar">
            <h2 className="sidebar-title">Chats</h2>
            <div className="chat-list">
              {/* Chat list items can be added here */}
              <p>No active chats</p>
            </div>
            <button className="new-chat-button">New Chat</button>
          </aside>

          <main className="chat-content">
            <div className="messages-box">
              {messages.length === 0 ? (
                <p className="welcome-message">Hello! Welcome to Ciphered.</p>
              ) : (
                messages.map((msg, index) => (
                  <div key={index} className="message">
                    <span className="message-sender">{msg.sender}:</span>
                    <span className="message-text">{msg.text}</span>
                  </div>
                ))
              )}
            </div>
            <div className="send-message-box">
              <input
                type="text"
                placeholder="Type your message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="message-input"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSendMessage();
                  }
                }}
              />
              <button onClick={handleSendMessage} className="send-button">
                Send
              </button>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}

export default App;
