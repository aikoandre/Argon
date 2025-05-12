// src/pages/ChatPage.tsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const [messages, setMessages] = useState<any[]>([]); // Defina um tipo melhor para mensagens
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (chatId) {
      console.log(`Entering chat with ID: ${chatId}`);
      // Lógica para buscar histórico de mensagens para este chatId virá aqui
      // fetch(`http://localhost:8000/api/chats/${chatId}/messages`)
      //   .then(res => res.json())
      //   .then(data => setMessages(data))
      //   .catch(err => console.error("Failed to load messages", err));
    }
  }, [chatId]);

  const handleSendMessage = async () => {
    if (!userInput.trim() || !chatId) return;
    setIsLoading(true);
    // Adiciona a mensagem do usuário à UI imediatamente
    setMessages((prev) => [
      ...prev,
      { sender: "user", message: userInput, timestamp: "now" },
    ]);
    const currentInput = userInput;
    setUserInput(""); // Limpa o input

    try {
      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, user_input: currentInput }),
      });
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();
      // Adiciona a resposta da IA
      setMessages((prev) => [
        ...prev,
        { sender: "ai", message: data.ai_response, timestamp: "now_ai" },
      ]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        { sender: "system", message: `Error: ${error}`, timestamp: "now_err" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2>Chat with {chatId}</h2>
      <div
        className="chat-history"
        style={{
          height: "400px",
          overflowY: "scroll",
          border: "1px solid #ccc",
          padding: "10px",
          marginBottom: "10px",
        }}
      >
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender}`}>
            <strong>{msg.sender}: </strong>
            {msg.message}
          </div>
        ))}
        {isLoading && (
          <div className="message system">
            <em>AI is typing...</em>
          </div>
        )}
      </div>
      <div className="chat-input">
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Type your message..."
          rows={3}
          style={{ width: "80%", marginRight: "10px" }}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
        />
        <button onClick={handleSendMessage} disabled={isLoading}>
          {isLoading ? "Sending..." : "Send"}
        </button>
      </div>
      {/* Menu Hambúrguer e outras opções virão aqui */}
    </div>
  );
}
export default ChatPage;
