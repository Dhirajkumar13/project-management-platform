'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import toast from 'react-hot-toast'
import api from '@/lib/api'

const schema = z.object({ email: z.string().email('Invalid email') })
type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      await api.post('/auth/forgot-password', data)
      setSent(true)
      toast.success('Reset link sent!')
    } catch {
      toast.error('Something went wrong')
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
        <p className="text-gray-500 text-sm mb-4">If that email exists, we&apos;ve sent a reset link.</p>
        <Link href="/login" className="text-zinc-900 hover:underline text-sm font-medium">Back to login</Link>
      </div>
    )
  }

  return (
    <>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Reset password</h2>
      <p className="text-gray-500 text-sm mb-6">
        <Link href="/login" className="text-zinc-900 hover:underline font-medium">← Back to login</Link>
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input {...register('email')} type="email" placeholder="you@company.com"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-400" />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <button type="submit" disabled={isSubmitting}
          className="w-full bg-zinc-900 text-white py-2.5 rounded-lg font-medium hover:bg-zinc-800 disabled:opacity-50 text-sm">
          {isSubmitting ? 'Sending...' : 'Send reset link'}
        </button>
      </form>
    </>
  )
}
