import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['ORDER', 'WALLET', 'PARTNER', 'SYSTEM'], required: true },
    isRead: { type: Boolean, default: false },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    createdAt: { type: Date, default: Date.now }
  });

const Notification = mongoose.model("Notification",NotificationSchema)

export default Notification