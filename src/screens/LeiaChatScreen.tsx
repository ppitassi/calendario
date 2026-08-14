import { useState, useEffect, useRef } from "react";
import { Send, Sparkles, RefreshCw, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MainLayout } from "../components/MainLayout";
import { api } from "../lib/api";
import { ClientData } from "../types";
import { PromptLibrarySidebar } from "./leia-chat/PromptLibrarySidebar";
import { Input } from "../components/ui/Input/Input";
import { Button } from "../components/ui/Button/Button";
import { IconButton } from "../components/ui/IconButton/IconButton";
import styles from "./LeiaChatScreen.module.css";

interface Message {
  id: string;
  sender: "user" | "leia";
  text: string;
  timestamp: number;
}

interface LeiaChatScreenProps {
  currentClient: ClientData | null;
  onNavigate: (screen: string) => void;
}

export function LeiaChatScreen({ currentClient, onNavigate }: LeiaChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isPromptLibraryOpen, setIsPromptLibraryOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const welcomeText = currentClient
      ? `Olá! Sou a **LeIA**, sua assistente criativa. Estou pronta para ajudar com o planejamento de conteúdo de **${currentClient.name}**.\n\nPosso gerar ideias de posts, escrever legendas, montar estratégias de funil, criar briefings criativos e muito mais. Use a biblioteca de prompts à esquerda ou simplesmente me pergunte qualquer coisa!`
      : "Olá! Sou a **LeIA**, sua assistente criativa. Selecione um cliente na barra lateral para que eu possa personalizar minhas respostas com o briefing e dados estratégicos deles.";
    setMessages([
      {
        id: "welcome",
        sender: "leia",
        text: welcomeText,
        timestamp: Date.now(),
      },
    ]);
  }, [currentClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: Message = {
      id: Math.random().toString(36).substring(2, 9),
      sender: "user",
      text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    try {
      const historyForApi = messages
        .filter((m) => m.id !== "welcome")
        .slice(-20)
        .map((m) => ({ sender: m.sender, text: m.text }));

      const response = await api.chatWithLeia(currentClient?.id || null, text, historyForApi);

      const leiaMsg: Message = {
        id: Math.random().toString(36).substring(2, 9),
        sender: "leia",
        text: response,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, leiaMsg]);
    } catch (err) {
      console.error("LeIA chat error:", err);
      const errorMsg: Message = {
        id: Math.random().toString(36).substring(2, 9),
        sender: "leia",
        text: "Desculpe, houve um erro ao processar sua mensagem. Tente novamente em alguns segundos.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderFormattedText = (txt: string) => {
    const lines = txt.split("\n");
    return lines.map((line, lineIdx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const rendered = parts.map((part, idx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={idx} className={styles.emphasis}>
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        return (
          <div key={lineIdx} className={styles.listLine}>
            <span>•</span>
            <span>{rendered}</span>
          </div>
        );
      }
      if (/^\d+\.\s/.test(line.trim())) {
        return (
          <div key={lineIdx} className={styles.numberedLine}>
            {rendered}
          </div>
        );
      }
      if (line.trim() === "") {
        return <div key={lineIdx} className={styles.spacer} />;
      }
      return <div key={lineIdx}>{rendered}</div>;
    });
  };

  return (
    <MainLayout activeScreen="leia_chat" onNavigate={onNavigate} currentClient={currentClient}>
      <div className={styles.root}>
        <AnimatePresence>
          <PromptLibrarySidebar
            isOpen={isPromptLibraryOpen}
            onClose={() => setIsPromptLibraryOpen(false)}
            onSelectPrompt={handleSendMessage}
          />
        </AnimatePresence>

        <div className={styles.chatPane}>
          <div className={styles.header}>
            <div className={styles.headerStart}>
              {!isPromptLibraryOpen && (
                <IconButton
                  label="Abrir biblioteca de prompts"
                  onClick={() => setIsPromptLibraryOpen(true)}
                  variant="glass"
                >
                  <BookOpen />
                </IconButton>
              )}
              <div className={styles.identity}>
                <div className={styles.avatarWrap}>
                  <div className={styles.avatar}>
                    <Sparkles />
                  </div>
                  <div className={styles.online} />
                </div>
                <div className={styles.identityCopy}>
                  <h2>LeIA</h2>
                  <span>
                    {currentClient ? `Assistindo ${currentClient.name}` : "Assistente Criativa • Online"}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.headerActions}>
              <Button
                onClick={() => {
                  setMessages([]);
                  const welcomeText = currentClient
                    ? `Conversa reiniciada! Como posso ajudar com **${currentClient.name}**?`
                    : "Conversa reiniciada! Selecione um cliente para começarmos.";
                  setMessages([
                    {
                      id: "welcome-reset",
                      sender: "leia",
                      text: welcomeText,
                      timestamp: Date.now(),
                    },
                  ]);
                }}
                variant="danger"
                size="small"
                icon={<RefreshCw />}
              >
                Limpar Chat
              </Button>
            </div>
          </div>

          <div className={styles.messages}>
            {messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={styles.messageRow} data-sender={msg.sender}>
                <div
                  className={styles.bubble}
                  data-sender={msg.sender}
                >
                  {msg.sender === "leia" ? <div className={styles.formatted}>{renderFormattedText(msg.text)}</div> : <span className={styles.userText}>{msg.text}</span>}
                </div>
              </motion.div>
            ))}

            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.typingRow}>
                <div className={styles.typingBubble}>
                  <div className={styles.typingDots}>
                    <div data-index="1" />
                    <div data-index="2" />
                    <div data-index="3" />
                  </div>
                  <span>LeIA está pensando...</span>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className={styles.composerWrap}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputValue);
              }}
              className={styles.composer}
            >
              <Input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={currentClient ? `Pergunte à LeIA sobre ${currentClient.name}...` : "Pergunte à LeIA..."}
                className="flex-1"
                disabled={isTyping}
              />
              <Button
                type="submit"
                disabled={!inputValue.trim() || isTyping}
                variant="primary"
                icon={<Send />}
              >
                Enviar
              </Button>
            </form>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
