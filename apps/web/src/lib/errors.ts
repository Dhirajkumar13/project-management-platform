type ErrorOverrides = Partial<Record<number | 'network' | 'default', string>>

interface AxiosLikeError {
  response?: {
    status: number
    data?: {
      message?: string
      errors?: { message: string }[]
    }
  }
}

export function getErrorMessage({
  error,
  action,
  resource,
  role,
  overrides = {},
}: {
  error: unknown
  action: string
  resource: string
  role?: string
  overrides?: ErrorOverrides
}): string {
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[API Error] ${action} ${resource}:`, error)
  }

  const axiosError = error as AxiosLikeError

  if (!axiosError?.response) {
    return overrides.network ?? 'Unable to connect to the server. Please check your internet connection.'
  }

  const { status, data } = axiosError.response
  const serverMessage = data?.message
  const firstValidationError = data?.errors?.[0]?.message

  if (overrides[status]) return overrides[status]!

  switch (status) {
    case 401:
      return 'Your session has expired. Please log in again.'

    case 403: {
      if (role === 'VIEWER') return `Viewer access cannot ${action} ${resource}.`
      if (role === 'MEMBER' && (action === 'delete' || action === 'manage')) {
        return `Only admins can ${action} ${resource}.`
      }
      return `You don't have permission to ${action} ${resource}.`
    }

    case 404:
      return `${capitalize(resource)} not found.`

    case 409:
      return serverMessage ?? `A ${resource} with this name already exists.`

    case 422:
      return firstValidationError ?? serverMessage ?? 'Invalid input. Please check the form and try again.'

    case 429:
      return 'Too many requests. Please try again later.'

    case 500:
      return 'Something went wrong on our end. Please try again.'

    default:
      if (status >= 400 && status < 500) {
        return serverMessage ?? `Unable to ${action} ${resource}.`
      }
      return overrides.default ?? 'An unexpected error occurred. Please try again.'
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
