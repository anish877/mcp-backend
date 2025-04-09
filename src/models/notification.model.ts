import mongoose from 'mongoose';

// Define the shape of the Notification document
export interface INotification extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: 'ORDER' | 'WALLET' | 'PARTNER' | 'SYSTEM';
  priority: 'low' | 'medium' | 'high';
  isRead: boolean;
  actionRequired?: boolean;
  referenceId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

// Create the schema
const NotificationSchema = new mongoose.Schema<INotification>({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  title: { 
    type: String, 
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['ORDER', 'WALLET', 'PARTNER', 'SYSTEM'], 
    required: true,
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low',
    index: true
  },
  isRead: { 
    type: Boolean, 
    default: false,
    index: true
  },
  actionRequired: {
    type: Boolean,
    default: false,
    index: true
  },
  referenceId: { 
    type: mongoose.Schema.Types.ObjectId 
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  }
});

// Create and export the model
const Notification = mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;