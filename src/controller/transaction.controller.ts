import { Request, Response } from 'express';
import Transaction from '../models/transaction.model';
import mongoose from 'mongoose';

// Define the authenticated request interface
interface AuthenticatedRequest extends Request {
  user: {
    _id: mongoose.Types.ObjectId;
  };
}

// Define the transaction model with paginate method
interface TransactionModel extends mongoose.Model<any> {
  paginate: (query: any, options: any) => Promise<{
    docs: any[];
    totalDocs: number;
    page: number;
    totalPages: number;
    limit: number;
  }>;
}

interface TransactionQueryParams {
  page?: string;
  limit?: string;
  type?: 'ADD_MONEY' | 'TRANSFER' | 'WITHDRAW' | 'PAYMENT' | 'REFUND';
  startDate?: string;
  endDate?: string;
  status?: 'PENDING' | 'COMPLETED' | 'FAILED';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

const getTransactions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user._id;
  const { 
    page = '1', 
    limit = '10', 
    type, 
    startDate, 
    endDate, 
    status,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query as TransactionQueryParams;
  
  try {
    const query: any = {
      $or: [{ fromUserId: userId }, { toUserId: userId }]
    };

    if (type) {
      query.type = type;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (startDate || endDate) {
      query.createdAt = {} as { $gte?: Date; $lte?: Date };
      
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const sort: { [key: string]: 1 | -1 } = {};
    sort[sortBy || 'createdAt'] = sortOrder === 'asc' ? 1 : -1;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: [
        { path: 'fromUserId', select: 'fullName email' },
        { path: 'toUserId', select: 'fullName email' },
        { path: 'orderId' }
      ]
    };

    // Cast Transaction to TransactionModel to use paginate method
    const transactions = await (Transaction as unknown as TransactionModel).paginate(query, options);

    res.status(200).json({
      success: true,
      data: {
        transactions: transactions.docs,
        pagination: {
          total: transactions.totalDocs,
          page: transactions.page,
          pages: transactions.totalPages,
          limit: transactions.limit
        }
      }
    });
  } catch (error) {
    console.error('Get Transactions Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getTransactionDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user._id;
  const { transactionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(transactionId)) {
    res.status(400).json({ success: false, message: 'Invalid transaction ID' });
    return;
  }

  try {
    const transaction = await Transaction.findById(transactionId)
      .populate('fromUserId', 'fullName email')
      .populate('toUserId', 'fullName email')
      .populate('orderId');

    if (!transaction) {
      res.status(404).json({ success: false, message: 'Transaction not found' });
      return;
    }

    // Type assertion to handle populated models
    interface PopulatedUser {
      _id: mongoose.Types.ObjectId;
      fullName: string;
      email: string;
    }

    const fromUser = transaction.fromUserId as unknown as PopulatedUser;
    const toUser = transaction.toUserId as unknown as PopulatedUser;

    const isFromUser = fromUser && fromUser._id.toString() === userId.toString();
    const isToUser = toUser && toUser._id.toString() === userId.toString();

    if (!isFromUser && !isToUser) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error('Get Transaction Details Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

interface PeriodQuery {
  period?: 'week' | 'month' | 'year';
}

const getTransactionSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  console.log("vfsdfd")
  const userId = req.user._id;
  const { period = 'month' } = req.query as PeriodQuery;
  console.log(userId)
  try {
    const endDate = new Date();
    const startDate = new Date();
    
    switch(period) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(endDate.getMonth() - 1); 
    }

    const moneyReceived = await Transaction.aggregate([
      {
        $match: {
          toUserId: userId,
          status: 'COMPLETED',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const moneySent = await Transaction.aggregate([
      {
        $match: {
          fromUserId: userId,
          status: 'COMPLETED',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);
    console.log(moneySent)
    const totalReceived = moneyReceived.reduce((sum, item) => sum + item.total, 0);
    const totalSent = moneySent.reduce((sum, item) => sum + item.total, 0);

    res.status(200).json({
      success: true,
      data: {
        period,
        dateRange: {
          start: startDate,
          end: endDate
        },
        received: {
          total: totalReceived,
          breakdown: moneyReceived
        },
        sent: {
          total: totalSent,
          breakdown: moneySent
        },
        netFlow: totalReceived - totalSent
      }
    });
  } catch (error) {
    console.error('Get Transaction Summary Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

interface ExportTransactionQuery {
  format?: 'json' | 'csv';
  startDate?: string;
  endDate?: string;
  type?: 'ADD_MONEY' | 'TRANSFER' | 'WITHDRAW' | 'PAYMENT' | 'REFUND';
}

const exportTransactions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user._id;
  const { format = 'json', startDate, endDate, type } = req.query as ExportTransactionQuery;
  
  try {
    const query: any = {
      $or: [{ fromUserId: userId }, { toUserId: userId }]
    };
    
    if (type) {
      query.type = type;
    }
    
    if (startDate || endDate) {
      query.createdAt = {} as { $gte?: Date; $lte?: Date };
      
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    interface PopulatedTransaction {
      _id: mongoose.Types.ObjectId;
      createdAt: Date;
      type: string;
      status: string;
      amount: number;
      fromUserId: {
        fullName: string;
        email: string;
      } | null;
      toUserId: {
        fullName: string;
        email: string;
      } | null;
      description?: string;
    }
    
    const transactions = await Transaction.find(query)
      .populate('fromUserId', 'fullName email')
      .populate('toUserId', 'fullName email')
      .sort({ createdAt: -1 })
      .lean() as PopulatedTransaction[];
    
    const formattedTransactions = transactions.map(transaction => ({
      id: transaction._id.toString(),
      date: transaction.createdAt.toISOString().split('T')[0],
      time: transaction.createdAt.toISOString().split('T')[1].substring(0, 8),
      type: transaction.type,
      status: transaction.status,
      amount: transaction.amount,
      from: transaction.fromUserId ? transaction.fromUserId.fullName : 'N/A',
      to: transaction.toUserId ? transaction.toUserId.fullName : 'N/A',
      description: transaction.description || 'N/A'
    }));
    
    if (format === 'csv') {
      res.status(200).json({
        success: true,
        data: 'CSV generation would happen here',
        message: 'CSV export feature not fully implemented'
      });
    } else {
      res.status(200).json({
        success: true,
        data: formattedTransactions
      });
    }
  } catch (error) {
    console.error('Export Transactions Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const TransactionController = {
  getTransactionDetails,
  getTransactions,
  getTransactionSummary,
  exportTransactions
};

export default TransactionController;