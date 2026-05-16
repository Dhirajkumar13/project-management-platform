import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { env } from '@/config/env'

interface TokenPayload {
  userId: string
}

export const generateAccessToken = (payload: TokenPayload): string =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions)

export const generateRefreshToken = (payload: TokenPayload): string =>
  jwt.sign({ ...payload, jti: uuidv4() }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions)

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload
}

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload
}
