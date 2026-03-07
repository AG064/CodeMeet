import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import api from '../api/axios';
import FeedbackBanner from '../components/FeedbackBanner.tsx';
import { IconEdit, IconMore, IconUser, IconMessage, IconSearch, IconInfo, IconPaperclip, IconSend, IconX } from '../components/Icons';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
const BACKEND_BASE_URL = import.meta.env.VITE_WS_BASE_URL || API_BASE_URL.replace(/\/api\/?$/, '');
const TYPING_RENEW_INTERVAL_MS = 1000;
const TYPING_IDLE_TIMEOUT_MS = 1200;
const TYPING_INDICATOR_HIDE_DELAY_MS = 2000;

type ChatPartner = {
  id: string;
  name: string;
  profilePicture?: string;
  unreadCount: number;
   online?: boolean;
   lastSeenAt?: string | null;
   lastSeenVisible?: boolean;
};

type Message = {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  attachmentUrl?: string;
  attachmentName?: string;
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
   lastSeenVisible?: boolean;
};

type ChatPartnerSummary = {
   id: string;
   name: string;
   unreadCount: number;
};

type UserSummary = {
   id: string;
   name: string;
   profilePicture?: string;
   lastSeenAt?: string | null;
   lastSeenVisible?: boolean;
};

type PresenceStatus = {
   online?: boolean;
   lastSeenAt?: string | null;
   lastSeenVisible?: boolean;
};

type PaginatedResponse<T> = {
   content?: T[];
};

const sortMessagesAsc = (items: Message[]) => {
   return [...items].sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      const ta = Number.isNaN(dateA.getTime()) ? 0 : dateA.getTime();
      const tb = Number.isNaN(dateB.getTime()) ? 0 : dateB.getTime();

      if (ta !== tb) {
         return ta - tb;
      }

      return (a.id || '').localeCompare(b.id || '');
   });
};

