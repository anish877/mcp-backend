import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema({
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Sender
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Receiver
    amount: { type: Number, required: true },
    type: { type: String, enum: ['ADD_MONEY', 'TRANSFER', 'WITHDRAW', 'PAYMENT', 'REFUND'], required: true },
    status: { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' }, // Related order if applicable
    description: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  });

const Transaction = mongoose.model("Transaction",TransactionSchema)

export default Transaction