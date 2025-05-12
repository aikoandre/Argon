const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  chat: async (chatId, userInput) => {
    const response = await fetch('http://localhost:8000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ chat_id: chatId, user_input: userInput })
    });
    const data = await response.json();
    return data;
  }
});
