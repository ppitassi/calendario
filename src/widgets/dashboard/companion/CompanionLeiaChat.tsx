import React, { useRef, useEffect } from "react";
import { Send, RefreshCw } from "lucide-react";
import { Input } from "../../../components/ui/Input/Input";
import { Button } from "../../../components/ui/Button/Button";
import { IconButton } from "../../../components/ui/IconButton/IconButton";
import styles from "./CompanionLeiaChat.module.css";

type Message = {
  id: string;
  sender: "user" | "leia";
  text: string;
  timestamp: number;
};

type CompanionLeiaChatProps = {
  messages: Message[];
  inputValue: string;
  setInputValue: (val: string) => void;
  isTyping: boolean;
  handleSendMessage: (text: string) => Promise<void>;
  renderFormattedText: (txt: string) => React.ReactNode[];
};

export function CompanionLeiaChat({
  messages,
  inputValue,
  setInputValue,
  isTyping,
  handleSendMessage,
  renderFormattedText,
}: CompanionLeiaChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <div className={styles.root}>
      <div className={styles.messages}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.message} ${msg.sender === "leia" ? styles.leiaMessage : styles.userMessage}`}
          >
            <span className={styles.messageText}>{renderFormattedText(msg.text)}</span>
          </div>
        ))}
        {isTyping && (
          <div className={styles.typing}>
            <RefreshCw className={styles.spinner} />
            <span>LeIA está pensando...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.suggestions}>
        {[
          { label: "💡 Ideias", text: "Gerar ideias de posts criativos" },
          { label: "✍️ Legenda", text: "Melhorar a legenda de um post" },
          { label: "📅 Estratégia", text: "Quais as dicas de estratégia para o ciclo?" },
        ].map((chip) => (
          <Button
            key={chip.label}
            onClick={() => handleSendMessage(chip.text)}
            size="small"
            variant="glass"
          >
            {chip.label}
          </Button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputValue);
        }}
        className={styles.form}
      >
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Pergunte à LeIA..."
          className="flex-1"
        />
        <IconButton
          type="submit"
          label="Enviar mensagem"
          disabled={!inputValue.trim()}
          variant="primary"
        >
          <Send />
        </IconButton>
      </form>
    </div>
  );
}
