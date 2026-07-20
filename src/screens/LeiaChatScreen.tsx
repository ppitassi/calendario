import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, Sparkles, RefreshCw, Lightbulb, PenTool, Target, 
  Calendar, Zap, BookOpen, Hash, MessageSquare, X, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MainLayout } from '../components/MainLayout';
import { api } from '../lib/api';
import { auth } from '../lib/auth';
import { ClientData } from '../types';
import { cn } from '../lib/utils';

interface Message {
  id: string;
  sender: 'user' | 'leia';
  text: string;
  timestamp: number;
}

interface LeiaChatScreenProps {
  currentClient: ClientData | null;
  onNavigate: (screen: string) => void;
}

const PROMPT_LIBRARY = [
  { label: '💡 Ideias de Posts', text: 'Gere 5 ideias de posts criativos e estratégicos para as redes sociais desse cliente, variando os formatos (carrossel, reels, feed).', icon: Lightbulb, color: 'text-amber-400' },
  { label: '✍️ Escrever Legenda', text: 'Escreva uma legenda profissional para um post de feed do Instagram. Use copywriting com gancho, corpo informativo e CTA.', icon: PenTool, color: 'text-sky-400' },
  { label: '📅 Plano Semanal', text: 'Crie um plano semanal de conteúdo para redes sociais (segunda a sexta) com formato e tema de cada dia.', icon: Calendar, color: 'text-emerald-400' },
  { label: '🎯 Estratégia de Funil', text: 'Monte uma estratégia de conteúdo completa baseada em funil de vendas (topo, meio e fundo) para este cliente.', icon: Target, color: 'text-rose-400' },
  { label: '#️⃣ Hashtags', text: 'Gere 3 grupos de hashtags (alcance, nicho e marca) otimizados para o Instagram deste cliente. Máximo 30 hashtags.', icon: Hash, color: 'text-violet-400' },
  { label: '⚡ Hook de Reels', text: 'Crie 5 ganchos iniciais criativos e virais para Reels curtos desse nicho. O gancho deve ser nos primeiros 2 segundos.', icon: Zap, color: 'text-orange-400' },
  { label: '📖 Briefing Criativo', text: 'Gere um briefing completo para um post criativo baseado no setor e público-alvo do cliente. Inclua tom de voz, referências visuais e CTA.', icon: BookOpen, color: 'text-cyan-400' },
];

