'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters').optional().or(z.literal('')),
})
type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      const payload = { ...data, organizationName: data.organizationName || undefined }
      const res = await api.post('/auth/register', payload)
      setAuth(res.data.data.user, res.data.data.accessToken)
      toast.success('Account created!')
      router.push('/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Registration failed'
      toast.error(msg)
    }
  }

  return (
    <>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Create account</h2>
      <p className="text-gray-500 text-sm mb-6">
        Already have an account?{' '}
        <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">Sign in</Link>
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {[
          { name: 'name' as const, label: 'Full name', type: 'text', placeholder: 'John Doe' },
          { name: 'email' as const, label: 'Email', type: 'email', placeholder: 'you@company.com' },
          { name: 'password' as const, label: 'Password', type: 'password', placeholder: '••••••••' },
          { name: 'organizationName' as const, label: 'Organization name (optional)', type: 'text', placeholder: 'Acme Corp' },
        ].map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
            <input
              {...register(field.name)}
              type={field.type}
              placeholder={field.placeholder}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
            {errors[field.name] && <p className="text-red-500 text-xs mt-1">{errors[field.name]?.message}</p>}
          </div>
        ))}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm"
        >
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </>
  )
}
