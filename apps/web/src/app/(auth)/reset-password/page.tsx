'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { Suspense } from 'react'

const schema = z.object({
  password: z.string().min(8, 'Must be at least 8 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })
type FormData = z.infer<typeof schema>

function ResetForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post('/auth/reset-password', { token, password: data.password }),
    onSuccess: () => {
      toast.success('Password reset! Please log in.')
      router.push('/login')
    },
    onError: () => toast.error('Reset link is invalid or expired'),
  })

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-red-600 mb-4">Invalid reset link.</p>
        <Link href="/forgot-password" className="text-zinc-900 hover:underline">Request a new one</Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
        <input {...register('password')} type="password" placeholder="At least 8 characters"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400" />
        {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
        <input {...register('confirm')} type="password" placeholder="Repeat password"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400" />
        {errors.confirm && <p className="text-red-500 text-xs mt-1">{errors.confirm.message}</p>}
      </div>
      <Button type="submit" className="w-full" loading={isSubmitting || mutation.isPending}>
        Reset Password
      </Button>
      <p className="text-center text-sm text-gray-500">
        <Link href="/login" className="text-zinc-900 hover:underline">Back to login</Link>
      </p>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">P</div>
          <h1 className="text-xl font-bold text-gray-900">Set new password</h1>
          <p className="text-gray-500 text-sm mt-1">Choose a strong password</p>
        </div>
        <Suspense>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  )
}