export function LeiaChatScreen({ currentClient, onNavigate }: LeiaChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isPromptLibraryOpen, setIsPromptLibraryOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const welcomeText = currentClient
      ? `Olá! Sou a **LeIA**, sua assistente criativa. Estou pronta para ajudar com o planejamento de conteúdo de **${currentClient.name}**.\n\nPosso gerar ideias de posts, escrever legendas, montar estratégias de funil, criar briefings criativos e muito mais. Use a biblioteca de prompts à esquerda ou simplesmente me pergunte qualquer coisa!`
      : "Olá! Sou a **LeIA**, sua assistente criativa. Selecione um cliente na barra lateral para que eu possa personalizar minhas respostas com o briefing e dados estratégicos deles.";
    setMessages([{
      id: 'welcome',
      sender: 'leia',
      text: welcomeText,
      timestamp: Date.now()
    }]);
  }, [currentClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: Message = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'user',
      text,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      const historyForApi = messages
        .filter(m => m.id !== 'welcome')
        .slice(-20)
        .map(m => ({ sender: m.sender, text: m.text }));

      const response = await api.chatWithLeia(
        currentClient?.id || null,
        text,
        historyForApi
      );

      const leiaMsg: Message = {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'leia',
        text: response,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, leiaMsg]);
    } catch (err) {
      console.error('LeIA chat error:', err);
      const errorMsg: Message = {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'leia',
        text: 'Desculpe, houve um erro ao processar sua mensagem. Tente novamente em alguns segundos.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderFormattedText = (txt: string) => {
    const lines = txt.split('\n');
    return lines.map((line, lineIdx) => {
      // Bold
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const rendered = parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={idx} className="font-black text-primary">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      // Bullet points
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return <div key={lineIdx} className="flex gap-2 pl-2 py-0.5"><span className="text-primary mt-0.5">•</span><span>{rendered}</span></div>;
      }
      // Numbered list
      if (/^\d+\.\s/.test(line.trim())) {
        return <div key={lineIdx} className="pl-2 py-0.5">{rendered}</div>;
      }
      // Empty line
      if (line.trim() === '') {
        return <div key={lineIdx} className="h-2" />;
      }
      return <div key={lineIdx}>{rendered}</div>;
    });
  };

  const personalizedGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  return (
    <MainLayout activeScreen="leia_chat" onNavigate={onNavigate} currentClient={currentClient}>
      <div className="flex-1 flex overflow-hidden">
        {/* Prompt Library Sidebar */}
        <AnimatePresence>
          {isPromptLibraryOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="border-r border-white/5 bg-white/30 dark:bg-zinc-900/30 backdrop-blur-md flex flex-col overflow-hidden shrink-0"
            >
              <div className="p-6 border-b border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" /> Prompts
                  </h3>
                  <button 
                    onClick={() => setIsPromptLibraryOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-all opacity-40 hover:opacity-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[10px] opacity-40 leading-relaxed">
                  Clique em qualquer prompt para enviar automaticamente à LeIA.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
                {PROMPT_LIBRARY.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(prompt.text)}
                    className="w-full text-left p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all group flex items-center gap-3"
                  >
                    <prompt.icon className={cn("w-5 h-5 shrink-0 transition-transform group-hover:scale-110", prompt.color)} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold truncate">{prompt.label}</span>
                      <span className="text-[9px] opacity-40 line-clamp-2 mt-0.5">{prompt.text.substring(0, 60)}...</span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat Header */}
          <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between bg-white/20 dark:bg-zinc-900/20 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              {!isPromptLibraryOpen && (
                <button
                  onClick={() => setIsPromptLibraryOpen(true)}
                  className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-primary/10 transition-all"
                >
                  <BookOpen className="w-4 h-4" />
                </button>
              )}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-primary/20">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-background animate-pulse" />
                </div>
                <div className="flex flex-col">
                  <h2 className="font-display font-black text-lg leading-none tracking-tight">LeIA</h2>
                  <span className="text-[9px] font-bold uppercase opacity-40 tracking-widest mt-0.5">
                    {currentClient ? `Assistindo ${currentClient.name}` : 'Assistente Criativa • Online'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setMessages([]);
                  const welcomeText = currentClient
                    ? `Conversa reiniciada! Como posso ajudar com **${currentClient.name}**?`
                    : 'Conversa reiniciada! Selecione um cliente para começarmos.';
                  setMessages([{
                    id: 'welcome-reset',
                    sender: 'leia',
                    text: welcomeText,
                    timestamp: Date.now()
                  }]);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-white/5 text-[10px] font-bold uppercase hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-500 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Limpar Chat
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4 scrollbar-thin">
            {messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex",
                  msg.sender === 'leia' ? "justify-start" : "justify-end"
                )}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-3xl p-5 text-sm leading-relaxed",
                    msg.sender === 'leia'
                      ? "bg-black/5 dark:bg-white/5 border border-white/5 text-foreground"
                      : "bg-primary text-white shadow-lg shadow-primary/20"
                  )}
                >
                  {msg.sender === 'leia' ? (
                    <div className="space-y-0.5">{renderFormattedText(msg.text)}</div>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.text}</span>
                  )}
                </div>
              </motion.div>
            ))}

            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-black/5 dark:bg-white/5 border border-white/5 rounded-3xl px-6 py-4 flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-40">LeIA está pensando...</span>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-6 border-t border-white/5 bg-white/20 dark:bg-zinc-900/20 backdrop-blur-sm">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputValue);
              }}
              className="flex gap-3 max-w-4xl mx-auto"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={currentClient ? `Pergunte à LeIA sobre ${currentClient.name}...` : 'Pergunte à LeIA...'}
                className="flex-1 px-6 py-4 text-sm rounded-2xl bg-black/5 dark:bg-white/5 border border-white/5 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/30 text-foreground transition-all font-medium"
                disabled={isTyping}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isTyping}
                className="px-6 py-4 rounded-2xl bg-primary text-white hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none shadow-lg shadow-primary/20 flex items-center gap-2 font-bold text-xs uppercase"
              >
                <Send className="w-4 h-4" />
                Enviar
              </button>
            </form>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
