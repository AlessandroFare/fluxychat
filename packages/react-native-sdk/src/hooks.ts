import { useState, useEffect, useCallback, useRef } from 'react';
import { FluxyChatClient } from './client';
import { Message, Room, ConnectionStatus, SendMessageOptions } from './types';

export interface UseChatOptions {
  roomId: string;
  autoConnect?: boolean;
  loadMessages?: boolean;
}

export interface UseChatReturn {
  messages: Message[];
  loading: boolean;
  error: string | null;
  connectionStatus: ConnectionStatus;
  sendMessage: (options: SendMessageOptions) => Promise<Message>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

export function useChat(client: FluxyChatClient, options: UseChatOptions): UseChatReturn {
  const { roomId, autoConnect = true, loadMessages = true } = options;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [hasMore, setHasMore] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!autoConnect) return;

    client.connect(roomId);

    const unsubStatus = client.onConnectionChange((status) => {
      if (mountedRef.current) setConnectionStatus(status);
    });

    const unsubMessage = client.onMessage((event) => {
      if (event.roomId === roomId && mountedRef.current) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === event.data.id);
          if (exists) return prev;
          return [...prev, event.data as Message];
        });
      }
    });

    return () => {
      unsubStatus();
      unsubMessage();
      client.disconnect();
    };
  }, [client, roomId, autoConnect]);

  useEffect(() => {
    if (!loadMessages) return;

    setLoading(true);
    client
      .loadMessages(roomId, { limit: 50 })
      .then((msgs) => {
        if (mountedRef.current) {
          setMessages(msgs);
          setHasMore(msgs.length === 50);
        }
      })
      .catch((err) => {
        if (mountedRef.current) setError(err.message);
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
  }, [client, roomId, loadMessages]);

  const sendMessage = useCallback(
    async (options: SendMessageOptions): Promise<Message> => {
      const msg = await client.sendMessage(roomId, options);
      return msg;
    },
    [client, roomId]
  );

  const loadMore = useCallback(async () => {
    if (messages.length === 0) return;
    const oldest = messages[0];
    const more = await client.loadMessages(roomId, { limit: 50, before: oldest.createdAt });
    setHasMore(more.length === 50);
  }, [client, roomId, messages]);

  return { messages, loading, error, connectionStatus, sendMessage, loadMore, hasMore };
}

export interface UseRoomsReturn {
  rooms: Room[];
  loading: boolean;
  error: string | null;
  createRoom: (name: string, type?: Room['type']) => Promise<Room>;
  refresh: () => Promise<void>;
}

export function useRooms(client: FluxyChatClient): UseRoomsReturn {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await client.listRooms();
      if (mountedRef.current) setRooms(list);
    } catch (err: unknown) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Failed to load rooms');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    mountedRef.current = true;
    fetchRooms();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchRooms]);

  const createRoom = useCallback(
    async (name: string, type?: Room['type']): Promise<Room> => {
      const room = await client.createRoom(name, type);
      setRooms((prev) => [room, ...prev]);
      return room;
    },
    [client]
  );

  return { rooms, loading, error, createRoom, refresh: fetchRooms };
}

export interface UseTypingOptions {
  roomId: string;
  timeout?: number;
}

export function useTyping(client: FluxyChatClient, options: UseTypingOptions) {
  const { roomId, timeout = 3000 } = options;
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = client.onTyping((event) => {
      if (event.roomId !== roomId) return;
      setTypingUsers((prev) => {
        if (event.typing) {
          return prev.includes(event.userId) ? prev : [...prev, event.userId];
        }
        return prev.filter((id) => id !== event.userId);
      });
    });
    return unsub;
  }, [client, roomId]);

  const startTyping = useCallback(() => {
    client.sendTyping(roomId, true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      client.sendTyping(roomId, false);
    }, timeout);
  }, [client, roomId, timeout]);

  const stopTyping = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    client.sendTyping(roomId, false);
  }, [client, roomId]);

  return { typingUsers, startTyping, stopTyping };
}
