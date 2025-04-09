import { Request, Response } from 'express';
import User from '../models/user.model';
import Transaction from '../models/transaction.model';
import Notification from '../models/notification.model';
import mongoose from 'mongoose';
import PickupPartner from '../models/pickupPartner.model';

// Define a type for the user object attached to request
interface UserRequest extends Request {
  user: {
    _id: mongoose.Types.ObjectId | string;
    role?: string;
  };
}

interface AddMoneyRequest {
  amount: number;
}

interface TransferMoneyRequest {
  partnerId: string;
  amount: number;
  description?: string;
}

interface WithdrawMoneyRequest {
  amount: number;
  bankDetails: {
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
  };
}

const addMoney = async (req: UserRequest, res: Response): Promise<void> => {
  const { amount }: AddMoneyRequest = req.body;
  const userId = req.user._id;

  if (!amount || amount <= 0) {
    res.status(400).json({ success: false, message: 'Invalid amount' });
    return;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { wallet: amount } },
      { new: true, session }
    );

    if (!user) {
      await session.abortTransaction();
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const transaction = await Transaction.create(
      [{
        toUserId: userId,
        amount,
        type: 'ADD_MONEY',
        status: 'COMPLETED',
        description: 'Added money to wallet'
      }],
      { session }
    );

    await Notification.create(
      [{
        userId,
        title: 'Money Added',
        message: `₹${amount} has been added to your wallet.`,
        type: 'WALLET',
        referenceId: transaction[0]._id
      }],
      { session }
    );

    await session.commitTransaction();
    
    res.status(200).json({
      success: true,
      data: {
        newBalance: user.wallet,
        transaction: transaction[0]
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Add Money Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    session.endSession();
  }
};

const transferMoney = async (req: UserRequest, res: Response): Promise<void> => {
  const { partnerId, amount, description }: TransferMoneyRequest = req.body;
  const mcpId = req.user._id;

  if (!partnerId || !amount || amount <= 0) {
    res.status(400).json({ success: false, message: 'Invalid parameters' });
    return;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const mcp = await User.findById(mcpId).session(session);
    if (!mcp || mcp.role !== 'MCP') {
      await session.abortTransaction();
      res.status(403).json({ success: false, message: 'Only MCPs can transfer money to partners' });
      return;
    }

    if (mcp.wallet < amount) {
      await session.abortTransaction();
      res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
      return;
    }

    const partner = await User.findById(partnerId).session(session);
    if (!partner || partner.role !== 'PICKUP_PARTNER') {
      await session.abortTransaction();
      res.status(404).json({ success: false, message: 'Partner not found' });
      return;
    }


    const partnerRelation = await PickupPartner.findOne({
      mcpId,
      partnerId,
      status: 'ACTIVE'
    }).session(session);

    if (!partnerRelation) {
      await session.abortTransaction();
      res.status(403).json({ success: false, message: 'This partner is not associated with your account' });
      return;
    }

    // Update MCP wallet (decrease)
    await User.findByIdAndUpdate(
      mcpId,
      { $inc: { wallet: -amount } },
      { session }
    );

    // Update partner wallet (increase)
    await User.findByIdAndUpdate(
      partnerId,
      { $inc: { wallet: amount } },
      { session }
    );

    // Create transaction record
    const transaction = await Transaction.create(
      [{
        fromUserId: mcpId,
        toUserId: partnerId,
        amount,
        type: 'TRANSFER',
        status: 'COMPLETED',
        description: description || 'Transfer to pickup partner'
      }],
      { session }
    );

    // Create notifications for both users
    await Notification.create(
      [
        {
          userId: mcpId,
          title: 'Money Transferred',
          message: `₹${amount} has been transferred to ${partner.fullName}.`,
          type: 'WALLET',
          referenceId: transaction[0]._id
        },
        {
          userId: partnerId,
          title: 'Money Received',
          message: `₹${amount} has been received from ${mcp.fullName}.`,
          type: 'WALLET',
          referenceId: transaction[0]._id
        }
      ],
      { session, ordered:true }
    );

    await session.commitTransaction();
    
    res.status(200).json({
      success: true,
      data: {
        transaction: transaction[0]
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Transfer Money Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    session.endSession();
  }
};

const withdrawMoney = async (req: UserRequest, res: Response): Promise<void> => {
  const { amount, bankDetails }: WithdrawMoneyRequest = req.body;
  const userId = req.user._id;

  if (!amount || amount <= 0 || !bankDetails) {
    res.status(400).json({ success: false, message: 'Invalid parameters' });
    return;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);
    
    if (!user) {
      await session.abortTransaction();
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (user.wallet < amount) {
      await session.abortTransaction();
      res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
      return;
    }

    await User.findByIdAndUpdate(
      userId,
      { $inc: { wallet: -amount } },
      { session }
    );

    const transaction = await Transaction.create(
      [{
        fromUserId: userId,
        amount,
        type: 'WITHDRAW',
        status: 'PENDING',
        description: 'Withdrawal request to bank account'
      }],
      { session }
    );

    await Notification.create(
      [{
        userId,
        title: 'Withdrawal Request',
        message: `Your withdrawal request of ₹${amount} is being processed.`,
        type: 'WALLET',
        referenceId: transaction[0]._id
      }],
      { session }
    );

    await session.commitTransaction();
    
    res.status(200).json({
      success: true,
      data: {
        transaction: transaction[0],
        message: 'Withdrawal request submitted successfully'
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Withdraw Money Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    session.endSession();
  }
};

const getBalance = async (req: UserRequest, res: Response): Promise<void> => {
  const userId = req.user._id;

  try {
    const user = await User.findById(userId).select('wallet');
    
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        balance: user.wallet
      }
    });
  } catch (error) {
    console.error('Get Balance Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const WalletController = {
  addMoney,
  transferMoney,
  withdrawMoney,
  getBalance
};

export default WalletController;