'use client'
import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { Camera } from 'lucide-react'
import { SelectDropdown } from '@/components/ui/SelectDropdown'

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
  'Asia/Kolkata', 'Australia/Sydney',
]

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  timezone: z.string(),
  avatarUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z.string().min(8, 'At least 8 characters'),
  confirm: z.string(),
}).refine((d) => d.newPassword === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })

type ProfileForm = z.infer<typeof profileSchema>
type PasswordForm = z.infer<typeof passwordSchema>

const DEFAULT_PREFS = {
  task_assigned: { email: true, in_app: true },
  mentioned: { email: true, in_app: true },
  due_date_reminder: { email: true, in_app: true },
  invite_received: { email: true, in_app: true },
}

const PREF_LABELS: Record<string, string> = {
  task_assigned: 'Task assigned to me',
  mentioned: 'Mentioned in a comment',
  due_date_reminder: 'Due date reminder (24hr)',
  invite_received: 'Invitation received',
}

export default function ProfilePage() {
  const { user, setAuth } = useAuthStore()
  const [prefs, setPrefs] = useState<typeof DEFAULT_PREFS>(
    (user as any)?.notificationPrefs ?? DEFAULT_PREFS
  )
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: { name: user?.name ?? '', timezone: user?.timezone ?? 'UTC', avatarUrl: user?.avatarUrl ?? '' },
  })

  const { register: regPwd, handleSubmit: handlePwd, reset: resetPwd, formState: { errors: pwdErrors, isSubmitting: pwdSubmitting } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  })

  const profileMutation = useMutation({
    mutationFn: (data: ProfileForm & { notificationPrefs: typeof DEFAULT_PREFS }) =>
      api.patch('/auth/profile', data).then((r) => r.data.data),
    onSuccess: (updatedUser) => {
      setAuth(updatedUser, useAuthStore.getState().accessToken ?? '')
      toast.success('Profile updated!')
    },
    onError: () => toast.error('Failed to update profile'),
  })

  const passwordMutation = useMutation({
    mutationFn: (data: PasswordForm) =>
      api.patch('/auth/profile/password', { currentPassword: data.currentPassword, newPassword: data.newPassword }),
    onSuccess: () => {
      resetPwd()
      toast.success('Password changed!')
    },
    onError: () => toast.error('Current password is incorrect'),
  })

  const togglePref = (key: keyof typeof DEFAULT_PREFS, channel: 'email' | 'in_app') => {
    setPrefs((prev) => ({
      ...prev,
      [key]: { ...prev[key], [channel]: !prev[key][channel] },
    }))
  }

  const onSaveProfile = (data: ProfileForm) => {
    profileMutation.mutate({ ...data, notificationPrefs: prefs })
  }

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const res = await api.post('/auth/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const updatedUser = res.data.data
      setAuth(updatedUser, useAuthStore.getState().accessToken ?? '')
      setValue('avatarUrl', updatedUser.avatarUrl ?? '')
      toast.success('Avatar uploaded!')
    } catch {
      toast.error('Failed to upload avatar')
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (!user) return null

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Profile & Preferences" />
      <div className="p-6 max-w-2xl space-y-6">
        {/* Profile */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h2>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative group">
              <Avatar name={user.name} avatarUrl={user.avatarUrl} size="lg" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                aria-label="Upload avatar photo"
              >
                <Camera className="w-5 h-5 text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFile}
                aria-label="Avatar file input"
              />
            </div>
            <div>
              <p className="font-medium text-gray-900">{user.name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="mt-1 text-xs text-zinc-900 hover:text-zinc-700 underline disabled:opacity-50"
              >
                {avatarUploading ? 'Uploading…' : 'Upload photo'}
              </button>
            </div>
          </div>
          <form onSubmit={handleSubmit(onSaveProfile)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input {...register('name')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <input type="hidden" {...register('avatarUrl')} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <select {...register('timezone')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <Button type="submit" loading={isSubmitting || profileMutation.isPending}>Save Profile</Button>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
          <form onSubmit={handlePwd((d) => passwordMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input {...regPwd('currentPassword')} type="password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
              {pwdErrors.currentPassword && <p className="text-red-500 text-xs mt-1">{pwdErrors.currentPassword.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input {...regPwd('newPassword')} type="password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
              {pwdErrors.newPassword && <p className="text-red-500 text-xs mt-1">{pwdErrors.newPassword.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input {...regPwd('confirm')} type="password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
              {pwdErrors.confirm && <p className="text-red-500 text-xs mt-1">{pwdErrors.confirm.message}</p>}
            </div>
            <Button type="submit" variant="outline" loading={pwdSubmitting || passwordMutation.isPending}>
              Change Password
            </Button>
          </form>
        </div>

        {/* Notification Preferences */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Notification Preferences</h2>
          <p className="text-sm text-gray-500 mb-4">Choose how you want to be notified</p>
          <div className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Event</th>
                  <th className="pb-2 text-center text-xs font-medium text-gray-500 w-20">Email</th>
                  <th className="pb-2 text-center text-xs font-medium text-gray-500 w-20">In-App</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(Object.keys(DEFAULT_PREFS) as (keyof typeof DEFAULT_PREFS)[]).map((key) => (
                  <tr key={key}>
                    <td className="py-3 text-sm text-gray-700">{PREF_LABELS[key]}</td>
                    <td className="py-3 text-center">
                      <button onClick={() => togglePref(key, 'email')}
                        className={`w-10 h-5 rounded-full transition-colors ${prefs[key].email ? 'bg-zinc-900' : 'bg-gray-200'} relative`}>
                        <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform absolute top-0.5 ${prefs[key].email ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="py-3 text-center">
                      <button onClick={() => togglePref(key, 'in_app')}
                        className={`w-10 h-5 rounded-full transition-colors ${prefs[key].in_app ? 'bg-zinc-900' : 'bg-gray-200'} relative`}>
                        <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform absolute top-0.5 ${prefs[key].in_app ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <Button onClick={() => profileMutation.mutate({ name: user.name, timezone: user.timezone, notificationPrefs: prefs })}
              loading={profileMutation.isPending} size="sm">
              Save Preferences
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
