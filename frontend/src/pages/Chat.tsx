import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import api from '../api/axios';
import { IconEdit, IconMore, IconUser, IconMessage, IconSearch, IconInfo, IconPaperclip, IconSend, IconX } from '../components/Icons';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
const BACKEND_BASE_URL = import.meta.env.VITE_WS_BASE_URL || API_BASE_URL.replace(/\/api\/?$/, '');

type ChatPartner = {
  id: string;
  name: string;
  profilePicture?: string;
  unreadCount: number;
   online?: boolean;
   lastSeenAt?: string | null;
};

type Message = {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  timestamp: string;
  isRead: boolean;
};

type TypingEvent = {
   senderId: string;
   recipientId: string;
   typing: boolean;
};

type PresenceEvent = {
   userId: string;
   online: boolean;
   lastSeenAt?: string | null;
};

const sortMessagesAsc = (items: Message[]) => {
   return [...items].sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      // Handle invalid dates by pushing them to the end
      const ta = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
      const tb = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
      
      if (ta !== tb) return ta - tb;
      // Secondary sort by ID if timestamps are identical
      return (a.id || '').localeCompare(b.id || '');
   });
};

const Chat: React.FC = () => {
  const { partnerId } = useParams<{ partnerId: string }>();
  const navigate = useNavigate();

  const [partners, setPartners] = useState<ChatPartner[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
   const [isPartnerTyping, setIsPartnerTyping] = useState(false);
   const [lastSeenTick, setLastSeenTick] = useState(Date.now());
   const [isSearchOpen, setIsSearchOpen] = useState(false);
   const [searchQuery, setSearchQuery] = useState('');
   const [isMenuOpen, setIsMenuOpen] = useState(false);
   const [isEditMode, setIsEditMode] = useState(false);
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activePartnerData, setActivePartnerData] = useState<ChatPartner | null>(null);
  
  const stompClient = useRef<Client | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
   const messagesContainerRef = useRef<HTMLDivElement>(null);
   const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   const typingIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   const typingStateRef = useRef(false);

  // 1. Initialize logic
  useEffect(() => {
    fetchInitialData();

      return () => {
         if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
         }
         if (typingIndicatorTimeoutRef.current) {
            clearTimeout(typingIndicatorTimeoutRef.current);
         }
         stompClient.current?.deactivate();
      };
  }, []);

   // Re-render every minute so "last seen" labels stay fresh without page reload
   useEffect(() => {
      const id = setInterval(() => {
         setLastSeenTick(Date.now());
      }, 60000);

      return () => clearInterval(id);
   }, []);

   // 2. Fetch specific chat history when partnerId changes
   useEffect(() => {
      if (partnerId && currentUserId) {
          fetchChatHistory(partnerId);
          markAsRead(partnerId);
          setIsPartnerTyping(false);
      } else {
          setMessages([]);
          setIsPartnerTyping(false);
      }
   }, [partnerId, currentUserId]);

      // 2b. Keep active partner header in sync without re-fetching history repeatedly
   useEffect(() => {
      if (!partnerId) {
         setActivePartnerData(null);
         return;
      }

      // Re-fetch history when switching partners to ensure we have the latest state
      fetchChatHistory(partnerId);

      const existingPartner = partners.find((p) => p.id === partnerId);
      if (existingPartner) {
         setActivePartnerData(existingPartner);
         return;
      }
      
      setupActivePartnerData(partnerId);
   }, [partnerId, partners]);

  // 3. Scroll to bottom when messages update
  useEffect(() => {
      const scrollToLatest = () => {
         if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
         }
         messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      };

      // Wait one frame so DOM height is finalized
      requestAnimationFrame(scrollToLatest);
   }, [messages, partnerId]);

  const fetchInitialData = async () => {
    try {
      const [userRes, partnersRes] = await Promise.all([
        api.get('/me'),
        api.get('/chat/partners')
      ]);
      setCurrentUserId(userRes.data.id);
      
      // The backend returns a list of {id, name, unreadCount}. 
      // Need overfetch to get profilePictures
      const enhancedPartners = await Promise.all(
         partnersRes.data.map(async (p: any) => {
            try {
               const detail = await api.get(`/users/${p.id}`);
               return { ...p, profilePicture: detail.data?.profilePicture };
            } catch {
               return p;
            }
         })
      );

         const presenceMapRes = await api.get('/chat/presence').catch(() => ({ data: {} }));
         const presenceMap = presenceMapRes.data || {};

         const partnersWithPresence = enhancedPartners.map((p: ChatPartner) => ({
            ...p,
            online: Boolean(presenceMap[p.id]?.online),
            lastSeenAt: presenceMap[p.id]?.lastSeenAt || null
         }));

         setPartners(partnersWithPresence);

      // Startup STOMP Connection
      connectWebSocket(userRes.data.id);

    } catch (err) {
      console.error('Core chat bootstrap failed', err);
    }
  };

  const setupActivePartnerData = async (targetId: string) => {
      let p = partners.find(p => p.id === targetId);
      if (!p) {
         try {
             const detail = await api.get(`/users/${targetId}`);
             p = {
                id: detail.data.id,
                name: detail.data.name,
                profilePicture: detail.data.profilePicture,
               unreadCount: 0,
                      online: false,
                      lastSeenAt: detail.data.lastSeenAt || null
             };
             // Add securely to partners list if initiated via outside route
             setPartners(prev => {
                if(prev.find(x => x.id === targetId)) return prev;
                return [p!, ...prev];
             });
         } catch {
             return; // failed to load partner
         }
      }
      setActivePartnerData(p || null);
  };

  const fetchChatHistory = async (targetId: string) => {
     try {
       const res = await api.get(`/chat/history/${targetId}?size=50`);
          const content = Array.isArray(res.data?.content) ? res.data.content : [];
          setMessages(sortMessagesAsc(content));
     } catch (err) {
       console.error('Failed to fetch chat history', err);
     }
  };

  const markAsRead = async (senderId: string) => {
      try {
         await api.post(`/chat/read/${senderId}`);
         setPartners(prev => prev.map(p => p.id === senderId ? { ...p, unreadCount: 0 } : p));
      } catch (err) {
         console.warn('Silent fail: unread state logic');
      }
  };

  const connectWebSocket = (uId: string) => {
      if (stompClient.current) {
         stompClient.current.deactivate();
         stompClient.current = null;
      }

    // STOMP over Standard WebSocket
    const token = localStorage.getItem('token');
    
    // Convert HTTP URL to WS URL
    const wsUrl = BACKEND_BASE_URL.replace(/^http/, 'ws') + '/ws';
    
    const client = new Client({
      brokerURL: wsUrl,
      
      // Pass the JWT so simple Stomp authorization interceptor works.
      connectHeaders: {
         Authorization: `Bearer ${token}`
      },
      // Debug logging
      debug: (str) => {
        console.log('STOMP: ' + str);
      },
      reconnectDelay: 5000,
      
      onConnect: () => {
         console.log('STOMP Connected');
         // Subscribe to private user queue
         client.subscribe('/user/queue/messages', (msg) => {
            const incomingMessage: Message = JSON.parse(msg.body);
            
            // 1. Instantly append message if it belongs to open chat
            setMessages((prevMsg) => {
               // Security check: Ignore duplicates if STOMP triggers twice internally
               if (prevMsg.find(m => m.id === incomingMessage.id)) return prevMsg;
               
               // Get current ID directly from URL to avoid closure staleness
               const currentPathId = window.location.pathname.split('/').pop() || '';
               
               // Check if message belongs to the CURRENTLY OPEN chat
               const isRelevant = 
                  (incomingMessage.senderId === currentPathId && incomingMessage.recipientId === uId) ||
                  (incomingMessage.senderId === uId && incomingMessage.recipientId === currentPathId);

               if (isRelevant) {
                   return sortMessagesAsc([...prevMsg, incomingMessage]);
               }
               return prevMsg;
            });

            // 2. Adjust Partners list and read counters
            setPartners((prev) => {
               const partnerIdToFind = incomingMessage.senderId === uId ? incomingMessage.recipientId : incomingMessage.senderId;
               let partnerIndex = prev.findIndex(p => p.id === partnerIdToFind);
               let currentActiveId = window.location.pathname.split('/').pop() || '';
               
               const isTargetingUsAndNotActive = incomingMessage.senderId !== uId && currentActiveId !== partnerIdToFind;
               
               if (partnerIndex === -1) {
                  // Partner not in list, trigger a fetch
                  fetchInitialData(); 
                  return prev;
               }

               const pArray = [...prev];
               const targetPartner = pArray.splice(partnerIndex, 1)[0]; // Remove element
               
               if (isTargetingUsAndNotActive) {
                   targetPartner.unreadCount = (targetPartner.unreadCount || 0) + 1;
               } else if (incomingMessage.senderId === partnerIdToFind && currentActiveId === partnerIdToFind) {
                   // Message received from active screen, silently mark as read
                   api.post(`/chat/read/${partnerIdToFind}`).catch(() => {});
               }

               // Lift partner to top (Push to Unshift)
               return [targetPartner, ...pArray];
            });
         });

            client.subscribe('/user/queue/typing', (msg) => {
                  const typingEvent: TypingEvent = JSON.parse(msg.body);
                  const activePartnerId = window.location.pathname.split('/').pop() || '';
                  
                  // Normalize comparison to handle case sensitivity if needed
                  if (!activePartnerId || typingEvent.senderId.toLowerCase() !== activePartnerId.toLowerCase()) {
                     return;
                  }

                  setIsPartnerTyping(typingEvent.typing);
                  if (typingIndicatorTimeoutRef.current) {
                     clearTimeout(typingIndicatorTimeoutRef.current);
                  }
                  if (typingEvent.typing) {
                     typingIndicatorTimeoutRef.current = setTimeout(() => setIsPartnerTyping(false), 2000);
                  }
             });

            client.subscribe('/user/queue/presence', (msg) => {
                  const presenceEvent: PresenceEvent = JSON.parse(msg.body);
                  setPartners((prev) => prev.map((p) => (
                     p.id === presenceEvent.userId
                  ? { ...p, online: presenceEvent.online, lastSeenAt: presenceEvent.lastSeenAt ?? p.lastSeenAt }
                        : p
                  )));
             });
      },
      onStompError: (frame) => {
        console.error('Broker reported error: ' + frame.headers['message']);
      },
    });

    client.activate();
    stompClient.current = client;
  };

  const handleSendMessage = () => {
      if (!newMessage.trim() || !partnerId || !currentUserId) return;

      const chatMessage = {
          recipientId: partnerId,
          content: newMessage
      };

      if (stompClient.current && stompClient.current.connected) {
         stompClient.current.publish({
            destination: '/app/chat', // Controller MessageMapping
            body: JSON.stringify(chatMessage)
         });
      } else {
         // Fallback to REST HTTP Post
         api.post(`/chat/send/${partnerId}`, { content: newMessage })
            .then((res) => {
               // Manually add the message to the list if successful
               if (res.data) {
                  setMessages((prevMsg) => sortMessagesAsc([...prevMsg, res.data]));
               }
            })
            .catch(err => {
             console.error('Fallback send error', err);
         });
      }

      setNewMessage('');
         sendTyping(false);
  };

   const sendTyping = (typing: boolean) => {
      if (!partnerId || !stompClient.current?.connected) {
         return;
      }
      if (typingStateRef.current === typing) {
         return;
      }

      typingStateRef.current = typing;
      stompClient.current.publish({
         destination: '/app/chat/typing',
         body: JSON.stringify({ recipientId: partnerId, typing })
      });
   };

   const handleMessageInput = (value: string) => {
      setNewMessage(value);
      if (!partnerId) {
         return;
      }

      if (value.trim().length > 0) {
         sendTyping(true);
         if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
         }
         typingTimeoutRef.current = setTimeout(() => sendTyping(false), 1200);
      } else {
         if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
         }
         sendTyping(false);
      }
   };

   const formatLastSeen = (lastSeenAt?: string | null) => {
      if (!lastSeenAt) {
         return 'last seen recently';
      }

      const date = new Date(lastSeenAt);
      if (Number.isNaN(date.getTime())) {
         return 'last seen recently';
      }

      const diffMs = lastSeenTick - date.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);

      if (diffMinutes < 1) {
         return 'Just now';
      }
      if (diffMinutes < 60) {
         return `${diffMinutes}m ago`;
      }

      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) {
         return `${diffHours}h ago`;
      }

      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
   };

   const filteredMessages = searchQuery.trim().length === 0
      ? messages
      : messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()));

   return (
      <div className="flex h-full min-h-0 w-full bg-transparent rounded-3xl shadow-2xl border border-white/5 animate-fade-in relative backdrop-blur-sm">
      
      {/* Sidebar: Chat Channels */}
      <div className={`w-full md:w-80 min-h-0 flex-shrink-0 bg-zinc-900/60 border-r border-white/5 flex flex-col backdrop-blur-xl z-20 ${partnerId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
            <h2 className="text-lg font-bold text-zinc-100 tracking-tight">Messages</h2>
            <div className="flex gap-2">
                      <button
                           onClick={() => setIsEditMode((prev) => !prev)}
                           className={`p-2 rounded-full transition-colors ${isEditMode ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-white/5 text-zinc-400 hover:text-indigo-400'}`}
                           title={isEditMode ? 'Exit edit mode' : 'Edit messages'}
                      >
                  <span className="text-lg"><IconEdit className="w-5 h-5" /></span>
               </button>
                      <button
                           onClick={() => setIsMenuOpen((prev) => !prev)}
                           className="p-2 rounded-full hover:bg-white/5 text-zinc-400 hover:text-indigo-400 transition-colors"
                           title="Conversation settings"
                      >
                  <span className="text-lg"><IconMore className="w-5 h-5" /></span>
               </button>
            </div>
        </div>

            {isMenuOpen && (
               <div className="mx-3 mt-2 p-2 rounded-xl border border-white/10 bg-zinc-900/80 backdrop-blur-xl">
                  <button
                     onClick={() => {
                        setPartners((prev) => prev.map((p) => p.id === partnerId ? { ...p, unreadCount: 0 } : p));
                        setIsMenuOpen(false);
                     }}
                     className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-white/5 text-zinc-300"
                  >
                     Mark conversation as read
                  </button>
                  <button
                     onClick={() => {
                        setMessages([]);
                        setIsMenuOpen(false);
                     }}
                     className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-white/5 text-zinc-300"
                  >
                     Clear local message view
                  </button>
               </div>
            )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2 custom-scrollbar">
            {partners.length === 0 ? (
                <div className="p-8 text-center text-zinc-600 text-sm">No active conversations</div>
            ) : (
                partners.map(p => (
                   <div 
                      key={p.id} 
                      onClick={() => navigate(`/chat/${p.id}`)}
                      className={`group p-3 rounded-2xl flex items-center cursor-pointer transition-all duration-200 border border-transparent ${partnerId === p.id ? 'bg-indigo-600/10 border-indigo-500/20 shadow-sm' : 'hover:bg-zinc-800/50 hover:border-white/5'}`}
                   >
                     <div className="relative">
                         <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl overflow-hidden bg-zinc-800 border-2 ${partnerId === p.id ? 'border-indigo-500/30' : 'border-zinc-700/30'}`}>
                             {p.profilePicture ? (
                                <img src={`${BACKEND_BASE_URL}${p.profilePicture}`} alt={p.name} className="w-full h-full object-cover" />
                             ) : (
                                <span className="opacity-50"><IconUser className="w-6 h-6" /></span>
                             )}
                         </div>
                         {/* Online Status Dot */}
                         {p.online && (
                            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-zinc-900 rounded-full z-10 shadow-sm shadow-emerald-500/20"></div>
                         )}
                         {/* Unread Counter Badge */}
                         {p.unreadCount > 0 && (
                            <div className="absolute -top-1 -right-1 bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full z-10 shadow-lg shadow-indigo-500/30 border border-zinc-900">
                               {p.unreadCount}
                            </div>
                         )}
                     </div>
                     <div className="ml-3 truncate flex-1">
                        <div className="flex justify-between items-center mb-0.5">
                           <p className={`font-medium text-sm truncate ${p.unreadCount > 0 ? 'text-zinc-100' : 'text-zinc-300 group-hover:text-zinc-200'}`}>{p.name}</p>
                           <span className="text-[10px] text-zinc-600">{p.online ? 'Now' : formatLastSeen(p.lastSeenAt)}</span>
                        </div>
                          <p className={`text-xs truncate ${(p.id === activePartnerData?.id && isPartnerTyping) ? 'text-indigo-400 italic' : 'text-zinc-500'}`}>
                           {p.id === activePartnerData?.id && isPartnerTyping ? 'Typing...' : (p.unreadCount > 0 ? 'New message' : 'Click to chat')}
                        </p>
                     </div>
                   </div>
                ))
            )}
        </div>
      </div>

      {/* Main Panel: Chat Window */}
      <div className={`flex-1 min-h-0 flex flex-col bg-zinc-900/30 relative ${!partnerId ? 'hidden md:flex' : 'flex'}`}>
         {/* Decorative Gradients */}
         <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
         <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/5 rounded-full blur-3xl pointer-events-none translate-y-1/2 -translate-x-1/2"></div>

          {!partnerId ? (
              <div className="flex-1 flex items-center justify-center flex-col gap-6 text-zinc-500 z-10">
                  <div className="w-24 h-24 rounded-full bg-zinc-800/50 flex items-center justify-center text-4xl shadow-inner border border-white/5">
                     <IconMessage className="w-12 h-12 text-zinc-600" />
                  </div>
                  <div className="text-center">
                     <p className="text-lg font-medium text-zinc-300">Select a conversation</p>
                     <p className="text-sm mt-1 opacity-60">to start messaging</p>
                  </div>
              </div>
          ) : (
             <>
                {/* Chat Header */}
                <div className="h-20 px-6 border-b border-white/5 flex shrink-0 items-center justify-between backdrop-blur-md bg-zinc-900/40 z-20">
                    <div className="flex items-center gap-4">
                       <button
                          onClick={() => navigate('/chat')}
                          className="md:hidden px-2 py-1 rounded-lg text-xs border border-white/10 text-zinc-300 hover:bg-white/5"
                       >
                          Back
                       </button>
                       <div className="relative">
                           <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border border-white/10 shadow-md">
                               {activePartnerData?.profilePicture ? 
                                 <img src={`${BACKEND_BASE_URL}${activePartnerData.profilePicture}`} className="w-full h-full object-cover"/> : 
                                 <div className="w-full h-full flex items-center justify-center text-zinc-500"><IconUser className="w-5 h-5" /></div>
                               }
                           </div>
                           {activePartnerData?.online && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border border-zinc-900 rounded-full"></div>}
                       </div>
                       
                        <div className="flex flex-col">
                           <h3 className="text-zinc-100 font-bold text-base tracking-wide flex items-center gap-2">
                              {activePartnerData?.name || 'Loading...'}
                              {activePartnerData?.online && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block opacity-50"></span>}
                           </h3>
                           <span className={`text-xs font-medium ${activePartnerData?.online ? 'text-emerald-500/80' : 'text-zinc-500'}`}>
                              {activePartnerData?.online ? 'Active now' : `Seen ${formatLastSeen(activePartnerData?.lastSeenAt)}`}
                           </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                                  <button
                                       onClick={() => setIsSearchOpen((prev) => !prev)}
                                       className={`p-2.5 rounded-full transition-all ${isSearchOpen ? 'text-indigo-300 bg-indigo-500/20' : 'text-zinc-400 hover:text-indigo-400 hover:bg-white/5'}`}
                                       title="Search"
                                  >
                          <IconSearch className="w-5 h-5" />
                       </button>
                                  <button
                                       onClick={() => partnerId && navigate(`/profile/${partnerId}`)}
                                       className="p-2.5 rounded-full text-zinc-400 hover:text-indigo-400 hover:bg-white/5 transition-all"
                                       title="Profile info"
                                  >
                          <IconInfo className="w-5 h-5" />
                       </button>
                    </div>
                </div>

                        {isSearchOpen && (
                           <div className="px-6 py-3 border-b border-white/5 bg-zinc-900/40 backdrop-blur-md z-20 flex items-center gap-2">
                              <IconSearch className="w-4 h-4 text-zinc-500" />
                              <input
                                 type="text"
                                 value={searchQuery}
                                 onChange={(e) => setSearchQuery(e.target.value)}
                                 placeholder="Search in this conversation..."
                                 className="flex-1 bg-transparent outline-none text-sm text-zinc-200 placeholder-zinc-500"
                              />
                              <button
                                 onClick={() => {
                                    setSearchQuery('');
                                    setIsSearchOpen(false);
                                 }}
                                 className="p-1.5 rounded-md hover:bg-white/5 text-zinc-400"
                                 title="Close search"
                              >
                                 <IconX className="w-4 h-4" />
                              </button>
                           </div>
                        )}

                {/* Messages Feed */}
                <div ref={messagesContainerRef} className="flex-1 min-h-0 p-6 overflow-y-auto custom-scrollbar scroll-smooth flex flex-col z-10">
                  {filteredMessages.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-40">
                           <div className="w-16 h-1 bg-gradient-to-r from-transparent via-zinc-600 to-transparent rounded-full mb-4"></div>
                        <p className="text-sm text-zinc-500 font-medium">{searchQuery ? 'No matching messages' : 'Start the conversation'}</p>
                        </div>
                    ) : (
                     <div className="flex flex-col space-y-6 pb-2">
                       {filteredMessages.map((m, idx) => {
                              const isOwn = m.senderId === currentUserId;
                          const isSequence = idx > 0 && filteredMessages[idx-1].senderId === m.senderId;
                              
                              return (
                                 <div key={m.id} className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} group animate-fade-in`}>
                               {!isOwn && !isSequence && (
                                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/5 flex-shrink-0 mr-2 overflow-hidden self-end mb-1 shadow-sm">
                                      {activePartnerData?.profilePicture ? 
                                       <img src={`${BACKEND_BASE_URL}${activePartnerData.profilePicture}`} className="w-full h-full object-cover"/> : 
                                       <div className="w-full h-full flex items-center justify-center text-xs opacity-50"><IconUser className="w-4 h-4" /></div>
                                      }
                                  </div>
                               )}
                               {!isOwn && isSequence && <div className="w-10"></div>}
                               
                               <div className={`max-w-[70%] relative ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                                   <div className={`px-5 py-3 text-sm shadow-md backdrop-blur-sm border ${
                                      isOwn 
                                         ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm border-indigo-500/20' 
                                         : 'bg-zinc-800/80 text-zinc-100 rounded-2xl rounded-tl-sm border-white/5'
                                   } transition-all hover:shadow-lg`}>
                                      {m.content}
                                   </div>
                                   {isEditMode && isOwn && (
                                      <button
                                        className="mt-1 text-[10px] text-zinc-400 hover:text-indigo-300 px-1"
                                        onClick={() => {
                                          const next = window.prompt('Edit message', m.content);
                                          if (next === null) return;
                                          setMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, content: next } : x));
                                        }}
                                      >
                                        Edit
                                      </button>
                                   )}
                                   <div className={`text-[10px] mt-1 opacity-0 group-hover:opacity-60 transition-opacity px-1 flex items-center gap-1 text-zinc-500 font-medium`}>
                                      {new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                      {isOwn && (
                                         <span className={m.isRead ? 'text-indigo-400 font-bold' : 'text-zinc-600 font-bold tracking-tighter'}>
                                            {m.isRead ? '✓✓' : '✓'}
                                         </span>
                                      )}
                                   </div>
                               </div>
                           </div>
                        );
                    })}
                    
                    {isPartnerTyping && (
                       <div className="flex w-full justify-start items-center gap-3 pl-10 animate-pulse">
                          <div className="bg-zinc-800/50 px-4 py-2 rounded-full border border-white/5 flex gap-1 items-center">
                             <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                             <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                             <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                          </div>
                          <span className="text-xs text-zinc-500 font-medium">Typing...</span>
                       </div>
                    )}
                    
                        <div ref={messagesEndRef} className="h-4" />
                       </div>
                    )}
                </div>

                {/* Message Input Input */}
                <div className="p-5 bg-zinc-900/60 backdrop-blur-xl border-t border-white/5 flex shrink-0 gap-3 w-full z-20 items-end">
                    <button className="p-3 rounded-full bg-zinc-800/50 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 transition-colors border border-white/5">
                       <IconPaperclip className="w-5 h-5" />
                    </button>
                    <div className="flex-1 bg-zinc-800/50 rounded-2xl border border-zinc-700/50 focus-within:border-indigo-500/50 focus-within:bg-zinc-800 transition-all flex items-center shadow-inner">
                       <input 
                          type="text" 
                          value={newMessage}
                          onChange={(e) => handleMessageInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                          className="flex-1 bg-transparent border-none outline-none text-zinc-200 placeholder-zinc-500 px-4 py-3"
                          placeholder="Type a message..."
                          autoFocus
                       />
                    </div>
                    <button 
                       onClick={handleSendMessage}
                       disabled={!newMessage.trim()}
                       className="p-3 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-500 hover:scale-105 transition-all active:scale-95 flex items-center justify-center h-[50px] w-[50px]"
                    >
                       <IconSend className="w-5 h-5" />
                    </button>
                </div>
             </>
          )}
      </div>
    </div>
  );
};

export default Chat;