const getRoutePartnerId = () => window.location.pathname.split('/').pop() || '';

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
   const [pendingFile, setPendingFile] = useState<File | null>(null);
   const [uploading, setUploading] = useState(false);
   const [blockingPartner, setBlockingPartner] = useState(false);
   const [actionError, setActionError] = useState<string | null>(null);
   const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activePartnerData, setActivePartnerData] = useState<ChatPartner | null>(null);

  const stompClient = useRef<Client | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
   const messagesContainerRef = useRef<HTMLDivElement>(null);
   const fileInputRef = useRef<HTMLInputElement>(null);
   const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   const typingIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   const typingStateRef = useRef(false);
   const lastTypingSentAtRef = useRef(0);

   const loadPartnerData = useCallback(async (targetId: string): Promise<ChatPartner | null> => {
      try {
         const detail = await api.get<UserSummary>(`/users/${targetId}`);
         return {
            id: detail.data.id,
            name: detail.data.name,
            profilePicture: detail.data.profilePicture,
            unreadCount: 0,
            online: false,
            lastSeenAt: detail.data.lastSeenAt || null,
            lastSeenVisible: detail.data.lastSeenVisible !== false,
         };
      } catch {
         return null;
      }
   }, []);

   const fetchChatHistory = useCallback(async (targetId: string) => {
      try {
         const res = await api.get<PaginatedResponse<Message>>(`/chat/history/${targetId}?size=50`);
         const content = Array.isArray(res.data?.content) ? res.data.content : [];
         setMessages(sortMessagesAsc(content));
      } catch (error) {
         console.error('Failed to fetch chat history', error);
      }
   }, []);

   const markAsRead = useCallback(async (senderId: string) => {
      try {
         await api.post(`/chat/read/${senderId}`);
         setPartners((prev) => prev.map((partner) => (partner.id === senderId ? { ...partner, unreadCount: 0 } : partner)));
      } catch {
         console.warn('Silent fail: unread state logic');
      }
   }, []);

   const connectWebSocket = useCallback((userId: string) => {
      if (stompClient.current) {
         stompClient.current.deactivate();
         stompClient.current = null;
      }

      const token = localStorage.getItem('token');
      const wsUrl = BACKEND_BASE_URL.replace(/^http/, 'ws') + '/ws';

      const client = new Client({
         brokerURL: wsUrl,
         connectHeaders: {
            Authorization: `Bearer ${token}`,
         },
         debug: (message) => {
            console.log(`STOMP: ${message}`);
         },
         reconnectDelay: 5000,
         onConnect: () => {
            console.log('STOMP Connected');

            client.subscribe('/user/queue/messages', (msg) => {
               const incomingMessage: Message = JSON.parse(msg.body);

               setMessages((prevMessages) => {
                  if (prevMessages.some((message) => message.id === incomingMessage.id)) {
                     return prevMessages;
                  }

                  const currentPathId = getRoutePartnerId();
                  const isRelevant =
                     (incomingMessage.senderId === currentPathId && incomingMessage.recipientId === userId) ||
                     (incomingMessage.senderId === userId && incomingMessage.recipientId === currentPathId);

                  return isRelevant ? sortMessagesAsc([...prevMessages, incomingMessage]) : prevMessages;
               });

               setPartners((prev) => {
                  const partnerIdToFind = incomingMessage.senderId === userId ? incomingMessage.recipientId : incomingMessage.senderId;
                  const partnerIndex = prev.findIndex((partner) => partner.id === partnerIdToFind);
                  const currentActiveId = getRoutePartnerId();
                  const isTargetingUsAndNotActive = incomingMessage.senderId !== userId && currentActiveId !== partnerIdToFind;

                  if (partnerIndex === -1) {
                     void loadPartnerData(partnerIdToFind).then((partner) => {
                        if (!partner) {
                           return;
                        }

                        setPartners((existing) => (existing.some((item) => item.id === partner.id) ? existing : [partner, ...existing]));
                     });
                     return prev;
                  }

                  const nextPartners = [...prev];
                  const [targetPartner] = nextPartners.splice(partnerIndex, 1);

                  if (isTargetingUsAndNotActive) {
                     targetPartner.unreadCount = (targetPartner.unreadCount || 0) + 1;
                  } else if (incomingMessage.senderId === partnerIdToFind && currentActiveId === partnerIdToFind) {
                     void api.post(`/chat/read/${partnerIdToFind}`).catch(() => undefined);
                  }

                  return [targetPartner, ...nextPartners];
               });
            });

            client.subscribe('/user/queue/typing', (msg) => {
               const typingEvent: TypingEvent = JSON.parse(msg.body);
               const activePartnerId = getRoutePartnerId();

               if (!activePartnerId || typingEvent.senderId.toLowerCase() !== activePartnerId.toLowerCase()) {
                  return;
               }

               setIsPartnerTyping(typingEvent.typing);
               if (typingIndicatorTimeoutRef.current) {
                  clearTimeout(typingIndicatorTimeoutRef.current);
               }
               if (typingEvent.typing) {
                  typingIndicatorTimeoutRef.current = setTimeout(() => setIsPartnerTyping(false), TYPING_INDICATOR_HIDE_DELAY_MS);
               }
            });

            client.subscribe('/user/queue/presence', (msg) => {
               const presenceEvent: PresenceEvent = JSON.parse(msg.body);
               setPartners((prev) =>
                  prev.map((partner) =>
                     partner.id === presenceEvent.userId
                        ? {
                              ...partner,
                              online: presenceEvent.online,
                              lastSeenAt: presenceEvent.lastSeenAt ?? (presenceEvent.lastSeenVisible === false ? null : partner.lastSeenAt),
                              lastSeenVisible: presenceEvent.lastSeenVisible !== false,
                           }
                        : partner,
                  ),
               );
            });
         },
         onStompError: (frame) => {
            console.error(`Broker reported error: ${frame.headers.message}`);
         },
      });

      client.activate();
      stompClient.current = client;
   }, [loadPartnerData]);

   const fetchInitialData = useCallback(async () => {
      try {
         const [userRes, partnersRes] = await Promise.all([
            api.get<UserSummary>('/me'),
            api.get<ChatPartnerSummary[]>('/chat/partners'),
         ]);

         setCurrentUserId(userRes.data.id);

         const enhancedPartners = await Promise.all(
            partnersRes.data.map(async (partner) => {
               try {
                  const detail = await api.get<UserSummary>(`/users/${partner.id}`);
                  return {
                     ...partner,
                     profilePicture: detail.data?.profilePicture,
                     lastSeenVisible: detail.data?.lastSeenVisible !== false,
                  };
               } catch {
                  return partner;
               }
            }),
         );

         const presenceMapRes = await api.get<Record<string, PresenceStatus>>('/chat/presence').catch(() => ({ data: {} }));
         const presenceMap = presenceMapRes.data || {};

         const partnersWithPresence = enhancedPartners.map((partner) => ({
            ...partner,
            online: Boolean(presenceMap[partner.id]?.online),
            lastSeenAt: presenceMap[partner.id]?.lastSeenAt || null,
            lastSeenVisible: presenceMap[partner.id]?.lastSeenVisible !== false && partner.lastSeenVisible !== false,
         }));

         setPartners(partnersWithPresence);
         connectWebSocket(userRes.data.id);
      } catch (error) {
         console.error('Core chat bootstrap failed', error);
      }
   }, [connectWebSocket]);

   // Bootstrap chat data once, then clean up timers and the socket when the page closes.
  useEffect(() => {
      void fetchInitialData();

      return () => {
         if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
         }
         if (typingIndicatorTimeoutRef.current) {
            clearTimeout(typingIndicatorTimeoutRef.current);
         }
         stompClient.current?.deactivate();
      };
   }, [fetchInitialData]);

   useEffect(() => {
      const id = setInterval(() => {
         setLastSeenTick(Date.now());
      }, 60000);

      return () => clearInterval(id);
   }, []);

   useEffect(() => {
      const handleBlocked = (event: Event) => {
         const customEvent = event as CustomEvent<{ id: string; name?: string }>;
         const blockedId = customEvent.detail?.id;
         if (!blockedId) {
            return;
         }

         setPartners((prev) => prev.filter((partner) => partner.id !== blockedId));

         if (partnerId === blockedId) {
            setActionSuccess(`${customEvent.detail?.name || 'User'} was blocked successfully.`);
            setActivePartnerData(null);
            setMessages([]);
            setIsPartnerTyping(false);
            setTimeout(() => navigate('/chat'), 1200);
         }
      };

      window.addEventListener('codemeet:user-blocked', handleBlocked as EventListener);
      return () => window.removeEventListener('codemeet:user-blocked', handleBlocked as EventListener);
   }, [navigate, partnerId]);

   useEffect(() => {
      if (partnerId && currentUserId) {
         void fetchChatHistory(partnerId);
         void markAsRead(partnerId);
         setIsPartnerTyping(false);
         return;
      }

      setMessages([]);
      setIsPartnerTyping(false);
   }, [currentUserId, fetchChatHistory, markAsRead, partnerId]);

   // Keep the selected conversation details in sync with the sidebar.
   useEffect(() => {
      if (!partnerId) {
         setActivePartnerData(null);
         return;
      }

      const existingPartner = partners.find((partner) => partner.id === partnerId);
      if (existingPartner) {
         setActivePartnerData(existingPartner);
         return;
      }

      void loadPartnerData(partnerId).then((partner) => {
         if (!partner) {
            return;
         }

         setActivePartnerData(partner);
         setPartners((prev) => (prev.some((item) => item.id === partner.id) ? prev : [partner, ...prev]));
      });
   }, [loadPartnerData, partnerId, partners]);

   useEffect(() => {
      const scrollToLatest = () => {
         if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
         }
      };

      requestAnimationFrame(scrollToLatest);
   }, [messages, partnerId]);

  const handleSendMessage = () => {
      if (!newMessage.trim() || !partnerId || !currentUserId) {
         return;
      }

      const chatMessage = {
         recipientId: partnerId,
         content: newMessage,
      };

      if (stompClient.current?.connected) {
         stompClient.current.publish({
            destination: '/app/chat',
            body: JSON.stringify(chatMessage),
         });
      } else {
         api.post<Message>(`/chat/send/${partnerId}`, { content: newMessage })
            .then((res) => {
               if (res.data) {
                  setMessages((prevMessages) => sortMessagesAsc([...prevMessages, res.data]));
               }
            })
            .catch((error) => {
               console.error('Fallback send error', error);
            });
      }

      setNewMessage('');
      sendTyping(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
         setPendingFile(file);
      }
      e.target.value = '';
  };

  const handleSendAttachment = async () => {
      if (!pendingFile || !partnerId) {
         return;
      }

      setUploading(true);
      try {
         const formData = new FormData();
         formData.append('file', pendingFile);
         formData.append('content', newMessage.trim() || pendingFile.name);
         const res = await api.post<Message>(`/chat/upload/${partnerId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
         });
         if (res.data) {
            setMessages((prev) => sortMessagesAsc([...prev, res.data]));
         }
         setPendingFile(null);
         setNewMessage('');
      } catch (error) {
         console.error('Attachment upload failed', error);
      } finally {
         setUploading(false);
      }
  };

   const handleBlockPartner = async () => {
      if (!partnerId || !activePartnerData || blockingPartner) {
         return;
      }

      try {
         setBlockingPartner(true);
         setActionError(null);
         setActionSuccess(null);
         await api.post(`/block/${partnerId}`);
         window.dispatchEvent(new CustomEvent('codemeet:user-blocked', {
            detail: { id: partnerId, name: activePartnerData.name },
         }));
         setActionSuccess(`${activePartnerData.name} was blocked successfully.`);
         setPartners((prev) => prev.filter((partner) => partner.id !== partnerId));
         setIsMenuOpen(false);
         setTimeout(() => {
            setActivePartnerData(null);
            setMessages([]);
            setIsPartnerTyping(false);
            navigate('/chat');
         }, 1200);
      } catch (error) {
         console.error('Failed to block user', error);
         setActionError('Could not block this user right now.');
      } finally {
         setBlockingPartner(false);
      }
   };

   const sendTyping = (typing: boolean) => {
      if (!partnerId || !stompClient.current?.connected) {
         return;
      }

      // Throttle repeated "typing=true" events so we do not publish on every keystroke.
      const now = Date.now();
      const isDuplicateTrue =
         typing &&
         typingStateRef.current === true &&
         now - lastTypingSentAtRef.current < TYPING_RENEW_INTERVAL_MS;

      if ((!typing && typingStateRef.current === false) || isDuplicateTrue) {
         return;
      }

      typingStateRef.current = typing;
      lastTypingSentAtRef.current = now;
      stompClient.current.publish({
         destination: '/app/chat/typing',
         body: JSON.stringify({ recipientId: partnerId, typing }),
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
         typingTimeoutRef.current = setTimeout(() => sendTyping(false), TYPING_IDLE_TIMEOUT_MS);
         return;
      }

      if (typingTimeoutRef.current) {
         clearTimeout(typingTimeoutRef.current);
      }
      sendTyping(false);
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

   const getPresenceLabel = (partner?: ChatPartner | null) => {
      if (partner?.online) {
         return 'Active now';
      }
      if (partner?.lastSeenVisible === false) {
         return 'Last seen hidden';
      }
      return `Seen ${formatLastSeen(partner?.lastSeenAt)}`;
   };

   const filteredMessages = searchQuery.trim().length === 0
      ? messages
      : messages.filter((message) => message.content.toLowerCase().includes(searchQuery.toLowerCase()));

   return (
      <div className="flex h-full min-h-0 w-full bg-transparent rounded-3xl shadow-2xl border border-white/5 animate-fade-in relative backdrop-blur-sm">

      {/* Conversation list */}
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
                  {partnerId && (
                     <button
                        onClick={handleBlockPartner}
                        disabled={blockingPartner}
                        className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-red-500/10 text-red-300 disabled:opacity-60 disabled:cursor-not-allowed"
                     >
                        {blockingPartner ? 'Blocking…' : 'Block user'}
                     </button>
                  )}
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
                         {p.online && (
                            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-zinc-900 rounded-full z-10 shadow-sm shadow-emerald-500/20"></div>
                         )}
                         {p.unreadCount > 0 && (
                            <div className="absolute -top-1 -right-1 bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full z-10 shadow-lg shadow-indigo-500/30 border border-zinc-900">
                               {p.unreadCount}
                            </div>
                         )}
                     </div>
                     <div className="ml-3 truncate flex-1">
                        <div className="flex justify-between items-center mb-0.5">
                           <p className={`font-medium text-sm truncate ${p.unreadCount > 0 ? 'text-zinc-100' : 'text-zinc-300 group-hover:text-zinc-200'}`}>{p.name}</p>
                           <span className="text-[10px] text-zinc-600">{p.online ? 'Now' : (p.lastSeenVisible === false ? 'Hidden' : formatLastSeen(p.lastSeenAt))}</span>
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

         {/* Active conversation */}
      <div className={`flex-1 min-h-0 flex flex-col bg-zinc-900/30 relative overflow-hidden ${!partnerId ? 'hidden md:flex' : 'flex'}`}>
         <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
         <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/5 rounded-full blur-3xl pointer-events-none translate-y-1/2 -translate-x-1/2"></div>

         {actionError && (
            <FeedbackBanner variant="error" className="absolute top-4 left-1/2 z-30 -translate-x-1/2 shadow-lg">
               {actionError}
            </FeedbackBanner>
         )}

         {actionSuccess && (
            <FeedbackBanner variant="success" className="absolute top-4 left-1/2 z-30 -translate-x-1/2 shadow-lg">
               {actionSuccess}
            </FeedbackBanner>
         )}

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
                              {getPresenceLabel(activePartnerData)}
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
                                      {m.attachmentUrl && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(m.attachmentUrl) ? (
                                         <a href={`${BACKEND_BASE_URL}${m.attachmentUrl}`} target="_blank" rel="noopener noreferrer">
                                            <img
                                               src={`${BACKEND_BASE_URL}${m.attachmentUrl}`}
                                               alt={m.attachmentName || 'image'}
                                               className="max-w-[280px] max-h-[300px] rounded-lg mb-1 cursor-pointer"
                                            />
                                         </a>
                                      ) : m.attachmentUrl ? (
                                         <a
                                            href={`${BACKEND_BASE_URL}${m.attachmentUrl}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`flex items-center gap-2 mb-1 ${isOwn ? 'text-indigo-100 hover:text-white' : 'text-indigo-400 hover:text-indigo-300'} transition-colors`}
                                         >
                                            <IconPaperclip className="w-4 h-4 shrink-0" />
                                            <span className="underline truncate">{m.attachmentName || 'Download file'}</span>
                                         </a>
                                      ) : null}
                                      {m.content && !(m.attachmentUrl && m.content === m.attachmentName) && (
                                         <span>{m.content}</span>
                                      )}
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

                {pendingFile && (
                    <div className="px-5 py-2 bg-zinc-900/80 border-t border-white/5 flex items-center gap-2">
                       <IconPaperclip className="w-4 h-4 text-indigo-400 shrink-0" />
                       <span className="text-sm text-zinc-300 truncate flex-1">{pendingFile.name}</span>
                       <button onClick={() => setPendingFile(null)} className="text-zinc-400 hover:text-zinc-200 transition-colors">
                          <IconX className="w-4 h-4" />
                       </button>
                    </div>
                )}

                {/* Message composer */}
                <div className="p-5 bg-zinc-900/60 backdrop-blur-xl border-t border-white/5 flex shrink-0 gap-3 w-full z-20 items-end">
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                    <button
                       onClick={() => fileInputRef.current?.click()}
                       className="p-3 rounded-full bg-zinc-800/50 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 transition-colors border border-white/5"
                    >
                       <IconPaperclip className="w-5 h-5" />
                    </button>
                    <div className="flex-1 bg-zinc-800/50 rounded-2xl border border-zinc-700/50 focus-within:border-indigo-500/50 focus-within:bg-zinc-800 transition-all flex items-center shadow-inner">
                       <input 
                          type="text" 
                          value={newMessage}
                          onChange={(e) => handleMessageInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (pendingFile ? handleSendAttachment() : handleSendMessage())}
                          className="flex-1 bg-transparent border-none outline-none text-zinc-200 placeholder-zinc-500 px-4 py-3"
                          placeholder={pendingFile ? 'Add a caption...' : 'Type a message...'}
                          autoFocus
                       />
                    </div>
                    <button 
                       onClick={pendingFile ? handleSendAttachment : handleSendMessage}
                       disabled={uploading || (!pendingFile && !newMessage.trim())}
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