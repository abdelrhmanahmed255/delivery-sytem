import { useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { driversApi } from '../../api/drivers';

export const DriverChat = () => {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Ensure thread exists then fetch messages
  const { data: thread } = useQuery({
    queryKey: ['my-chat-thread'],
    queryFn: () => driversApi.getMyChatThread(),
    staleTime: Infinity,
  });

  const { data: messages, refetch, isFetching } = useQuery({
    queryKey: ['my-chat-messages'],
    queryFn: () => driversApi.getMyChatMessages(),
    enabled: !!thread,
    refetchInterval: 8_000,
  });

  const sendMutation = useMutation({
    mutationFn: () => driversApi.sendMyChatMessage(message),
    onSuccess: () => { setMessage(''); refetch(); },
  });

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const msgList: any[] = messages ?? [];

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center justify-between">
        <div>
          <h2 className="font-black text-gray-900">💬 محادثة مع الإدارة</h2>
          <p className="text-xs text-gray-500">يمكنك التواصل مع المشرف هنا</p>
        </div>
        {isFetching && <span className="text-xs text-gray-400 animate-pulse">جارٍ التحديث...</span>}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {!thread && (
          <p className="text-center text-gray-400 text-sm py-8">جارٍ تحميل المحادثة...</p>
        )}
        {thread && msgList.length === 0 && (
          <div className="text-center py-12">
            <p className="text-3xl mb-2">💬</p>
            <p className="text-gray-500 text-sm">لا توجد رسائل بعد.</p>
            <p className="text-gray-400 text-xs mt-1">ابدأ المحادثة مع الإدارة.</p>
          </div>
        )}
        {msgList.map((msg: any) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender_type === 'driver' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                msg.sender_type === 'driver'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
              }`}
            >
              {msg.sender_type === 'admin' && (
                <p className="text-[10px] font-bold text-gray-400 mb-0.5">الإدارة</p>
              )}
              <p>{msg.body}</p>
              <p className={`text-[10px] mt-0.5 ${msg.sender_type === 'driver' ? 'text-blue-200' : 'text-gray-400'}`}>
                {new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-100 px-4 py-3">
        <form
          className="flex gap-2"
          onSubmit={e => { e.preventDefault(); if (message.trim()) sendMutation.mutate(); }}
        >
          <input
            type="text"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="اكتب رسالتك للإدارة..."
            disabled={!thread}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
          />
          <button
            type="submit"
            disabled={!message.trim() || sendMutation.isPending || !thread}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold px-5 py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {sendMutation.isPending ? '...' : '↑'}
          </button>
        </form>
      </div>
    </div>
  );
};
