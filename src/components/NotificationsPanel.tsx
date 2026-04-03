import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bell, Check, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../supabase';
import { cn } from '../utils';

interface Notification {
  id: string;
  message: string;
  created_at: string;
  read_at: string | null;
  channel: 'in_app' | 'email' | 'push' | 'sms';
}

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export default function NotificationsPanel({
  isOpen,
  onClose,
  notifications,
  onMarkRead,
  onMarkAllRead
}: NotificationsPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-[70] flex flex-col"
          >
            <div className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-xl">
                  <Bell className="w-5 h-5 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold">Notifications</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onMarkAllRead}
                  className="text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors px-3 py-1 rounded-lg hover:bg-emerald-50"
                >
                  Mark all read
                </button>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                    <Bell className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-gray-500 font-medium">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => !notification.read_at && onMarkRead(notification.id)}
                    className={cn(
                      "p-4 rounded-2xl border transition-all cursor-pointer relative group",
                      notification.read_at 
                        ? "bg-white border-gray-100 opacity-60" 
                        : "bg-emerald-50/30 border-emerald-100 shadow-sm hover:shadow-md"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        notification.channel === 'in_app' ? "bg-blue-100 text-blue-600" :
                        notification.channel === 'email' ? "bg-purple-100 text-purple-600" :
                        notification.channel === 'push' ? "bg-orange-100 text-orange-600" :
                        "bg-gray-100 text-gray-600"
                      )}>
                        {notification.channel}
                      </span>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                        <Clock className="w-3 h-3" />
                        {format(new Date(notification.created_at), 'MMM d, h:mm a')}
                      </div>
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed pr-6">
                      {notification.message}
                    </p>
                    {!notification.read_at && (
                      <div className="absolute top-4 right-4 w-2 h-2 bg-emerald-500 rounded-full" />
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
