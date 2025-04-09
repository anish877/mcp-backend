import { Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import Transaction from '../models/transaction.model';
import User from '../models/user.model';
import Notification from '../models/notification.model';
import mongoose from 'mongoose';

interface UserRequest extends Request {
  user: {
    _id: mongoose.Types.ObjectId | string;
    role?: string;
    email?: string;
    fullName?: string;
    phone?: string;
  };
}

const razorpay = new Razorpay({
  key_id: 'rzp_test_0OBBqbtEyBk5DZ',
  key_secret: '1oM2BJr5tnjbC4mK4EBwroVt'
});

const createOrder = async (req: UserRequest, res: Response): Promise<void> => {
  try {
    const { amount,partnerId } = req.body;
    const userId = partnerId || req.user._id;
    
    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, message: 'Invalid amount' });
      return;
    }
    
    // Get user details for the order
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    
    // Amount should be in paise (multiply by 100)
    const amountInPaise = amount * 100;
    
    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `${userId}`,
      notes: {
        userId: userId.toString(),
        purpose: 'wallet_add'
      }
    };
    
    const order = await razorpay.orders.create(options);
    
    // Create a pending transaction in your database
    const transaction = await Transaction.create({
      toUserId: userId,
      amount,
      type: 'ADD_MONEY',
      status: 'PENDING',
      description: 'Adding money to wallet via Razorpay',
      paymentDetails: {
        orderId: order.id,
        provider: 'RAZORPAY'
      }
    });
    
    res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        amount: amountInPaise,
        currency: 'INR',
        transactionId: transaction._id,
        key: 'rzp_test_0OBBqbtEyBk5DZ',
        user: {
          name: user.fullName || 'User',
          email: user.email || '',
          contact: user.phone || ''
        }
      }
    });
  } catch (error) {
    console.error('Create Razorpay Order Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const verifyPayment = async (req: UserRequest, res: Response): Promise<void> => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, transactionId, partnerId} = req.body;
  const userId = partnerId || req.user._id;
  console.log(req.body)
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !transactionId) {
    res.status(400).json({ success: false, message: 'Missing payment verification parameters' });
    return;
  }
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Verify the payment signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '1oM2BJr5tnjbC4mK4EBwroVt')
      .update(body)
      .digest('hex');
    
    const isValid = expectedSignature === razorpay_signature;
    
    if (!isValid) {
      await session.abortTransaction();
      res.status(400).json({ success: false, message: 'Invalid payment signature' });
      return;
    }
    
    // Find the transaction
    const transaction = await Transaction.findById(transactionId).session(session);
    //@ts-ignore
    if (!transaction || transaction.toUserId.toString() !== userId.toString()) {
      await session.abortTransaction();
      res.status(404).json({ success: false, message: 'Transaction not found' });
      return;
    }
    
    if (transaction.status === 'COMPLETED') {
      await session.abortTransaction();
      res.status(200).json({ success: true, message: 'Payment already processed' });
      return;
    }
    
    // Update transaction status
    transaction.status = 'COMPLETED';
    //@ts-ignore
    transaction.paymentDetails = {
        //@ts-ignore
      ...transaction.paymentDetails,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    };
    await transaction.save({ session });
    
    // Update user wallet balance
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { wallet: transaction.amount } },
      { new: true, session }
    );
    console.log(user)
    if (!user) {
      await session.abortTransaction();
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    
    // Create notification
    await Notification.create([{
      userId,
      title: 'Money Added',
      message: `₹${transaction.amount} has been added to your wallet.`,
      type: 'WALLET',
      referenceId: transaction._id
    }], { session });
    
    await session.commitTransaction();
    
    res.status(200).json({
      success: true,
      data: {
        newBalance: user.wallet,
        transaction
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Verify Payment Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    session.endSession();
  }
};

// Export methods
const RazorpayController = {
  createOrder,
  verifyPayment
};

export default RazorpayController;