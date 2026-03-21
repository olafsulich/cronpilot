'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { apiClient } from '@/lib/api'
import type { Integration, IntegrationCreateParams } from '@cronpilot/shared'
import { IntegrationCreateSchema } from '@cronpilot/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  Bell,
  Globe,
  Hash,
  Loader2,
  Mail,
  Plus,
  Shield,
  Trash2,
  X,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

function fetcher(path: string) {
  return apiClient.get<Integration[]>(path)
}

const INTEGRATION_ICONS: Record<string, React.ReactNode> = {
  slack: <Hash className="h-5 w-5" />,
  pagerduty: <Shield className="h-5 w-5" />,
  webhook: <Globe className="h-5 w-5" />,
  email: <Mail className="h-5 w-5" />,
}

const INTEGRATION_LABELS: Record<string, string> = {
  slack: 'Slack',
  pagerduty: 'PagerDuty',
  webhook: 'Webhook',
  email: 'Email',
}

type IntegrationType = 'slack' | 'pagerduty' | 'webhook' | 'email'

export default function IntegrationsPage() {
  const [showModal, setShowModal] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const { data: integrations = [], isLoading, mutate } = useSWR<Integration[]>(
    '/integrations',
    fetcher,
  )

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await apiClient.delete(`/integrations/${id}`)
      await mutate()
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
          <p className="text-gray-500 text-sm mt-1">
            Connect services to receive alert notifications.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add integration
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : integrations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200 border-dashed">
          <Bell className="h-10 w-10 text-gray-300 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-1">No integrations yet</h3>
          <p className="text-gray-500 text-sm mb-6">
            Add Slack, PagerDuty, or a webhook to start receiving alert notifications.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add integration
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                  {INTEGRATION_ICONS[integration.type] ?? <Bell className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{integration.name}</p>
                  <p className="text-xs text-gray-400">
                    {INTEGRATION_LABELS[integration.type]} &middot; Added{' '}
                    {formatDate(new Date(integration.createdAt))}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(integration.id)}
                disabled={deleting === integration.id}
                className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting === integration.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AddIntegrationModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            mutate()
          }}
        />
      )}
    </div>
  )
}

function AddIntegrationModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [selectedType, setSelectedType] = useState<IntegrationType>('slack')
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<IntegrationCreateParams>({
    resolver: zodResolver(IntegrationCreateSchema),
    defaultValues: { type: 'slack' },
  })

  function handleTypeChange(type: IntegrationType) {
    setSelectedType(type)
    reset({ type } as IntegrationCreateParams)
    setServerError(null)
  }

  async function onSubmit(values: IntegrationCreateParams) {
    setServerError(null)
    try {
      await apiClient.post('/integrations', values)
      onSuccess()
    } catch (err: unknown) {
      const error = err as { message?: string }
      setServerError(error.message ?? 'Failed to add integration.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Add integration</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Type selector */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            {(['slack', 'pagerduty', 'webhook', 'email'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleTypeChange(type)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-colors ${
                  selectedType === type
                    ? 'border-orange-300 bg-orange-50 text-orange-600'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <span className={selectedType === type ? 'text-orange-500' : 'text-gray-400'}>
                  {INTEGRATION_ICONS[type]}
                </span>
                {INTEGRATION_LABELS[type]}
              </button>
            ))}
          </div>

          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <input type="hidden" {...register('type')} value={selectedType} />

            <FormField label="Name" error={errors.name?.message}>
              <input
                {...register('name')}
                type="text"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
                placeholder="My Slack integration"
              />
            </FormField>

            {selectedType === 'slack' && (
              <>
                <FormField label="Webhook URL" error={(errors as { webhookUrl?: { message?: string } }).webhookUrl?.message}>
                  <input
                    {...register('webhookUrl' as keyof IntegrationCreateParams)}
                    type="url"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
                    placeholder="https://hooks.slack.com/services/..."
                  />
                </FormField>
                <FormField label="Channel" error={(errors as { channel?: { message?: string } }).channel?.message}>
                  <input
                    {...register('channel' as keyof IntegrationCreateParams)}
                    type="text"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
                    placeholder="#alerts"
                  />
                </FormField>
              </>
            )}

            {selectedType === 'pagerduty' && (
              <FormField label="Integration key" error={(errors as { integrationKey?: { message?: string } }).integrationKey?.message}>
                <input
                  {...register('integrationKey' as keyof IntegrationCreateParams)}
                  type="text"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
                  placeholder="abc123..."
                />
              </FormField>
            )}

            {selectedType === 'webhook' && (
              <>
                <FormField label="URL" error={(errors as { url?: { message?: string } }).url?.message}>
                  <input
                    {...register('url' as keyof IntegrationCreateParams)}
                    type="url"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
                    placeholder="https://example.com/webhook"
                  />
                </FormField>
                <FormField label="Signing secret" error={(errors as { secret?: { message?: string } }).secret?.message}>
                  <input
                    {...register('secret' as keyof IntegrationCreateParams)}
                    type="text"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
                    placeholder="whsec_..."
                  />
                </FormField>
              </>
            )}

            {selectedType === 'email' && (
              <FormField label="Email address" error={(errors as { address?: { message?: string } }).address?.message}>
                <input
                  {...register('address' as keyof IntegrationCreateParams)}
                  type="email"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
                  placeholder="alerts@example.com"
                />
              </FormField>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-60 transition-colors"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Adding…' : 'Add integration'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function FormField({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-red-600 text-xs mt-1.5">{error}</p>}
    </div>
  )
}
