import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import api from '../api/axios';
import { IconHome, IconSearch, IconNetwork, IconMessage, IconUser, IconLogout, IconBell, IconInfo } from '../components/Icons';
import { toHandle } from '../utils/handle';

const BACKEND_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api').replace(/\/api\/?$/, '');

type Notification = {
  id: string;
  type: 'connection_request' | 'unread_message';
  title: string;
  text: string;
};

type CurrentUser = {
  name: string;
  profilePicture?: string;
};

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [cookieAccepted, setCookieAccepted] = useState<boolean>(() => localStorage.getItem('cookieConsent') === 'accepted');
  const stompClient = useRef<Client | null>(null);

  const fetchNotifications = async () => {
    try {
      // Fetch pending connection requests
      const { data: pending } = await api.get('/connections/pending');
      
      // Fetch chat partners for unread messages
      const { data: chats } = await api.get('/chat/partners');
      const unreadChats = chats.filter((c: any) => c.unreadCount > 0);
      
      let notifs: Notification[] = [];
      
      // Resolve requester details for pretty notifications
      await Promise.all(pending.map(async (req: any) => {
        try {
          const { data: user } = await api.get(`/users/${req.id}`);
          notifs.push({
            id: req.connectionId,
            type: 'connection_request',
            title: 'New Connection Request',
            text: `${user.name} wants to connect with you.`
          });
        } catch(e) {
          console.error(e);
        }
      }));
      
      for (const chat of unreadChats) {
        notifs.push({
          id: `chat-${chat.id}`,
          type: 'unread_message',
          title: 'New Message',
          text: `You have ${chat.unreadCount} unread message(s) from ${chat.name}.`
        });
      }
      
      setNotifications(notifs);
      setUnreadCount(notifs.length);

    } catch (e) {
      console.error('Failed to load notifications', e);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const { data } = await api.get('/me');
      setCurrentUser(data);
    } catch (e) {
      console.error('Failed to load user', e);
    }
  };

  useEffect(() => {
    if (['/login', '/register'].includes(location.pathname)) return;
    fetchCurrentUser();
    fetchNotifications();
    
    // Connect WebSocket to listen to events
    const token = localStorage.getItem('token');
    const wsUrl = BACKEND_BASE_URL.replace(/^http/, 'ws') + '/ws';
    
    const client = new Client({
      brokerURL: wsUrl,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
         // Listen for incoming messages to trigger a notification refresh
         client.subscribe('/user/queue/messages', () => {
            fetchNotifications();
         });
         
         // Listen for connection requests to trigger a notification refresh
         client.subscribe('/user/queue/notifications', () => {
            fetchNotifications();
         });
      },
      onStompError: (err) => console.error('Layout WS Error:', err)
    });
    
    client.activate();
    stompClient.current = client;

    // We no longer poll here. STOMP replaces it.
    
    return () => {
       if (stompClient.current) {
          stompClient.current.deactivate();
       }
    };
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <IconHome className="w-5 h-5" /> },
    { path: '/matches', label: 'Discover', icon: <IconSearch className="w-5 h-5" /> },
    { path: '/connections', label: 'Network', icon: <IconNetwork className="w-5 h-5" /> },
    { path: '/chat', label: 'Comms', icon: <IconMessage className="w-5 h-5" /> },
    { path: '/setup-bio', label: 'Identity', icon: <IconUser className="w-5 h-5" /> },
    { path: '/settings', label: 'Settings', icon: <IconInfo className="w-5 h-5" /> },
  ];

  // Don't show layout on auth pages
  if (['/login', '/register'].includes(location.pathname)) {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-200 font-sans selection:bg-indigo-500/30">
      
      {/* Sidebar Navigation */}
      <aside className="hidden md:flex w-20 lg:w-64 flex-shrink-0 flex-col border-r border-white/5 bg-zinc-900/30 backdrop-blur-md z-50 transition-all duration-300">
        <div className="h-20 flex items-center justify-center lg:justify-start lg:px-8 border-b border-white/5">
          <div className="h-10 w-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold">
            M
          </div>
          <span className="ml-3 font-bold text-xl tracking-wide hidden lg:block bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            CodeMeet
          </span>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `nav-item group relative ${isActive ? 'active' : ''}`
              }
            >
              <span className="text-xl relative z-10 group-hover:scale-110 transition-transform duration-200">
                {item.icon}
              </span>
              <span className="hidden lg:block font-medium tracking-wide">
                {item.label}
              </span>
              {/* Hover Glow Effect */}
              <div className="absolute inset-0 bg-indigo-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center lg:justify-start gap-3 px-4 py-3 text-red-400/80 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200 group"
          >
            <span className="text-xl group-hover:rotate-180 transition-transform duration-500"><IconLogout className="w-5 h-5" /></span>
            <span className="hidden lg:block font-medium">Disconnect</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden pb-16 md:pb-0">
        {/* Top Header / Status Bar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-zinc-900/20 backdrop-blur-sm z-40">
           <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="uppercase tracking-wider">System Online</span>
           </div>
           
           <div className="flex items-center gap-4">
              <div className="relative">
                <button 
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="w-10 h-10 rounded-full bg-zinc-800/50 hover:bg-zinc-700/50 flex items-center justify-center text-zinc-400 transition-colors relative" 
                  title="Notifications"
                >
                   <IconBell className="w-5 h-5" />
                   {unreadCount > 0 && (
                     <span className="absolute top-1 right-1 w-4 h-4 bg-indigo-500 rounded-full border-2 border-zinc-900 text-[8px] font-bold text-white flex items-center justify-center">
                        {unreadCount}
                     </span>
                   )}
                </button>
                
                {isNotificationsOpen && (
                  <div className="absolute right-0 top-12 w-80 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-3 border-b border-white/5 flex justify-between items-center">
                      <h3 className="text-sm font-bold text-zinc-100">Notifications</h3>
                      <button className="text-xs text-indigo-400 hover:text-indigo-300" onClick={() => setIsNotificationsOpen(false)}>Close</button>
                    </div>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar p-2 space-y-2">
                       {notifications.length === 0 ? (
                         <div className="p-4 text-center text-xs text-zinc-500 italic">
                            No new notifications
                         </div>
                       ) : (
                         notifications.map(notif => (
                           <div key={notif.id} className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => {
                             setIsNotificationsOpen(false);
                             if (notif.type === 'connection_request') navigate('/connections');
                             if (notif.type === 'unread_message') navigate('/chat');
                           }}>
                              <p className="text-sm text-zinc-300 font-medium">{notif.title}</p>
                              <p className="text-xs text-zinc-500 mt-1">{notif.text}</p>
                           </div>
                         ))
                       )}
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-3 pl-1 pr-4 py-1 rounded-full bg-zinc-800/50 hover:bg-zinc-700/50 border border-white/5 transition-all group"
                title="Your Profile"
              >
                 <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform overflow-hidden">
                    {currentUser?.profilePicture ? (
                       <img src={`${BACKEND_BASE_URL}${currentUser.profilePicture}`} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                       <IconUser className="w-4 h-4" />
                    )}
                 </div>
                 <span className="text-sm font-medium text-zinc-300 hidden md:block group-hover:text-indigo-200 transition-colors">
                    {toHandle(currentUser?.name || 'my_profile')}
                 </span>
              </button>
           </div>
        </header>

          {/* Page Content */}
          <div className="flex-1 min-h-0 overflow-hidden p-4 lg:p-8 relative">
           {/* Background Grid Pattern */}
           <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
           </div>

            <div className="relative z-10 h-full min-h-0 overflow-y-auto">
              <Outlet />
           </div>

           <div className="absolute bottom-2 right-4 text-[10px] text-zinc-500/80 z-10 hidden md:flex items-center gap-2">
             <Link to="/privacy" className="hover:text-zinc-300 transition-colors">Privacy</Link>
             <span>•</span>
             <span>All rights reserved</span>
           </div>
        </div>

        <nav className="md:hidden absolute bottom-0 left-0 right-0 h-16 border-t border-white/5 bg-zinc-950/95 backdrop-blur-xl z-50 px-2 flex items-center justify-around">
          {navItems.slice(0, 5).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `flex flex-col items-center justify-center text-[10px] gap-1 px-2 py-1 rounded-lg ${isActive ? 'text-indigo-300 bg-indigo-500/10' : 'text-zinc-500'}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </main>

      {!cookieAccepted && (
        <div className="fixed bottom-20 md:bottom-4 right-4 left-4 md:left-auto md:w-[420px] bg-zinc-900/95 border border-white/10 rounded-xl shadow-2xl p-4 z-[60]">
          <p className="text-sm text-zinc-300 leading-relaxed">
            We use essential cookies for authentication and security. By continuing, you consent to these cookies.
            Read our <Link to="/privacy" className="text-indigo-300 hover:text-indigo-200">Privacy statement</Link>.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => navigate('/privacy')}
              className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-zinc-300 hover:bg-white/5"
            >
              Review
            </button>
            <button
              onClick={() => {
                localStorage.setItem('cookieConsent', 'accepted');
                setCookieAccepted(true);
              }}
              className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Accept
            </button>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default Layout;
