import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Notification from '../models/notification.model';

// Define types for request parameters
interface GetNotificationsQuery {
  page?: string;
  limit?: string;
  type?: string;
  isRead?: string;
  priority?: string;
  actionRequired?: string;
}

interface UpdateNotificationParams {
  id: string;
}

interface AuthenticatedRequest extends Request {
    user: {
      _id: mongoose.Types.ObjectId;
      role: string;
    };
  }

// Define the controller class
class NotificationController {
  // Get notifications with filtering, pagination and sorting
  async getNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        page = '1',
        limit = '10',
        type,
        isRead,
        priority,
        actionRequired
      } = req.query as unknown as GetNotificationsQuery;
      const userId = req.user._id
      if (!userId) {
        res.status(400).json({ success: false, message: 'userId is required' });
        return;
      }

      // Build the filter object
      const filter: Record<string, any> = { userId: new mongoose.Types.ObjectId(userId) };
      
      if (type) {
        filter.type = type.toUpperCase();
      }
      
      if (isRead !== undefined) {
        filter.isRead = isRead === 'true';
      }
      
      if (priority) {
        filter.priority = priority.toLowerCase();
      }
      
      if (actionRequired !== undefined) {
        filter.actionRequired = actionRequired === 'true';
      }

      // Parse pagination parameters
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;

      // Execute the query with pagination
      const notifications = await Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

      // Get total count for pagination
      const totalCount = await Notification.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: {
          notifications,
          pagination: {
            total: totalCount,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(totalCount / limitNum)
          }
        }
      });
    } catch (error) {
      console.error('Error getting notifications:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Create a new notification
  async createNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { title, message, type, referenceId, priority, actionRequired } = req.body;
      const userId = req.user._id

      if (!userId || !title || !message || !type) {
        res.status(400).json({ success: false, message: 'Missing required fields' });
        return;
      }

      const notification = new Notification({
        userId: new mongoose.Types.ObjectId(userId),
        title,
        message,
        type: type.toUpperCase(),
        referenceId: referenceId ? new mongoose.Types.ObjectId(referenceId) : undefined,
        priority: priority || 'low',
        actionRequired: actionRequired || false,
        isRead: false,
        createdAt: new Date()
      });

      await notification.save();
      res.status(201).json({ success: true, data: notification });
    } catch (error) {
      console.error('Error creating notification:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Mark a notification as read
  async markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params as unknown as UpdateNotificationParams;

      const notification = await Notification.findByIdAndUpdate(
        id,
        { isRead: true },
        { new: true }
      );

      if (!notification) {
        res.status(404).json({ success: false, message: 'Notification not found' });
        return;
      }

      res.status(200).json({ success: true, data: notification });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Mark all notifications as read for a specific user
  async markAllAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user._id;

      if (!userId) {
        res.status(400).json({ success: false, message: 'userId is required' });
        return;
      }

      const result = await Notification.updateMany(
        { userId: new mongoose.Types.ObjectId(userId), isRead: false },
        { isRead: true }
      );

      res.status(200).json({
        success: true,
        data: { updatedCount: result.modifiedCount }
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Delete a notification
  async deleteNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params as unknown as UpdateNotificationParams;

      const notification = await Notification.findByIdAndDelete(id);

      if (!notification) {
        res.status(404).json({ success: false, message: 'Notification not found' });
        return;
      }

      res.status(200).json({ success: true, message: 'Notification deleted successfully' });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Get notification statistics for a user
  async getNotificationStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user._id;

      if (!userId) {
        res.status(400).json({ success: false, message: 'userId is required' });
        return;
      }

      const userIdObj = new mongoose.Types.ObjectId(userId);

      // Run aggregation for all the stats we need
      const [totalCount, unreadCount, highPriorityCount, actionRequiredCount] = await Promise.all([
        Notification.countDocuments({ userId: userIdObj }),
        Notification.countDocuments({ userId: userIdObj, isRead: false }),
        Notification.countDocuments({ userId: userIdObj, priority: 'high' }),
        Notification.countDocuments({ userId: userIdObj, actionRequired: true })
      ]);

      // Get count by type
      const typeStats = await Notification.aggregate([
        { $match: { userId: userIdObj } },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]);

      // Format type stats into an object
      const typeCountsObj = typeStats.reduce((acc: Record<string, number>, curr) => {
        acc[curr._id.toLowerCase()] = curr.count;
        return acc;
      }, {});

      res.status(200).json({
        success: true,
        data: {
          total: totalCount,
          unread: unreadCount,
          highPriority: highPriorityCount,
          actionRequired: actionRequiredCount,
          typeCounts: typeCountsObj
        }
      });
    } catch (error) {
      console.error('Error getting notification stats:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
}

export default new NotificationController();