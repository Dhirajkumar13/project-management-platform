'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

const INPUT_BASE =
  'w-full px-3 py-2.5 border rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
const INPUT_NORMAL = `${INPUT_BASE} border-gray-300 text-gray-900 placeholder-gray-400`
const INPUT_ERROR  = `${INPUT_BASE} border-red-400 text-gray-900 placeholder-gray-400 bg-red-50`

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [showPassword, setShowPassword] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: 'admin@demo.com', password: 'password123' },
  })

  const onSubmit = async (data: FormData) => {
    setApiError(null)
    try {
      const res = await api.post('/auth/login', data)
      setAuth(res.data.data.user, res.data.data.accessToken)
      router.push('/dashboard')
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message

      if (status === 401) {
        setApiError('Incorrect email or password. Please try again.')
      } else if (status === 404) {
        setApiError('No account found with that email address.')
      } else {
        setApiError(msg ?? 'Something went wrong. Please try again.')
      }
    }
  }

  return (
    <>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Sign in</h2>
      <p className="text-gray-500 text-sm mb-6">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-blue-600 hover:underline font-medium">
          Sign up
        </Link>
      </p>

      {/* API error banner */}
      {apiError && (
        <div className="flex items-start gap-2.5 mb-4 px-3.5 py-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{apiError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
            Email
          </label>
          <input
            id="email"
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            className={errors.email ? INPUT_ERROR : INPUT_NORMAL}
          />
          {errors.email && (
            <p className="flex items-center gap-1 text-red-600 text-xs mt-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              className={`${errors.password ? INPUT_ERROR : INPUT_NORMAL} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="flex items-center gap-1 text-red-600 text-xs mt-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {errors.password.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-zinc-900 text-white py-2.5 rounded-lg font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm mt-2"
        >
          {isSubmitting ? (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : null}
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-6 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 border border-gray-100">
        <p className="font-medium text-gray-700 mb-1">Demo credentials</p>
        <p>admin@demo.com / password123</p>
        <p>member@demo.com / password123</p>
      </div>
    </>
  )
}
