'use client'

import { useState, useCallback, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'

interface AsyncActionState {
  loading: boolean
  success: boolean
  error: string | null
}

/**
 * Hook for handling async button actions with loading, success, and error states.
 * Shows toast notifications on success/error automatically.
 *
 * Usage:
 *   const { loading, execute } = useAsyncAction()
 *   <Button onClick={() => execute(() => deployApi.approve(slug, 'prod'))} disabled={loading}>
 */
export function useAsyncAction<T = unknown>() {
  const [state, setState] = useState<AsyncActionState>({
    loading: false,
    success: false,
    error: null,
  })
  const { toast } = useToast()
  const abortRef = useRef(false)

  const execute = useCallback(
    async (
      action: () => Promise<T>,
      options?: {
        successMessage?: string
        errorMessage?: string
        onSuccess?: (data: T) => void
        onError?: (error: Error) => void
      }
    ): Promise<T | null> => {
      abortRef.current = false
      setState({ loading: true, success: false, error: null })

      try {
        const result = await action()

        if (abortRef.current) return null

        setState({ loading: false, success: true, error: null })

        toast({
          title: 'Succès',
          description: options?.successMessage ?? 'Action exécutée avec succès',
        })

        options?.onSuccess?.(result)
        return result
      } catch (err) {
        if (abortRef.current) return null

        const message =
          err instanceof Error ? err.message : 'Une erreur est survenue'

        setState({ loading: false, success: false, error: message })

        toast({
          title: 'Erreur',
          description: options?.errorMessage ?? message,
          variant: 'destructive',
        })

        options?.onError?.(err instanceof Error ? err : new Error(message))
        return null
      }
    },
    [toast]
  )

  const reset = useCallback(() => {
    abortRef.current = true
    setState({ loading: false, success: false, error: null })
  }, [])

  return {
    loading: state.loading,
    success: state.success,
    error: state.error,
    execute,
    reset,
  }
}
