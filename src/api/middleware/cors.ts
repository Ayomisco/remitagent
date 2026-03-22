import cors from 'cors'

export const corsMiddleware = cors({
  origin: process.env.NODE_ENV === 'production' ? false : '*',
  methods: ['GET', 'POST'],
})
