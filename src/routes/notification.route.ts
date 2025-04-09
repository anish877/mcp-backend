import express from 'express';
import NotificationController from '../controller/notification.controller';
import  authenticateUser  from '../middleware/auth.middleware'; // Assuming you have an auth middleware

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Get notifications with filtering and pagination
router.get('/', NotificationController.getNotifications);

// Get notification statistics
router.get('/stats/:userId', NotificationController.getNotificationStats);

// Create a new notification
router.post('/', NotificationController.createNotification);

// Mark a notification as read
router.patch('/:id/read', NotificationController.markAsRead);

// Mark all notifications as read for a user
router.patch('/read-all', NotificationController.markAllAsRead);

// Delete a notification
router.delete('/:id', NotificationController.deleteNotification);

export default router;