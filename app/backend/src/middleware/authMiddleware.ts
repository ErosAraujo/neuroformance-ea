import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';

export interface AuthRequest extends Request {
  user?: { id: number; profile: 'student' | 'teacher' | 'admin' };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Token não fornecido' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; profile: 'student' | 'teacher' | 'admin' };
    req.user = { id: decoded.id, profile: decoded.profile };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido' });
  }
};