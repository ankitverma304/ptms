import React, { createContext, useContext, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    socketRef.current = io('/', { withCredentials: true });
    socketRef.current.emit('join_user', user.id);

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [user]);

  const joinProject  = (pid) => socketRef.current?.emit('join_project', pid);
  const leaveProject = (pid) => socketRef.current?.emit('leave_project', pid);
  const onEvent      = (event, cb) => { socketRef.current?.on(event, cb); return () => socketRef.current?.off(event, cb); };

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, joinProject, leaveProject, onEvent }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
