import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Bell,
  BellDot,
  Check,
  CheckCheck,
  Clock,
  Mail,
  MailOpen,
  Trash2,
  AlertCircle,
  Info,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export function NotificationInbox() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Subscribe to real-time notifications
      const channel = supabase
        .channel('notifications-channel')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotification = payload.new as Notification;
            setNotifications(prev => [newNotification, ...prev]);
            toast.info(newNotification.title);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false) // Only fetch unread notifications
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsReadAndDelete = async (notificationId: string) => {
    try {
      // Delete the notification from the database
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      // Remove from local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const markAllAsReadAndDelete = async () => {
    if (!user) return;

    try {
      // Delete all unread notifications for this user
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications([]);
      toast.success('All notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error);
      toast.error('Failed to clear notifications');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'session_reminder':
        return <Calendar className="w-4 h-4 text-blue-500" />;
      case 'attendance_confirmation':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'session_cancelled':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const unreadCount = notifications.length;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="ghost" className="relative">
          {unreadCount > 0 ? (
            <>
              <BellDot className="w-4 h-4" />
              <Badge 
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                variant="destructive"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            </>
          ) : (
            <Bell className="w-4 h-4" />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
              {unreadCount > 0 && (
                <Badge variant="secondary">{unreadCount} new</Badge>
              )}
            </SheetTitle>
            {unreadCount > 0 && (
              <Button size="sm" variant="ghost" onClick={markAllAsReadAndDelete}>
                <Trash2 className="w-4 h-4 mr-1" />
                Clear All
              </Button>
            )}
          </div>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Clock className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No notifications</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-4 rounded-lg border bg-primary/5 border-primary/20 hover:bg-primary/10 cursor-pointer transition-colors"
                  onClick={() => markAsReadAndDelete(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getTypeIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-foreground font-medium truncate">
                          {notification.title}
                        </p>
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(notification.created_at), 'MMM d, yyyy • h:mm a')}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsReadAndDelete(notification.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
