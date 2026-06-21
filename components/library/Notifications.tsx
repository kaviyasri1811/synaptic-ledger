import React, { useState, useEffect } from 'react';
import { Bell, Check, Loader2 } from 'lucide-react';
import { Notification, User } from '../../types';
import { firestoreService } from '../../src/services/firestoreService';
import { where, orderBy, QueryConstraint } from 'firebase/firestore';

interface NotificationsProps {
  user: User;
}

const Notifications: React.FC<NotificationsProps> = ({ user }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (user.role === 'hod') {
        const unsubscribe = firestoreService.subscribeToCollection<Notification>('notifications', [orderBy('date', 'desc')], async (data) => {
           const deptUsers = await firestoreService.getCollection<User>('users', [where('departmentId', '==', user.departmentId || '')]);
           const deptUserIds = deptUsers.map(u => u.uid);
           
           const filtered = data.filter(n => n.userId === user.uid || (n.type === 'fine' && deptUserIds.includes(n.userId)));
           setNotifications(filtered);
           setLoading(false);
        });
        return unsubscribe;
      } else {
        const constraints: QueryConstraint[] = [
          where('userId', '==', user.uid),
          orderBy('date', 'desc')
        ];
        const unsubscribe = firestoreService.subscribeToCollection<Notification>('notifications', constraints, (data) => {
          setNotifications(data);
          setLoading(false);
        });
        return unsubscribe;
      }
    };

    let unsub: any;
    fetchNotifications().then(u => unsub = u);
    return () => {
      if (unsub) unsub();
    };
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await firestoreService.updateDoc('notifications', id, { read: true });
    } catch (error) {
      console.error('Failed to mark notification as read', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Notifications</h2>
          <p className="text-slate-500">Stay updated with library alerts and messages.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {notifications.map(notification => (
              <div 
                key={notification.id} 
                className={`p-6 flex gap-4 transition-colors ${
                  notification.read ? 'bg-transparent' : 'bg-emerald-50/50 dark:bg-emerald-900/10'
                }`}
              >
                <div className={`mt-1 p-2 rounded-full h-fit ${
                  notification.type === 'fine' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' :
                  notification.type === 'due_reminder' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' :
                  'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
                }`}>
                  <Bell className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className={`text-base font-semibold ${notification.read ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white'}`}>
                        {notification.title}
                      </h4>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-slate-400 mt-2">
                        {new Date(notification.date).toLocaleString()}
                      </p>
                    </div>
                    {!notification.read && (
                      <button 
                        onClick={() => markAsRead(notification.id)}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {notifications.length === 0 && (
              <div className="p-12 text-center text-slate-500">
                You have no notifications.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
